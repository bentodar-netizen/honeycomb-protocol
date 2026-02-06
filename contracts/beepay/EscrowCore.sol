// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IIdentityRegistry.sol";
import "./IConditionModule.sol";

contract EscrowCore is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IIdentityRegistry public immutable identityRegistry;
    
    address public constant NATIVE_TOKEN = address(0);
    address public treasury;
    uint256 public feeBps = 100; // 1% fee
    uint256 private constant BPS_BASE = 10000;
    
    uint256 private _escrowIdCounter;
    
    enum EscrowStatus { CREATED, FUNDED, RELEASED, REFUNDED, DISPUTED }
    
    struct Escrow {
        uint256 escrowId;
        bytes32 payerId;
        bytes32 payeeId;
        address token;
        uint256 amount;
        uint256 deadline;
        bytes32 termsHash;
        address conditionModule;
        bytes conditionData;
        EscrowStatus status;
        uint256 fundedAt;
    }
    
    mapping(uint256 => Escrow) public escrows;
    mapping(address => bool) public approvedConditionModules;
    
    event EscrowCreated(
        uint256 indexed escrowId,
        bytes32 indexed payerId,
        bytes32 indexed payeeId,
        address token,
        uint256 amount,
        uint256 deadline,
        bytes32 termsHash,
        address conditionModule
    );
    
    event EscrowFunded(uint256 indexed escrowId, address indexed from);
    event EscrowReleased(uint256 indexed escrowId, address indexed to, uint256 feeAmount);
    event EscrowRefunded(uint256 indexed escrowId, address indexed to);
    event EscrowDisputed(uint256 indexed escrowId, address indexed by);
    event ConditionModuleApproved(address indexed module, bool approved);
    
    constructor(address _identityRegistry, address _treasury) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        treasury = _treasury;
    }
    
    function createEscrow(
        bytes32 payerId,
        bytes32 payeeId,
        address token,
        uint256 amount,
        uint256 deadline,
        bytes32 termsHash,
        address conditionModule,
        bytes calldata conditionData
    ) external nonReentrant returns (uint256 escrowId) {
        require(identityRegistry.isAuthorized(payerId, msg.sender), "Not authorized");
        require(approvedConditionModules[conditionModule], "Condition module not approved");
        require(deadline > block.timestamp, "Invalid deadline");
        require(amount > 0, "Amount must be positive");
        
        (,,,bool payeeActive) = identityRegistry.getIdentity(payeeId);
        require(payeeActive, "Payee identity not active");
        
        _escrowIdCounter++;
        escrowId = _escrowIdCounter;
        
        escrows[escrowId] = Escrow({
            escrowId: escrowId,
            payerId: payerId,
            payeeId: payeeId,
            token: token,
            amount: amount,
            deadline: deadline,
            termsHash: termsHash,
            conditionModule: conditionModule,
            conditionData: conditionData,
            status: EscrowStatus.CREATED,
            fundedAt: 0
        });
        
        emit EscrowCreated(escrowId, payerId, payeeId, token, amount, deadline, termsHash, conditionModule);
    }
    
    function fund(uint256 escrowId) external payable nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.escrowId != 0, "Escrow does not exist");
        require(escrow.status == EscrowStatus.CREATED, "Escrow not in CREATED state");
        require(identityRegistry.isAuthorized(escrow.payerId, msg.sender), "Not authorized payer");
        
        if (escrow.token == NATIVE_TOKEN) {
            require(msg.value == escrow.amount, "Incorrect BNB amount");
        } else {
            require(msg.value == 0, "BNB sent for ERC20 escrow");
            IERC20(escrow.token).safeTransferFrom(msg.sender, address(this), escrow.amount);
        }
        
        escrow.status = EscrowStatus.FUNDED;
        escrow.fundedAt = block.timestamp;
        
        emit EscrowFunded(escrowId, msg.sender);
    }
    
    function release(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.FUNDED, "Escrow not funded");
        
        bool satisfied = IConditionModule(escrow.conditionModule).isSatisfied(escrowId, escrow.conditionData);
        require(satisfied, "Condition not satisfied");
        
        escrow.status = EscrowStatus.RELEASED;
        
        (address payeeAccount,,,) = identityRegistry.getIdentity(escrow.payeeId);
        
        uint256 feeAmount = (escrow.amount * feeBps) / BPS_BASE;
        uint256 netAmount = escrow.amount - feeAmount;
        
        if (escrow.token == NATIVE_TOKEN) {
            (bool successTo,) = payeeAccount.call{value: netAmount}("");
            require(successTo, "BNB transfer failed");
            
            if (feeAmount > 0) {
                (bool successFee,) = treasury.call{value: feeAmount}("");
                require(successFee, "Fee transfer failed");
            }
        } else {
            IERC20(escrow.token).safeTransfer(payeeAccount, netAmount);
            
            if (feeAmount > 0) {
                IERC20(escrow.token).safeTransfer(treasury, feeAmount);
            }
        }
        
        emit EscrowReleased(escrowId, payeeAccount, feeAmount);
    }
    
    function refund(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.FUNDED, "Escrow not funded");
        require(block.timestamp > escrow.deadline, "Deadline not passed");
        
        bool satisfied = IConditionModule(escrow.conditionModule).isSatisfied(escrowId, escrow.conditionData);
        require(!satisfied, "Condition already satisfied");
        
        escrow.status = EscrowStatus.REFUNDED;
        
        (address payerAccount,,,) = identityRegistry.getIdentity(escrow.payerId);
        
        if (escrow.token == NATIVE_TOKEN) {
            (bool success,) = payerAccount.call{value: escrow.amount}("");
            require(success, "BNB transfer failed");
        } else {
            IERC20(escrow.token).safeTransfer(payerAccount, escrow.amount);
        }
        
        emit EscrowRefunded(escrowId, payerAccount);
    }
    
    function dispute(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.FUNDED, "Escrow not funded");
        require(
            identityRegistry.isAuthorized(escrow.payerId, msg.sender) ||
            identityRegistry.isAuthorized(escrow.payeeId, msg.sender),
            "Not authorized"
        );
        
        escrow.status = EscrowStatus.DISPUTED;
        
        emit EscrowDisputed(escrowId, msg.sender);
    }
    
    function resolveDispute(uint256 escrowId, bool releaseToPayee) external onlyOwner {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.DISPUTED, "Not in dispute");
        
        if (releaseToPayee) {
            escrow.status = EscrowStatus.RELEASED;
            (address payeeAccount,,,) = identityRegistry.getIdentity(escrow.payeeId);
            
            uint256 feeAmount = (escrow.amount * feeBps) / BPS_BASE;
            uint256 netAmount = escrow.amount - feeAmount;
            
            if (escrow.token == NATIVE_TOKEN) {
                (bool success,) = payeeAccount.call{value: netAmount}("");
                require(success, "Transfer failed");
                if (feeAmount > 0) {
                    (bool successFee,) = treasury.call{value: feeAmount}("");
                    require(successFee, "Fee transfer failed");
                }
            } else {
                IERC20(escrow.token).safeTransfer(payeeAccount, netAmount);
                if (feeAmount > 0) {
                    IERC20(escrow.token).safeTransfer(treasury, feeAmount);
                }
            }
            
            emit EscrowReleased(escrowId, payeeAccount, feeAmount);
        } else {
            escrow.status = EscrowStatus.REFUNDED;
            (address payerAccount,,,) = identityRegistry.getIdentity(escrow.payerId);
            
            if (escrow.token == NATIVE_TOKEN) {
                (bool success,) = payerAccount.call{value: escrow.amount}("");
                require(success, "Transfer failed");
            } else {
                IERC20(escrow.token).safeTransfer(payerAccount, escrow.amount);
            }
            
            emit EscrowRefunded(escrowId, payerAccount);
        }
    }
    
    function approveConditionModule(address module, bool approved) external onlyOwner {
        approvedConditionModules[module] = approved;
        emit ConditionModuleApproved(module, approved);
    }
    
    function setFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high");
        feeBps = newFeeBps;
    }
    
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }
    
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return escrows[escrowId];
    }
    
    function getEscrowCount() external view returns (uint256) {
        return _escrowIdCounter;
    }
    
    receive() external payable {}
}
