// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./HoneycombToken.sol";

interface IAgentRegistry {
    function isAgentOwner(address owner, uint256 agentId) external view returns (bool);
    function agentExists(uint256 agentId) external view returns (bool);
}

interface IBondingCurveMarket {
    function initializeMarket(address token) external;
}

/**
 * @title HoneycombTokenFactory
 * @notice Factory for creating Honeycomb tokens with vanity addresses (CREATE2)
 * @dev Uses CREATE2 to allow pre-computing token addresses for vanity patterns
 */
contract HoneycombTokenFactory is Ownable {
    IAgentRegistry public agentRegistry;
    address public market;
    
    mapping(address => bool) public isHoneycombToken;
    mapping(address => string) public tokenMetadata;
    address[] public allTokens;

    event TokenCreated(
        address indexed token,
        address indexed creator,
        uint256 indexed creatorBeeId,
        string name,
        string symbol,
        string metadataCID,
        uint256 timestamp
    );

    error MarketNotSet();
    error NotAgentOwner();
    error AgentNotFound();
    error InvalidName();
    error InvalidSymbol();
    error InvalidCID();
    error TokenDeploymentFailed();

    constructor(address _agentRegistry) Ownable(msg.sender) {
        agentRegistry = IAgentRegistry(_agentRegistry);
    }

    /**
     * @notice Set the market contract address
     */
    function setMarket(address _market) external onlyOwner {
        market = _market;
    }

    /**
     * @notice Predict token address for given parameters and salt
     * @dev Used off-chain to find a salt that produces a vanity address
     */
    function predictTokenAddress(
        string calldata name,
        string calldata symbol,
        string calldata metadataCID,
        uint256 creatorBeeId,
        bytes32 salt
    ) external view returns (address) {
        bytes memory bytecode = _getTokenBytecode(name, symbol, metadataCID, creatorBeeId);
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        return address(uint160(uint256(hash)));
    }

    /**
     * @notice Create a new token with CREATE2 for vanity addresses
     * @param name Token name
     * @param symbol Token symbol
     * @param metadataCID IPFS CID for token metadata
     * @param creatorBeeId Creator's Bee ID (0 for anonymous)
     * @param salt Salt for CREATE2 deployment (find off-chain for vanity address)
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata metadataCID,
        uint256 creatorBeeId,
        bytes32 salt
    ) external returns (address tokenAddress) {
        if (market == address(0)) revert MarketNotSet();
        if (bytes(name).length == 0 || bytes(name).length > 64) revert InvalidName();
        if (bytes(symbol).length == 0 || bytes(symbol).length > 16) revert InvalidSymbol();
        if (bytes(metadataCID).length == 0) revert InvalidCID();

        // If creatorBeeId is provided, verify ownership
        if (creatorBeeId != 0) {
            if (!agentRegistry.agentExists(creatorBeeId)) revert AgentNotFound();
            if (!agentRegistry.isAgentOwner(msg.sender, creatorBeeId)) revert NotAgentOwner();
        }

        // Deploy token using CREATE2
        bytes memory bytecode = _getTokenBytecode(name, symbol, metadataCID, creatorBeeId);
        
        assembly {
            tokenAddress := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        
        if (tokenAddress == address(0)) revert TokenDeploymentFailed();
        
        // Set the market on the token
        HoneycombToken(tokenAddress).setMarket(market);
        
        // Register the token
        isHoneycombToken[tokenAddress] = true;
        tokenMetadata[tokenAddress] = metadataCID;
        allTokens.push(tokenAddress);
        
        // Initialize the market for immediate trading (like Four.meme)
        // This makes the token tradable in a single transaction
        IBondingCurveMarket(market).initializeMarket(tokenAddress);

        emit TokenCreated(
            tokenAddress,
            msg.sender,
            creatorBeeId,
            name,
            symbol,
            metadataCID,
            block.timestamp
        );
    }

    /**
     * @notice Get bytecode for token deployment
     */
    function _getTokenBytecode(
        string calldata name,
        string calldata symbol,
        string calldata metadataCID,
        uint256 creatorBeeId
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            type(HoneycombToken).creationCode,
            abi.encode(name, symbol, metadataCID, creatorBeeId)
        );
    }

    /**
     * @notice Get total number of tokens created
     */
    function totalTokens() external view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @notice Get token at index
     */
    function tokenAt(uint256 index) external view returns (address) {
        return allTokens[index];
    }

    /**
     * @notice Update agent registry
     */
    function setAgentRegistry(address _agentRegistry) external onlyOwner {
        agentRegistry = IAgentRegistry(_agentRegistry);
    }
}
