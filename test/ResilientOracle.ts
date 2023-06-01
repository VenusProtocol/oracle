import { smock } from "@defi-wonderland/smock";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { ethers, upgrades } from "hardhat";

import { AccessControlManager, BoundValidator, ChainlinkOracle, ResilientOracle } from "../typechain-types";
import { addr0000, addr1111, getSimpleAddress } from "./utils/data";
import { makeVToken } from "./utils/makeVToken";

const { expect } = chai;
chai.use(smock.matchers);

const getChainlinkOracle = async () => {
  const oracle = await smock.fake<ChainlinkOracle>("ChainlinkOracle");
  return oracle;
};

const getMockSimpleOracleOracle = async () => {
  const oracleFactory = await ethers.getContractFactory("MockSimpleOracle");
  const oracle = await oracleFactory.deploy();
  return oracle;
};

const getBoundValidator = async () => {
  const boundValidator = await smock.fake<BoundValidator>("BoundValidator");
  return boundValidator;
};

describe("Oracle plugin frame unit tests", () => {
  before(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.signers = signers;
    this.admin = admin;
    this.mainOracle = await getChainlinkOracle();
    this.pivotOracle = await getChainlinkOracle();
    this.fallbackOracle = await getChainlinkOracle();
    this.boundValidator = await getBoundValidator();
    this.simpleOracle = await getMockSimpleOracleOracle();
    this.vBnb = signers[5].address;
    this.vai = signers[6].address;
    this.bnbAddr = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
  });

  beforeEach(async function () {
    const fakeAccessControlManager = await smock.fake<AccessControlManager>("AccessControlManagerScenario");
    fakeAccessControlManager.isAllowedToCall.returns(true);

    const resilientOracle = await ethers.getContractFactory("ResilientOracle", this.admin);
    const instance = <ResilientOracle>await upgrades.deployProxy(resilientOracle, [fakeAccessControlManager.address], {
      constructorArgs: [this.vBnb, this.vai, this.boundValidator.address],
    });
    this.oracleBasement = instance;
  });

  describe("token config", () => {
    describe("add single token config", () => {
      it("vToken can\"t be zero & main oracle can't be zero", async function () {
        await expect(
          this.oracleBasement.setTokenConfig({
            asset: addr0000,
            oracles: [addr1111, addr1111, addr1111],
            enableFlagsForOracles: [true, false, true],
          }),
        ).to.be.revertedWith("can't be zero address");

        await expect(
          this.oracleBasement.setTokenConfig({
            asset: addr1111,
            oracles: [addr0000, addr1111, addr0000],
            enableFlagsForOracles: [true, false, true],
          }),
        ).to.be.revertedWith("can't be zero address");
      });

      it("reset token config", async function () {
        const vToken = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const asset = await vToken.underlying();

        await this.oracleBasement.setTokenConfig({
          asset,
          oracles: [addr1111, addr1111, addr1111],
          enableFlagsForOracles: [true, false, true],
        });
        expect((await this.oracleBasement.getTokenConfig(asset)).enableFlagsForOracles[0]).to.equal(true);
        await this.oracleBasement.setTokenConfig({
          asset,
          oracles: [addr1111, addr0000, addr0000],
          enableFlagsForOracles: [false, false, true],
        });
        expect((await this.oracleBasement.getTokenConfig(asset)).enableFlagsForOracles[0]).to.equal(false);
      });

      it("token config added successfully & events check", async function () {
        const vToken = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const asset = await vToken.underlying();

        const result = await this.oracleBasement.setTokenConfig({
          asset,
          oracles: [addr1111, addr1111, addr1111],
          enableFlagsForOracles: [true, false, true],
        });
        await expect(result)
          .to.emit(this.oracleBasement, "TokenConfigAdded")
          .withArgs(asset, addr1111, addr1111, addr1111);
      });
    });

    describe("batch add token configs", () => {
      it("length check", async function () {
        await expect(this.oracleBasement.setTokenConfigs([])).to.be.revertedWith("length can't be 0");
      });

      it("token config added successfully & data check", async function () {
        const vToken1 = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const asset1 = await vToken1.underlying();

        const vToken2 = await makeVToken(
          this.admin,
          { name: "vBTC", symbol: "vBTC" },
          { name: "Bitcoin", symbol: "BTC" },
        );
        const asset2 = await vToken2.underlying();

        await this.oracleBasement.setTokenConfigs([
          {
            asset: asset1,
            oracles: [addr1111, addr1111, addr0000],
            enableFlagsForOracles: [true, false, true],
          },
          {
            asset: asset2,
            oracles: [addr1111, getSimpleAddress(2), getSimpleAddress(3)],
            enableFlagsForOracles: [true, false, true],
          },
        ]);
        expect((await this.oracleBasement.getTokenConfig(asset1)).oracles[0]).to.equal(addr1111);
        expect((await this.oracleBasement.getTokenConfig(asset2)).oracles[1]).to.equal(getSimpleAddress(2));
        expect((await this.oracleBasement.getTokenConfig(asset2)).enableFlagsForOracles[0]).to.equal(true);
        // non exist config
        expect((await this.oracleBasement.getTokenConfig(getSimpleAddress(8))).asset).to.be.equal(addr0000);
      });
    });
  });

  describe("change oracle", () => {
    describe("set oracle", () => {
      it("null check", async function () {
        const vToken = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const asset = await vToken.underlying();

        // vToken can't be zero
        await expect(this.oracleBasement.setOracle(addr0000, addr1111, 0)).to.be.revertedWith("can't be zero address");

        // main oracle can't be zero
        await this.oracleBasement.setTokenConfig({
          asset,
          oracles: [addr1111, addr1111, addr0000],
          enableFlagsForOracles: [true, false, true],
        });
        await expect(this.oracleBasement.setOracle(asset, addr0000, 0)).to.be.revertedWith(
          "can't set zero address to main oracle",
        );
        // nothing happens
        await this.oracleBasement.setOracle(asset, addr1111, 0);
        await this.oracleBasement.setOracle(asset, addr0000, 2);
      });

      it("existance check", async function () {
        const vToken = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const asset = await vToken.underlying();

        await expect(this.oracleBasement.setOracle(asset, addr1111, 0)).to.be.revertedWith("token config must exist");
      });

      it("oracle set successfully & data check", async function () {
        const vToken = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const asset = await vToken.underlying();

        await this.oracleBasement.setTokenConfig({
          asset,
          oracles: [addr1111, addr1111, addr0000],
          enableFlagsForOracles: [true, false, true],
        });

        await this.oracleBasement.setOracle(asset, getSimpleAddress(2), 1);
        expect((await this.oracleBasement.getTokenConfig(asset)).enableFlagsForOracles).to.eql([
          true,
          false,
          true,
        ]);
        expect((await this.oracleBasement.getTokenConfig(asset)).oracles).to.eql([
          addr1111,
          getSimpleAddress(2),
          addr0000,
        ]);
      });
    });
  });

  describe("get underlying price", () => {
    let token1;
    let asset1;
    let token2;
    let asset2;
    let token3;
    let asset3;

    const token1FallbackPrice = 2222222;
    const token2FallbackPrice = 3333333;

    beforeEach(async function () {
      token1 = await makeVToken(this.admin, { name: "vETH", symbol: "vETH" }, { name: "Ethereum", symbol: "ETH" });
      asset1 = await token1.underlying();
      token1 = token1.address;

      token2 = await makeVToken(this.admin, { name: "vBTC", symbol: "vBTC" }, { name: "Bitcoin", symbol: "BTC" });
      asset2 = await token2.underlying();
      token2 = token2.address;

      token3 = this.vBnb;
      asset3 = this.bnbAddr;

      await this.oracleBasement.setTokenConfigs([
        {
          asset: asset1,
          oracles: [this.mainOracle.address, this.pivotOracle.address, this.fallbackOracle.address],
          enableFlagsForOracles: [true, true, false],
        },
        {
          asset: asset2,
          oracles: [this.mainOracle.address, this.pivotOracle.address, this.fallbackOracle.address],
          enableFlagsForOracles: [true, true, false],
        },
        {
          asset: asset3,
          oracles: [this.mainOracle.address, this.pivotOracle.address, this.fallbackOracle.address],
          enableFlagsForOracles: [true, true, false],
        },
      ]);
      this.fallbackOracle.getPrice.whenCalledWith(asset1).returns(token1FallbackPrice);
      this.fallbackOracle.getPrice.whenCalledWith(asset2).returns(token2FallbackPrice);
      this.fallbackOracle.getPrice.whenCalledWith(asset3).returns(token2FallbackPrice);
    });
    it("revert when protocol paused", async function () {
      await this.oracleBasement.pause();
      await expect(this.oracleBasement.getUnderlyingPrice(token1)).to.be.revertedWith("resilient oracle is paused");
      await this.oracleBasement.unpause();
      await expect(this.oracleBasement.getUnderlyingPrice(token1)).to.be.revertedWith("invalid resilient oracle price");
    });
    it("revert price when main oracle is disabled and there is no fallback oracle", async function () {
      await this.oracleBasement.enableOracle(asset1, 0, false);
      await expect(this.oracleBasement.getUnderlyingPrice(token1)).to.be.revertedWith("invalid resilient oracle price");
    });
    it("revert price main oracle returns 0 and there is no fallback oracle", async function () {
      await this.mainOracle.getPrice.whenCalledWith(asset1).returns(0);
      await expect(this.oracleBasement.getUnderlyingPrice(token1)).to.be.revertedWith("invalid resilient oracle price");
    });
    it("revert if price fails checking", async function () {
      await this.mainOracle.getPrice.whenCalledWith(asset1).returns(1000);
      // invalidate the main oracle
      await this.pivotOracle.getPrice.whenCalledWith(asset1).returns(10000);
      await this.boundValidator.validatePriceWithAnchorPrice.returns(false);
      await expect(this.oracleBasement.getUnderlyingPrice(token1)).to.be.revertedWith("invalid resilient oracle price");
    });
    it("check price with/without pivot oracle", async function () {
      await this.mainOracle.getPrice.whenCalledWith(asset1).returns(1000);
      await this.boundValidator.validatePriceWithAnchorPrice.returns(false);
      // empty pivot oracle
      await this.oracleBasement.setOracle(asset1, addr0000, 1);
      const price1 = await this.oracleBasement.getUnderlyingPrice(token1);
      expect(price1).to.equal(1000);
      // set oracle back
      await this.oracleBasement.setOracle(asset1, this.pivotOracle.address, 1);
      await this.mainOracle.getPrice.whenCalledWith(asset1).returns(1000);
      await this.pivotOracle.getPrice.whenCalledWith(asset1).returns(10000);
      // invalidate price
      await this.boundValidator.validatePriceWithAnchorPrice.returns(false);
      await expect(this.oracleBasement.getUnderlyingPrice(token1)).to.be.revertedWith("invalid resilient oracle price");
    });

    it("disable pivot oracle", async function () {
      await this.mainOracle.getPrice.whenCalledWith(asset1).returns(1000);
      await this.mainOracle.getPrice.whenCalledWith(asset3).returns(2000);
      // pivot passes the price...
      await this.boundValidator.validatePriceWithAnchorPrice.returns(true);
      // ...but pivot is disabled, so it won't come to invalidate
      await this.oracleBasement.enableOracle(asset1, 1, false);
      await this.oracleBasement.enableOracle(asset3, 1, false);
      const price1 = await this.oracleBasement.getUnderlyingPrice(token1);
      expect(price1).to.equal(1000);
      const price3 = await this.oracleBasement.getUnderlyingPrice(token3);
      expect(price3).to.equal(2000);
    });

    it("enable fallback oracle", async function () {
      await this.mainOracle.getPrice.whenCalledWith(asset2).returns(1000);
      await this.mainOracle.getPrice.whenCalledWith(asset3).returns(2000);
      // invalidate the price first
      await this.pivotOracle.getPrice.whenCalledWith(asset2).returns(1000);
      await this.pivotOracle.getPrice.whenCalledWith(asset3).returns(2000);

      await this.boundValidator.validatePriceWithAnchorPrice.returns(false);
      await expect(this.oracleBasement.getUnderlyingPrice(token2)).to.be.revertedWith("invalid resilient oracle price");
      await expect(this.oracleBasement.getUnderlyingPrice(token3)).to.be.revertedWith("invalid resilient oracle price");

      // enable fallback oracle
      await this.mainOracle.getPrice.whenCalledWith(asset2).returns(0);
      await this.boundValidator.validatePriceWithAnchorPrice.returns(true);
      await this.oracleBasement.enableOracle(asset1, 2, true);
      await expect(this.oracleBasement.getUnderlyingPrice(token2)).to.be.revertedWith("invalid resilient oracle price");

      // set fallback oracle to zero address
      await this.oracleBasement.setOracle(asset2, addr0000, 2);
      await expect(this.oracleBasement.getUnderlyingPrice(token2)).to.be.revertedWith("invalid resilient oracle price");

      // bring fallback oracle to action, but return 0 price
      await this.oracleBasement.setOracle(asset2, this.fallbackOracle.address, 2);
      await this.fallbackOracle.getPrice.whenCalledWith(asset2).returns(0);
      // notice: token2 is invalidated
      await expect(this.oracleBasement.getUnderlyingPrice(token2)).to.be.revertedWith("invalid resilient oracle price");
    });
    it("Return fallback price when fallback price is validated successfully with pivot oracle", async function () {
      // main oracle price is invalid
      await this.mainOracle.getPrice.whenCalledWith(asset1).returns(0);
      await this.pivotOracle.getPrice.whenCalledWith(asset1).returns(1000);
      await this.fallbackOracle.getPrice.whenCalledWith(asset1).returns(2000);
      // fallback oracle is enabled
      await this.oracleBasement.enableOracle(asset1, 0, false);
      await this.oracleBasement.enableOracle(asset1, 2, true);
      await this.boundValidator.validatePriceWithAnchorPrice.returns(true);
      expect(await this.oracleBasement.getUnderlyingPrice(token1)).to.be.equal(2000);
    });
    it("Return main price when fallback price validation failed with pivot oracle", async function () {
      await this.mainOracle.getPrice.whenCalledWith(asset1).returns(2000);
      // pivot oracle price is invalid
      await this.pivotOracle.getPrice.whenCalledWith(asset1).returns(0);
      await this.fallbackOracle.getPrice.whenCalledWith(asset1).returns(1000);
      // fallback oracle is enabled
      await this.oracleBasement.enableOracle(asset1, 2, true);
      await this.boundValidator.validatePriceWithAnchorPrice.returns(true);
      expect(await this.oracleBasement.getUnderlyingPrice(token1)).to.be.equal(2000);
    });
  });
});
