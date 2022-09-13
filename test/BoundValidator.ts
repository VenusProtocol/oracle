import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { artifacts, ethers, waffle } from "hardhat";
import { BoundValidator, MockBoundValidator } from "../src/types";
import { addr0000, addr1111, getSimpleAddress } from "./utils/data";

const EXP_SCALE = BigNumber.from(10).pow(18);

const getBoundValidator = async (account: SignerWithAddress) => {
    const artifact = await artifacts.readArtifact("MockBoundValidator");
    const instance = <MockBoundValidator>await waffle.deployContract(account, artifact, []);
    await instance.deployed();
    await instance.initialize();
    return instance;
}

describe("bound validator", function () {
    beforeEach(async function () {
        const signers: SignerWithAddress[] = await ethers.getSigners();
        const admin = signers[0];
        this.signers = signers;
        this.admin = admin;
        this.boundValidator = <BoundValidator><unknown>await getBoundValidator(admin);
    });
    describe('admin check', function () {
        it('only admin can call add validation configs', async function () {
            const config = {
                vToken: addr1111,
                upperBoundRatio: EXP_SCALE.mul(12).div(10),
                lowerBoundRatio: EXP_SCALE.mul(8).div(10),
            }
            await expect(
                this.boundValidator.connect(this.signers[2]).setValidateConfigs([config])
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                this.boundValidator.connect(this.signers[1]).setValidateConfig(config)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        })
    })
    describe('add validation config', function () {
        it('length check', async function () {
            await expect(
                this.boundValidator.setValidateConfigs([])
            ).to.be.revertedWith("invalid validate config length");
        })
        it('validation config check', async function () {
            const config = {
                vToken: addr0000,
                upperBoundRatio: 0,
                lowerBoundRatio: 0,
            }
            await expect(
                this.boundValidator.setValidateConfigs([config])
            ).to.be.revertedWith("can't be zero address");

            config.vToken = addr1111;
            await expect(
                this.boundValidator.setValidateConfigs([config])
            ).to.be.revertedWith("bound must be positive");

            config.lowerBoundRatio = 100;
            config.upperBoundRatio = 80;
            await expect(
                this.boundValidator.setValidateConfigs([config])
            ).to.be.revertedWith("upper bound must be higher than lowner bound");
        });
        it('config added successfully & event check', async function () {
            const config = {
                vToken: addr1111,
                upperBoundRatio: 100,
                lowerBoundRatio: 80,
            };
            const result = await this.boundValidator.setValidateConfigs([config])
            await expect(result).to.emit(this.boundValidator, 'ValidateConfigAdded').withArgs(
                addr1111, 100, 80,
            );
            const savedConfig = await this.boundValidator.validateConfigs(addr1111);
            expect(savedConfig.upperBoundRatio).to.equal(100);
            expect(savedConfig.lowerBoundRatio).to.equal(80);
            expect(savedConfig.vToken).to.equal(addr1111);
        })
    });


    describe('validate price', function () {
        it('validate pice', async function () {
            const token0 = getSimpleAddress(3);
            const validationConfig = {
                vToken: token0,
                upperBoundRatio: EXP_SCALE.mul(12).div(10),
                lowerBoundRatio: EXP_SCALE.mul(8).div(10),
            }
            await this.boundValidator.setValidateConfigs([validationConfig]);

            const anchorPrice = EXP_SCALE;

            await expect(
                this.boundValidator.validatePriceWithAnchorPrice(addr1111, 100, 0)
            ).to.be.revertedWith("validation config not exist");
            await expect(
                this.boundValidator.validatePriceWithAnchorPrice(token0, 100, 0)
            ).to.be.revertedWith("anchor price is not valid");

            let validateResult = await this.boundValidator.validatePriceWithAnchorPrice(token0, EXP_SCALE, anchorPrice)
            expect(validateResult).to.equal(true);
            validateResult = await this.boundValidator.validatePriceWithAnchorPrice(token0, EXP_SCALE.mul(100).div(79), anchorPrice)
            expect(validateResult).to.equal(false);
            validateResult = await this.boundValidator.validatePriceWithAnchorPrice(token0, EXP_SCALE.mul(100).div(121), anchorPrice)
            expect(validateResult).to.equal(false);
        })
    })
});