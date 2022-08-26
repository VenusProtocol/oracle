import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { artifacts, ethers, waffle } from "hardhat";
import { MockPivotOracle, MockSimpleOracle, VenusOracle } from "../src/types";
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
    const oracleBasementArtifact = await artifacts.readArtifact("VenusOracle");
    const oracleBasement = await waffle.deployContract(this.admin, oracleBasementArtifact, []);
    await oracleBasement.deployed();
    this.oracleBasement = <VenusOracle>oracleBasement;
  });

  describe('constructor', function () {
    it('sets address of owner', async function () {
      const owner = await this.oracleBasement.owner();
      expect(owner).to.equal(this.admin.address);
    });
  });

  describe('admin check', function () {
    it('only admin can call the setters', async function () {
      // addTokenConfigs
      await expect(
        this.oracleBasement.connect(this.signers[2]).addTokenConfigs([addr0000], [{
          oracles: [addr0000, addr0000, addr0000],
          enableFlagsForOracles: [false, false, false],
        }])
      ).to.be.revertedWith("Ownable: caller is not the owner");

      // addTokenConfig
      await expect(
        this.oracleBasement.connect(this.signers[1]).addTokenConfig(addr0000, {
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
      await this.oracleBasement.connect(this.signers[2]).addTokenConfig(addr1111,
        {
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
          this.oracleBasement.addTokenConfig(addr0000, {
            oracles: [addr1111, addr1111, addr1111],
            enableFlagsForOracles: [true, false, true],
          })
        ).to.be.revertedWith("can't be zero address");

        await expect(
          this.oracleBasement.addTokenConfig(addr1111, {
            oracles: [addr0000, addr1111, addr0000],
            enableFlagsForOracles: [true, false, true],
          })
        ).to.be.revertedWith("can't be zero address");
      });

      it('token must not exist', async function () {
        await this.oracleBasement.addTokenConfig(addr1111, {
          oracles: [addr1111, addr1111, addr1111],
          enableFlagsForOracles: [true, false, true],
        })
        await expect(
          this.oracleBasement.addTokenConfig(addr1111, {
            oracles: [addr1111, addr0000, addr0000],
            enableFlagsForOracles: [false, false, true],
          })
        ).to.be.revertedWith("token config must not exist");
      });

      it('token config added successfully & events check', async function () {
        const result = await this.oracleBasement.addTokenConfig(addr1111, {
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
          this.oracleBasement.addTokenConfigs([], [])
        ).to.be.revertedWith("length can't be 0");
        await expect(
          this.oracleBasement.addTokenConfigs([addr1111], [])
        ).to.be.revertedWith("length doesn't match");
      })

      it('token config added successfully & data check', async function () {
        await this.oracleBasement.addTokenConfigs([addr1111, getSimpleAddress(3)], [{
          oracles: [addr1111, addr1111, addr0000],
          enableFlagsForOracles: [true, false, true],
        },
        {
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
      await this.oracleBasement.addTokenConfig(addr1111, {
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
      await this.oracleBasement.addTokenConfigs([token1, token2], [{
          oracles: [this.mainOracle.address, this.pivotOracle.address, this.fallbackOracle.address],
          enableFlagsForOracles: [true, true, false],
        },
        {
          oracles: [this.mainOracle.address, this.pivotOracle.address, this.fallbackOracle.address],
          enableFlagsForOracles: [true, true, false],
        },
      ]);
      this.fallbackOracle.setPrice(token1, token1FallbackPrice);
      this.fallbackOracle.setPrice(token2, token2FallbackPrice);
    })
    it('zero price when protocol paused', async function () {
      await this.oracleBasement.pause();
      const price = await this.oracleBasement.getUnderlyingPrice(token1);
      expect(price).to.equal(0);
    })
    it('zero price when main oracle is disabled', async function () {
      await this.oracleBasement.enableOracle(token1, 0, false);
      const price = await this.oracleBasement.getUnderlyingPrice(token1);
      expect(price).to.equal(0);
    })
    it('zero price main oracle returns 0', async function () {
      await this.mainOracle.setPrice(token1, 0);
      const price = await this.oracleBasement.getUnderlyingPrice(token1);
      expect(price).to.equal(0);
    })
    it('zero price if fails checking', async function () {
      await this.mainOracle.setPrice(token1, 1000);
      // invalidate the main oracle
      await this.pivotOracle.setValidateResult(token1, false);
      const price = await this.oracleBasement.getUnderlyingPrice(token1);
      expect(price).to.equal(0);
    })
    it('check price with/without pivot oracle', async function () {
      await this.mainOracle.setPrice(token1, 1000);
      await this.pivotOracle.setValidateResult(token1, false);
      // empty pivot oracle
      await this.oracleBasement.setOracle(token1, addr0000, 1);
      let price = await this.oracleBasement.getUnderlyingPrice(token1);
      expect(price).to.equal(1000);

      // set oracle back
      await this.oracleBasement.setOracle(token1, this.pivotOracle.address, 1);
      await this.mainOracle.setPrice(token1, 1000);
      // invalidate price
      await this.pivotOracle.setValidateResult(token1, false);
      price = await this.oracleBasement.getUnderlyingPrice(token1);
      expect(price).to.equal(0);
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
      let price = await this.oracleBasement.getUnderlyingPrice(token2);
      expect(price).to.equal(0);
      
      // enable fallback oracle
      await this.oracleBasement.enableOracle(token2, 2, true);
      price = await this.oracleBasement.getUnderlyingPrice(token2);
      expect(price).to.equal(token2FallbackPrice);
      // set fallback oracle to zero 
      await this.oracleBasement.setOracle(token2, addr0000, 2);
      price = await this.oracleBasement.getUnderlyingPrice(token2);
      expect(price).to.equal(0);
    })
  });
});
