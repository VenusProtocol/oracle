import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { artifacts, ethers, upgrades, waffle } from "hardhat";

import { BoundValidator, PythOracle } from "../src/types";
import { MockPyth } from "../src/types/contracts/test/MockPyth";
import { addr0000, addr1111, getBytes32String, getSimpleAddress } from "./utils/data";
import { makeVToken } from "./utils/makeVToken";
import { getTime, increaseTime } from "./utils/time";

const EXP_SCALE = BigNumber.from(10).pow(18);

const getPythOracle = async (account: SignerWithAddress, vBnb: string) => {
  const actualOracleArtifact = await artifacts.readArtifact("MockPyth");
  const actualOracle = await waffle.deployContract(account, actualOracleArtifact, [0, 0]);
  await actualOracle.deployed();

  const PythOracle = await ethers.getContractFactory("PythOracle", account);
  const instance = <PythOracle>await upgrades.deployProxy(PythOracle, [actualOracle.address], {
    constructorArgs: [vBnb],
  });
  return instance;
};

const getBoundValidator = async (account: SignerWithAddress, vBnb: string) => {
  const BoundValidator = await ethers.getContractFactory("BoundValidator", account);
  const instance = <BoundValidator>await upgrades.deployProxy(BoundValidator, [], {
    constructorArgs: [vBnb],
  });
  return instance;
};

