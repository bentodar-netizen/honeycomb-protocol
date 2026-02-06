// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IIdentityRegistry.sol";

contract BudgetVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IIdentityRegistry public immutable identityRegistry;
    
    address public constant NATIVE_TOKEN = address(0);
    uint256 private constant DAY_IN_SECONDS = 86400;
    
    struct Budget {
        uint256 balance;
        uint256 dailyLimit;
        uint256 dailySpent;
        uint256 lastResetDay;
        bool isFrozen;
    }
    
    mapping(bytes32 => mapping(address => Budget)) private _budgets;
    mapping(bytes32 => mapping(address => uint256)) private _payeeLimits;
    mapping(address => bool) public allowedTargets;
    
    event Deposited(bytes32 indexed identityId, address indexed token, uint256 amount, address indexed from);
    event Withdrawn(bytes32 indexed identityId, address indexed token, uint256 amount, address indexed to);
    event LimitSet(bytes32 indexed identityId, address indexed token, uint256 limit);
    event PayeeLimitSet(bytes32 indexed identityId, bytes32 indexed payeeId, address indexed token, uint256 limit);
    event Spent(bytes32 indexed identityId, address indexed target, address token, uint256 amount, bytes32 memoHash);
    event Frozen(bytes32 indexed identityId, bool frozen);
    event TargetAllowed(address indexed target, bool allowed);
    
    constructor(address _identityRegistry) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }
    
    function deposit(bytes32 identityId, address token, uint256 amount) external payable nonReentrant {
        (address primaryAccount,,, bool isActive) = identityRegistry.getIdentity(identityId);
        require(primaryAccount != address(0), "Identity does not exist");
        require(isActive, "Identity not active");
        
        Budget storage budget = _budgets[identityId][token];
        
        if (token == NATIVE_TOKEN) {
            require(msg.value == amount, "Incorrect BNB amount");
            budget.balance += msg.value;
        } else {
            require(msg.value == 0, "BNB sent for ERC20 deposit");
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            budget.balance += amount;
        }
        
        emit Deposited(identityId, token, amount, msg.sender);
    }
    
    function withdraw(bytes32 identityId, address token, uint256 amount, address to) external nonReentrant {
        require(identityRegistry.isAuthorized(identityId, msg.sender), "Not authorized");
        
        Budget storage budget = _budgets[identityId][token];
        require(!budget.isFrozen, "Budget is frozen");
        require(budget.balance >= amount, "Insufficient balance");
        
        budget.balance -= amount;
        
        if (token == NATIVE_TOKEN) {
            (bool success,) = to.call{value: amount}("");
            require(success, "BNB transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
        
        emit Withdrawn(identityId, token, amount, to);
    }
    
    function setDailyLimit(bytes32 identityId, address token, uint256 limit) external {
        require(identityRegistry.isAuthorized(identityId, msg.sender), "Not authorized");
        
        Budget storage budget = _budgets[identityId][token];
        budget.dailyLimit = limit;
        
        emit LimitSet(identityId, token, limit);
    }
    
    function setPayeeLimit(bytes32 identityId, bytes32 payeeId, address token, uint256 limit) external {
        require(identityRegistry.isAuthorized(identityId, msg.sender), "Not authorized");
        
        bytes32 key = keccak256(abi.encodePacked(identityId, payeeId, token));
        _payeeLimits[identityId][token] = limit;
        
        emit PayeeLimitSet(identityId, payeeId, token, limit);
    }
    
    function allowTarget(address target, bool allowed) external onlyOwner {
        allowedTargets[target] = allowed;
        emit TargetAllowed(target, allowed);
    }
    
    function spend(
        bytes32 identityId,
        address target,
        address token,
        uint256 amount,
        bytes32 memoHash
    ) external nonReentrant returns (bool) {
        require(identityRegistry.isAuthorized(identityId, msg.sender), "Not authorized");
        require(allowedTargets[target], "Target not allowed");
        
        Budget storage budget = _budgets[identityId][token];
        require(!budget.isFrozen, "Budget is frozen");
        require(budget.balance >= amount, "Insufficient balance");
        
        uint256 currentDay = block.timestamp / DAY_IN_SECONDS;
        if (currentDay > budget.lastResetDay) {
            budget.dailySpent = 0;
            budget.lastResetDay = currentDay;
        }
        
        if (budget.dailyLimit > 0) {
            require(budget.dailySpent + amount <= budget.dailyLimit, "Daily limit exceeded");
            budget.dailySpent += amount;
        }
        
        budget.balance -= amount;
        
        if (token == NATIVE_TOKEN) {
            (bool success,) = target.call{value: amount}("");
            require(success, "BNB transfer failed");
        } else {
            IERC20(token).safeTransfer(target, amount);
        }
        
        emit Spent(identityId, target, token, amount, memoHash);
        return true;
    }
    
    function emergencyFreeze(bytes32 identityId, bool frozen) external {
        require(identityRegistry.isAuthorized(identityId, msg.sender), "Not authorized");
        
        _budgets[identityId][NATIVE_TOKEN].isFrozen = frozen;
        
        emit Frozen(identityId, frozen);
    }
    
    function freezeAll(bytes32 identityId, address[] calldata tokens, bool frozen) external {
        require(identityRegistry.isAuthorized(identityId, msg.sender), "Not authorized");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            _budgets[identityId][tokens[i]].isFrozen = frozen;
        }
        
        emit Frozen(identityId, frozen);
    }
    
    function getBudget(bytes32 identityId, address token) external view returns (
        uint256 balance,
        uint256 dailyLimit,
        uint256 dailySpent,
        uint256 remainingToday,
        bool isFrozen
    ) {
        Budget storage budget = _budgets[identityId][token];
        
        uint256 currentDay = block.timestamp / DAY_IN_SECONDS;
        uint256 spent = currentDay > budget.lastResetDay ? 0 : budget.dailySpent;
        uint256 remaining = budget.dailyLimit > 0 ? budget.dailyLimit - spent : type(uint256).max;
        
        return (
            budget.balance,
            budget.dailyLimit,
            spent,
            remaining,
            budget.isFrozen
        );
    }
    
    receive() external payable {}
}
