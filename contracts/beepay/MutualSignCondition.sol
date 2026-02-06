// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./IConditionModule.sol";
import "./IIdentityRegistry.sol";
import "./EscrowCore.sol";

contract MutualSignCondition is IConditionModule, EIP712 {
    using ECDSA for bytes32;
    
    IIdentityRegistry public immutable identityRegistry;
    EscrowCore public immutable escrowCore;
    
    bytes32 private constant RELEASE_INTENT_TYPEHASH = keccak256("ReleaseIntent(uint256 escrowId)");
    
    mapping(uint256 => mapping(bytes32 => bool)) public approvals;
    
    event ReleaseApproved(uint256 indexed escrowId, bytes32 indexed identityId);
    
    constructor(address _identityRegistry, address _escrowCore) EIP712("MutualSignCondition", "1") {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        escrowCore = EscrowCore(payable(_escrowCore));
    }
    
    function approveRelease(uint256 escrowId) external {
        EscrowCore.Escrow memory escrow = escrowCore.getEscrow(escrowId);
        require(escrow.escrowId != 0, "Escrow does not exist");
        
        bytes32 callerIdentity;
        if (identityRegistry.isAuthorized(escrow.payerId, msg.sender)) {
            callerIdentity = escrow.payerId;
        } else if (identityRegistry.isAuthorized(escrow.payeeId, msg.sender)) {
            callerIdentity = escrow.payeeId;
        } else {
            revert("Not authorized");
        }
        
        require(!approvals[escrowId][callerIdentity], "Already approved");
        
        approvals[escrowId][callerIdentity] = true;
        
        emit ReleaseApproved(escrowId, callerIdentity);
    }
    
    function approveReleaseWithSignature(uint256 escrowId, bytes calldata signature) external {
        EscrowCore.Escrow memory escrow = escrowCore.getEscrow(escrowId);
        require(escrow.escrowId != 0, "Escrow does not exist");
        
        bytes32 structHash = keccak256(abi.encode(RELEASE_INTENT_TYPEHASH, escrowId));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        
        bytes32 signerIdentity;
        if (identityRegistry.isAuthorized(escrow.payerId, signer)) {
            signerIdentity = escrow.payerId;
        } else if (identityRegistry.isAuthorized(escrow.payeeId, signer)) {
            signerIdentity = escrow.payeeId;
        } else {
            revert("Invalid signature");
        }
        
        require(!approvals[escrowId][signerIdentity], "Already approved");
        
        approvals[escrowId][signerIdentity] = true;
        
        emit ReleaseApproved(escrowId, signerIdentity);
    }
    
    function isSatisfied(uint256 escrowId, bytes calldata) external view override returns (bool) {
        EscrowCore.Escrow memory escrow = escrowCore.getEscrow(escrowId);
        
        return approvals[escrowId][escrow.payerId] && approvals[escrowId][escrow.payeeId];
    }
    
    function hasApproved(uint256 escrowId, bytes32 identityId) external view returns (bool) {
        return approvals[escrowId][identityId];
    }
    
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
