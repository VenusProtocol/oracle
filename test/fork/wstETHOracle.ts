/* eslint-disable no-restricted-syntax */
import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { Contract } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import { contracts as ethereum } from "../../deployments/ethereum.json";
import { contracts as sepolia } from "../../deployments/sepolia.json";
import { ResilientOracle, WstETHOracle__factory } from "../../typechain-types";
import { TokenConfigStruct } from "../../typechain-types/contracts/ResilientOracle";
import { WstETHOracle } from "../../typechain-types/contracts/oracles/WstETHOracle";
import { addr0000 } from "../utils/data";
import WSTETH_ABI from "./abi/wstETH.json";
import { forking, initMainnetUser } from "./utils";

const { expect } = chai;
chai.use(smock.matchers);

const FORK: boolean = process.env.FORK === "true";
const FORKED_NETWORK: string = process.env.FORKED_NETWORK || "";
const WETH_USD_PRICE_DENOMINATOR = parseUnits("1", 18);

const oracleAddress = {
  ethereum: ethereum.ResilientOracle.address,
  sepolia: sepolia.ResilientOracle.address,
};

type BlockConfig = {
  [key: string]: number;
};

type AddressConfig = {
  [key: string]: string;
};

const stETHAddress: AddressConfig = {
  ethereum: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
  sepolia: "0xF5465B70Af90AEb26Aa13b1000a8CbEA53a5f4cf",
};

const wstETHAddress: AddressConfig = {
  ethereum: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
  sepolia: "0x9b87ea90fdb55e1a0f17fbeddcf7eb0ac4d50493",
};

const WETHAddress: AddressConfig = {
  ethereum: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  sepolia: "0x700868CAbb60e90d77B6588ce072d9859ec8E281",
};

const contractAdmin: AddressConfig = {
  ethereum: "0x285960C5B22fD66A736C7136967A3eB15e93CC67",
  sepolia: "0x94fa6078b6b8a26f0b6edffbe6501b22a10470fb",
};

const blockNumberPerNetwork: BlockConfig = {
  ethereum: 19000000,
  sepolia: 5000000,
};

const blockNumer = blockNumberPerNetwork[FORKED_NETWORK];

// NOTE: in order to test the configuration, the blockNumber should be after the configuration transaction took place
if (FORK && (FORKED_NETWORK === "ethereum" || FORKED_NETWORK === "sepolia")) {
  forking(blockNumer, () => {
    let oracle: ResilientOracle;
    let wstETHOracle: WstETHOracle;
    let wstETH: Contract;
    describe(`Price configuration validation for network ${FORKED_NETWORK}`, () => {
      before(async () => {
        oracle = await ethers.getContractAt("ResilientOracle", oracleAddress[FORKED_NETWORK]);
        wstETH = await ethers.getContractAt(WSTETH_ABI, wstETHAddress[FORKED_NETWORK]);
        const WstETHOracleFactory: WstETHOracle__factory = await ethers.getContractFactory("WstETHOracle");
        wstETHOracle = await upgrades.deployProxy(WstETHOracleFactory, [], {
          constructorArgs: [
            wstETHAddress[FORKED_NETWORK],
            WETHAddress[FORKED_NETWORK],
            stETHAddress[FORKED_NETWORK],
            oracle.address,
          ],
        });
        const impersonatedContractAdmin = await initMainnetUser(
          contractAdmin[FORKED_NETWORK],
          ethers.utils.parseUnits("2"),
        );

        const tokenConfig: TokenConfigStruct = {
          asset: wstETHAddress[FORKED_NETWORK],
          oracles: [wstETHOracle.address, addr0000, addr0000],
          enableFlagsForOracles: [true, false, false],
        };

        await oracle.connect(impersonatedContractAdmin).setTokenConfig(tokenConfig);
      });

      it("Validate price for wstETH", async () => {
        const WETH_USD_PRICE = await oracle.getPrice(WETHAddress[FORKED_NETWORK]);
        const STETH_AMOUNT_FOR_ONE_WSTETH = await wstETH.stEthPerToken();
        const expectedPrice = WETH_USD_PRICE.mul(STETH_AMOUNT_FOR_ONE_WSTETH).div(WETH_USD_PRICE_DENOMINATOR);
        expect(await oracle.getPrice(wstETHAddress[FORKED_NETWORK])).to.equal(expectedPrice);
      });
    });
  });
}
