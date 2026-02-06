// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HoneycombAIAgentRegistry
 * @notice On-chain registry for paid AI agents with configurable pricing models
 * @dev AI agents are registered with metadata CID, payout address, and pricing configuration
 */
contract HoneycombAIAgentRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum PricingType {
        PER_MESSAGE,
        PER_TOKEN,
        PER_TASK
    }

    struct PricingModel {
        PricingType pricingType;
        uint256 priceWeiPerUnit;
    }

    struct AIAgent {
        uint256 id;
        address owner;
        address payoutAddress;
        string metadataCID;
        PricingModel pricing;
        uint256 createdAt;
        uint256 updatedAt;
        bool verified;
        bool active;
        uint256 totalUsageUnits;
        uint256 totalEarningsWei;
    }

    uint256 private _nextAgentId = 1;
    
    mapping(uint256 => AIAgent) public agents;
    mapping(address => uint256[]) public ownerAgents;
    mapping(uint256 => bool) public agentExists;

    event AgentCreated(
        uint256 indexed agentId,
        address indexed owner,
        address payoutAddress,
        string metadataCID,
        PricingType pricingType,
        uint256 priceWeiPerUnit,
        uint256 timestamp
    );
    
    event AgentUpdated(
        uint256 indexed agentId,
        string metadataCID,
        uint256 timestamp
    );

    event AgentPricingUpdated(
        uint256 indexed agentId,
        PricingType pricingType,
        uint256 priceWeiPerUnit,
        uint256 timestamp
    );
    
    event AgentVerified(
        uint256 indexed agentId,
        address indexed verifier,
        uint256 timestamp
    );
    
    event AgentUnverified(
        uint256 indexed agentId,
        address indexed verifier,
        uint256 timestamp
    );

    event AgentDeactivated(
        uint256 indexed agentId,
        uint256 timestamp
    );

    event AgentActivated(
        uint256 indexed agentId,
        uint256 timestamp
    );

    event UsageRecorded(
        uint256 indexed agentId,
        uint256 units,
        uint256 earningsWei,
        uint256 timestamp
    );

    error AgentNotFound();
    error NotAgentOwner();
    error InvalidCID();
    error InvalidPrice();
    error InvalidPayoutAddress();
    error AgentNotActive();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    /**
     * @notice Create a new AI agent
     * @param metadataCID IPFS CID containing agent metadata (name, description, skills, etc.)
     * @param payoutAddress Address to receive agent earnings
     * @param pricingType Type of pricing model (PER_MESSAGE, PER_TOKEN, PER_TASK)
     * @param priceWeiPerUnit Price in wei per usage unit
     * @return agentId The ID of the newly created AI agent
     */
    function createAgent(
        string calldata metadataCID,
        address payoutAddress,
        PricingType pricingType,
        uint256 priceWeiPerUnit
    ) 
        external 
        nonReentrant 
        returns (uint256 agentId) 
    {
        if (bytes(metadataCID).length == 0) revert InvalidCID();
        if (payoutAddress == address(0)) revert InvalidPayoutAddress();
        if (priceWeiPerUnit == 0) revert InvalidPrice();

        agentId = _nextAgentId++;
        
        agents[agentId] = AIAgent({
            id: agentId,
            owner: msg.sender,
            payoutAddress: payoutAddress,
            metadataCID: metadataCID,
            pricing: PricingModel({
                pricingType: pricingType,
                priceWeiPerUnit: priceWeiPerUnit
            }),
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            verified: false,
            active: true,
            totalUsageUnits: 0,
            totalEarningsWei: 0
        });
        
        ownerAgents[msg.sender].push(agentId);
        agentExists[agentId] = true;

        emit AgentCreated(
            agentId,
            msg.sender,
            payoutAddress,
            metadataCID,
            pricingType,
            priceWeiPerUnit,
            block.timestamp
        );
    }

    /**
     * @notice Update agent metadata
     * @param agentId The agent ID to update
     * @param metadataCID New IPFS CID for metadata
     */
    function updateAgentMetadata(uint256 agentId, string calldata metadataCID) 
        external 
        nonReentrant 
    {
        if (!agentExists[agentId]) revert AgentNotFound();
        if (agents[agentId].owner != msg.sender) revert NotAgentOwner();
        if (bytes(metadataCID).length == 0) revert InvalidCID();

        agents[agentId].metadataCID = metadataCID;
        agents[agentId].updatedAt = block.timestamp;

        emit AgentUpdated(agentId, metadataCID, block.timestamp);
    }

    /**
     * @notice Update agent pricing
     * @param agentId The agent ID to update
     * @param pricingType New pricing type
     * @param priceWeiPerUnit New price per unit
     */
    function updateAgentPricing(
        uint256 agentId,
        PricingType pricingType,
        uint256 priceWeiPerUnit
    ) 
        external 
        nonReentrant 
    {
        if (!agentExists[agentId]) revert AgentNotFound();
        if (agents[agentId].owner != msg.sender) revert NotAgentOwner();
        if (priceWeiPerUnit == 0) revert InvalidPrice();

        agents[agentId].pricing = PricingModel({
            pricingType: pricingType,
            priceWeiPerUnit: priceWeiPerUnit
        });
        agents[agentId].updatedAt = block.timestamp;

        emit AgentPricingUpdated(agentId, pricingType, priceWeiPerUnit, block.timestamp);
    }

    /**
     * @notice Update payout address
     * @param agentId The agent ID to update
     * @param newPayoutAddress New payout address
     */
    function updatePayoutAddress(uint256 agentId, address newPayoutAddress) 
        external 
        nonReentrant 
    {
        if (!agentExists[agentId]) revert AgentNotFound();
        if (agents[agentId].owner != msg.sender) revert NotAgentOwner();
        if (newPayoutAddress == address(0)) revert InvalidPayoutAddress();

        agents[agentId].payoutAddress = newPayoutAddress;
        agents[agentId].updatedAt = block.timestamp;
    }

    /**
     * @notice Deactivate an agent (stops accepting payments)
     * @param agentId The agent ID to deactivate
     */
    function deactivateAgent(uint256 agentId) external nonReentrant {
        if (!agentExists[agentId]) revert AgentNotFound();
        if (agents[agentId].owner != msg.sender) revert NotAgentOwner();

        agents[agentId].active = false;
        agents[agentId].updatedAt = block.timestamp;

        emit AgentDeactivated(agentId, block.timestamp);
    }

    /**
     * @notice Reactivate an agent
     * @param agentId The agent ID to activate
     */
    function activateAgent(uint256 agentId) external nonReentrant {
        if (!agentExists[agentId]) revert AgentNotFound();
        if (agents[agentId].owner != msg.sender) revert NotAgentOwner();

        agents[agentId].active = true;
        agents[agentId].updatedAt = block.timestamp;

        emit AgentActivated(agentId, block.timestamp);
    }

    /**
     * @notice Verify an agent (admin/verifier only)
     * @param agentId The agent ID to verify
     */
    function verifyAgent(uint256 agentId) 
        external 
        onlyRole(VERIFIER_ROLE)
        nonReentrant 
    {
        if (!agentExists[agentId]) revert AgentNotFound();

        agents[agentId].verified = true;
        agents[agentId].updatedAt = block.timestamp;

        emit AgentVerified(agentId, msg.sender, block.timestamp);
    }

    /**
     * @notice Unverify an agent (admin/verifier only)
     * @param agentId The agent ID to unverify
     */
    function unverifyAgent(uint256 agentId) 
        external 
        onlyRole(VERIFIER_ROLE)
        nonReentrant 
    {
        if (!agentExists[agentId]) revert AgentNotFound();

        agents[agentId].verified = false;
        agents[agentId].updatedAt = block.timestamp;

        emit AgentUnverified(agentId, msg.sender, block.timestamp);
    }

    /**
     * @notice Record usage (called by escrow contract)
     * @param agentId The agent ID
     * @param units Units used
     * @param earningsWei Earnings in wei
     */
    function recordUsage(uint256 agentId, uint256 units, uint256 earningsWei) 
        external 
        onlyRole(ADMIN_ROLE)
        nonReentrant 
    {
        if (!agentExists[agentId]) revert AgentNotFound();

        agents[agentId].totalUsageUnits += units;
        agents[agentId].totalEarningsWei += earningsWei;

        emit UsageRecorded(agentId, units, earningsWei, block.timestamp);
    }

    /**
     * @notice Get owner of an agent
     * @param agentId The agent ID
     * @return Owner address
     */
    function ownerOf(uint256 agentId) external view returns (address) {
        if (!agentExists[agentId]) revert AgentNotFound();
        return agents[agentId].owner;
    }

    /**
     * @notice Get agent details
     * @param agentId The agent ID
     * @return agent The full agent struct
     */
    function getAgent(uint256 agentId) external view returns (AIAgent memory) {
        if (!agentExists[agentId]) revert AgentNotFound();
        return agents[agentId];
    }

    /**
     * @notice Get agent pricing
     * @param agentId The agent ID
     * @return pricing The pricing model
     */
    function getAgentPricing(uint256 agentId) external view returns (PricingModel memory) {
        if (!agentExists[agentId]) revert AgentNotFound();
        return agents[agentId].pricing;
    }

    /**
     * @notice Calculate cost for usage
     * @param agentId The agent ID
     * @param units Number of units
     * @return cost Total cost in wei
     */
    function calculateCost(uint256 agentId, uint256 units) external view returns (uint256) {
        if (!agentExists[agentId]) revert AgentNotFound();
        return agents[agentId].pricing.priceWeiPerUnit * units;
    }

    /**
     * @notice Check if agent is active
     * @param agentId The agent ID
     * @return active Whether agent is active
     */
    function isAgentActive(uint256 agentId) external view returns (bool) {
        if (!agentExists[agentId]) revert AgentNotFound();
        return agents[agentId].active;
    }

    /**
     * @notice Get all agents owned by an address
     * @param owner The owner address
     * @return agentIds Array of agent IDs
     */
    function getAgentsByOwner(address owner) external view returns (uint256[] memory) {
        return ownerAgents[owner];
    }

    /**
     * @notice Get total number of agents
     * @return count Number of agents created
     */
    function totalAgents() external view returns (uint256) {
        return _nextAgentId - 1;
    }
}
