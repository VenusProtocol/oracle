// npx hardhat setup_oracle --network bsctestnet
import { task } from "hardhat/config";
// The ABI of the old oracle has changed
import OldOracleAbi from './oldOracleAbi.json';
import ComptrollerAbi from './comptroller.json';


// fetched from https://docs.chain.link/docs/bnb-chain-addresses/
import chainlinkFeedData from './chainlink.json';
import { waterfall } from "../utils/waterfall";
import { ChainlinkOracle } from "../../src/types/contracts/oracles/ChainlinkOracle";

type ChainlinkFeedProxyItem = {
  pair: string,
  assetName: string,
  deviationThreshold: number,
  heartbeat: string, // 24h, 1h, ...
  decimals: number,
  proxy: string,
  feedCategory: string,
  feedType: string,
};

type ChainlinkFeedDataItem = {
  name: string,
  url: string,
  networkType: string,
  proxies: Array<ChainlinkFeedProxyItem>
};

interface PatchedChainlinkFeedDataItem extends ChainlinkFeedDataItem {
  proxyMap: {
    [proxy: string]: ChainlinkFeedProxyItem
  }
}

type ChainlinkFeedData = [ChainlinkFeedDataItem, ChainlinkFeedDataItem];

const HEARTBEAT_OFFSET = 120; // 2 mins

// patch chainlink data
function patchChainlinkData(data: ChainlinkFeedData) {
  const dataMap = data.reduce((target, item: ChainlinkFeedDataItem) => {
    target[item.networkType] = {
      ...item,
      proxyMap: item.proxies.reduce((targetInner, proxy: ChainlinkFeedProxyItem) => {
        targetInner[proxy.proxy] = proxy;
        return targetInner;
      }, {} as { [proxy: string]: ChainlinkFeedProxyItem })
    };
    return target;
  }, {} as { [networkName: string]: PatchedChainlinkFeedDataItem })
  return dataMap;
}

function parseHeartbeatTime(t: string): number {
  if (t.includes('h')) {
    return parseInt(t.replace('h', '')) * 3600;
  }
  if (t.includes('m')) {
    return parseInt(t.replace('m', '')) * 60;
  }
  return 0;
}


task("setup_oracle", "Set all price feeds and prices from the old oracle to the new one", async (_taskArgs, hre) => {
  const ethers = hre.ethers;
  const artifacts = hre.artifacts;

  const { deployments, network } = hre;

  const oracleDeployment = await deployments.get('ChainlinkOracle');
  const ourOracleContractAddress = oracleDeployment.address;

  console.log(`network name: ${network.name}`);

  const oldOracleContractAddress = network.name === 'bsctestnet'
    ? '0x03cf8ff6262363010984b192dc654bd4825caffc'
    : '0xd8b6da2bfec71d684d3e2a2fc9492ddad5c3787f';
  
  const comptrollerContractAddress = network.name === 'bsctestnet'
    ? '0x94d1820b2D1c7c7452A163983Dc888CEC546b77D'
    : '0xfd36e2c2a6789db23113685031d7f16329158384';


  // prepare contracts
  console.log(`comptroller contract: ${comptrollerContractAddress}`);
  const comptrollerContract = await ethers.getContractAt(ComptrollerAbi, comptrollerContractAddress);
  const allMarkets: string[] = await comptrollerContract.getAllMarkets();
  console.log(`total markat count: ${allMarkets.length}`);

  
  console.log(`current venus chainlink oracle contract: ${oldOracleContractAddress}`);
  const oldOracleContract = await ethers.getContractAt(OldOracleAbi, oldOracleContractAddress);

  console.log(`our venus chainlink oracle contract: ${ourOracleContractAddress}`);
  const ourOracleContract = <ChainlinkOracle>await ethers.getContractAt('ChainlinkOracle', ourOracleContractAddress);

  const oldAdmin = await oldOracleContract.functions.admin();
  console.log(`old admin: ${oldAdmin}`);

  const ourAdmin = await ourOracleContract.functions.owner();
  console.log(`our admin: ${ourAdmin}`);

  // set stale period a little longer than heartbeat
  const patchedChainlinkData = patchChainlinkData(chainlinkFeedData as unknown as ChainlinkFeedData); 
  
  const { proxyMap } = patchedChainlinkData[network.name === 'bsctestnet' ? 'testnet' : 'mainnet'];

  // get feeds
  const metadata = (await Promise.all(allMarkets.map(async market => {
    const vTokenContract = await ethers.getContractAt(await (await artifacts.readArtifact('VBep20Interface')).abi, market);
    const vTokenSymbol = await vTokenContract.symbol();
    let feed: string = '';
    let symbol: string = '';
    let directPrice = ethers.BigNumber.from(0);
    if (vTokenSymbol !== 'vBNB') {
      const underlyingAddress = await vTokenContract.underlying();
      const underlyingTokenContract = await ethers.getContractAt(await (await artifacts.readArtifact('BEP20Interface')).abi, underlyingAddress);
      const underlyingSymbol = await underlyingTokenContract.symbol();
      feed = await oldOracleContract.getFeed(underlyingSymbol);
      symbol = underlyingSymbol;
      directPrice = await oldOracleContract.assetPrices(underlyingAddress);
    } else {
      symbol = 'vBNB';
      feed = await oldOracleContract.getFeed(symbol);
    }
    // @todo: XVS is manually set right now

    // get direct price
    if (feed === '0x0000000000000000000000000000000000000000') {
      return {
        feed: '', symbol, market, 
        directPrice,
        heartbeat: 0, stalePeriod: 120
      };
    }
    if (!proxyMap[feed]) {
      console.log(`${symbol} is deprecated from Chainlink`);
      return {
        feed: '', symbol, market, directPrice,
        heartbeat: 0, stalePeriod: 120
      }
    }
    return {
      feed, symbol, market, 
      directPrice,
      heartbeat: proxyMap[feed].heartbeat, 
      stalePeriod: parseHeartbeatTime(proxyMap[feed].heartbeat) + 120 // plus 2 mins to heartbeat
    }
  }))).filter(Boolean)

  console.log(metadata)

  const validFeedData = metadata.filter(e => !!e.feed)

  // apply events
  await waterfall([
    // function batchSetFeed(string[] assets, address[] feeds, uint[] stalePeriods)
    () => {
      return ourOracleContract.setTokenConfigs(validFeedData.map(e => ({
        vToken: e.market,
        feed: e.feed,
        maxStalePeriod: e.stalePeriod
      })));
    },
    // function setDirectPrice(address asset, uint price)
    ...(metadata.filter(i => i.directPrice.gt(0)).map(data => {
      return async () => {
        console.log('set underlying price:', data.symbol, data.directPrice);
        const tx = await ourOracleContract.setUnderlyingPrice(data.market, data.directPrice);
        await tx.wait();
        console.log('done set direct price');
      }
    })),
  ])
});
