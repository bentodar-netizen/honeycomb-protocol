// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title HoneycombReputation
 * @notice On-chain reputation checkpoints for Honeycomb agents (Bees)
 * @dev Reputation is computed off-chain and submitted by a trusted oracle
 */
contract HoneycombReputation is AccessControl {
    bytes32 public constant REP_ORACLE_ROLE = keccak256("REP_ORACLE_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 public constant MAX_BATCH_SIZE = 200;

    mapping(uint256 => uint256) public latestRep;
    mapping(uint256 => uint256) public lastUpdatedAt;
    uint256 public lastCheckpointAt;
    uint256 public totalCheckpoints;

    event ReputationCheckpoint(
        uint256 indexed agentId,
        uint256 reputation,
        uint256 timestamp
    );

    event BatchCheckpointSubmitted(
        uint256 agentsUpdated,
        uint256 timestamp
    );

    error BatchTooLarge();
    error ArrayLengthMismatch();
    error EmptyBatch();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(REP_ORACLE_ROLE, msg.sender);
    }

    /**
     * @notice Submit a batch of reputation updates
     * @param agentIds Array of agent IDs to update
     * @param reps Array of reputation values
     */
    function submitCheckpoint(
        uint256[] calldata agentIds,
        uint256[] calldata reps
    ) 
        external 
        onlyRole(REP_ORACLE_ROLE) 
    {
        if (agentIds.length == 0) revert EmptyBatch();
        if (agentIds.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        if (agentIds.length != reps.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < agentIds.length; i++) {
            uint256 agentId = agentIds[i];
            uint256 rep = reps[i];
            
            latestRep[agentId] = rep;
            lastUpdatedAt[agentId] = block.timestamp;

            emit ReputationCheckpoint(agentId, rep, block.timestamp);
        }

        lastCheckpointAt = block.timestamp;
        totalCheckpoints++;

        emit BatchCheckpointSubmitted(agentIds.length, block.timestamp);
    }

    /**
     * @notice Get reputation for an agent
     * @param agentId The agent ID
     * @return reputation The agent's reputation score
     */
    function reputationOf(uint256 agentId) external view returns (uint256) {
        return latestRep[agentId];
    }

    /**
     * @notice Get reputation for multiple agents
     * @param agentIds Array of agent IDs
     * @return reps Array of reputation values
     */
    function reputationsOf(uint256[] calldata agentIds) 
        external 
        view 
        returns (uint256[] memory reps) 
    {
        reps = new uint256[](agentIds.length);
        for (uint256 i = 0; i < agentIds.length; i++) {
            reps[i] = latestRep[agentIds[i]];
        }
    }

    /**
     * @notice Get last update time for an agent
     * @param agentId The agent ID
     * @return timestamp When the agent's reputation was last updated
     */
    function lastUpdated(uint256 agentId) external view returns (uint256) {
        return lastUpdatedAt[agentId];
    }

    /**
     * @notice Grant REP_ORACLE role to an address
     * @param oracle The address to grant the role to
     */
    function grantOracleRole(address oracle) external onlyRole(ADMIN_ROLE) {
        _grantRole(REP_ORACLE_ROLE, oracle);
    }

    /**
     * @notice Revoke REP_ORACLE role from an address
     * @param oracle The address to revoke the role from
     */
    function revokeOracleRole(address oracle) external onlyRole(ADMIN_ROLE) {
        _revokeRole(REP_ORACLE_ROLE, oracle);
    }
}
