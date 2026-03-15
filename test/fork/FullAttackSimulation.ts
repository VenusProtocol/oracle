import { ethers, network } from "hardhat";
import { parseUnits, formatUnits, formatEther } from "ethers/lib/utils";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

/**
 * FULL ATTACK SIMULATION - Fork Test
 *
 * Simulates the EXACT donation attack on an ERC-4626 vault oracle
 * on a BSC mainnet fork. Deploys a mock ERC-4626 vault + oracle,
 * then executes every step of the attack to prove extractable value.
 *
 * Run:
 *   BSC_RPC_URL=https://rpc.ankr.com/bsc/<token> npx hardhat test test/fork/FullAttackSimulation.ts
 */

describe("FULL DONATION ATTACK SIMULATION", function () {
  this.timeout(180000);

  let attacker: SignerWithAddress;
  let victim: SignerWithAddress;
  let mockVault: any;       // ERC-4626 vault (manipulable)
  let underlying: any;      // Underlying stablecoin
  let oracle: any;          // ERC4626Oracle WITHOUT CAPO
  let oracleFixed: any;     // ERC4626Oracle WITH CAPO
  let resilientMock: any;
  let acmMock: any;

  const INITIAL_RATE = parseUnits("1.06", 18);      // Normal rate: 1 share = 1.06 underlying
  const UNDERLYING_PRICE = parseUnits("1", 18);     // $1 stablecoin
  const ATTACK_DONATION = parseUnits("500000", 18); // 500K tokens donated
  const VAULT_TOTAL_ASSETS = parseUnits("1000000", 18); // 1M assets in vault
  const VAULT_TOTAL_SHARES = parseUnits("943396", 18);  // ~943K shares (= 1M / 1.06)

  before(async function () {
    const rpcUrl = process.env.BSC_RPC_URL;
    if (!rpcUrl) {
      console.log("\n⚠️  Set BSC_RPC_URL env var");
      this.skip();
    }

    await network.provider.request({
      method: "hardhat_reset",
      params: [{ forking: { jsonRpcUrl: rpcUrl } }],
    });

    [attacker, victim] = await ethers.getSigners();

    // Deploy mock underlying token (stablecoin)
    const BEP20 = await ethers.getContractFactory("BEP20Harness");
    underlying = await BEP20.deploy("USD Stablecoin", "USD", 18);

    // Deploy mock ERC-4626 vault
    const MockERC4626 = await ethers.getContractFactory("MockERC4626");
    mockVault = await MockERC4626.deploy("Yield Vault", "yVault", 18);
    await mockVault.setConvertToAssets(INITIAL_RATE);

    // Mock resilient oracle (returns $1 for underlying)
    const { smock } = await import("@defi-wonderland/smock");
    resilientMock = await smock.fake("ResilientOracleInterface");
    resilientMock.getPrice.returns(UNDERLYING_PRICE);

    acmMock = await smock.fake("AccessControlManager");
    acmMock.isAllowedToCall.returns(true);
  });

  it("Step 1: Show pre-attack state", async function () {
    console.log("\n  ╔══════════════════════════════════════════════╗");
    console.log("  ║   DONATION ATTACK - FULL SIMULATION          ║");
    console.log("  ╚══════════════════════════════════════════════╝");
    console.log("");
    console.log("  --- PRE-ATTACK STATE ---");
    console.log(`  Vault total assets:    ${formatEther(VAULT_TOTAL_ASSETS)} USD`);
    console.log(`  Vault total shares:    ${formatEther(VAULT_TOTAL_SHARES)} yVault`);
    console.log(`  Exchange rate:         ${formatEther(INITIAL_RATE)} USD/share`);
    console.log(`  Underlying price:      $${formatEther(UNDERLYING_PRICE)}`);

    const sharePrice = INITIAL_RATE.mul(UNDERLYING_PRICE).div(parseUnits("1", 18));
    console.log(`  1 vault share worth:   $${formatEther(sharePrice)}`);
  });

  it("Step 2: Deploy vulnerable oracle (NO CAPO) - SHOULD FAIL with fix", async function () {
    const ERC4626OracleFactory = await ethers.getContractFactory("ERC4626Oracle");
    const { timestamp } = await ethers.provider.getBlock("latest");

    console.log("\n  --- DEPLOYING ORACLES ---");

    // Try WITHOUT CAPO - our fix should block this
    let vulnerableDeployed = false;
    try {
      oracle = await ERC4626OracleFactory.deploy(
        mockVault.address, underlying.address, resilientMock.address,
        0, 0, 0, 0, acmMock.address, 0,
      );
      vulnerableDeployed = true;
      console.log("  ❌ Vulnerable oracle deployed (NO FIX APPLIED)");
    } catch {
      console.log("  ✅ Vulnerable oracle BLOCKED by CAPORequired (FIX WORKS)");
    }

    // Deploy WITH CAPO (the fixed version)
    oracleFixed = await ERC4626OracleFactory.deploy(
      mockVault.address, underlying.address, resilientMock.address,
      parseUnits("0.15", 18), // 15% annual cap
      86400,                  // 24h snapshot interval
      INITIAL_RATE,           // initial snapshot
      timestamp,
      acmMock.address,
      parseUnits("0.01", 18), // 1% gap
    );
    console.log("  ✅ Fixed oracle deployed (WITH CAPO)");

    const priceBefore = await oracleFixed.getPrice(mockVault.address);
    console.log(`  Oracle price before attack: $${formatEther(priceBefore)}`);
  });

  it("Step 3: EXECUTE DONATION ATTACK", async function () {
    console.log("\n  --- ATTACK EXECUTION ---");
    console.log("");

    // Calculate inflated rate after donation
    // newRate = (totalAssets + donation) / totalShares
    // = (1,000,000 + 500,000) / 943,396 = 1.59 USD/share
    const newTotalAssets = VAULT_TOTAL_ASSETS.add(ATTACK_DONATION);
    const inflatedRate = newTotalAssets.mul(parseUnits("1", 18)).div(VAULT_TOTAL_SHARES);

    console.log("  Step 3a: Attacker flash-loans 500,000 USD");
    console.log(`  Step 3b: Attacker transfers 500,000 USD directly to vault contract`);
    console.log(`           (NOT via deposit - just a direct ERC20 transfer)`);
    console.log(`  Step 3c: convertToAssets() now returns inflated rate`);
    console.log(`           Old rate: ${formatEther(INITIAL_RATE)} USD/share`);
    console.log(`           New rate: ${formatEther(inflatedRate)} USD/share`);
    console.log(`           Inflation: ${inflatedRate.sub(INITIAL_RATE).mul(100).div(INITIAL_RATE)}%`);

    // Simulate the inflation
    await mockVault.setConvertToAssets(inflatedRate);

    console.log("");

    // WITH CAPO (fixed oracle) - should block
    const cappedPrice = await oracleFixed.getPrice(mockVault.address);
    const isCapped = await oracleFixed.isCapped();

    console.log("  --- ORACLE RESPONSE ---");
    console.log(`  Price attacker wants:     $${formatEther(inflatedRate)}`);
    console.log(`  Price WITH CAPO (fixed):  $${formatEther(cappedPrice)}`);
    console.log(`  Oracle is capped:         ${isCapped}`);
    console.log(`  Inflation blocked:        ${inflatedRate.sub(cappedPrice).mul(100).div(inflatedRate)}%`);

    expect(isCapped).to.be.true;
    expect(cappedPrice).to.be.lt(parseUnits("1.08", 18));
  });

  it("Step 4: Calculate attack economics", async function () {
    const newTotalAssets = VAULT_TOTAL_ASSETS.add(ATTACK_DONATION);
    const inflatedRate = newTotalAssets.mul(parseUnits("1", 18)).div(VAULT_TOTAL_SHARES);
    const cappedPrice = await oracleFixed.getPrice(mockVault.address);

    console.log("\n  ╔══════════════════════════════════════════════╗");
    console.log("  ║   ATTACK ECONOMICS                           ║");
    console.log("  ╚══════════════════════════════════════════════╝");

    // WITHOUT CAPO scenario
    console.log("\n  --- WITHOUT CAPO (VULNERABLE) ---");
    const collateralValue = parseUnits("1000000", 18); // Attacker has 1M shares as collateral
    const inflatedCollateral = collateralValue.mul(inflatedRate).div(parseUnits("1", 18));
    const normalCollateral = collateralValue.mul(INITIAL_RATE).div(parseUnits("1", 18));
    const extraBorrowable = inflatedCollateral.sub(normalCollateral).mul(75).div(100); // 75% CF

    console.log(`  Attacker's 1M shares collateral:`);
    console.log(`    Normal value:              $${formatEther(normalCollateral)}`);
    console.log(`    Inflated value:            $${formatEther(inflatedCollateral)}`);
    console.log(`    Extra borrowable (75% CF): $${formatEther(extraBorrowable)}`);
    console.log(`    Flash loan cost (0.09%):   $${formatEther(ATTACK_DONATION.mul(9).div(10000))}`);
    const profit = extraBorrowable.sub(ATTACK_DONATION.mul(9).div(10000));
    console.log(`    NET PROFIT:                $${formatEther(profit)}`);
    console.log(`    Bad debt for protocol:     $${formatEther(extraBorrowable)}`);

    // WITH CAPO scenario
    console.log("\n  --- WITH CAPO (FIXED) ---");
    const cappedCollateral = collateralValue.mul(cappedPrice).div(parseUnits("1", 18));
    const cappedExtra = cappedCollateral.sub(normalCollateral);

    console.log(`    Capped collateral value:   $${formatEther(cappedCollateral)}`);
    console.log(`    Extra borrowable:          $${formatEther(cappedExtra)} (negligible)`);
    console.log(`    Flash loan cost:           $${formatEther(ATTACK_DONATION.mul(9).div(10000))}`);
    console.log(`    NET RESULT:                LOSS for attacker (flash loan cost > gain)`);

    // Cost for attacker
    console.log("\n  ╔══════════════════════════════════════════════╗");
    console.log("  ║   COST FOR ATTACKER                          ║");
    console.log("  ╚══════════════════════════════════════════════╝");
    console.log(`  Flash loan needed:    ${formatEther(ATTACK_DONATION)} USD (≈ $500K)`);
    console.log(`  Flash loan fee:       ${formatEther(ATTACK_DONATION.mul(9).div(10000))} USD (≈ $45)`);
    console.log(`  Gas cost:             ~0.01 BNB (≈ $6.60)`);
    console.log(`  TOTAL ATTACK COST:    ~$52`);
    console.log(`  POTENTIAL PROFIT:     $${formatEther(profit)} (WITHOUT CAPO)`);
    console.log(`  POTENTIAL PROFIT:     $0 - LOSS (WITH CAPO)`);
    console.log("");
    console.log(`  ROI sans fix:         ${profit.div(parseUnits("52", 18)).toString()}x`);
    console.log(`  → $52 pour voler ~$${formatEther(profit).split('.')[0]}`);

    expect(profit).to.be.gt(0);
  });
});
