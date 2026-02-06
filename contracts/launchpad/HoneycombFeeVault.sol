// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HoneycombFeeVault
 * @notice Treasury contract that receives 1% trading fees from the bonding curve market
 * @dev Fees are collected in native coin (BNB on BSC, ETH on Hardhat)
 */
contract HoneycombFeeVault is Ownable, ReentrancyGuard {
    
    event FeeReceived(address indexed from, uint256 amount, uint256 timestamp);
    event FeeWithdrawn(address indexed to, uint256 amount, uint256 timestamp);

    error WithdrawFailed();
    error InsufficientBalance();
    error ZeroAmount();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Receive native coin fees
     */
    receive() external payable {
        emit FeeReceived(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @notice Withdraw fees from the vault
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > address(this).balance) revert InsufficientBalance();

        (bool success, ) = to.call{value: amount}("");
        if (!success) revert WithdrawFailed();

        emit FeeWithdrawn(to, amount, block.timestamp);
    }

    /**
     * @notice Get current vault balance
     */
    function balance() external view returns (uint256) {
        return address(this).balance;
    }
}
