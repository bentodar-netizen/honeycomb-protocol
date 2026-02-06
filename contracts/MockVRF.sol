// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockVRF
 * @notice Mock VRF consumer for local development and testing
 * @dev Uses blockhash + requestId to generate pseudo-random numbers
 * WARNING: This is NOT cryptographically secure - for testing only!
 */
contract MockVRF is Ownable {
    
    // Interface to callback into the duel contract
    interface IDuelContract {
        function fulfillRandomness(uint256 requestId, uint256 randomWord) external;
    }
    
    address public duelContract;
    uint256 private _nextRequestId = 1;
    
    // Mapping of requestId to duelId for tracking
    mapping(uint256 => uint256) public requestToDuel;
    mapping(uint256 => bool) public requestFulfilled;
    
    event RandomnessRequested(uint256 indexed requestId, uint256 indexed duelId);
    event RandomnessFulfilled(uint256 indexed requestId, uint256 randomWord);
    
    error NotDuelContract();
    error AlreadyFulfilled();
    error InvalidRequest();
    
    constructor(address _duelContract) Ownable(msg.sender) {
        duelContract = _duelContract;
    }
    
    /**
     * @notice Set the duel contract address (owner only)
     */
    function setDuelContract(address _duelContract) external onlyOwner {
        duelContract = _duelContract;
    }
    
    /**
     * @notice Request random words - called by the duel contract
     * @param duelId The duel requesting randomness
     * @return requestId The request ID for tracking
     */
    function requestRandomWords(uint256 duelId) external returns (uint256 requestId) {
        if (msg.sender != duelContract) revert NotDuelContract();
        
        requestId = _nextRequestId++;
        requestToDuel[requestId] = duelId;
        
        emit RandomnessRequested(requestId, duelId);
        
        return requestId;
    }
    
    /**
     * @notice Fulfill randomness manually (for testing)
     * @dev In production, this would be called by Chainlink VRF or similar
     * @param requestId The request to fulfill
     */
    function fulfillRandomness(uint256 requestId) external {
        if (requestToDuel[requestId] == 0) revert InvalidRequest();
        if (requestFulfilled[requestId]) revert AlreadyFulfilled();
        
        requestFulfilled[requestId] = true;
        
        // Generate pseudo-random number from blockhash and requestId
        // WARNING: This is predictable and NOT secure for production!
        uint256 randomWord = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    requestId,
                    block.timestamp,
                    block.prevrandao
                )
            )
        );
        
        emit RandomnessFulfilled(requestId, randomWord);
        
        // Callback to the duel contract
        IDuelContract(duelContract).fulfillRandomness(requestId, randomWord);
    }
    
    /**
     * @notice Fulfill randomness with a specific value (for testing)
     * @param requestId The request to fulfill
     * @param randomWord The random word to use
     */
    function fulfillRandomnessWithValue(uint256 requestId, uint256 randomWord) external onlyOwner {
        if (requestToDuel[requestId] == 0) revert InvalidRequest();
        if (requestFulfilled[requestId]) revert AlreadyFulfilled();
        
        requestFulfilled[requestId] = true;
        
        emit RandomnessFulfilled(requestId, randomWord);
        
        // Callback to the duel contract
        IDuelContract(duelContract).fulfillRandomness(requestId, randomWord);
    }
    
    /**
     * @notice Auto-fulfill the latest request (convenience function for testing)
     */
    function autoFulfillLatest() external {
        uint256 requestId = _nextRequestId - 1;
        if (requestId == 0) revert InvalidRequest();
        if (requestToDuel[requestId] == 0) revert InvalidRequest();
        if (requestFulfilled[requestId]) revert AlreadyFulfilled();
        
        requestFulfilled[requestId] = true;
        
        uint256 randomWord = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    requestId,
                    block.timestamp
                )
            )
        );
        
        emit RandomnessFulfilled(requestId, randomWord);
        
        IDuelContract(duelContract).fulfillRandomness(requestId, randomWord);
    }
    
    /**
     * @notice Get the next request ID
     */
    function nextRequestId() external view returns (uint256) {
        return _nextRequestId;
    }
}
