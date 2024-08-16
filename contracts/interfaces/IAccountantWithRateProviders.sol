pragma solidity 0.8.25;

interface IAccountantWithRateProviders {
    function getRate() external view returns (uint256);
}
