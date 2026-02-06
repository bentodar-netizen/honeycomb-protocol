// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./IConditionModule.sol";
import "./IIdentityRegistry.sol";
import "./EscrowCore.sol";

contract QuorumSignCondition is IConditionModule, EIP712 {
    using ECDSA for bytes32;
    
    IIdentityRegistry public immutable identityRegistry;
    EscrowCore public immutable escrowCore;
    
    bytes32 private constant RECEIPT_TYPEHASH = keccak256("Receipt(uint256 escrowId,bytes32 outcomeHash)");
    
    mapping(uint256 => mapping(bytes32 => bool)) public validatorSignatures;
    mapping(uint256 => uint256) public signatureCount;
    
    event ReceiptSigned(uint256 indexed escrowId, bytes32 indexed validatorId);
    event QuorumReached(uint256 indexed escrowId);
    
    constructor(address _identityRegistry, address _escrowCore) EIP712("QuorumSignCondition", "1") {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        escrowCore = EscrowCore(payable(_escrowCore));
    }
    
    function signReceipt(uint256 escrowId, bytes32 outcomeHash, bytes calldata signature) external {
        EscrowCore.Escrow memory escrow = escrowCore.getEscrow(escrowId);
        require(escrow.escrowId != 0, "Escrow does not exist");
        
        (bytes32[] memory validators, uint256 k, bytes32 expectedOutcome) = _decodeConditionData(escrow.conditionData);
        require(outcomeHash == expectedOutcome, "Outcome hash mismatch");
        
        bytes32 structHash = keccak256(abi.encode(RECEIPT_TYPEHASH, escrowId, outcomeHash));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        
        bytes32 signerIdentity = identityRegistry.getIdentityByAccount(signer);
        require(signerIdentity != bytes32(0), "Signer has no identity");
        
        bool isValidator = false;
        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == signerIdentity) {
                isValidator = true;
                break;
            }
        }
        require(isValidator, "Signer is not a validator");
        
        require(!validatorSignatures[escrowId][signerIdentity], "Already signed");
        
        validatorSignatures[escrowId][signerIdentity] = true;
        signatureCount[escrowId]++;
        
        emit ReceiptSigned(escrowId, signerIdentity);
        
        if (signatureCount[escrowId] >= k) {
            emit QuorumReached(escrowId);
        }
    }
    
    function isSatisfied(uint256 escrowId, bytes calldata conditionData) external view override returns (bool) {
        (, uint256 k,) = _decodeConditionData(conditionData);
        return signatureCount[escrowId] >= k;
    }
    
    function _decodeConditionData(bytes memory conditionData) internal pure returns (
        bytes32[] memory validators,
        uint256 k,
        bytes32 outcomeHash
    ) {
        return abi.decode(conditionData, (bytes32[], uint256, bytes32));
    }
    
    function encodeConditionData(
        bytes32[] memory validators,
        uint256 k,
        bytes32 outcomeHash
    ) external pure returns (bytes memory) {
        return abi.encode(validators, k, outcomeHash);
    }
    
    function getSignatureCount(uint256 escrowId) external view returns (uint256) {
        return signatureCount[escrowId];
    }
    
    function hasValidatorSigned(uint256 escrowId, bytes32 validatorId) external view returns (bool) {
        return validatorSignatures[escrowId][validatorId];
    }
    
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
