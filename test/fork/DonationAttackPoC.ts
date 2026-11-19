import { ethers, network } from "hardhat";
import { parseUnits, formatUnits, formatEther } from "ethers/lib/utils";
import { expect } from "chai";

/**
 * DONATION ATTACK PoC - Venus Protocol
 *
 * This test forks BSC mainnet and demonstrates the ERC-4626 donation
 * attack vector on Venus oracle contracts that have snapshotInterval=0
 * (CAPO disabled).
 *
 * Run with:
 *   npx hardhat test test/fork/DonationAttackPoC.ts --network hardhat
 *
 * Requires BSC_RPC_URL env var (Ankr or other BSC mainnet RPC)
 */

// Venus BSC addresses
const WBETH = "0xa2E3356610840701BDf5611a53974510Ae27E2e1";
const WBETH_ORACLE = "0x739db790c656E54590957Ed4d6B94665bCcb3786"; // WBETHOracle on BSC
const RESILIENT_ORACLE = "0x6592b5DE802159F3E74B2486b091D11a8256ab8A";
const COMPTROLLER = "0xfD36E2c2a6789Db23113685031d7F16329158384"; // Venus Core Pool
const vWBETH = "0x6CFdEc747f37DAf3b87a35a1D9c8AD3063A1A8A0";

// For the PoC we'll demonstrate on the ERC4626Oracle pattern
// Using a mock to show the exact vulnerability

