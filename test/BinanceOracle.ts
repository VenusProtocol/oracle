import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

import { BinanceOracle, MockBinanceFeedRegistry } from "../typechain-types";
import { makeVToken } from "./utils/makeVToken";

describe("Binance Oracle unit tests", function () {
  before(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.signers = signers;
    this.admin = admin;
    this.vBnb = signers[5].address;

    this.vEth = await makeVToken(admin, { name: "vETH", symbol: "vETH" }, { name: "Ethereum", symbol: "ETH" });
    this.ethPrice = "133378924169"; //$1333.78924169
    this.bnbPrice = "24598000000"; //$245.98

    const MockBinanceFeedRegistry = await ethers.getContractFactory("MockBinanceFeedRegistry", admin);
    this.mockBinanceFeedRegistry = <MockBinanceFeedRegistry>await upgrades.deployProxy(MockBinanceFeedRegistry, []);

    const BinanceOracle = await ethers.getContractFactory("BinanceOracle", admin);
    console.log(this.vBnb);
    this.binanceOracle = <BinanceOracle>await upgrades.deployProxy(
      BinanceOracle,
      [this.mockBinanceFeedRegistry.address],
      {
        constructorArgs: [this.vBnb],
      },
    );
  });

  it("set price", async function () {
    this.mockBinanceFeedRegistry.setAssetPrice("ETH", this.ethPrice);
    expect(await this.mockBinanceFeedRegistry.assetPrices("ETH")).to.be.equal(this.ethPrice);
  });

  it("set BNB price", async function () {
    this.mockBinanceFeedRegistry.setAssetPrice("BNB", this.bnbPrice);
    expect(await this.mockBinanceFeedRegistry.assetPrices("BNB")).to.be.equal(this.bnbPrice);
  });

  it("fetch price", async function () {
    expect(await this.binanceOracle.getUnderlyingPrice(this.vEth.address)).to.be.equal("1333789241690000000000");
    expect(await this.binanceOracle.getUnderlyingPrice(this.vBnb)).to.be.equal("245980000000000000000");
  });

  it("fetch BNB price", async function () {
    expect(await this.binanceOracle.getUnderlyingPrice(this.vBnb)).to.be.equal("245980000000000000000");
  });
});
