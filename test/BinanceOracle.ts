import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";
import { BinanceOracle, MockBinanceFeedRegistry } from "../src/types";
import { ChainlinkOracle } from "../src/types/contracts/oracles/ChainlinkOracle";
import { addr0000 } from "./utils/data";

import { makeChainlinkOracle } from "./utils/makeChainlinkOracle";
import { makeVToken } from "./utils/makeVToken";
import { getTime, increaseTime } from "./utils/time";

const MAX_STALE_PERIOD = 60 * 15; // 15min

describe("Binance Oracle unit tests", function () {
  before(async function () {

    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.signers = signers;
    this.admin = admin;

    this.vEth = await makeVToken(admin, { name: "vETH", symbol: "vETH" }, { name: "Ethereum", symbol: "ETH" });
    this.ethPrice = "133378924169" //$1333.78924169

    const MockBinanceFeedRegistry = await ethers.getContractFactory("MockBinanceFeedRegistry", admin);
    this.mockBinanceFeedRegistry = <MockBinanceFeedRegistry>await upgrades.deployProxy(MockBinanceFeedRegistry, []);

    const BinanceOracle = await ethers.getContractFactory("BinanceOracle", admin);
    this.binanceOracle = <BinanceOracle>await upgrades.deployProxy(BinanceOracle, [
      this.mockBinanceFeedRegistry.address
    ]);
  });

  it("set price", async function () {
    this.mockBinanceFeedRegistry.setAssetPrice("ETH", this.ethPrice)
    expect(await this.mockBinanceFeedRegistry.assetPrices("ETH")).to.be.equal(this.ethPrice)
  });

  it("fetch price", async function () {
    expect(await this.binanceOracle.getUnderlyingPrice(this.vEth.address)).to.be.equal(this.ethPrice)
  });
})