describe("Oracle plugin frame unit tests", function () {
  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.vBnb = signers[5].address;
    this.signers = signers;
    this.admin = admin;
    this.pythOracle = await getPythOracle(admin, this.vBnb);
    this.boundValidator = await getBoundValidator(admin, this.vBnb);
  });

  describe("constructor", function () {
    it("sets address of owner", async function () {
      const owner = await this.pythOracle.owner();
      expect(owner).to.equal(this.admin.address);
    });
  });

  describe("admin check", function () {
    it("only admin can call the setters", async function () {
      const config = {
        pythId: getBytes32String(2),
        asset: addr1111,
        maxStalePeriod: 10,
      };
      // setTokenConfigs
      await expect(this.pythOracle.connect(this.signers[2]).setTokenConfigs([config])).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );

      // setTokenConfig
      await expect(this.pythOracle.connect(this.signers[1]).setTokenConfig(config)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );

      // setOracle
      await expect(this.pythOracle.connect(this.signers[2]).setUnderlyingPythOracle(addr1111)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("transfer owner", async function () {
      const config = {
        pythId: getBytes32String(2),
        asset: addr1111,
        maxStalePeriod: 10,
      };
      await this.pythOracle.transferOwnership(this.signers[2].address);
      const newOwner = await this.pythOracle.owner();
      expect(newOwner).to.equal(this.signers[2].address);
      await this.pythOracle.connect(this.signers[2]).setTokenConfigs([config]);
      expect((await this.pythOracle.tokenConfigs(addr1111)).asset).to.equal(addr1111);
    });
  });

  describe("token config", function () {
    describe("add single token config", function () {
      it("vToken can\"t be zero & maxStalePeriod can't be zero", async function () {
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

    describe("batch add token configs", function () {
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

  describe("get underlying price", function () {
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

      this.vETH = await makeVToken(this.admin, { name: "vETH", symbol: "vETH" }, { name: "Ethereum", symbol: "ETH" });
    });
    it("revert when asset not exist", async function () {
      await expect(this.pythOracle.getUnderlyingPrice(this.vETH.address)).to.be.revertedWith("asset doesn't exist");
    });

    it("revert when price is expired", async function () {
      await this.pythOracle.setTokenConfig({
        asset: await this.vETH.underlying(),
        pythId: getBytes32String(2),
        maxStalePeriod: 111,
      });
      await increaseTime(120);
      await expect(this.pythOracle.getUnderlyingPrice(this.vETH.address)).to.be.revertedWith(
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
        asset: await this.vETH.underlying(),
        pythId: getBytes32String(3),
        maxStalePeriod: 111,
      });

      // test negative price
      await expect(this.pythOracle.getUnderlyingPrice(this.vETH.address)).to.be.revertedWith(
        "SafeCast: value must be positive",
      );

      feed.price.price = BigNumber.from(0);
      await this.underlyingPythOracle.updatePriceFeedsHarness([feed]);
      await expect(this.pythOracle.getUnderlyingPrice(this.vETH.address)).to.be.revertedWith(
        "Pyth oracle price must be positive",
      );
    });

    it("price should be 18 decimals", async function () {
      let vToken = await makeVToken(this.admin, { name: "vETH", symbol: "vETH" }, { name: "Ethereum", symbol: "ETH" });

      await this.pythOracle.setTokenConfig({
        asset: await this.vETH.underlying(),
        pythId: getBytes32String(1),
        maxStalePeriod: 111,
      });

      let price = await this.pythOracle.getUnderlyingPrice(this.vETH.address);
      // 10000000 * 10**-6 * 10**18 * 10**0 = 1e19
      expect(price).to.equal(BigNumber.from(10).pow(19));

      vToken = await makeVToken(
        this.admin,
        { name: "vBTC", symbol: "vBTC" },
        { name: "Bitcoin", symbol: "BTC", decimals: 8 },
      );

      // test another token
      await this.pythOracle.setTokenConfig({
        asset: await vToken.underlying(),
        pythId: getBytes32String(2),
        maxStalePeriod: 111,
      });

      price = await this.pythOracle.getUnderlyingPrice(vToken.address);
      // 1 * 10**2 * 10**18 * 10**10 = 1e30
      expect(price).to.equal(BigNumber.from(10).pow(30));
    });
  });

  describe("validation", function () {
    it("validate price", async function () {
      const vToken = await makeVToken(
        this.admin,
        { name: "vETH", symbol: "vETH" },
        { name: "Ethereum", symbol: "ETH" },
      );

      const validationConfig = {
        asset: await vToken.underlying(),
        upperBoundRatio: EXP_SCALE.mul(12).div(10),
        lowerBoundRatio: EXP_SCALE.mul(8).div(10),
      };

      // set price
      await this.pythOracle.setTokenConfig({
        asset: await vToken.underlying(),
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
      await expect(this.boundValidator.validatePriceWithAnchorPrice(vToken.address, 100, 0)).to.be.revertedWith(
        "validation config not exist",
      );

      await this.boundValidator.setValidateConfigs([validationConfig]);

      // no need to test this, Pyth price must be positive
      // await expect(
      //   this.pythOracle.validatePrice(token0, 100)
      // ).to.be.revertedWith("anchor price is not valid");

      let validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        vToken.address,
        EXP_SCALE,
        await this.pythOracle.getUnderlyingPrice(vToken.address),
      );
      expect(validateResult).to.equal(true);
      validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        vToken.address,
        EXP_SCALE.mul(100).div(79),
        await this.pythOracle.getUnderlyingPrice(vToken.address),
      );
      expect(validateResult).to.equal(false);
      validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        vToken.address,
        EXP_SCALE.mul(100).div(121),
        await this.pythOracle.getUnderlyingPrice(vToken.address),
      );
      expect(validateResult).to.equal(false);
    });
    it("validate BNB price", async function () {
        const bnbAddr = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"
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
        await expect(this.boundValidator.validatePriceWithAnchorPrice(this.vBnb, 100, 0)).to.be.revertedWith(
          "validation config not exist",
        );
  
        await this.boundValidator.setValidateConfigs([validationConfig]);
  
        let validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
          this.vBnb,
          EXP_SCALE,
          await this.pythOracle.getUnderlyingPrice(this.vBnb),
        );
        expect(validateResult).to.equal(true);
        validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
          this.vBnb,
          EXP_SCALE.mul(100).div(79),
          await this.pythOracle.getUnderlyingPrice(this.vBnb),
        );
        expect(validateResult).to.equal(false);
        validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
          this.vBnb,
          EXP_SCALE.mul(100).div(121),
          await this.pythOracle.getUnderlyingPrice(this.vBnb),
        );
        expect(validateResult).to.equal(false);
      });
  });
});
