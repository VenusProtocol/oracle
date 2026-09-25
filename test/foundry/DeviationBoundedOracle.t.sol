// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { AccessControlManager } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlManager.sol";
import { CommonBase } from "forge-std/Base.sol";
import { StdCheats } from "forge-std/StdCheats.sol";
import { StdUtils } from "forge-std/StdUtils.sol";
import { Test } from "forge-std/Test.sol";

import { DeviationBoundedOracle } from "../../contracts/DeviationBoundedOracle.sol";
import { IDeviationBoundedOracle } from "../../contracts/interfaces/IDeviationBoundedOracle.sol";
import { ResilientOracleInterface } from "../../contracts/interfaces/OracleInterface.sol";
import { MockSimpleOracle } from "../../contracts/test/MockSimpleOracle.sol";
import { VBEP20Harness } from "../../contracts/test/VBEP20Harness.sol";

uint256 constant MIN_PRICE = 1e12;
uint256 constant MAX_PRICE = 1e30;

/// @dev Drives the oracle the way production does: the spot price moves, markets observe it on
///  borrow and liquidate, a keeper corrects the window, and time passes.
contract DeviationBoundedOracleHandler is CommonBase, StdCheats, StdUtils {
    DeviationBoundedOracle public immutable dbo;
    MockSimpleOracle public immutable spotOracle;
    address public immutable vToken;
    address public immutable asset;

    constructor(DeviationBoundedOracle dbo_, MockSimpleOracle spotOracle_, address vToken_, address asset_) {
        dbo = dbo_;
        spotOracle = spotOracle_;
        vToken = vToken_;
        asset = asset_;
    }

    /// @dev Up to 15% either way, so some moves cross the 10% trigger and some do not.
    function movePrice(uint256 seed) external {
        uint256 spot = spotOracle.getPrice(asset);
        uint256 next = bound(seed, (spot * 85) / 100, (spot * 115) / 100);
        spotOracle.setPrice(asset, bound(next, MIN_PRICE, MAX_PRICE));
    }

    function observe() external {
        dbo.updateProtectionState(vToken);
    }

    /// @dev The keeper pulls the window toward spot. The minimum stays at or below both the spot and
    ///  the maximum, as the oracle requires, and within 10% of that cap.
    function keeperSetsMin(uint256 seed) external {
        (, uint128 maxPrice) = _window();
        uint256 cap = _min(spotOracle.getPrice(asset), maxPrice);
        dbo.updateMinPrice(asset, uint128(bound(seed, (cap * 9) / 10, cap)));
    }

    /// @dev Likewise the maximum: at or above both the spot and the minimum, within 10% of that floor.
    function keeperSetsMax(uint256 seed) external {
        (uint128 minPrice, ) = _window();
        uint256 floor = _max(spotOracle.getPrice(asset), minPrice);
        dbo.updateMaxPrice(asset, uint128(bound(seed, floor, (floor * 11) / 10)));
    }

    function keeperExitsProtection() external {
        if (dbo.canExitProtection(asset)) dbo.exitProtectionMode(asset);
    }

    function passTime(uint256 secondsElapsed) external {
        vm.warp(block.timestamp + bound(secondsElapsed, 1, 2 days));
    }

    function _window() internal view returns (uint128 minPrice, uint128 maxPrice) {
        (minPrice, maxPrice, , , , , , , , ) = dbo.assetProtectionConfig(asset);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }
}

/// @notice The bounded oracle may only ever make a position look worse than spot: collateral priced
///  at or below it, debt at or above it.
contract DeviationBoundedOracleTest is Test {
    DeviationBoundedOracle internal dbo;
    DeviationBoundedOracleHandler internal handler;
    MockSimpleOracle internal spotOracle;
    address internal asset = makeAddr("asset");
    address internal vToken;

    uint256 internal constant INITIAL_PRICE = 1e18;
    uint256 internal constant TRIGGER_THRESHOLD = 10e16;

    function setUp() public {
        spotOracle = new MockSimpleOracle();
        spotOracle.setPrice(asset, INITIAL_PRICE);
        vToken = address(new VBEP20Harness("Venus Asset", "vASSET", 8, asset));

        AccessControlManager acm = new AccessControlManager();
        DeviationBoundedOracle implementation = new DeviationBoundedOracle(
            ResilientOracleInterface(address(spotOracle)),
            makeAddr("vBNB"),
            makeAddr("VAI")
        );
        dbo = DeviationBoundedOracle(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(DeviationBoundedOracle.initialize, (address(acm)))
                )
            )
        );
        handler = new DeviationBoundedOracleHandler(dbo, spotOracle, vToken, asset);

        acm.giveCallPermission(
            address(dbo),
            "setTokenConfig((address,uint64,uint256,uint256,bool,bool))",
            address(this)
        );
        acm.giveCallPermission(address(dbo), "updateMinPrice(address,uint128)", address(handler));
        acm.giveCallPermission(address(dbo), "updateMaxPrice(address,uint128)", address(handler));
        acm.giveCallPermission(address(dbo), "exitProtectionMode(address)", address(handler));

        dbo.setTokenConfig(
            IDeviationBoundedOracle.TokenConfigInput({
                asset: asset,
                cooldownPeriod: 1 hours,
                triggerThreshold: TRIGGER_THRESHOLD,
                resetThreshold: 5e16,
                enableBoundedPricing: true,
                enableCaching: false
            })
        );

        targetContract(address(handler));
    }

    /// @notice A jump past the trigger switches protection on and prices the position at the worse
    ///  of the old and new price: collateral at the lower, debt at the higher.
    function testFuzz_aMovePastTheTriggerEngagesProtection(uint256 movedPrice, bool up) public {
        movedPrice = up
            ? bound(movedPrice, (INITIAL_PRICE * 111) / 100, INITIAL_PRICE * 10)
            : bound(movedPrice, INITIAL_PRICE / 10, (INITIAL_PRICE * 89) / 100);
        spotOracle.setPrice(asset, movedPrice);

        dbo.updateProtectionState(vToken);

        assertTrue(dbo.currentlyUsingProtectedPrice(asset));
        (uint256 collateralPrice, uint256 debtPrice) = dbo.getBoundedPricesView(vToken);
        assertEq(collateralPrice, up ? INITIAL_PRICE : movedPrice);
        assertEq(debtPrice, up ? movedPrice : INITIAL_PRICE);
    }

    function invariant_collateralNeverAboveSpotAndDebtNeverBelow() public view {
        uint256 spot = spotOracle.getPrice(asset);
        (uint256 collateralPrice, uint256 debtPrice) = dbo.getBoundedPricesView(vToken);

        assertLe(collateralPrice, spot);
        assertGe(debtPrice, spot);
    }

    /// @notice The view and the state-changing path compute the prices separately. Integrations
    ///  preview with one and act with the other, so the two must never disagree.
    function invariant_viewMatchesTheStateChangingPath() public {
        (uint256 viewCollateral, uint256 viewDebt) = dbo.getBoundedPricesView(vToken);

        uint256 snapshot = vm.snapshotState();
        (uint256 collateralPrice, uint256 debtPrice) = dbo.getBoundedPrices(vToken);
        vm.revertToState(snapshot);

        assertEq(collateralPrice, viewCollateral);
        assertEq(debtPrice, viewDebt);
    }

    function invariant_windowStaysPositiveAndOrdered() public view {
        (uint128 minPrice, uint128 maxPrice, , , , , , , , ) = dbo.assetProtectionConfig(asset);

        assertGt(minPrice, 0);
        assertLe(minPrice, maxPrice);
    }
}
