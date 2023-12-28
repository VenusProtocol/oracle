import { smock } from "@defi-wonderland/smock";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

import { AccessControlManager, BinanceOracle, MockBinanceFeedRegistry } from "../typechain-types";
import { makeVToken } from "./utils/makeVToken";

describe("Binance Oracle unit tests", () => {
  before(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.signers = signers;
    this.admin = admin;
    this.vai = signers[5].address;

    this.vEth = await makeVToken({ name: "vETH", symbol: "vETH" }, { name: "Ethereum", symbol: "ETH" });
    this.vBnb = await makeVToken({ name: "vBNB", symbol: "vBNB" }, { name: "Binance", symbol: "BNB" });
    this.wbeth = await makeVToken(
      { name: "vWBETH", symbol: "vWBETH" },
      { name: "Wrapped Beacon ETH", symbol: "wBETH" },
    );
    this.ethPrice = "133378924169"; // $1333.78924169
    this.bnbPrice = "24598000000"; // $245.98
    this.wbethPrice = "133378924169"; // $1333.78924169

    const mockBinanceFeedRegistry = await ethers.getContractFactory("MockBinanceFeedRegistry", admin);
    this.mockBinanceFeedRegistry = <MockBinanceFeedRegistry>await upgrades.deployProxy(mockBinanceFeedRegistry, []);

    const publicResolver = await smock.fake("PublicResolverInterface");
    const sidRegistry = await smock.fake("SIDRegistryInterface");
    sidRegistry.resolver.returns(publicResolver.address);
    publicResolver.addr.returns(this.mockBinanceFeedRegistry.address);

    const fakeAccessControlManager = await smock.fake<AccessControlManager>("AccessControlManagerScenario");
    fakeAccessControlManager.isAllowedToCall.returns(true);
    this.fakeAccessControlManager = fakeAccessControlManager;

    const binanceOracle = await ethers.getContractFactory("BinanceOracle", admin);
    this.binanceOracle = <BinanceOracle>await upgrades.deployProxy(
      binanceOracle,
      [sidRegistry.address, fakeAccessControlManager.address],
      {
        constructorArgs: [],
      },
    );

    await this.binanceOracle.setMaxStalePeriod("ETH", 24 * 60 * 60);
    await this.binanceOracle.setMaxStalePeriod("BNB", 24 * 60 * 60);
    await this.binanceOracle.setMaxStalePeriod("WBETH", 24 * 60 * 60);

    await this.binanceOracle.setSymbolOverride("WBNB", "BNB");
    await this.binanceOracle.setSymbolOverride("wBETH", "WBETH");
  });

  it("set price", async function () {
    this.mockBinanceFeedRegistry.setAssetPrice("ETH", this.ethPrice);
    expect((await this.mockBinanceFeedRegistry.assetPrices("ETH")).toString()).to.be.equal(this.ethPrice);
  });

  it("set BNB price", async function () {
    this.mockBinanceFeedRegistry.setAssetPrice("BNB", this.bnbPrice);
    expect((await this.mockBinanceFeedRegistry.assetPrices("BNB")).toString()).to.be.equal(this.bnbPrice);
  });

  it("fetch price", async function () {
    expect((await this.binanceOracle.getPrice(this.vEth.underlying())).toString()).to.be.equal(
      "1333789241690000000000",
    );
    expect((await this.binanceOracle.getPrice(this.vBnb.underlying())).toString()).to.be.equal("245980000000000000000");
  });

  it("fetch BNB price", async function () {
    expect((await this.binanceOracle.getPrice(this.vBnb.underlying())).toString()).to.be.equal("245980000000000000000");
  });

  it("price expired", async function () {
    await this.binanceOracle.setMaxStalePeriod("ETH", 5);
    await this.binanceOracle.setMaxStalePeriod("BNB", 5);

    await expect(this.binanceOracle.getPrice(this.vEth.underlying())).to.be.revertedWith(
      "binance oracle price expired",
    );
    await expect(this.binanceOracle.getPrice(this.vBnb.underlying())).to.be.revertedWith(
      "binance oracle price expired",
    );
  });

  it("set WBETH price", async function () {
    await this.mockBinanceFeedRegistry.setAssetPrice("WBETH", this.wbethPrice);
    expect((await this.mockBinanceFeedRegistry.assetPrices("WBETH")).toString()).to.be.equal(this.wbethPrice);
  });

  it("fetch WBETH price", async function () {
    expect((await this.binanceOracle.getPrice(this.wbeth.underlying())).toString()).to.be.equal(
      "1333789241690000000000",
    );
  });

  it("revert when setting feed registry address and sid already available", async function () {
    await expect(this.binanceOracle.setFeedRegistryAddress(this.mockBinanceFeedRegistry.address)).to.be.revertedWith(
      "sidRegistryAddress must be zero",
    );
  });

  it("revert when feed registry address is zero", async function () {
    const binanceOracle = await ethers.getContractFactory("BinanceOracle", this.admin);
    this.binanceOracle = <BinanceOracle>await upgrades.deployProxy(
      binanceOracle,
      [ethers.constants.AddressZero, this.fakeAccessControlManager.address],
      {
        constructorArgs: [],
      },
    );

    await expect(this.binanceOracle.setFeedRegistryAddress(ethers.constants.AddressZero)).to.be.revertedWith(
      "can't be zero address",
    );
  });

  it("fetch price from direct feed registry ", async function () {
    await this.binanceOracle.setMaxStalePeriod("ETH", 24 * 60 * 60);
    await this.binanceOracle.setFeedRegistryAddress(this.mockBinanceFeedRegistry.address);
    this.mockBinanceFeedRegistry.setAssetPrice("ETH", this.ethPrice);
    expect((await this.mockBinanceFeedRegistry.assetPrices("ETH")).toString()).to.be.equal(this.ethPrice);
    expect((await this.binanceOracle.getPrice(this.vEth.underlying())).toString()).to.be.equal(
      "1333789241690000000000",
    );
  });
});
