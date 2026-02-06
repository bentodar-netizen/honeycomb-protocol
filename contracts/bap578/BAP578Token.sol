// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./IBAP578.sol";

/**
 * @title BAP578Token - Non-Fungible Agent Token
 * @notice Implementation of BAP-578 NFA standard for Honeycomb AI Hatchery
 * @dev ERC-721 compatible with agent memory, proof-of-prompt, and learning capabilities
 */
contract BAP578Token is 
    ERC721, 
    ERC721URIStorage, 
    ERC721Enumerable, 
    Ownable, 
    ReentrancyGuard, 
    IBAP578 
{
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    /// @notice Minting fee in BNB
    uint256 public mintFee = 0.01 ether;
    
    /// @notice Fee vault address for collecting minting fees
    address public feeVault;
    
    /// @notice Mapping from token ID to agent metadata
    mapping(uint256 => AgentMetadata) private _agents;
    
    /// @notice Mapping from token ID to memory history (version => root)
    mapping(uint256 => mapping(uint256 => bytes32)) private _memoryHistory;
    
    /// @notice Mapping from token ID to training history (version => hash)
    mapping(uint256 => mapping(uint256 => bytes32)) private _trainingHistory;
    
    /// @notice Mapping from token ID to authorized operators for memory updates
    mapping(uint256 => mapping(address => bool)) private _memoryOperators;
    
    /// @notice Base URI for metadata
    string private _baseTokenURI;
    
    constructor(
        string memory name_,
        string memory symbol_,
        address feeVault_
    ) ERC721(name_, symbol_) {
        feeVault = feeVault_;
        _baseTokenURI = "";
    }
    
    // ==================== Minting ====================
    
    /**
     * @notice Mint a new NFA
     * @param name_ Agent name
     * @param description_ Agent description
     * @param modelType_ AI model type (e.g., "gpt-4", "claude-3")
     * @param agentType_ Static or Learning agent
     * @param systemPromptHash Hash of the system prompt (Proof-of-Prompt)
     * @param initialMemoryRoot Initial memory state merkle root
     * @param metadataURI IPFS URI for extended metadata
     */
    function mintAgent(
        string memory name_,
        string memory description_,
        string memory modelType_,
        AgentType agentType_,
        bytes32 systemPromptHash,
        bytes32 initialMemoryRoot,
        string memory metadataURI
    ) external payable nonReentrant returns (uint256) {
        require(msg.value >= mintFee, "Insufficient minting fee");
        require(bytes(name_).length > 0, "Name required");
        require(bytes(name_).length <= 64, "Name too long");
        
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, metadataURI);
        
        _agents[tokenId] = AgentMetadata({
            name: name_,
            description: description_,
            modelType: modelType_,
            agentType: agentType_,
            status: AgentStatus.ACTIVE,
            createdAt: block.timestamp,
            lastActiveAt: block.timestamp,
            proofOfPrompt: systemPromptHash,
            memoryRoot: initialMemoryRoot,
            trainingVersion: 1,
            interactionCount: 0
        });
        
        _memoryHistory[tokenId][1] = initialMemoryRoot;
        _trainingHistory[tokenId][1] = systemPromptHash;
        
        // Transfer fee to vault
        if (msg.value > 0 && feeVault != address(0)) {
            (bool success, ) = feeVault.call{value: msg.value}("");
            require(success, "Fee transfer failed");
        }
        
        emit AgentMinted(tokenId, msg.sender, name_, agentType_, systemPromptHash);
        
        return tokenId;
    }
    
    /**
     * @notice Mint agent with sponsored fee (owner pays)
     */
    function sponsoredMint(
        address to,
        string memory name_,
        string memory description_,
        string memory modelType_,
        AgentType agentType_,
        bytes32 systemPromptHash,
        bytes32 initialMemoryRoot,
        string memory metadataURI
    ) external onlyOwner returns (uint256) {
        require(bytes(name_).length > 0, "Name required");
        
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);
        
        _agents[tokenId] = AgentMetadata({
            name: name_,
            description: description_,
            modelType: modelType_,
            agentType: agentType_,
            status: AgentStatus.ACTIVE,
            createdAt: block.timestamp,
            lastActiveAt: block.timestamp,
            proofOfPrompt: systemPromptHash,
            memoryRoot: initialMemoryRoot,
            trainingVersion: 1,
            interactionCount: 0
        });
        
        _memoryHistory[tokenId][1] = initialMemoryRoot;
        _trainingHistory[tokenId][1] = systemPromptHash;
        
        emit AgentMinted(tokenId, to, name_, agentType_, systemPromptHash);
        
        return tokenId;
    }
    
    // ==================== IBAP578 Implementation ====================
    
    function getAgentMetadata(uint256 tokenId) external view override returns (AgentMetadata memory) {
        require(_exists(tokenId), "Agent does not exist");
        return _agents[tokenId];
    }
    
    function getProofOfPrompt(uint256 tokenId) external view override returns (bytes32) {
        require(_exists(tokenId), "Agent does not exist");
        return _agents[tokenId].proofOfPrompt;
    }
    
    function getMemoryRoot(uint256 tokenId) external view override returns (bytes32) {
        require(_exists(tokenId), "Agent does not exist");
        return _agents[tokenId].memoryRoot;
    }
    
    function updateMemory(uint256 tokenId, bytes32 newMemoryRoot) external override {
        require(_exists(tokenId), "Agent does not exist");
        require(
            _isApprovedOrOwner(msg.sender, tokenId) || _memoryOperators[tokenId][msg.sender],
            "Not authorized"
        );
        require(_agents[tokenId].status == AgentStatus.ACTIVE, "Agent not active");
        
        bytes32 previousRoot = _agents[tokenId].memoryRoot;
        _agents[tokenId].memoryRoot = newMemoryRoot;
        _agents[tokenId].lastActiveAt = block.timestamp;
        
        uint256 version = _agents[tokenId].trainingVersion + 1;
        _memoryHistory[tokenId][version] = newMemoryRoot;
        
        emit MemoryUpdated(tokenId, previousRoot, newMemoryRoot, version);
    }
    
    function updateTraining(uint256 tokenId, bytes32 trainingHash) external override {
        require(_exists(tokenId), "Agent does not exist");
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        require(_agents[tokenId].agentType == AgentType.LEARNING, "Not a learning agent");
        require(_agents[tokenId].status == AgentStatus.ACTIVE, "Agent not active");
        
        _agents[tokenId].trainingVersion++;
        _agents[tokenId].lastActiveAt = block.timestamp;
        
        uint256 version = _agents[tokenId].trainingVersion;
        _trainingHistory[tokenId][version] = trainingHash;
        
        emit TrainingUpdated(tokenId, version, trainingHash);
    }
    
    function recordInteraction(uint256 tokenId, bytes32 interactionHash) external override {
        require(_exists(tokenId), "Agent does not exist");
        require(
            _isApprovedOrOwner(msg.sender, tokenId) || _memoryOperators[tokenId][msg.sender],
            "Not authorized"
        );
        require(_agents[tokenId].status == AgentStatus.ACTIVE, "Agent not active");
        
        _agents[tokenId].interactionCount++;
        _agents[tokenId].lastActiveAt = block.timestamp;
        
        emit InteractionRecorded(tokenId, _agents[tokenId].interactionCount, interactionHash);
    }
    
    function pauseAgent(uint256 tokenId) external override {
        require(_exists(tokenId), "Agent does not exist");
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        require(_agents[tokenId].status == AgentStatus.ACTIVE, "Agent not active");
        
        AgentStatus previousStatus = _agents[tokenId].status;
        _agents[tokenId].status = AgentStatus.PAUSED;
        
        emit AgentStateChanged(tokenId, previousStatus, AgentStatus.PAUSED);
    }
    
    function resumeAgent(uint256 tokenId) external override {
        require(_exists(tokenId), "Agent does not exist");
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        require(_agents[tokenId].status == AgentStatus.PAUSED, "Agent not paused");
        
        _agents[tokenId].status = AgentStatus.ACTIVE;
        _agents[tokenId].lastActiveAt = block.timestamp;
        
        emit AgentStateChanged(tokenId, AgentStatus.PAUSED, AgentStatus.ACTIVE);
    }
    
    function terminateAgent(uint256 tokenId) external override {
        require(_exists(tokenId), "Agent does not exist");
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        require(_agents[tokenId].status != AgentStatus.TERMINATED, "Already terminated");
        
        AgentStatus previousStatus = _agents[tokenId].status;
        _agents[tokenId].status = AgentStatus.TERMINATED;
        
        emit AgentStateChanged(tokenId, previousStatus, AgentStatus.TERMINATED);
    }
    
    function isAgentActive(uint256 tokenId) external view override returns (bool) {
        require(_exists(tokenId), "Agent does not exist");
        return _agents[tokenId].status == AgentStatus.ACTIVE;
    }
    
    function getAgentType(uint256 tokenId) external view override returns (AgentType) {
        require(_exists(tokenId), "Agent does not exist");
        return _agents[tokenId].agentType;
    }
    
    function getTrainingVersion(uint256 tokenId) external view override returns (uint256) {
        require(_exists(tokenId), "Agent does not exist");
        return _agents[tokenId].trainingVersion;
    }
    
    function getInteractionCount(uint256 tokenId) external view override returns (uint256) {
        require(_exists(tokenId), "Agent does not exist");
        return _agents[tokenId].interactionCount;
    }
    
    // ==================== Memory Operators ====================
    
    /**
     * @notice Authorize an address to update agent memory
     * @param tokenId The NFA token ID
     * @param operator Address to authorize
     * @param approved Whether to approve or revoke
     */
    function setMemoryOperator(uint256 tokenId, address operator, bool approved) external {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        _memoryOperators[tokenId][operator] = approved;
    }
    
    /**
     * @notice Check if an address is an authorized memory operator
     */
    function isMemoryOperator(uint256 tokenId, address operator) external view returns (bool) {
        return _memoryOperators[tokenId][operator];
    }
    
    // ==================== History ====================
    
    /**
     * @notice Get memory root at a specific version
     */
    function getMemoryAtVersion(uint256 tokenId, uint256 version) external view returns (bytes32) {
        require(_exists(tokenId), "Agent does not exist");
        return _memoryHistory[tokenId][version];
    }
    
    /**
     * @notice Get training hash at a specific version
     */
    function getTrainingAtVersion(uint256 tokenId, uint256 version) external view returns (bytes32) {
        require(_exists(tokenId), "Agent does not exist");
        return _trainingHistory[tokenId][version];
    }
    
    // ==================== Admin Functions ====================
    
    function setMintFee(uint256 newFee) external onlyOwner {
        mintFee = newFee;
    }
    
    function setFeeVault(address newVault) external onlyOwner {
        feeVault = newVault;
    }
    
    function setBaseURI(string memory baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
    }
    
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    function totalAgents() external view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    // ==================== Required Overrides ====================
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, IERC165)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
