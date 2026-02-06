// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IConditionModule {
    function isSatisfied(uint256 escrowId, bytes calldata conditionData) external view returns (bool);
}
