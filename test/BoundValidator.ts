import { smock } from "@defi-wonderland/smock";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat";

import { AccessControlManager, BoundValidator } from "../typechain-types";
import { addr0000, addr1111 } from "./utils/data";
import { makeToken } from "./utils/makeToken";

const EXP_SCALE = BigNumber.from(10).pow(18);

const getBoundValidator = async (account: SignerWithAddress) => {
  const boundValidator = await ethers.getContractFactory("BoundValidator", account);

  const fakeAccessControlManager = await smock.fake<AccessControlManager>("AccessControlManagerScenario");
  fakeAccessControlManager.isAllowedToCall.returns(true);

  return <BoundValidator>await upgrades.deployProxy(boundValidator, [fakeAccessControlManager.address], {
    constructorArgs: [],
  });
};

describe("bound validator", () => {
  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.signers = signers;
    this.admin = admin;
    this.boundValidator = <BoundValidator>(<unknown>await getBoundValidator(admin));
    this.token = await makeToken(admin, "Token", "Token");
  });
  describe("add validation config", () => {
    it("length check", async function () {
      await expect(this.boundValidator.setValidateConfigs([])).to.be.revertedWith("invalid validate config length");
    });
    it("validation config check", async function () {
      const config = {
        asset: addr0000,
        upperBoundRatio: 0,
        lowerBoundRatio: 0,
      };
      await expect(this.boundValidator.setValidateConfigs([config])).to.be.revertedWith("asset can't be zero address");

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
        asset: await this.token.address,
        upperBoundRatio: 100,
        lowerBoundRatio: 80,
      };
      const result = await this.boundValidator.setValidateConfigs([config]);
      await expect(result)
        .to.emit(this.boundValidator, "ValidateConfigAdded")
        .withArgs(await this.token.address, 100, 80);
      const savedConfig = await this.boundValidator.validateConfigs(await this.token.address);
      expect(savedConfig.upperBoundRatio).to.equal(100);
      expect(savedConfig.lowerBoundRatio).to.equal(80);
      expect(savedConfig.asset).to.equal(await this.token.address);
    });
  });

  describe("validate price", () => {
    it("validate price", async function () {
      const token0 = await makeToken(this.admin, "Token1", "Token1");

      const token1 = await makeToken(this.admin, "Token2", "Token2");
      const validationConfig = {
        asset: token0.address,
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
  });
});
