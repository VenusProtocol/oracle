import { smock } from "@defi-wonderland/smock";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { deployments, ethers, upgrades } from "hardhat";

import { AccessControlManager, BoundValidator, PythOracle } from "../typechain-types";
import { MockPyth } from "../typechain-types/contracts/test/MockPyth";
import { addr0000, addr1111, getBytes32String, getSimpleAddress } from "./utils/data";
import { makeToken } from "./utils/makeToken";
import { getTime, increaseTime } from "./utils/time";

const EXP_SCALE = BigNumber.from(10).pow(18);
const bnbAddr = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";

const getPythOracle = deployments.createFixture(async ({ getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;
  const actualOracle = await deploy("PoolRegistry", {
    from: deployer,
    contract: "MockPyth",
    args: [0, 0],
    autoMine: true,
    log: true,
  });

  const pythOracle = await ethers.getContractFactory("PythOracle", deployer);
  const fakeAccessControlManager = await smock.fake<AccessControlManager>("AccessControlManagerScenario");
  fakeAccessControlManager.isAllowedToCall.returns(true);

  const instance = <PythOracle>await upgrades.deployProxy(
    pythOracle,
    [actualOracle.address, fakeAccessControlManager.address],
    {
      constructorArgs: [],
    },
  );
  return instance;
});

const getBoundValidator = async (account: SignerWithAddress) => {
  const boundValidator = await ethers.getContractFactory("BoundValidator", account);
  const fakeAccessControlManager = await smock.fake<AccessControlManager>("AccessControlManager");
  fakeAccessControlManager.isAllowedToCall.returns(true);

  const instance = <BoundValidator>await upgrades.deployProxy(boundValidator, [fakeAccessControlManager.address], {
    constructorArgs: [],
  });
  return instance;
};

describe("Oracle plugin frame unit tests", () => {
  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.vai = signers[6].address;
    this.signers = signers;
    this.admin = admin;
    this.pythOracle = await getPythOracle();
    this.boundValidator = await getBoundValidator(admin);
  });

  describe("admin check", () => {
    it("transfer owner", async function () {
      const config = {
        pythId: getBytes32String(2),
        asset: addr1111,
        maxStalePeriod: 10,
      };
      await this.pythOracle.transferOwnership(this.signers[2].address);
      await this.pythOracle.connect(this.signers[2]).acceptOwnership();
      const newOwner = await this.pythOracle.owner();
      expect(newOwner).to.equal(this.signers[2].address);
      await this.pythOracle.connect(this.signers[2]).setTokenConfigs([config]);
      expect((await this.pythOracle.tokenConfigs(addr1111)).asset).to.equal(addr1111);
    });
  });

  describe("token config", () => {
    describe("add single token config", () => {
      it("token can\"t be zero & maxStalePeriod can't be zero", async function () {
        await expect(
          this.pythOracle.setTokenConfig({
            pythId: getBytes32String(2),
            asset: addr0000,
            maxStalePeriod: 10,
          }),
        ).to.be.revertedWith("can't be zero address");

        await expect(
          this.pythOracle.setTokenConfig({
            pythId: getBytes32String(2),
            asset: addr1111,
            maxStalePeriod: 0,
          }),
        ).to.be.revertedWith("max stale period cannot be 0");
      });

      it("token config added successfully & events check", async function () {
        const result = await this.pythOracle.setTokenConfig({
          asset: addr1111,
          pythId: getBytes32String(2),
          maxStalePeriod: 111,
        });
        await expect(result).to.emit(this.pythOracle, "TokenConfigAdded").withArgs(addr1111, getBytes32String(2), 111);
      });
    });

    describe("batch add token configs", () => {
      it("length check", async function () {
        await expect(this.pythOracle.setTokenConfigs([])).to.be.revertedWith("length can't be 0");
      });

      it("token config added successfully & data check", async function () {
        await this.pythOracle.setTokenConfigs([
          {
            asset: addr1111,
            pythId: getBytes32String(2),
            maxStalePeriod: 111,
          },
          {
            asset: getSimpleAddress(2),
            pythId: getBytes32String(3),
            maxStalePeriod: 222,
          },
        ]);
        expect((await this.pythOracle.tokenConfigs(addr1111)).asset).to.equal(addr1111);
        expect((await this.pythOracle.tokenConfigs(getSimpleAddress(2))).maxStalePeriod).to.equal(222);
      });
    });
  });

  describe("get underlying price", () => {
    beforeEach(async function () {
      const underlyingPythAddress = await this.pythOracle.underlyingPythOracle();
      const UnderlyingPythFactory = await ethers.getContractFactory("MockPyth");
      const underlyingPyth = UnderlyingPythFactory.attach(underlyingPythAddress);
      this.underlyingPythOracle = <MockPyth>underlyingPyth;
      const ts = await getTime();
      // update some feeds
      await this.underlyingPythOracle.updatePriceFeedsHarness([
        {
          id: getBytes32String(1),
          price: {
            price: BigNumber.from(10000000), // 10000000 * 10 ** -6 = $10
            conf: 10,
            expo: -6,
            publishTime: ts,
          },
          emaPrice: {
            price: 0,
            conf: 0,
            expo: 0,
            publishTime: 0,
          },
        },
        {
          id: getBytes32String(2),
          price: {
            price: BigNumber.from(1),
            conf: 10,
            expo: 2,
            publishTime: ts,
          },
          emaPrice: {
            price: 0,
            conf: 0,
            expo: 0,
            publishTime: 0,
          },
        },
      ]);

      this.eth = await makeToken("ETH", "ETH");
    });
    it("revert when asset not exist", async function () {
      await expect(this.pythOracle.getPrice(this.eth.address)).to.be.revertedWith("asset doesn't exist");
    });

    it("revert when price is expired", async function () {
      await this.pythOracle.setTokenConfig({
        asset: await this.eth.address,
        pythId: getBytes32String(2),
        maxStalePeriod: 111,
      });
      await increaseTime(120);
      await expect(this.pythOracle.getPrice(this.eth.address)).to.be.revertedWith(
        "no price available which is recent enough",
      );
    });

    it("revert when price is not positive (just in case Pyth return insane data)", async function () {
      const ts = await getTime();
      const feed = {
        id: getBytes32String(3),
        price: {
          price: BigNumber.from(-10),
          conf: 10,
          expo: BigNumber.from(-10),
          publishTime: ts,
        },
        emaPrice: {
          price: 0,
          conf: 0,
          expo: 0,
          publishTime: 0,
        },
      };
      await this.underlyingPythOracle.updatePriceFeedsHarness([feed]);

      await this.pythOracle.setTokenConfig({
        asset: await this.eth.address,
        pythId: getBytes32String(3),
        maxStalePeriod: 111,
      });

      // test negative price
      await expect(this.pythOracle.getPrice(this.eth.address)).to.be.revertedWith("SafeCast: value must be positive");

      feed.price.price = BigNumber.from(0);
      await this.underlyingPythOracle.updatePriceFeedsHarness([feed]);
      await expect(this.pythOracle.getPrice(this.eth.address)).to.be.revertedWith("invalid pyth oracle price");
    });

    it("price should be 18 decimals", async function () {
      let token = await makeToken("ETH", "ETH");

      await this.pythOracle.setTokenConfig({
        asset: await this.eth.address,
        pythId: getBytes32String(1),
        maxStalePeriod: 111,
      });

      let price = await this.pythOracle.getPrice(this.eth.address);
      // 10000000 * 10**-6 * 10**18 * 10**0 = 1e19
      expect(price).to.equal(BigNumber.from(10).pow(19));

      token = await makeToken("BTC", "BTC", 8);

      // test another token
      await this.pythOracle.setTokenConfig({
        asset: await token.address,
        pythId: getBytes32String(2),
        maxStalePeriod: 111,
      });

      price = await this.pythOracle.getPrice(token.address);
      // 1 * 10**2 * 10**18 * 10**10 = 1e30
      expect(price).to.equal(BigNumber.from(10).pow(30));
    });
  });

  describe("validation", () => {
    it("validate price", async function () {
      const token = await makeToken("ETH", "ETH");

      const validationConfig = {
        asset: await token.address,
        upperBoundRatio: EXP_SCALE.mul(12).div(10),
        lowerBoundRatio: EXP_SCALE.mul(8).div(10),
      };

      // set price
      await this.pythOracle.setTokenConfig({
        asset: await token.address,
        pythId: getBytes32String(3),
        maxStalePeriod: 111,
      });
      const feed = {
        id: getBytes32String(3),
        price: {
          price: BigNumber.from(10).pow(6),
          conf: 10,
          expo: BigNumber.from(-6),
          publishTime: await getTime(),
        },
        emaPrice: {
          price: 0,
          conf: 0,
          expo: 0,
          publishTime: 0,
        },
      };

      const underlyingPythAddress = await this.pythOracle.underlyingPythOracle();
      const UnderlyingPythFactory = await ethers.getContractFactory("MockPyth");
      const underlyingPyth = UnderlyingPythFactory.attach(underlyingPythAddress);
      const underlyingPythOracle = <MockPyth>underlyingPyth;
      await underlyingPythOracle.updatePriceFeedsHarness([feed]);

      // sanity check
      await expect(this.boundValidator.validatePriceWithAnchorPrice(token.address, 100, 0)).to.be.revertedWith(
        "validation config not exist",
      );

      await this.boundValidator.setValidateConfigs([validationConfig]);

      // no need to test this, Pyth price must be positive
      // await expect(
      //   this.pythOracle.validatePrice(token0, 100)
      // ).to.be.revertedWith("anchor price is not valid");

      let validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        token.address,
        EXP_SCALE,
        await this.pythOracle.getPrice(token.address),
      );
      expect(validateResult).to.equal(true);
      validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        token.address,
        EXP_SCALE.mul(100).div(79),
        await this.pythOracle.getPrice(token.address),
      );
      expect(validateResult).to.equal(false);
      validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        token.address,
        EXP_SCALE.mul(100).div(121),
        await this.pythOracle.getPrice(token.address),
      );
      expect(validateResult).to.equal(false);
    });
    it("validate BNB price", async function () {
      const validationConfig = {
        asset: bnbAddr,
        upperBoundRatio: EXP_SCALE.mul(12).div(10),
        lowerBoundRatio: EXP_SCALE.mul(8).div(10),
      };

      // set price
      await this.pythOracle.setTokenConfig({
        asset: bnbAddr,
        pythId: getBytes32String(3),
        maxStalePeriod: 111,
      });
      const feed = {
        id: getBytes32String(3),
        price: {
          price: BigNumber.from(10).pow(6),
          conf: 10,
          expo: BigNumber.from(-6),
          publishTime: await getTime(),
        },
        emaPrice: {
          price: 0,
          conf: 0,
          expo: 0,
          publishTime: 0,
        },
      };

      const underlyingPythAddress = await this.pythOracle.underlyingPythOracle();
      const UnderlyingPythFactory = await ethers.getContractFactory("MockPyth");
      const underlyingPyth = UnderlyingPythFactory.attach(underlyingPythAddress);
      const underlyingPythOracle = <MockPyth>underlyingPyth;
      await underlyingPythOracle.updatePriceFeedsHarness([feed]);

      // sanity check
      await expect(this.boundValidator.validatePriceWithAnchorPrice(bnbAddr, 100, 0)).to.be.revertedWith(
        "validation config not exist",
      );

      await this.boundValidator.setValidateConfigs([validationConfig]);

      let validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        bnbAddr,
        EXP_SCALE,
        await this.pythOracle.getPrice(bnbAddr),
      );
      expect(validateResult).to.equal(true);
      validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        bnbAddr,
        EXP_SCALE.mul(100).div(79),
        await this.pythOracle.getPrice(bnbAddr),
      );
      expect(validateResult).to.equal(false);
      validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        bnbAddr,
        EXP_SCALE.mul(100).div(121),
        await this.pythOracle.getPrice(bnbAddr),
      );
      expect(validateResult).to.equal(false);
    });
  });
});
