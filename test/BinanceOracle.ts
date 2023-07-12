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

    this.vEth = await makeVToken(admin, { name: "vETH", symbol: "vETH" }, { name: "Ethereum", symbol: "ETH" });
    this.vBnb = await makeVToken(admin, { name: "vBNB", symbol: "vBNB" }, { name: "Binance", symbol: "BNB" });
    this.vWBnb = await makeVToken(admin, { name: "vWBNB", symbol: "vWBNB" }, { name: "Binance WBNB", symbol: "WBNB" });
    this.wbeth = await makeVToken(
      admin,
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

    const binanceOracle = await ethers.getContractFactory("BinanceOracle", admin);
    this.binanceOracle = <BinanceOracle>await upgrades.deployProxy(
      binanceOracle,
      [sidRegistry.address, fakeAccessControlManager.address],
      {
        constructorArgs: [await this.vWBnb.underlying(), "0x0000000000000000000000000000000000000348"],
      },
    );

    await this.binanceOracle.setMaxStalePeriod("ETH", 24 * 60 * 60);
    await this.binanceOracle.setMaxStalePeriod("WBNB", 24 * 60 * 60);
    await this.binanceOracle.setMaxStalePeriod("wBETH", 24 * 60 * 60);
  });

  it("set price", async function () {
    this.mockBinanceFeedRegistry.setAssetPrice(await this.vEth.underlying(), this.ethPrice);
    expect(await this.mockBinanceFeedRegistry.assetPrices(await this.vEth.underlying())).to.be.equal(this.ethPrice);
  });

  it("fetch price", async function () {
    expect(await this.binanceOracle.getPrice(this.vEth.underlying())).to.be.equal("1333789241690000000000");
  });

  it("fetch BNB price", async function () {
    this.mockBinanceFeedRegistry.setAssetPrice(await this.vWBnb.underlying(), this.bnbPrice);
    expect(await this.binanceOracle.getPrice("0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB")).to.be.equal(
      "245980000000000000000",
    );
  });

  it("price expired", async function () {
    await this.binanceOracle.setMaxStalePeriod("ETH", 5);
    await this.binanceOracle.setMaxStalePeriod("WBNB", 5);

    await expect(this.binanceOracle.getPrice(this.vEth.underlying())).to.be.revertedWith(
      "binance oracle price expired",
    );
    await expect(this.binanceOracle.getPrice("0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB")).to.be.revertedWith(
      "binance oracle price expired",
    );
  });

  it("set WBETH price", async function () {
    this.mockBinanceFeedRegistry.setAssetPrice(await this.wbeth.underlying(), this.wbethPrice);
    expect(await this.mockBinanceFeedRegistry.assetPrices(await this.wbeth.underlying())).to.be.equal(this.wbethPrice);
  });

  it("fetch WBETH price", async function () {
    expect(await this.binanceOracle.getPrice(await this.wbeth.underlying())).to.be.equal("1333789241690000000000");
  });

  it("fetch WBNB price", async function () {
    await this.binanceOracle.setMaxStalePeriod("WBNB", 24 * 60 * 60);
    expect(await this.binanceOracle.getPrice(await this.vWBnb.underlying())).to.be.equal("245980000000000000000");
  });
});
