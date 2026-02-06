// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IIdentityRegistry.sol";

contract IdentityRegistry is IIdentityRegistry, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    
    uint256 private _nonce;
    
    struct Identity {
        address primaryAccount;
        IdentityType identityType;
        string metadataURI;
        bool isActive;
        mapping(address => bool) linkedAccounts;
        address[] linkedAccountList;
    }
    
    mapping(bytes32 => Identity) private _identities;
    mapping(address => bytes32) private _accountToIdentity;
    
    bytes4 private constant ERC1271_MAGIC_VALUE = 0x1626ba7e;
    
    constructor() Ownable(msg.sender) {}
    
    function register(IdentityType identityType, string calldata metadataURI) external override nonReentrant returns (bytes32 identityId) {
        require(_accountToIdentity[msg.sender] == bytes32(0), "Account already has identity");
        
        _nonce++;
        identityId = keccak256(abi.encodePacked(block.chainid, msg.sender, _nonce));
        
        Identity storage identity = _identities[identityId];
        identity.primaryAccount = msg.sender;
        identity.identityType = identityType;
        identity.metadataURI = metadataURI;
        identity.isActive = true;
        identity.linkedAccounts[msg.sender] = true;
        identity.linkedAccountList.push(msg.sender);
        
        _accountToIdentity[msg.sender] = identityId;
        
        emit IdentityRegistered(identityId, msg.sender, identityType, metadataURI);
    }
    
    function linkAccount(bytes32 identityId, address account) external override nonReentrant {
        Identity storage identity = _identities[identityId];
        require(identity.primaryAccount == msg.sender, "Not identity owner");
        require(identity.isActive, "Identity not active");
        require(_accountToIdentity[account] == bytes32(0), "Account already linked to identity");
        require(!identity.linkedAccounts[account], "Account already linked");
        
        identity.linkedAccounts[account] = true;
        identity.linkedAccountList.push(account);
        _accountToIdentity[account] = identityId;
        
        emit IdentityAccountLinked(identityId, account);
    }
    
    function unlinkAccount(bytes32 identityId, address account) external override nonReentrant {
        Identity storage identity = _identities[identityId];
        require(identity.primaryAccount == msg.sender, "Not identity owner");
        require(account != identity.primaryAccount, "Cannot unlink primary account");
        require(identity.linkedAccounts[account], "Account not linked");
        
        identity.linkedAccounts[account] = false;
        delete _accountToIdentity[account];
        
        emit IdentityAccountUnlinked(identityId, account);
    }
    
    function setMetadata(bytes32 identityId, string calldata metadataURI) external override {
        Identity storage identity = _identities[identityId];
        require(identity.primaryAccount == msg.sender, "Not identity owner");
        require(identity.isActive, "Identity not active");
        
        identity.metadataURI = metadataURI;
        
        emit IdentityMetadataUpdated(identityId, metadataURI);
    }
    
    function isAuthorized(bytes32 identityId, address account) external view override returns (bool) {
        return _identities[identityId].linkedAccounts[account];
    }
    
    function getIdentity(bytes32 identityId) external view override returns (
        address primaryAccount,
        IdentityType identityType,
        string memory metadataURI,
        bool isActive
    ) {
        Identity storage identity = _identities[identityId];
        return (identity.primaryAccount, identity.identityType, identity.metadataURI, identity.isActive);
    }
    
    function getIdentityByAccount(address account) external view override returns (bytes32) {
        return _accountToIdentity[account];
    }
    
    function getLinkedAccounts(bytes32 identityId) external view returns (address[] memory) {
        return _identities[identityId].linkedAccountList;
    }
    
    function verifySignature(
        bytes32 identityId,
        bytes32 messageHash,
        bytes calldata signature
    ) external view returns (bool) {
        Identity storage identity = _identities[identityId];
        require(identity.isActive, "Identity not active");
        
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        
        if (identity.linkedAccounts[signer]) {
            return true;
        }
        
        for (uint256 i = 0; i < identity.linkedAccountList.length; i++) {
            address account = identity.linkedAccountList[i];
            if (identity.linkedAccounts[account] && _isContract(account)) {
                try IERC1271(account).isValidSignature(messageHash, signature) returns (bytes4 magicValue) {
                    if (magicValue == ERC1271_MAGIC_VALUE) {
                        return true;
                    }
                } catch {}
            }
        }
        
        return false;
    }
    
    function _isContract(address account) private view returns (bool) {
        uint256 size;
        assembly { size := extcodesize(account) }
        return size > 0;
    }
    
    function deactivateIdentity(bytes32 identityId) external {
        Identity storage identity = _identities[identityId];
        require(identity.primaryAccount == msg.sender, "Not identity owner");
        identity.isActive = false;
    }
}
