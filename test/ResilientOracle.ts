import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { artifacts, ethers, upgrades, waffle } from "hardhat";
import { MockPivotOracle, MockSimpleOracle, ResilientOracle } from "../src/types";
import { addr0000, addr1111, getSimpleAddress } from "./utils/data";

const getSimpleOracle = async (account: SignerWithAddress) => {
  const oracleArtifact = await artifacts.readArtifact("MockSimpleOracle");
  const oracle = await waffle.deployContract(account, oracleArtifact, []);
  await oracle.deployed();
  return <MockSimpleOracle>oracle;
}

const getPivotOracle = async (account: SignerWithAddress) => {
  const oracleArtifact = await artifacts.readArtifact("MockPivotOracle");
  const oracle = await waffle.deployContract(account, oracleArtifact, []);
  await oracle.deployed();
  return <MockPivotOracle>oracle;
}

describe("Oracle plugin frame unit tests", function () {
  before(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.signers = signers;
    this.admin = admin;
    this.mainOracle = await getSimpleOracle(admin);
    this.pivotOracle = await getPivotOracle(admin);;
    this.fallbackOracle = await getSimpleOracle(admin);
  });

  beforeEach(async function () {
    const ResilientOracle = await ethers.getContractFactory("ResilientOracle", this.admin);
    const instance = <ResilientOracle>await upgrades.deployProxy(ResilientOracle, []);
    this.oracleBasement = instance;
  });

  describe('constructor', function () {
    it('sets address of owner', async function () {
      const owner = await this.oracleBasement.owner();
      expect(owner).to.equal(this.admin.address);
    });
  });

  describe('admin check', function () {
    it('only admin can call the setters', async function () {
      // setTokenConfigs
      await expect(
        this.oracleBasement.connect(this.signers[2]).setTokenConfigs([{
          vToken: addr0000,
          oracles: [addr0000, addr0000, addr0000],
          enableFlagsForOracles: [false, false, false],
        }])
      ).to.be.revertedWith("Ownable: caller is not the owner");

      // setTokenConfig
      await expect(
        this.oracleBasement.connect(this.signers[1]).setTokenConfig({
          vToken: addr0000,
          oracles: [addr0000, addr0000, addr0000],
          enableFlagsForOracles: [false, false, false],
        })
      ).to.be.revertedWith("Ownable: caller is not the owner");

      // setOracle
      await expect(
        this.oracleBasement.connect(this.signers[2]).setOracle(addr0000, addr0000, 0)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      // enableOracle
      await expect(
        this.oracleBasement.connect(this.signers[2]).enableOracle(addr0000, 0, false)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      // pause & unpause
      await expect(
        this.oracleBasement.connect(this.signers[2]).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(
        this.oracleBasement.connect(this.signers[2]).unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    })

    it('transfer owner', async function () {
      await this.oracleBasement.transferOwnership(this.signers[2].address);
      const newOwner = await this.oracleBasement.owner();
      expect(newOwner).to.equal(this.signers[2].address);
      await this.oracleBasement.connect(this.signers[2]).setTokenConfig(
        {
          vToken: addr1111,
          oracles: [addr1111, addr1111, addr1111],
          enableFlagsForOracles: [false, false, false]
        }
      );
      expect((await this.oracleBasement.getTokenConfig(addr1111)).oracles[0]).to.equal(addr1111);
    })
  });

  describe('token config', function () {
    describe('add single token config', function () {
      it('vToken can"t be zero & main oracle can\'t be zero', async function () {
        await expect(
          this.oracleBasement.setTokenConfig({
            vToken: addr0000,
            oracles: [addr1111, addr1111, addr1111],
            enableFlagsForOracles: [true, false, true],
          })
        ).to.be.revertedWith("can't be zero address");

        await expect(
          this.oracleBasement.setTokenConfig({
            vToken: addr1111,
            oracles: [addr0000, addr1111, addr0000],
            enableFlagsForOracles: [true, false, true],
          })
        ).to.be.revertedWith("can't be zero address");
      });

      it('reset token config', async function () {
        await this.oracleBasement.setTokenConfig({
          vToken: addr1111,
          oracles: [addr1111, addr1111, addr1111],
          enableFlagsForOracles: [true, false, true],
        })
        expect((await this.oracleBasement.getTokenConfig(addr1111)).enableFlagsForOracles[0]).to.equal(true);
        await this.oracleBasement.setTokenConfig({
            vToken: addr1111,
            oracles: [addr1111, addr0000, addr0000],
            enableFlagsForOracles: [false, false, true],
          })
        expect((await this.oracleBasement.getTokenConfig(addr1111)).enableFlagsForOracles[0]).to.equal(false);
      });

      it('token config added successfully & events check', async function () {
        const result = await this.oracleBasement.setTokenConfig({
          vToken: addr1111,
          oracles: [addr1111, addr1111, addr1111],
          enableFlagsForOracles: [true, false, true],
        });
        await expect(result).to.emit(this.oracleBasement, 'TokenConfigAdded').withArgs(
          addr1111, addr1111, addr1111, addr1111
        )
      });
    })

    describe('batch add token configs', function () {
      it('length check', async function () {
        await expect(
          this.oracleBasement.setTokenConfigs([])
        ).to.be.revertedWith("length can't be 0");
      })

      it('token config added successfully & data check', async function () {
        await this.oracleBasement.setTokenConfigs([{
          vToken: addr1111,
          oracles: [addr1111, addr1111, addr0000],
          enableFlagsForOracles: [true, false, true],
        },
        {
          vToken: getSimpleAddress(3),
          oracles: [addr1111, getSimpleAddress(2), getSimpleAddress(3)],
          enableFlagsForOracles: [true, false, true],
        },
        ]);
        expect((await this.oracleBasement.getTokenConfig(addr1111)).oracles[0]).to.equal(addr1111);
        expect((await this.oracleBasement.getTokenConfig(getSimpleAddress(3))).oracles[1]).to.equal(getSimpleAddress(2));
        expect((await this.oracleBasement.getTokenConfig(getSimpleAddress(3))).enableFlagsForOracles[0]).to.equal(true);
        // non exist config
        expect((await this.oracleBasement.getTokenConfig(getSimpleAddress(8))).enableFlagsForOracles[0]).to.equal(false);
      })
    });

  });

  describe('change oracle', function () {
    beforeEach(async function () {
      await this.oracleBasement.setTokenConfig({
        vToken: addr1111,
        oracles: [addr1111, addr1111, addr0000],
        enableFlagsForOracles: [true, false, true],
      });
    })
    describe('set oracle', function () {
      it('null check', async function () {
        // vToken can't be zero
        await expect(
          this.oracleBasement.setOracle(addr0000, addr1111, 0)
        ).to.be.revertedWith("can't be zero address");
        // main oracle can't be zero
        await expect(
          this.oracleBasement.setOracle(addr1111, addr0000, 0)
        ).to.be.revertedWith("can't set zero address to main oracle");
        // nothing happens
        await this.oracleBasement.setOracle(addr1111, addr1111, 0)
        await this.oracleBasement.setOracle(addr1111, addr0000, 2)

      })

      it('existance check', async function () {
        await expect(
          this.oracleBasement.setOracle(getSimpleAddress(2), addr1111, 0)
        ).to.be.revertedWith("token config must exist");
      })

      it('oracle set successfully & data check', async function () {
        await this.oracleBasement.setOracle(addr1111, getSimpleAddress(2), 1);
        expect((await this.oracleBasement.getTokenConfig(addr1111)).enableFlagsForOracles).to.eql([true, false, true]);
        expect((await this.oracleBasement.getTokenConfig(addr1111)).oracles).to.eql([addr1111, getSimpleAddress(2), addr0000]);
      })
    })
  });

  describe('get underlying price', function () {
    const token1 = addr1111;
    const token2 = getSimpleAddress(3);
    const token1FallbackPrice = 2222222;
    const token2FallbackPrice = 3333333;


    beforeEach(async function () {
      await this.oracleBasement.setTokenConfigs([{
          vToken: token1,
          oracles: [this.mainOracle.address, this.pivotOracle.address, this.fallbackOracle.address],
          enableFlagsForOracles: [true, true, false],
        },
        {
          vToken: token2,
          oracles: [this.mainOracle.address, this.pivotOracle.address, this.fallbackOracle.address],
          enableFlagsForOracles: [true, true, false],
        },
      ]);
      this.fallbackOracle.setPrice(token1, token1FallbackPrice);
      this.fallbackOracle.setPrice(token2, token2FallbackPrice);
    })
    it('revert when protocol paused', async function () {
      await this.oracleBasement.pause();
      await expect(
        this.oracleBasement.getUnderlyingPrice(token1)
      ).to.be.revertedWith("resilient oracle is paused");
    })
    it('revert price when main oracle is disabled and there is no fallback oracle', async function () {
      await this.oracleBasement.enableOracle(token1, 0, false);
      await expect(
        this.oracleBasement.getUnderlyingPrice(token1)
      ).to.be.revertedWith("invalid resilient oracle price");
    })
    it('revert price main oracle returns 0 and there is no fallback oracle', async function () {
      await this.mainOracle.setPrice(token1, 0);
      await expect(
        this.oracleBasement.getUnderlyingPrice(token1)
      ).to.be.revertedWith("invalid resilient oracle price");
    })
    it('revert if price fails checking', async function () {
      await this.mainOracle.setPrice(token1, 1000);
      // invalidate the main oracle
      await this.pivotOracle.setValidateResult(token1, false);
      await expect(
        this.oracleBasement.getUnderlyingPrice(token1)
      ).to.be.revertedWith("invalid resilient oracle price");
    })
    it('check price with/without pivot oracle', async function () {
      await this.mainOracle.setPrice(token1, 1000);
      await this.pivotOracle.setValidateResult(token1, false);
      // empty pivot oracle
      await this.oracleBasement.setOracle(token1, addr0000, 1);
      const price = await this.oracleBasement.getUnderlyingPrice(token1);
      expect(price).to.equal(1000);

      // set oracle back
      await this.oracleBasement.setOracle(token1, this.pivotOracle.address, 1);
      await this.mainOracle.setPrice(token1, 1000);
      // invalidate price
      await this.pivotOracle.setValidateResult(token1, false);
      await expect(
        this.oracleBasement.getUnderlyingPrice(token1)
      ).to.be.revertedWith("invalid resilient oracle price");
    })

    it('disable pivot oracle', async function () {
      await this.mainOracle.setPrice(token1, 1000);
      // pivot passes the price...
      await this.pivotOracle.setValidateResult(token1, true);
      // ...but pivot is disabled, so it won't come to invalidate
      await this.oracleBasement.enableOracle(token1, 1, false);
      const price = await this.oracleBasement.getUnderlyingPrice(token1);
      expect(price).to.equal(1000);
    })

    it('enable fallback oracle', async function () {
      await this.mainOracle.setPrice(token2, 1000);
      // invalidate the price first
      await this.pivotOracle.setValidateResult(token2, false);
      await expect(
        this.oracleBasement.getUnderlyingPrice(token2)
      ).to.be.revertedWith("invalid resilient oracle price");
      
      // enable fallback oracle
      await this.oracleBasement.enableOracle(token2, 2, true);
      const price = await this.oracleBasement.getUnderlyingPrice(token2);
      expect(price).to.equal(token2FallbackPrice);

      // set fallback oracle to zero address
      await this.oracleBasement.setOracle(token2, addr0000, 2);
      await expect(
        this.oracleBasement.getUnderlyingPrice(token2)
      ).to.be.revertedWith("invalid resilient oracle price");

      // bring fallback oracle to action, but return 0 price
      await this.oracleBasement.setOracle(token2, this.fallbackOracle.address, 2);
      await this.fallbackOracle.setPrice(token2, 0);
      // notice: token2 is invalidated
      await expect(
        this.oracleBasement.getUnderlyingPrice(token2)
      ).to.be.revertedWith("fallback oracle price must be positive");
    })

    it('update twap', async function () {
      expect(await this.pivotOracle.twapUpdated()).to.be.equal(false)
      await this.oracleBasement.updatePrice(token1)
      expect(await this.pivotOracle.twapUpdated()).to.be.equal(true)
    })
  });
});
