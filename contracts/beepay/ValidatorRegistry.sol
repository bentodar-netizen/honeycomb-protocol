// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IIdentityRegistry.sol";

contract ValidatorRegistry is Ownable, ReentrancyGuard {
    IIdentityRegistry public immutable identityRegistry;
    
    uint256 public minimumBond = 0.1 ether;
    
    struct Validator {
        bytes32 identityId;
        uint256 bondAmount;
        uint256 slashedAmount;
        uint256 escrowsValidated;
        bool isActive;
        uint256 registeredAt;
    }
    
    mapping(bytes32 => Validator) public validators;
    bytes32[] public validatorList;
    
    event ValidatorRegistered(bytes32 indexed identityId, uint256 bond);
    event ValidatorSlashed(bytes32 indexed identityId, uint256 amount, string reason);
    event ValidatorWithdrawn(bytes32 indexed identityId, uint256 amount);
    event ValidatorDeactivated(bytes32 indexed identityId);
    event MinimumBondUpdated(uint256 newMinimumBond);
    event BondAdded(bytes32 indexed identityId, uint256 amount);
    
    constructor(address _identityRegistry) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }
    
    function registerValidator(bytes32 identityId) external payable nonReentrant {
        require(identityRegistry.isAuthorized(identityId, msg.sender), "Not authorized");
        require(msg.value >= minimumBond, "Insufficient bond");
        require(!validators[identityId].isActive, "Already registered");
        
        validators[identityId] = Validator({
            identityId: identityId,
            bondAmount: msg.value,
            slashedAmount: 0,
            escrowsValidated: 0,
            isActive: true,
            registeredAt: block.timestamp
        });
        
        validatorList.push(identityId);
        
        emit ValidatorRegistered(identityId, msg.value);
    }
    
    function addBond(bytes32 identityId) external payable nonReentrant {
        require(identityRegistry.isAuthorized(identityId, msg.sender), "Not authorized");
        require(validators[identityId].isActive, "Validator not active");
        
        validators[identityId].bondAmount += msg.value;
        
        emit BondAdded(identityId, msg.value);
    }
    
    function slash(bytes32 identityId, uint256 amount, string calldata reason) external onlyOwner {
        Validator storage validator = validators[identityId];
        require(validator.isActive, "Validator not active");
        require(amount <= validator.bondAmount, "Slash amount exceeds bond");
        
        validator.bondAmount -= amount;
        validator.slashedAmount += amount;
        
        (bool success,) = owner().call{value: amount}("");
        require(success, "Transfer failed");
        
        if (validator.bondAmount < minimumBond) {
            validator.isActive = false;
            emit ValidatorDeactivated(identityId);
        }
        
        emit ValidatorSlashed(identityId, amount, reason);
    }
    
    function deactivate(bytes32 identityId) external {
        require(identityRegistry.isAuthorized(identityId, msg.sender), "Not authorized");
        
        Validator storage validator = validators[identityId];
        require(validator.isActive, "Not active");
        
        validator.isActive = false;
        
        emit ValidatorDeactivated(identityId);
    }
    
    function withdraw(bytes32 identityId) external nonReentrant {
        require(identityRegistry.isAuthorized(identityId, msg.sender), "Not authorized");
        
        Validator storage validator = validators[identityId];
        require(!validator.isActive, "Must deactivate first");
        require(validator.bondAmount > 0, "No bond to withdraw");
        
        uint256 amount = validator.bondAmount;
        validator.bondAmount = 0;
        
        (address primaryAccount,,,) = identityRegistry.getIdentity(identityId);
        (bool success,) = primaryAccount.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit ValidatorWithdrawn(identityId, amount);
    }
    
    function incrementEscrowsValidated(bytes32 identityId) external {
        validators[identityId].escrowsValidated++;
    }
    
    function setMinimumBond(uint256 newMinimumBond) external onlyOwner {
        minimumBond = newMinimumBond;
        emit MinimumBondUpdated(newMinimumBond);
    }
    
    function getValidator(bytes32 identityId) external view returns (Validator memory) {
        return validators[identityId];
    }
    
    function isActiveValidator(bytes32 identityId) external view returns (bool) {
        return validators[identityId].isActive;
    }
    
    function getValidatorCount() external view returns (uint256) {
        return validatorList.length;
    }
    
    function getActiveValidators() external view returns (bytes32[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].isActive) {
                activeCount++;
            }
        }
        
        bytes32[] memory active = new bytes32[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].isActive) {
                active[index] = validatorList[i];
                index++;
            }
        }
        
        return active;
    }
    
    receive() external payable {}
}
