import { FakeContract, smock } from "@defi-wonderland/smock";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import { OracleInterface, ReferenceOracle, ReferenceOracle__factory, ResilientOracle } from "../typechain-types";
import { addr0000, addr1111 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

describe("ReferenceOracle", () => {
  const RESILIENT_ORACLE_PRICE = parseUnits("1.23", 18);
  const OTHER_ORACLE_PRICE = parseUnits("4.56", 18);
  let admin: SignerWithAddress;
  let someone: SignerWithAddress;
  let resilientOracle: FakeContract<ResilientOracle>;
  let someOracle: FakeContract<OracleInterface>;
  let referenceOracleFactory: ReferenceOracle__factory;
  let referenceOracle: ReferenceOracle;

  before(async () => {
    [admin, someone] = await ethers.getSigners();
    referenceOracleFactory = <ReferenceOracle__factory>await ethers.getContractFactory("ReferenceOracle", admin);
    resilientOracle = await smock.fake<ResilientOracle>("ResilientOracle");
    someOracle = await smock.fake<OracleInterface>("OracleInterface");
  });

  beforeEach(async () => {
    referenceOracle = await upgrades.deployProxy(referenceOracleFactory, [], {
      constructorArgs: [resilientOracle.address],
    });
    resilientOracle.getPrice.returns(RESILIENT_ORACLE_PRICE);
    someOracle.getPrice.returns(OTHER_ORACLE_PRICE);
  });

  describe("setOracle", () => {
    it("reverts if the asset is zero address", async () => {
      await expect(referenceOracle.setOracle(addr0000, someOracle.address)).to.be.revertedWithCustomError(
        referenceOracle,
        "ZeroAddressNotAllowed",
      );
    });

    it("reverts if called by a non-admin", async () => {
      await expect(referenceOracle.connect(someone).setOracle(addr1111, someOracle.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("emits OracleConfigured event", async () => {
      const tx = await referenceOracle.setOracle(addr1111, someOracle.address);
      await expect(tx).to.emit(referenceOracle, "OracleConfigured").withArgs(addr1111, someOracle.address);
    });

    it("sets the new oracle", async () => {
      await referenceOracle.setOracle(addr1111, someOracle.address);
      expect(await referenceOracle.oracles(addr1111)).to.equal(someOracle.address);
    });

    it("can unset the oracle", async () => {
      await referenceOracle.setOracle(addr1111, addr0000);
      expect(await referenceOracle.oracles(addr1111)).to.equal(addr0000);
    });
  });

  describe("getPrice", () => {
    it("returns resilient oracle price if there's no oracle configured", async () => {
      expect(await referenceOracle.getPrice(addr1111)).to.equal(RESILIENT_ORACLE_PRICE);
    });

    it("returns the other oracle price if there's an oracle set for asset", async () => {
      await referenceOracle.setOracle(addr1111, someOracle.address);
      expect(await referenceOracle.getPrice(addr1111)).to.equal(OTHER_ORACLE_PRICE);
    });
  });

  describe("getPriceAssuming", () => {
    it("returns the assumed price if no oracle is configured", async () => {
      const price = parseUnits("7.89", 18);
      expect(await referenceOracle.callStatic.getPriceAssuming(addr1111, [{ asset: addr1111, price }])).to.equal(price);
    });

    it("returns the assumed price even if the oracle is configured", async () => {
      await referenceOracle.setOracle(addr1111, someOracle.address);
      const price = parseUnits("7.89", 18);
      expect(await referenceOracle.callStatic.getPriceAssuming(addr1111, [{ asset: addr1111, price }])).to.equal(price);
    });
  });
});
