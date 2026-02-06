// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title IBAP578 - Non-Fungible Agent (NFA) Interface
 * @notice BNB Chain Application Proposal 578: Standard for tradeable AI agents
 * @dev Extends ERC-721 with agent-specific functionality including memory vault,
 *      proof-of-prompt, and learning capabilities
 */
interface IBAP578 is IERC721 {
    
    /// @notice Agent type: Static agents have fixed behavior, Learning agents can evolve
    enum AgentType { STATIC, LEARNING }
    
    /// @notice Agent status lifecycle
    enum AgentStatus { ACTIVE, PAUSED, TERMINATED }
    
    /// @notice Core agent metadata structure
    struct AgentMetadata {
        string name;
        string description;
        string modelType;
        AgentType agentType;
        AgentStatus status;
        uint256 createdAt;
        uint256 lastActiveAt;
        bytes32 proofOfPrompt;
        bytes32 memoryRoot;
        uint256 trainingVersion;
        uint256 interactionCount;
    }
    
    /// @notice Emitted when a new NFA is minted
    event AgentMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string name,
        AgentType agentType,
        bytes32 proofOfPrompt
    );
    
    /// @notice Emitted when agent memory is updated
    event MemoryUpdated(
        uint256 indexed tokenId,
        bytes32 previousRoot,
        bytes32 newRoot,
        uint256 version
    );
    
    /// @notice Emitted when agent state changes
    event AgentStateChanged(
        uint256 indexed tokenId,
        AgentStatus previousStatus,
        AgentStatus newStatus
    );
    
    /// @notice Emitted when agent training is updated
    event TrainingUpdated(
        uint256 indexed tokenId,
        uint256 newVersion,
        bytes32 trainingHash
    );
    
    /// @notice Emitted when agent interaction is recorded
    event InteractionRecorded(
        uint256 indexed tokenId,
        uint256 interactionCount,
        bytes32 interactionHash
    );
    
    /**
     * @notice Get the full metadata for an agent
     * @param tokenId The NFA token ID
     * @return metadata The complete agent metadata
     */
    function getAgentMetadata(uint256 tokenId) external view returns (AgentMetadata memory metadata);
    
    /**
     * @notice Get the Proof-of-Prompt for an agent
     * @dev Immutable cryptographic hash of the agent's training configuration
     * @param tokenId The NFA token ID
     * @return The proof-of-prompt hash
     */
    function getProofOfPrompt(uint256 tokenId) external view returns (bytes32);
    
    /**
     * @notice Get the current memory root for an agent
     * @dev Merkle root of the agent's memory vault
     * @param tokenId The NFA token ID
     * @return The current memory merkle root
     */
    function getMemoryRoot(uint256 tokenId) external view returns (bytes32);
    
    /**
     * @notice Update the agent's memory state
     * @dev Only callable by owner or approved operators
     * @param tokenId The NFA token ID
     * @param newMemoryRoot The new merkle root after memory update
     */
    function updateMemory(uint256 tokenId, bytes32 newMemoryRoot) external;
    
    /**
     * @notice Update agent training (for learning agents only)
     * @param tokenId The NFA token ID
     * @param trainingHash Hash of the new training data/configuration
     */
    function updateTraining(uint256 tokenId, bytes32 trainingHash) external;
    
    /**
     * @notice Record an interaction with the agent
     * @param tokenId The NFA token ID
     * @param interactionHash Hash of the interaction data
     */
    function recordInteraction(uint256 tokenId, bytes32 interactionHash) external;
    
    /**
     * @notice Pause an agent (temporarily disable)
     * @param tokenId The NFA token ID
     */
    function pauseAgent(uint256 tokenId) external;
    
    /**
     * @notice Resume a paused agent
     * @param tokenId The NFA token ID
     */
    function resumeAgent(uint256 tokenId) external;
    
    /**
     * @notice Permanently terminate an agent
     * @dev Irreversible action
     * @param tokenId The NFA token ID
     */
    function terminateAgent(uint256 tokenId) external;
    
    /**
     * @notice Check if an agent is active
     * @param tokenId The NFA token ID
     * @return True if agent is active
     */
    function isAgentActive(uint256 tokenId) external view returns (bool);
    
    /**
     * @notice Get the agent type (static or learning)
     * @param tokenId The NFA token ID
     * @return The agent type
     */
    function getAgentType(uint256 tokenId) external view returns (AgentType);
    
    /**
     * @notice Get the current training version for learning agents
     * @param tokenId The NFA token ID
     * @return The training version number
     */
    function getTrainingVersion(uint256 tokenId) external view returns (uint256);
    
    /**
     * @notice Get total interaction count for an agent
     * @param tokenId The NFA token ID
     * @return The total number of recorded interactions
     */
    function getInteractionCount(uint256 tokenId) external view returns (uint256);
}
