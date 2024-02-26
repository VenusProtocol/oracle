import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { IEETH, IWeETH, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { weETH, eETH } = ADDRESSES.ethereum;
const ETH_USD_PRICE = parseUnits("3100", 18); // 3100 USD for 1 ETH

describe("EtherFiOracle unit tests", () => {
  let weETHMock;
  let resilientOracleMock;
  let eETHMock;
  let EtherFiOracleFactory;
  let EtherFiOracle;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(ETH_USD_PRICE);

    weETHMock = await smock.fake<IWeETH>("IWeETH", { address: weETH });
    eETHMock = await smock.fake<IEETH>("IEETH", { address: eETH });

    weETHMock.getEETHByWeETH.returns(parseUnits("1.032226887617316822", 18));
    eETHMock.totalShares.returns(parseUnits("466507.083658021168798142", 18));
    eETHMock.totalSupply.returns(parseUnits("481541.155015750434162055", 18));

    EtherFiOracleFactory = await ethers.getContractFactory("EtherFiOracle");
  });

  describe("deployment", () => {
    it("revert if weETH address is 0", async () => {
      await expect(EtherFiOracleFactory.deploy(addr0000, eETHMock.address, resilientOracleMock.address)).to.be.reverted;
    });
    it("revert if eETH address is 0", async () => {
      await expect(EtherFiOracleFactory.deploy(weETHMock.address, addr0000, resilientOracleMock.address)).to.be
        .reverted;
    });
    it("revert if resilient oracle address is 0", async () => {
      await expect(EtherFiOracleFactory.deploy(weETHMock.address, eETHMock.address, addr0000)).to.be.reverted;
    });
    it("should deploy contract", async () => {
      EtherFiOracle = await EtherFiOracleFactory.deploy(
        weETHMock.address,
        eETHMock.address,
        resilientOracleMock.address,
      );
    });
  });

  describe("getPrice", () => {
    it("revert if address is not valid weETH or eETH address", async () => {
      await expect(EtherFiOracle.getPrice(addr0000)).to.be.revertedWith("wrong eETH or weETH asset address");
    });

    it("should get correct price of eETH", async () => {
      const price = await EtherFiOracle.getPrice(eETHMock.address);
      expect(price).to.equal(parseUnits("3003.2157049848910035", 18));
    });

    it("should get correct price of weETH", async () => {
      const price = await EtherFiOracle.getPrice(weETHMock.address);
      expect(price).to.equal(parseUnits("3099.9999999999999969", 18));
    });
  });
});
