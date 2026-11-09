// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { AccessControlManager } from "@venusprotocol/governance-contracts/contracts/Governance/AccessControlManager.sol";
import { Test } from "forge-std/Test.sol";

import { BoundValidator } from "../../contracts/oracles/BoundValidator.sol";

/// @notice A reported price is valid when anchorPrice / reportedPrice lies within the asset's bounds.
contract BoundValidatorTest is Test {
    BoundValidator internal validator;

    address internal constant ASSET = address(0xA55E7);

    /// @dev Headroom for the anchorPrice * 1e18 the validator computes.
    uint256 internal constant MAX_PRICE = 1e40;

    function setUp() public {
        AccessControlManager acm = new AccessControlManager();
        BoundValidator implementation = new BoundValidator();
        validator = BoundValidator(
            address(
                new ERC1967Proxy(address(implementation), abi.encodeCall(BoundValidator.initialize, (address(acm))))
            )
        );
        acm.giveCallPermission(address(validator), "setValidateConfig(ValidateConfig)", address(this));
    }

    function testFuzz_priceEqualToTheAnchorIsValid(uint256 price, uint256 lower, uint256 upper) public {
        price = bound(price, 1, MAX_PRICE);
        lower = bound(lower, 1, 1e18);
        upper = bound(upper, 1e18 + 1, 100e18);
        _setBounds(lower, upper);

        assertTrue(validator.validatePriceWithAnchorPrice(ASSET, price, price));
    }

    /// @notice The valid prices form one interval around the anchor: if a price is accepted, so is
    ///  every price between it and the anchor. A gap would mean rejecting a price closer to the
    ///  anchor than one that is accepted.
    function testFuzz_pricesBetweenAValidPriceAndTheAnchorAreValid(
        uint256 anchor,
        uint256 reported,
        uint256 between
    ) public {
        _setBounds(0.9e18, 1.1e18);
        anchor = bound(anchor, 5, MAX_PRICE);
        // Wide enough to cross both bounds, narrow enough that most runs land inside them.
        reported = bound(reported, (anchor * 4) / 5, (anchor * 5) / 4);
        vm.assume(validator.validatePriceWithAnchorPrice(ASSET, reported, anchor));

        (uint256 low, uint256 high) = reported < anchor ? (reported, anchor) : (anchor, reported);
        between = bound(between, low, high);

        assertTrue(validator.validatePriceWithAnchorPrice(ASSET, between, anchor));
    }

    function _setBounds(uint256 lower, uint256 upper) internal {
        validator.setValidateConfig(
            BoundValidator.ValidateConfig({ asset: ASSET, upperBoundRatio: upper, lowerBoundRatio: lower })
        );
    }
}
