// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./IIdentityRegistry.sol";
import "./BudgetVault.sol";

contract Paymaster is Ownable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    
    IIdentityRegistry public immutable identityRegistry;
    BudgetVault public immutable budgetVault;
    
    address public constant NATIVE_TOKEN = address(0);
    address public treasury;
    uint256 public feeBps = 100; // 1% default fee
    uint256 private constant BPS_BASE = 10000;
    
    mapping(bytes32 => uint256) public nonces;
    
    bytes32 private constant PAYMENT_AUTH_TYPEHASH = keccak256(
        "PaymentAuthorization(bytes32 fromId,bytes32 toId,address token,uint256 amount,bytes32 memoHash,uint256 nonce,uint256 deadline)"
    );
    
    event Payment(
        bytes32 indexed fromId,
        bytes32 indexed toId,
        address indexed token,
        uint256 grossAmount,
        uint256 feeAmount,
        bytes32 memoHash,
        address payerAccount
    );
    
    event PaymentClaimed(
        bytes32 indexed fromId,
        bytes32 indexed toId,
        address indexed token,
        uint256 grossAmount,
        uint256 feeAmount,
        bytes32 memoHash
    );
    
    event FeeUpdated(uint256 newFeeBps);
    event TreasuryUpdated(address newTreasury);
    
    constructor(
        address _identityRegistry,
        address _budgetVault,
        address _treasury
    ) Ownable(msg.sender) EIP712("BeePay", "1") {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        budgetVault = BudgetVault(payable(_budgetVault));
        treasury = _treasury;
    }
    
    function pay(
        bytes32 fromId,
        bytes32 toId,
        address token,
        uint256 amount,
        bytes32 memoHash
    ) external payable nonReentrant {
        require(identityRegistry.isAuthorized(fromId, msg.sender), "Not authorized for sender identity");
        require(amount > 0, "Amount must be positive");
        
        (address toAccount,,, bool toActive) = identityRegistry.getIdentity(toId);
        require(toAccount != address(0) && toActive, "Recipient identity invalid");
        
        uint256 feeAmount = (amount * feeBps) / BPS_BASE;
        uint256 netAmount = amount - feeAmount;
        
        if (token == NATIVE_TOKEN) {
            require(msg.value == amount, "Incorrect BNB amount");
            
            (bool successTo,) = toAccount.call{value: netAmount}("");
            require(successTo, "BNB transfer to recipient failed");
            
            if (feeAmount > 0) {
                (bool successFee,) = treasury.call{value: feeAmount}("");
                require(successFee, "Fee transfer failed");
            }
        } else {
            require(msg.value == 0, "BNB sent for ERC20 payment");
            
            IERC20(token).safeTransferFrom(msg.sender, toAccount, netAmount);
            
            if (feeAmount > 0) {
                IERC20(token).safeTransferFrom(msg.sender, treasury, feeAmount);
            }
        }
        
        emit Payment(fromId, toId, token, amount, feeAmount, memoHash, msg.sender);
    }
    
    function payFromVault(
        bytes32 fromId,
        bytes32 toId,
        address token,
        uint256 amount,
        bytes32 memoHash
    ) external nonReentrant {
        require(msg.sender == address(budgetVault), "Only vault can call");
        
        (address toAccount,,, bool toActive) = identityRegistry.getIdentity(toId);
        require(toAccount != address(0) && toActive, "Recipient identity invalid");
        
        uint256 feeAmount = (amount * feeBps) / BPS_BASE;
        uint256 netAmount = amount - feeAmount;
        
        if (token == NATIVE_TOKEN) {
            (bool successTo,) = toAccount.call{value: netAmount}("");
            require(successTo, "BNB transfer failed");
            
            if (feeAmount > 0) {
                (bool successFee,) = treasury.call{value: feeAmount}("");
                require(successFee, "Fee transfer failed");
            }
        } else {
            IERC20(token).safeTransfer(toAccount, netAmount);
            
            if (feeAmount > 0) {
                IERC20(token).safeTransfer(treasury, feeAmount);
            }
        }
        
        emit Payment(fromId, toId, token, amount, feeAmount, memoHash, address(budgetVault));
    }
    
    function claim(
        bytes32 fromId,
        bytes32 toId,
        address token,
        uint256 amount,
        bytes32 memoHash,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        require(identityRegistry.isAuthorized(toId, msg.sender), "Not authorized for recipient identity");
        require(block.timestamp <= deadline, "Authorization expired");
        require(amount > 0, "Amount must be positive");
        
        uint256 currentNonce = nonces[fromId];
        
        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_AUTH_TYPEHASH,
            fromId,
            toId,
            token,
            amount,
            memoHash,
            currentNonce,
            deadline
        ));
        
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        
        require(identityRegistry.isAuthorized(fromId, signer), "Invalid signature");
        
        nonces[fromId] = currentNonce + 1;
        
        (address fromAccount,,,) = identityRegistry.getIdentity(fromId);
        (address toAccount,,,) = identityRegistry.getIdentity(toId);
        
        uint256 feeAmount = (amount * feeBps) / BPS_BASE;
        uint256 netAmount = amount - feeAmount;
        
        if (token == NATIVE_TOKEN) {
            (bool successTo,) = toAccount.call{value: netAmount}("");
            require(successTo, "BNB transfer failed");
            
            if (feeAmount > 0) {
                (bool successFee,) = treasury.call{value: feeAmount}("");
                require(successFee, "Fee transfer failed");
            }
        } else {
            IERC20(token).safeTransferFrom(fromAccount, toAccount, netAmount);
            
            if (feeAmount > 0) {
                IERC20(token).safeTransferFrom(fromAccount, treasury, feeAmount);
            }
        }
        
        emit PaymentClaimed(fromId, toId, token, amount, feeAmount, memoHash);
    }
    
    function setFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high"); // Max 10%
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }
    
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }
    
    function getNonce(bytes32 identityId) external view returns (uint256) {
        return nonces[identityId];
    }
    
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
    
    receive() external payable {}
}
