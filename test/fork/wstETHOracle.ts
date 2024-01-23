/* eslint-disable no-restricted-syntax */
import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { Contract } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import { contracts as ethereum } from "../../deployments/ethereum.json";
import { contracts as sepolia } from "../../deployments/sepolia.json";
import { ADDRESSES, assets } from "../../helpers/deploymentConfig";
import { ResilientOracle, WstETHOracle__factory } from "../../typechain-types";
import { TokenConfigStruct } from "../../typechain-types/contracts/ResilientOracle";
import { WstETHOracle } from "../../typechain-types/contracts/oracles/WstETHOracle";
import { addr0000 } from "../utils/data";
import WSTETH_ABI from "./abi/wstETH.json";
import { forking, initMainnetUser } from "./utils";

const { expect } = chai;
chai.use(smock.matchers);

type BlockConfig = {
  [key: string]: number;
};

const FORK: boolean = process.env.FORK === "true";
const FORKED_NETWORK: string = process.env.FORKED_NETWORK || "";
const WETH_USD_PRICE_DENOMINATOR = parseUnits("1", 18);

// NOTE: in order to test the configuration, the blockNumber should be after the configuration transaction took place
if (FORK && (FORKED_NETWORK === "ethereum" || FORKED_NETWORK === "sepolia")) {
  const oracleAddress = {
    ethereum: ethereum.ResilientOracle.address,
    sepolia: sepolia.ResilientOracle.address,
  };

  const { stETHAddress, wstETHAddress, timelock } = ADDRESSES[FORKED_NETWORK];

  const WETHAsset = assets[FORKED_NETWORK].find(asset => asset.token === "WETH");
  const WETHAddress = WETHAsset?.address ?? addr0000;

  const blockNumberPerNetwork: BlockConfig = {
    ethereum: 19000000,
    sepolia: 5000000,
  };

  const blockNumer = blockNumberPerNetwork[FORKED_NETWORK];
  forking(blockNumer, () => {
    let oracle: ResilientOracle;
    let wstETHOracle: WstETHOracle;
    let wstETH: Contract;
    describe(`Price configuration validation for network ${FORKED_NETWORK}`, () => {
      before(async () => {
        oracle = await ethers.getContractAt("ResilientOracle", oracleAddress[FORKED_NETWORK]);
        wstETH = await ethers.getContractAt(WSTETH_ABI, wstETHAddress);
        const WstETHOracleFactory: WstETHOracle__factory = await ethers.getContractFactory("WstETHOracle");
        wstETHOracle = await upgrades.deployProxy(WstETHOracleFactory, [], {
          constructorArgs: [wstETHAddress, WETHAddress, stETHAddress, oracle.address],
        });
        const impersonatedContractAdmin = await initMainnetUser(timelock, ethers.utils.parseUnits("2"));

        const tokenConfig: TokenConfigStruct = {
          asset: wstETHAddress,
          oracles: [wstETHOracle.address, addr0000, addr0000],
          enableFlagsForOracles: [true, false, false],
        };

        await oracle.connect(impersonatedContractAdmin).setTokenConfig(tokenConfig);
      });

      it("Validate price for wstETH", async () => {
        const WETH_USD_PRICE = await oracle.getPrice(WETHAddress);
        const STETH_AMOUNT_FOR_ONE_WSTETH = await wstETH.stEthPerToken();
        const expectedPrice = WETH_USD_PRICE.mul(STETH_AMOUNT_FOR_ONE_WSTETH).div(WETH_USD_PRICE_DENOMINATOR);
        expect(await oracle.getPrice(wstETHAddress)).to.equal(expectedPrice);
      });
    });
  });
}
