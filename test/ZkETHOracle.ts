import { FakeContract, smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { BEP20Harness, IZkETH, ResilientOracleInterface, ZkETHOracle, ZkETHOracle__factory } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { WETH, zkETH } = ADDRESSES.zksyncmainnet;
const WETH_USD_PRICE = parseUnits("2700", 18);

describe("ZkETHOracle", () => {
  let zkETHMock: FakeContract<IZkETH>;
  let resilientOracleMock: FakeContract<ResilientOracleInterface>;
  let zkETHOracleFactory: ZkETHOracle__factory;
  let zkETHOracle: ZkETHOracle;
  let wethMock: FakeContract<BEP20Harness>;

  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");

    zkETHMock = await smock.fake<IZkETH>("IZkETH", { address: zkETH });
    zkETHMock.LSTPerToken.returns(parseUnits("1.1", 18));
    zkETHMock.decimals.returns(18);

    wethMock = await smock.fake<BEP20Harness>("BEP20Harness", { address: WETH });
    wethMock.decimals.returns(18);

    zkETHOracleFactory = <ZkETHOracle__factory>await ethers.getContractFactory("ZkETHOracle");
  });

  describe("deployment", () => {
    it("revert if WETH address is 0", async () => {
      await expect(zkETHOracleFactory.deploy(zkETHMock.address, addr0000, resilientOracleMock.address)).to.be.reverted;
    });

    it("revert if zkETH address is 0", async () => {
      await expect(zkETHOracleFactory.deploy(addr0000, wethMock.address, resilientOracleMock.address)).to.be.reverted;
    });

    it("should deploy contract", async () => {
      zkETHOracle = await zkETHOracleFactory.deploy(zkETHMock.address, wethMock.address, resilientOracleMock.address);
    });
  });

  describe("getPrice", () => {
    it("revert if address is not valid zkETH address", async () => {
      await expect(zkETHOracle.getPrice(addr0000)).to.be.revertedWithCustomError(zkETHOracle, "InvalidTokenAddress");
    });

    it("should get correct price of zkETH", async () => {
      resilientOracleMock.getPrice.returns(WETH_USD_PRICE);
      const price = await zkETHOracle.getPrice(zkETHMock.address);
      expect(price).to.equal(parseUnits("2970", 18));
    });
  });
});
