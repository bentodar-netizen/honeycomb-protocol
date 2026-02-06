// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAIAgentRegistry {
    function agentExists(uint256 agentId) external view returns (bool);
    function isAgentActive(uint256 agentId) external view returns (bool);
    function calculateCost(uint256 agentId, uint256 units) external view returns (uint256);
    function getAgent(uint256 agentId) external view returns (
        uint256 id,
        address owner,
        address payoutAddress,
        string memory metadataCID,
        uint8 pricingType,
        uint256 priceWeiPerUnit,
        uint256 createdAt,
        uint256 updatedAt,
        bool verified,
        bool active,
        uint256 totalUsageUnits,
        uint256 totalEarningsWei
    );
}

/**
 * @title HoneycombAIAgentEscrow
 * @notice Escrow contract for AI agent usage payments with 99/1% split
 * @dev Users pay for AI agent usage, 99% goes to agent owner, 1% to platform fee vault
 */
contract HoneycombAIAgentEscrow is Ownable, ReentrancyGuard {
    
    uint256 public constant PLATFORM_FEE_BPS = 100; // 1% = 100 basis points
    uint256 public constant BPS_DENOMINATOR = 10000;

    address public immutable registry;
    address public feeVault;

    mapping(uint256 => uint256) public agentBalances;
    mapping(bytes32 => bool) public usedPaymentHashes;

    event UsagePaid(
        uint256 indexed agentId,
        address indexed user,
        uint256 units,
        uint256 totalAmount,
        uint256 agentAmount,
        uint256 platformFee,
        bytes32 paymentHash,
        uint256 timestamp
    );

    event EarningsWithdrawn(
        uint256 indexed agentId,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    event FeeVaultUpdated(
        address oldVault,
        address newVault,
        uint256 timestamp
    );

    error AgentNotFound();
    error AgentNotActive();
    error InsufficientPayment();
    error InvalidUnits();
    error WithdrawFailed();
    error InsufficientBalance();
    error NotAgentOwner();
    error PaymentAlreadyUsed();
    error InvalidFeeVault();

    constructor(address _registry, address _feeVault) Ownable(msg.sender) {
        require(_registry != address(0), "Invalid registry");
        require(_feeVault != address(0), "Invalid fee vault");
        registry = _registry;
        feeVault = _feeVault;
    }

    /**
     * @notice Pay for AI agent usage
     * @param agentId The AI agent ID
     * @param units Number of units to pay for
     * @return paymentHash Unique hash for this payment (used for backend verification)
     */
    function payForUsage(uint256 agentId, uint256 units) 
        external 
        payable 
        nonReentrant 
        returns (bytes32 paymentHash) 
    {
        if (units == 0) revert InvalidUnits();
        
        // Verify agent exists and is active via registry
        (bool success, bytes memory data) = registry.staticcall(
            abi.encodeWithSignature("agentExists(uint256)", agentId)
        );
        require(success && abi.decode(data, (bool)), "Agent not found");
        
        (success, data) = registry.staticcall(
            abi.encodeWithSignature("isAgentActive(uint256)", agentId)
        );
        require(success && abi.decode(data, (bool)), "Agent not active");

        // Get required cost from registry
        (success, data) = registry.staticcall(
            abi.encodeWithSignature("calculateCost(uint256,uint256)", agentId, units)
        );
        require(success, "Failed to calculate cost");
        uint256 requiredAmount = abi.decode(data, (uint256));
        
        if (msg.value < requiredAmount) revert InsufficientPayment();

        // Generate unique payment hash
        paymentHash = keccak256(abi.encodePacked(
            agentId,
            msg.sender,
            units,
            msg.value,
            block.timestamp,
            block.number
        ));
        
        if (usedPaymentHashes[paymentHash]) revert PaymentAlreadyUsed();
        usedPaymentHashes[paymentHash] = true;

        // Calculate split: 1% to platform, 99% to agent
        uint256 platformFee = (msg.value * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 agentAmount = msg.value - platformFee;

        // Credit agent balance
        agentBalances[agentId] += agentAmount;

        // Send platform fee to vault
        if (platformFee > 0) {
            (bool feeSuccess, ) = feeVault.call{value: platformFee}("");
            require(feeSuccess, "Fee transfer failed");
        }

        emit UsagePaid(
            agentId,
            msg.sender,
            units,
            msg.value,
            agentAmount,
            platformFee,
            paymentHash,
            block.timestamp
        );

        // Refund excess payment
        if (msg.value > requiredAmount) {
            uint256 refund = msg.value - requiredAmount;
            (bool refundSuccess, ) = msg.sender.call{value: refund}("");
            require(refundSuccess, "Refund failed");
        }
    }

    /**
     * @notice Withdraw agent earnings
     * @param agentId The AI agent ID
     */
    function withdrawAgentEarnings(uint256 agentId) external nonReentrant {
        // Get agent owner from registry
        (bool success, bytes memory data) = registry.staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", agentId)
        );
        require(success, "Failed to get owner");
        address agentOwner = abi.decode(data, (address));
        
        if (msg.sender != agentOwner) revert NotAgentOwner();

        uint256 balance = agentBalances[agentId];
        if (balance == 0) revert InsufficientBalance();

        agentBalances[agentId] = 0;

        // Get payout address from registry
        (success, data) = registry.staticcall(
            abi.encodeWithSignature("getAgent(uint256)", agentId)
        );
        require(success, "Failed to get agent");
        
        // Decode just the payoutAddress (3rd field)
        // AIAgent struct: id, owner, payoutAddress, ...
        assembly {
            // Skip function selector offset and length, get payoutAddress at offset 64 (32*2)
            data := add(data, 32) // skip length prefix
        }
        (, , address payoutAddress, , , , , , , , , ) = abi.decode(
            data, 
            (uint256, address, address, string, uint8, uint256, uint256, uint256, bool, bool, uint256, uint256)
        );

        (bool withdrawSuccess, ) = payoutAddress.call{value: balance}("");
        if (!withdrawSuccess) revert WithdrawFailed();

        emit EarningsWithdrawn(agentId, payoutAddress, balance, block.timestamp);
    }

    /**
     * @notice Update fee vault address (owner only)
     * @param newFeeVault New fee vault address
     */
    function updateFeeVault(address newFeeVault) external onlyOwner {
        if (newFeeVault == address(0)) revert InvalidFeeVault();
        
        address oldVault = feeVault;
        feeVault = newFeeVault;

        emit FeeVaultUpdated(oldVault, newFeeVault, block.timestamp);
    }

    /**
     * @notice Get agent balance
     * @param agentId The AI agent ID
     * @return balance Current balance in wei
     */
    function getAgentBalance(uint256 agentId) external view returns (uint256) {
        return agentBalances[agentId];
    }

    /**
     * @notice Calculate payment details for a quote
     * @param agentId The AI agent ID
     * @param units Number of units
     * @return totalCost Total cost in wei
     * @return platformFee Platform fee in wei (1%)
     * @return agentEarnings Agent earnings in wei (99%)
     */
    function calculatePayment(uint256 agentId, uint256 units) 
        external 
        view 
        returns (uint256 totalCost, uint256 platformFee, uint256 agentEarnings) 
    {
        (bool success, bytes memory data) = registry.staticcall(
            abi.encodeWithSignature("calculateCost(uint256,uint256)", agentId, units)
        );
        require(success, "Failed to calculate cost");
        totalCost = abi.decode(data, (uint256));
        
        platformFee = (totalCost * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        agentEarnings = totalCost - platformFee;
    }

    /**
     * @notice Verify if a payment hash has been used
     * @param paymentHash The payment hash to check
     * @return used Whether the hash has been used
     */
    function isPaymentUsed(bytes32 paymentHash) external view returns (bool) {
        return usedPaymentHashes[paymentHash];
    }

    /**
     * @notice Get platform fee percentage
     * @return feeBps Fee in basis points (100 = 1%)
     */
    function getPlatformFeeBps() external pure returns (uint256) {
        return PLATFORM_FEE_BPS;
    }
}
