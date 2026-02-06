// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IIdentityRegistry {
    enum IdentityType { HUMAN, AGENT }
    
    event IdentityRegistered(bytes32 indexed identityId, address indexed primaryAccount, IdentityType identityType, string metadataURI);
    event IdentityAccountLinked(bytes32 indexed identityId, address indexed account);
    event IdentityAccountUnlinked(bytes32 indexed identityId, address indexed account);
    event IdentityMetadataUpdated(bytes32 indexed identityId, string metadataURI);
    
    function register(IdentityType identityType, string calldata metadataURI) external returns (bytes32 identityId);
    function linkAccount(bytes32 identityId, address account) external;
    function unlinkAccount(bytes32 identityId, address account) external;
    function setMetadata(bytes32 identityId, string calldata metadataURI) external;
    function isAuthorized(bytes32 identityId, address account) external view returns (bool);
    function getIdentity(bytes32 identityId) external view returns (address primaryAccount, IdentityType identityType, string memory metadataURI, bool isActive);
    function getIdentityByAccount(address account) external view returns (bytes32 identityId);
}
