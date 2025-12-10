import { impersonateAccount, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

import type { IAccessControlManagerV8, PancakeSwapOracle, SentinelOracle, UniswapOracle } from "../../typechain-types";
import { IAccessControlManagerV8__factory } from "../../typechain-types";
import { forking } from "./utils";

const TRX = "0xCE7de646e7208a4Ef112cb6ed5038FA6cC6b12e3";
const BTCB = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const NORMAL_TIMELOCK = "0x939bD8d64c0A9583A7Dcea9933f7b21697ab6396";
const ACM = "0x4788629abc6cfca10f9f969efdeaa1cf70c23555";
const ORACLE = "0x6592b5DE802159F3E74B2486b091D11a8256ab8A";

const FORKED_NETWORK: string = process.env.FORKED_NETWORK || "";
const FORK: boolean = process.env.FORK === "true";

async function setupFixture() {
  await impersonateAccount(NORMAL_TIMELOCK);
  const timelock = await ethers.getSigner(NORMAL_TIMELOCK);

  const pancakeSwapOracleFactory = await ethers.getContractFactory("PancakeSwapOracle");
  const pancakeSwapOracle = await upgrades.deployProxy(pancakeSwapOracleFactory, [ACM], {
    constructorArgs: [ORACLE],
    unsafeAllow: ["constructor", "internal-function-storage"],
  });

  const uniswapOracleFactory = await ethers.getContractFactory("UniswapOracle");
  const uniswapOracle = await upgrades.deployProxy(uniswapOracleFactory, [ACM], {
    constructorArgs: [ORACLE],
    unsafeAllow: ["constructor", "internal-function-storage"],
  });

  const sentinelOracleFactory = await ethers.getContractFactory("SentinelOracle");
  const sentinelOracle = (await upgrades.deployProxy(sentinelOracleFactory, [ACM], {
    unsafeAllow: ["constructor", "internal-function-storage"],
  })) as SentinelOracle;

  const acm = IAccessControlManagerV8__factory.connect(ACM, timelock) as IAccessControlManagerV8;
  await acm
    .connect(timelock)
    .giveCallPermission(pancakeSwapOracle.address, "setPoolConfig(address,address)", NORMAL_TIMELOCK);
  await acm
    .connect(timelock)
    .giveCallPermission(uniswapOracle.address, "setPoolConfig(address,address)", NORMAL_TIMELOCK);
  await acm
    .connect(timelock)
    .giveCallPermission(sentinelOracle.address, "setTokenOracleConfig(address,address)", NORMAL_TIMELOCK);

  return { timelock, pancakeSwapOracle, uniswapOracle, sentinelOracle };
}

if (FORK && FORKED_NETWORK === "bscmainnet") {
  forking(70909246, () => {
    describe("SentinelOracle DEX prices", () => {
      let sentinelOracle: SentinelOracle;
      let pancakeSwapOracle: PancakeSwapOracle;
      let uniswapOracle: UniswapOracle;
      let timelock: SignerWithAddress;

      beforeEach(async () => {
        ({ timelock, pancakeSwapOracle, uniswapOracle, sentinelOracle } = await loadFixture(setupFixture));

        await pancakeSwapOracle.connect(timelock).setPoolConfig(TRX, "0xF683113764E4499c473aCd38Fc4b37E71554E4aD");
        await pancakeSwapOracle.connect(timelock).setPoolConfig(USDT, "0x172fcD41E0913e95784454622d1c3724f546f849");

        await uniswapOracle.connect(timelock).setPoolConfig(BTCB, "0x28dF0835942396B7a1b7aE1cd068728E6ddBbAfD");

        await sentinelOracle.connect(timelock).setTokenOracleConfig(TRX, pancakeSwapOracle.address);
        await sentinelOracle.connect(timelock).setTokenOracleConfig(USDT, pancakeSwapOracle.address);
        await sentinelOracle.connect(timelock).setTokenOracleConfig(BTCB, uniswapOracle.address);
      });

      it("check TRX price from PancakeSwap", async () => {
        const price = await sentinelOracle.getPrice(TRX);
        expect(price).to.be.equal(parseUnits("0.287615712885971478", 30));
      });

      it("check USDT price from PancakeSwap", async () => {
        const price = await sentinelOracle.getPrice(USDT);
        expect(price).to.be.equal(parseUnits("0.999676428802385649", 18));
      });

      it("check BTCB price from Uniswap", async () => {
        const price = await sentinelOracle.getPrice(BTCB);
        expect(price).to.be.equal(parseUnits("91784.949423700465674501", 18));
      });
    });
  });
}
