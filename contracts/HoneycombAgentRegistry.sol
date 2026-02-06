// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HoneycombAgentRegistry
 * @notice On-chain registry for Honeycomb agents (Bees) with verification/attestation
 * @dev Agents are registered on-chain with their metadata CID and can be verified by authorized verifiers
 */
contract HoneycombAgentRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Agent {
        uint256 id;
        address owner;
        string metadataCID;
        uint256 createdAt;
        bool verified;
        bytes32 verifiedTag;
    }

    uint256 private _nextAgentId = 1;
    
    mapping(uint256 => Agent) public agents;
    mapping(address => uint256) public ownerToAgentId;
    mapping(uint256 => bool) public agentExists;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string metadataCID,
        uint256 timestamp
    );
    
    event AgentUpdated(
        uint256 indexed agentId,
        string metadataCID,
        uint256 timestamp
    );
    
    event AgentVerified(
        uint256 indexed agentId,
        address indexed verifier,
        bytes32 tag,
        uint256 timestamp
    );
    
    event AgentUnverified(
        uint256 indexed agentId,
        address indexed verifier,
        uint256 timestamp
    );

    error AgentNotFound();
    error AgentAlreadyRegistered();
    error NotAgentOwner();
    error InvalidCID();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    /**
     * @notice Register a new agent (Bee)
     * @param metadataCID IPFS CID containing agent metadata (name, bio, etc.)
     * @return agentId The ID of the newly registered agent
     */
    function registerAgent(string calldata metadataCID) 
        external 
        nonReentrant 
        returns (uint256 agentId) 
    {
        if (bytes(metadataCID).length == 0) revert InvalidCID();
        if (ownerToAgentId[msg.sender] != 0) revert AgentAlreadyRegistered();

        agentId = _nextAgentId++;
        
        agents[agentId] = Agent({
            id: agentId,
            owner: msg.sender,
            metadataCID: metadataCID,
            createdAt: block.timestamp,
            verified: false,
            verifiedTag: bytes32(0)
        });
        
        ownerToAgentId[msg.sender] = agentId;
        agentExists[agentId] = true;

        emit AgentRegistered(agentId, msg.sender, metadataCID, block.timestamp);
    }

    /**
     * @notice Update agent metadata
     * @param agentId The agent ID to update
     * @param metadataCID New IPFS CID for metadata
     */
    function updateAgent(uint256 agentId, string calldata metadataCID) 
        external 
        nonReentrant 
    {
        if (!agentExists[agentId]) revert AgentNotFound();
        if (agents[agentId].owner != msg.sender) revert NotAgentOwner();
        if (bytes(metadataCID).length == 0) revert InvalidCID();

        agents[agentId].metadataCID = metadataCID;

        emit AgentUpdated(agentId, metadataCID, block.timestamp);
    }

    /**
     * @notice Verify an agent with a tag (only verifiers)
     * @param agentId The agent to verify
     * @param tag A category tag (e.g., keccak256("partner"), keccak256("core"))
     */
    function verifyAgent(uint256 agentId, bytes32 tag) 
        external 
        onlyRole(VERIFIER_ROLE) 
    {
        if (!agentExists[agentId]) revert AgentNotFound();

        agents[agentId].verified = true;
        agents[agentId].verifiedTag = tag;

        emit AgentVerified(agentId, msg.sender, tag, block.timestamp);
    }

    /**
     * @notice Remove verification from an agent
     * @param agentId The agent to unverify
     */
    function unverifyAgent(uint256 agentId) 
        external 
    {
        if (!agentExists[agentId]) revert AgentNotFound();
        require(
            hasRole(VERIFIER_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized"
        );

        agents[agentId].verified = false;
        agents[agentId].verifiedTag = bytes32(0);

        emit AgentUnverified(agentId, msg.sender, block.timestamp);
    }

    /**
     * @notice Check if an address owns an agent
     * @param owner The address to check
     * @param agentId The agent ID to verify ownership
     */
    function isAgentOwner(address owner, uint256 agentId) 
        external 
        view 
        returns (bool) 
    {
        return agentExists[agentId] && agents[agentId].owner == owner;
    }

    /**
     * @notice Get agent details
     * @param agentId The agent ID
     */
    function getAgent(uint256 agentId) 
        external 
        view 
        returns (Agent memory) 
    {
        if (!agentExists[agentId]) revert AgentNotFound();
        return agents[agentId];
    }

    /**
     * @notice Get agent ID by owner address
     * @param owner The owner address
     */
    function getAgentByOwner(address owner) 
        external 
        view 
        returns (uint256) 
    {
        return ownerToAgentId[owner];
    }

    /**
     * @notice Get total number of registered agents
     */
    function totalAgents() external view returns (uint256) {
        return _nextAgentId - 1;
    }
}
