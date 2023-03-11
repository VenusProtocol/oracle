import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";

import { BoundValidator } from "../typechain-types";
import { addr0000, addr1111 } from "./utils/data";
import { makeVToken } from "./utils/makeVToken";

const EXP_SCALE = BigNumber.from(10).pow(18);

const getBoundValidator = async (account: SignerWithAddress, vBnb: string, vai: string) => {
  const BoundValidator = await ethers.getContractFactory("BoundValidator", account);

  return <BoundValidator>await upgrades.deployProxy(BoundValidator, [], {
    constructorArgs: [vBnb, vai],
  });
};

describe("bound validator", function () {
  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.vBnb = signers[5].address;
    this.vai = signers[5].address;
    this.signers = signers;
    this.admin = admin;
    this.boundValidator = <BoundValidator>(<unknown>await getBoundValidator(admin, this.vBnb, this.vai));
    this.vToken = await makeVToken(admin, { name: "vToken", symbol: "vToken" }, { name: "Token", symbol: "Token" });
    this.bnbAddr = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
  });
  describe("admin check", function () {
    it("only admin can call add validation configs", async function () {
      const config = {
        asset: await this.vToken.underlying(),
        upperBoundRatio: EXP_SCALE.mul(12).div(10),
        lowerBoundRatio: EXP_SCALE.mul(8).div(10),
      };
      await expect(this.boundValidator.connect(this.signers[2]).setValidateConfigs([config])).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );

      await expect(this.boundValidator.connect(this.signers[1]).setValidateConfig(config)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });
  });
  describe("add validation config", function () {
    it("length check", async function () {
      await expect(this.boundValidator.setValidateConfigs([])).to.be.revertedWith("invalid validate config length");
    });
    it("validation config check", async function () {
      const config = {
        asset: addr0000,
        upperBoundRatio: 0,
        lowerBoundRatio: 0,
      };
      await expect(this.boundValidator.setValidateConfigs([config])).to.be.revertedWith("can't be zero address");

      config.asset = addr1111;
      await expect(this.boundValidator.setValidateConfigs([config])).to.be.revertedWith("bound must be positive");

      config.lowerBoundRatio = 100;
      config.upperBoundRatio = 80;
      await expect(this.boundValidator.setValidateConfigs([config])).to.be.revertedWith(
        "upper bound must be higher than lowner bound",
      );
    });
    it("config added successfully & event check", async function () {
      const config = {
        asset: await this.vToken.underlying(),
        upperBoundRatio: 100,
        lowerBoundRatio: 80,
      };
      const result = await this.boundValidator.setValidateConfigs([config]);
      await expect(result)
        .to.emit(this.boundValidator, "ValidateConfigAdded")
        .withArgs(await this.vToken.underlying(), 100, 80);
      const savedConfig = await this.boundValidator.validateConfigs(await this.vToken.underlying());
      expect(savedConfig.upperBoundRatio).to.equal(100);
      expect(savedConfig.lowerBoundRatio).to.equal(80);
      expect(savedConfig.asset).to.equal(await this.vToken.underlying());
    });
  });

  describe("validate price", function () {
    it("validate price", async function () {
      const token0 = await makeVToken(
        this.admin,
        { name: "vToken1", symbol: "vToken1" },
        { name: "Token1", symbol: "Token1" },
      );
      const token1 = await makeVToken(
        this.admin,
        { name: "vToken2", symbol: "vToken2" },
        { name: "Token2", symbol: "Token2" },
      );
      const validationConfig = {
        asset: await token0.underlying(),
        upperBoundRatio: EXP_SCALE.mul(12).div(10),
        lowerBoundRatio: EXP_SCALE.mul(8).div(10),
      };
      await this.boundValidator.setValidateConfigs([validationConfig]);

      const anchorPrice = EXP_SCALE;

      await expect(this.boundValidator.validatePriceWithAnchorPrice(token1.address, 100, 0)).to.be.revertedWith(
        "validation config not exist",
      );
      await expect(this.boundValidator.validatePriceWithAnchorPrice(token0.address, 100, 0)).to.be.revertedWith(
        "anchor price is not valid",
      );

      let validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        token0.address,
        EXP_SCALE,
        anchorPrice,
      );
      expect(validateResult).to.equal(true);
      validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        token0.address,
        EXP_SCALE.mul(100).div(79),
        anchorPrice,
      );
      expect(validateResult).to.equal(false);
      validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        token0.address,
        EXP_SCALE.mul(100).div(121),
        anchorPrice,
      );
      expect(validateResult).to.equal(false);
    });

    it("validate vBnb price", async function () {
      const vBnb = this.vBnb;
      const validationConfig = {
        asset: this.bnbAddr,
        upperBoundRatio: EXP_SCALE.mul(12).div(10),
        lowerBoundRatio: EXP_SCALE.mul(8).div(10),
      };
      await this.boundValidator.setValidateConfigs([validationConfig]);

      const anchorPrice = EXP_SCALE;

      await expect(this.boundValidator.validatePriceWithAnchorPrice(vBnb, 100, 0)).to.be.revertedWith(
        "anchor price is not valid",
      );

      let validateResult = await this.boundValidator.validatePriceWithAnchorPrice(vBnb, EXP_SCALE, anchorPrice);
      expect(validateResult).to.equal(true);
      validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        vBnb,
        EXP_SCALE.mul(100).div(79),
        anchorPrice,
      );
      expect(validateResult).to.equal(false);
      validateResult = await this.boundValidator.validatePriceWithAnchorPrice(
        vBnb,
        EXP_SCALE.mul(100).div(121),
        anchorPrice,
      );
      expect(validateResult).to.equal(false);
    });
  });
});