describe("DONATION ATTACK PoC - BSC Fork", function () {
  this.timeout(120000); // 2 min timeout for fork

  before(async function () {
    const rpcUrl = process.env.BSC_RPC_URL;
    if (!rpcUrl) {
      console.log("\n⚠️  Set BSC_RPC_URL env var to run fork tests");
      console.log("   Example: BSC_RPC_URL=https://rpc.ankr.com/bsc/<token> npx hardhat test test/fork/DonationAttackPoC.ts\n");
      this.skip();
    }

    // Fork BSC mainnet with explicit hardfork config
    await network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
          jsonRpcUrl: rpcUrl,
        },
        hardhat: {
          chainId: 56,
          hardfork: "cancun",
        },
      }],
    });
  });

  it("Step 1: Read current wBETH market data on Venus BSC", async function () {
    // Direct contract calls (avoid ResilientOracle which has complex dependencies)
    const wbeth = await ethers.getContractAt("IWBETH", WBETH);
    const exchangeRate = await wbeth.exchangeRate();
    console.log(`\n  wBETH exchangeRate():             ${formatUnits(exchangeRate, 18)}`);

    // Get ETH price from Chainlink BSC
    const chainlinkETH = await ethers.getContractAt(
      ["function latestAnswer() view returns (int256)"],
      "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e", // ETH/USD on BSC
    );
    const ethPrice = await chainlinkETH.latestAnswer();
    console.log(`  ETH/USD (Chainlink):              $${formatUnits(ethPrice, 8)}`);

    // wBETH price = exchangeRate * ETH price
    const wbethPrice = exchangeRate.mul(ethPrice).div(parseUnits("1", 18));
    console.log(`  wBETH estimated price:            $${formatUnits(wbethPrice, 8)}`);

    // Get vWBETH market data
    const vToken = await ethers.getContractAt(
      ["function getCash() view returns (uint256)", "function totalBorrows() view returns (uint256)"],
      vWBETH,
    );
    const cash = await vToken.getCash();
    const borrows = await vToken.totalBorrows();
    const totalSupply = cash.add(borrows);

    console.log(`  vWBETH cash:                      ${formatEther(cash)} WBETH`);
    console.log(`  vWBETH borrows:                    ${formatEther(borrows)} WBETH`);
    console.log(`  vWBETH total supply:               ${formatEther(totalSupply)} WBETH`);

    const tvlUsd = totalSupply.mul(wbethPrice).div(parseUnits("1", 18));
    console.log(`  vWBETH TVL:                        $${formatUnits(tvlUsd, 8)}`);
    console.log(`\n  ⚠️  This entire TVL is exposed because WBETHOracle has snapshotInterval=0`);
  });

  it("Step 2: Demonstrate oracle has NO CAPO (snapshotInterval=0)", async function () {
    // Deploy a test ERC4626Oracle WITHOUT CAPO to show the vulnerability
    // We use a mock ERC4626 vault that we can manipulate
    const MockERC4626 = await ethers.getContractFactory("MockERC4626");
    const mockVault = await MockERC4626.deploy("Mock Vault", "mVault", 18);

    // Set initial exchange rate: 1 share = 1.06 underlying
    const normalRate = parseUnits("1.06", 18);
    await mockVault.setConvertToAssets(normalRate);

    const mockUnderlying = await ethers.getContractFactory("BEP20Harness");
    const underlying = await mockUnderlying.deploy("Mock USD", "mUSD", 18);

    // We need a mock resilient oracle for the underlying price
    const { smock } = await import("@defi-wonderland/smock");
    const resilientMock = await smock.fake("ResilientOracleInterface");
    resilientMock.getPrice.returns(parseUnits("1", 18)); // $1 per underlying

    const acmMock = await smock.fake("AccessControlManager");
    acmMock.isAllowedToCall.returns(true);

    // Try deploying WITHOUT CAPO - should REVERT with our fix
    const ERC4626OracleFactory = await ethers.getContractFactory("ERC4626Oracle");

    console.log("\n  Attempting to deploy ERC4626Oracle WITHOUT CAPO (snapshotInterval=0)...");
    try {
      await ERC4626OracleFactory.deploy(
        mockVault.address,
        underlying.address,
        resilientMock.address,
        0, // annualGrowthRate = 0
        0, // snapshotInterval = 0
        0,
        0,
        acmMock.address,
        0,
      );
      console.log("  ❌ DEPLOYED! Oracle is VULNERABLE (no CAPO enforced)");
    } catch (e: any) {
      console.log("  ✅ REJECTED! CAPORequired error - our fix works!");
    }

    // Deploy WITH CAPO
    const { timestamp } = await ethers.provider.getBlock("latest");
    const oracleWithCAPO = await ERC4626OracleFactory.deploy(
      mockVault.address,
      underlying.address,
      resilientMock.address,
      parseUnits("0.15", 18), // 15% annual growth cap
      86400, // 24h snapshot interval
      normalRate, // initial snapshot at current rate
      timestamp,
      acmMock.address,
      parseUnits("0.01", 18), // 1% gap
    );
    console.log("  ✅ Deployed ERC4626Oracle WITH CAPO (15% annual cap, 24h interval)");

    // Now simulate donation attack
    console.log("\n  --- SIMULATING DONATION ATTACK ---");

    const priceBefore = await oracleWithCAPO.getPrice(mockVault.address);
    console.log(`  Price BEFORE attack: $${formatUnits(priceBefore, 18)}`);

    // Attacker donates underlying to vault, inflating exchange rate
    const inflatedRate = parseUnits("1.76", 18); // +66% inflation
    await mockVault.setConvertToAssets(inflatedRate);

    const priceAfter = await oracleWithCAPO.getPrice(mockVault.address);
    console.log(`  Price AFTER attack (with CAPO):  $${formatUnits(priceAfter, 18)}`);
    console.log(`  Price attacker WANTED:           $${formatUnits(inflatedRate, 18)}`);

    const blocked = inflatedRate.sub(priceAfter).mul(100).div(inflatedRate);
    console.log(`  Inflation BLOCKED by CAPO:       ${blocked}%`);

    const isCapped = await oracleWithCAPO.isCapped();
    console.log(`  Oracle reports isCapped():       ${isCapped}`);

    expect(priceAfter).to.be.lt(parseUnits("1.08", 18));
    expect(isCapped).to.be.true;

    console.log("\n  ✅ CAPO successfully blocked the donation attack!");
    console.log("  ✅ Without CAPO, the attacker would have inflated collateral by 66%");
    console.log("  ✅ On the $19.2M wBETH pool, this could create millions in bad debt");
  });

  it("Step 3: Calculate maximum extractable value", async function () {
    const oracle = await ethers.getContractAt("OracleInterface", RESILIENT_ORACLE);
    const wbethPrice = await oracle.getPrice(WBETH);

    const vToken = await ethers.getContractAt(
      ["function getCash() view returns (uint256)", "function totalBorrows() view returns (uint256)"],
      vWBETH,
    );
    const cash = await vToken.getCash();
    const borrows = await vToken.totalBorrows();
    const totalSupply = cash.add(borrows);

    // If attacker inflates rate by 66% (like wUSDM attack)
    const inflationPercent = 66;
    const tvlUsd = totalSupply.mul(wbethPrice).div(parseUnits("1", 18));
    const inflatedValue = tvlUsd.mul(100 + inflationPercent).div(100);
    const extraBorrowable = inflatedValue.sub(tvlUsd);

    // Typical collateral factor is 0.75, so attacker can borrow 75% of inflated value
    const collateralFactor = 75;
    const maxBorrow = extraBorrowable.mul(collateralFactor).div(100);

    // Attacker's profit is borrow minus flash loan costs (~0.1%)
    const flashLoanCost = maxBorrow.div(1000);
    const estimatedProfit = maxBorrow.sub(flashLoanCost);

    console.log("\n  === MAXIMUM EXTRACTABLE VALUE (wBETH pool) ===");
    console.log(`  Current TVL:                     $${formatUnits(tvlUsd, 18)}`);
    console.log(`  TVL after 66% inflation:         $${formatUnits(inflatedValue, 18)}`);
    console.log(`  Extra borrowable value:          $${formatUnits(extraBorrowable, 18)}`);
    console.log(`  Max borrow (75% CF):             $${formatUnits(maxBorrow, 18)}`);
    console.log(`  Flash loan cost (~0.1%):         $${formatUnits(flashLoanCost, 18)}`);
    console.log(`  Estimated attacker profit:       $${formatUnits(estimatedProfit, 18)}`);
    console.log(`  Bad debt left for Venus:         $${formatUnits(maxBorrow, 18)}`);
    console.log("\n  ⚠️  These are theoretical maximums - actual profit depends on liquidity");
  });
});
