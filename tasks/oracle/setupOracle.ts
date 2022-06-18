// npx hardhat setup_oracle --network bsctestnet
import { task } from "hardhat/config";
import { waterfall } from "../utils/waterfall";
import { VenusChainlinkOracle } from "../../src/types";
import { TypedEvent } from "../../src/types/common";
// The ABI of the old oracle has changed
import OldOracleAbi from './oldOracleAbi.json';

// fetched from https://docs.chain.link/docs/bnb-chain-addresses/
import chainlinkFeedData from './chainlink.json';

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

function deduplicateEvents(events: TypedEvent[]) {
  const map: {
    [asset: string]: TypedEvent;
  } = {};
  events.forEach((event) => {
    const asset = event.args[0];
    // ideally the events are returned in an ascending block order, but just in case...
    if (map[asset]) {
      if (event.blockNumber >= map[asset].blockNumber) {
        // console.log(`updated: ${asset}, old: ${map[asset].blockNumber} new: ${event.blockNumber}`);
        map[asset] = event;
      }
    } else {
      map[asset] = event;
    }
  });
  return Object.keys(map).map(asset => map[asset]);
}

task("setup_oracle", "Set all price feeds and prices from the old oracle to the new one", async (_taskArgs, hre) => {
  const ethers = hre.ethers;

  const { deployments, network } = hre;

  const oracleDeployment = await deployments.get('VenusChainlinkOracle');
  const ourOracleContractAddress = oracleDeployment.address;

  console.log(`network name: ${network.name}`);

  const oldOracleContractAddress = network.name === 'bsctestnet'
    ? '0x03cf8ff6262363010984b192dc654bd4825caffc'
    : '0xd8b6da2bfec71d684d3e2a2fc9492ddad5c3787f';


  // prepare contracts
  console.log(`current venus chainlink oracle contract: ${oldOracleContractAddress}`);
  const oldOracleContract = <VenusChainlinkOracle>await ethers.getContractAt(OldOracleAbi, oldOracleContractAddress);

  console.log(`our venus chainlink oracle contract: ${ourOracleContractAddress}`);
  const ourOracleContract = <VenusChainlinkOracle>await ethers.getContractAt('VenusChainlinkOracle', ourOracleContractAddress);

  const oldAdmin = await oldOracleContract.functions.admin();
  console.log(`old admin: ${oldAdmin}`);

  const ourAdmin = await ourOracleContract.functions.admin();
  console.log(`our admin: ${ourAdmin}`);


  // fetch all previous price update events and apply all events to new contract
  const pricePostedEvents = await oldOracleContract.queryFilter(oldOracleContract.filters.PricePosted());
  const feedSetEvents = (await oldOracleContract.queryFilter(oldOracleContract.filters.FeedSet()));

  const dedupedPricePostedEvents = deduplicateEvents(pricePostedEvents).map(e => e.args);
  let dedupedFeedSetEvents = deduplicateEvents(feedSetEvents).map(e => {
    return { ...e.args, transactionHash: e.transactionHash }
  });

  // set stale period a little longer than heartbeat
  const patchedChainlinkData = patchChainlinkData(chainlinkFeedData as unknown as ChainlinkFeedData); 
  
  const { proxyMap } = patchedChainlinkData[network.name === 'bsctestnet' ? 'testnet' : 'mainnet'];

  dedupedFeedSetEvents = dedupedFeedSetEvents.map(event => {
    if (!proxyMap[event.feed]) {
      console.log(`invalid event: ${event.transactionHash}, feed: ${event.feed}`)
      return;
    }
    return {
      ...event,
      heartbeat: proxyMap[event.feed].heartbeat,
      stalePeriod: parseHeartbeatTime(proxyMap[event.feed].heartbeat) + HEARTBEAT_OFFSET
    }
  })

  dedupedFeedSetEvents = dedupedFeedSetEvents.filter(Boolean);

  console.log('feed set events:', dedupedFeedSetEvents);
  console.log('price posted events:', dedupedPricePostedEvents.length);

  // apply events
  await waterfall([
    // function batchSetFeed(string[] symbol, address[] feed, uint[] stalePeriods)
    () => {
      return ourOracleContract.batchSetFeeds(
        dedupedFeedSetEvents.map(e => e.symbol),
        dedupedFeedSetEvents.map(e => e.feed),
        dedupedFeedSetEvents.map(e => e.stalePeriod),
      )
    },
    // function setDirectPrice(address asset, uint price)
    ...(dedupedPricePostedEvents.map(event => {
      return async () => {
        console.log('set direct price:', event.asset, event.newPriceMantissa.toString());
        const tx = await ourOracleContract.setDirectPrice(event.asset, event.newPriceMantissa);
        await tx.wait();
        console.log('done set direct price', event.asset, event.newPriceMantissa.toString());
      }
    })),
  ])
});
