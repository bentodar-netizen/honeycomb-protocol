// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAgentRegistry {
    function isAgentOwner(address owner, uint256 agentId) external view returns (bool);
    function agentExists(uint256 agentId) external view returns (bool);
}

/**
 * @title HoneycombBountyEscrow
 * @notice On-chain bounty escrow for the Honeycomb task marketplace (Honey)
 * @dev Supports native token escrow (BNB on BSC, ETH on Hardhat)
 */
contract HoneycombBountyEscrow is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum BountyStatus { OPEN, AWARDED, CANCELLED, EXPIRED }

    struct Bounty {
        uint256 id;
        uint256 creatorAgentId;
        address creatorAddress;
        string bountyCID;
        uint256 rewardAmount;
        uint256 deadline;
        BountyStatus status;
        uint256 winningSolutionId;
        uint256 createdAt;
    }

    struct Solution {
        uint256 id;
        uint256 bountyId;
        uint256 agentId;
        address solverAddress;
        string solutionCID;
        uint256 createdAt;
    }

    IAgentRegistry public agentRegistry;
    
    uint256 private _nextBountyId = 1;
    
    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => mapping(uint256 => Solution)) public solutions;
    mapping(uint256 => uint256) public solutionCounts;
    mapping(uint256 => bool) public bountyExists;

    uint256 public constant MIN_REWARD = 0.001 ether;
    uint256 public constant MAX_REWARD = 1000 ether;
    uint256 public constant MIN_DEADLINE_DURATION = 1 hours;
    uint256 public constant MAX_DEADLINE_DURATION = 365 days;

    event BountyCreated(
        uint256 indexed bountyId,
        uint256 indexed creatorAgentId,
        address indexed creator,
        string bountyCID,
        uint256 rewardAmount,
        uint256 deadline,
        uint256 timestamp
    );

    event SolutionSubmitted(
        uint256 indexed bountyId,
        uint256 indexed solutionId,
        uint256 indexed agentId,
        address solver,
        string solutionCID,
        uint256 timestamp
    );

    event BountyAwarded(
        uint256 indexed bountyId,
        uint256 indexed solutionId,
        address indexed solverAddress,
        uint256 rewardAmount,
        uint256 timestamp
    );

    event BountyCancelled(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 refundAmount,
        uint256 timestamp
    );

    error BountyNotFound();
    error BountyNotOpen();
    error BountyDeadlinePassed();
    error BountyDeadlineNotPassed();
    error NotBountyCreator();
    error NotAgentOwner();
    error AgentNotFound();
    error InvalidRewardAmount();
    error InvalidDeadline();
    error InvalidCID();
    error SolutionNotFound();
    error CannotSolveOwnBounty();
    error AlreadySubmittedSolution();
    error TransferFailed();
    error NoSolutions();

    constructor(address _agentRegistry) {
        agentRegistry = IAgentRegistry(_agentRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Create a new bounty with escrowed reward
     * @param agentId The creator's agent ID
     * @param bountyCID IPFS CID containing bounty metadata
     * @param deadlineTimestamp Unix timestamp for submission deadline
     */
    function createBounty(
        uint256 agentId,
        string calldata bountyCID,
        uint256 deadlineTimestamp
    ) 
        external 
        payable 
        nonReentrant 
        returns (uint256 bountyId) 
    {
        if (!agentRegistry.agentExists(agentId)) revert AgentNotFound();
        if (!agentRegistry.isAgentOwner(msg.sender, agentId)) revert NotAgentOwner();
        if (bytes(bountyCID).length == 0) revert InvalidCID();
        if (msg.value < MIN_REWARD || msg.value > MAX_REWARD) revert InvalidRewardAmount();
        
        uint256 duration = deadlineTimestamp - block.timestamp;
        if (duration < MIN_DEADLINE_DURATION || duration > MAX_DEADLINE_DURATION) {
            revert InvalidDeadline();
        }

        bountyId = _nextBountyId++;
        
        bounties[bountyId] = Bounty({
            id: bountyId,
            creatorAgentId: agentId,
            creatorAddress: msg.sender,
            bountyCID: bountyCID,
            rewardAmount: msg.value,
            deadline: deadlineTimestamp,
            status: BountyStatus.OPEN,
            winningSolutionId: 0,
            createdAt: block.timestamp
        });
        
        bountyExists[bountyId] = true;

        emit BountyCreated(
            bountyId,
            agentId,
            msg.sender,
            bountyCID,
            msg.value,
            deadlineTimestamp,
            block.timestamp
        );
    }

    /**
     * @notice Submit a solution to an open bounty
     * @param bountyId The bounty to submit a solution for
     * @param agentId The solver's agent ID
     * @param solutionCID IPFS CID containing solution metadata
     */
    function submitSolution(
        uint256 bountyId,
        uint256 agentId,
        string calldata solutionCID
    ) 
        external 
        nonReentrant 
        returns (uint256 solutionId) 
    {
        if (!bountyExists[bountyId]) revert BountyNotFound();
        
        Bounty storage bounty = bounties[bountyId];
        if (bounty.status != BountyStatus.OPEN) revert BountyNotOpen();
        if (block.timestamp > bounty.deadline) revert BountyDeadlinePassed();
        
        if (!agentRegistry.agentExists(agentId)) revert AgentNotFound();
        if (!agentRegistry.isAgentOwner(msg.sender, agentId)) revert NotAgentOwner();
        if (bounty.creatorAgentId == agentId) revert CannotSolveOwnBounty();
        if (bytes(solutionCID).length == 0) revert InvalidCID();

        // Check if this agent already submitted
        for (uint256 i = 1; i <= solutionCounts[bountyId]; i++) {
            if (solutions[bountyId][i].agentId == agentId) {
                revert AlreadySubmittedSolution();
            }
        }

        solutionId = ++solutionCounts[bountyId];
        
        solutions[bountyId][solutionId] = Solution({
            id: solutionId,
            bountyId: bountyId,
            agentId: agentId,
            solverAddress: msg.sender,
            solutionCID: solutionCID,
            createdAt: block.timestamp
        });

        emit SolutionSubmitted(
            bountyId,
            solutionId,
            agentId,
            msg.sender,
            solutionCID,
            block.timestamp
        );
    }

    /**
     * @notice Award a solution and release escrowed funds to the winner
     * @param bountyId The bounty to award
     * @param solutionId The winning solution ID
     */
    function awardSolution(uint256 bountyId, uint256 solutionId) 
        external 
        nonReentrant 
    {
        if (!bountyExists[bountyId]) revert BountyNotFound();
        
        Bounty storage bounty = bounties[bountyId];
        if (bounty.status != BountyStatus.OPEN) revert BountyNotOpen();
        if (bounty.creatorAddress != msg.sender) revert NotBountyCreator();
        if (solutionCounts[bountyId] == 0) revert NoSolutions();
        
        Solution storage solution = solutions[bountyId][solutionId];
        if (solution.id == 0) revert SolutionNotFound();

        bounty.status = BountyStatus.AWARDED;
        bounty.winningSolutionId = solutionId;

        uint256 reward = bounty.rewardAmount;
        address winner = solution.solverAddress;

        (bool success, ) = winner.call{value: reward}("");
        if (!success) revert TransferFailed();

        emit BountyAwarded(
            bountyId,
            solutionId,
            winner,
            reward,
            block.timestamp
        );
    }

    /**
     * @notice Cancel a bounty and refund escrowed funds
     * @param bountyId The bounty to cancel
     */
    function cancelBounty(uint256 bountyId) 
        external 
        nonReentrant 
    {
        if (!bountyExists[bountyId]) revert BountyNotFound();
        
        Bounty storage bounty = bounties[bountyId];
        if (bounty.status != BountyStatus.OPEN) revert BountyNotOpen();
        if (bounty.creatorAddress != msg.sender) revert NotBountyCreator();

        bounty.status = BountyStatus.CANCELLED;

        uint256 refund = bounty.rewardAmount;
        address creator = bounty.creatorAddress;

        (bool success, ) = creator.call{value: refund}("");
        if (!success) revert TransferFailed();

        emit BountyCancelled(bountyId, creator, refund, block.timestamp);
    }

    /**
     * @notice Get bounty details
     */
    function getBounty(uint256 bountyId) 
        external 
        view 
        returns (Bounty memory) 
    {
        if (!bountyExists[bountyId]) revert BountyNotFound();
        return bounties[bountyId];
    }

    /**
     * @notice Get solution details
     */
    function getSolution(uint256 bountyId, uint256 solutionId) 
        external 
        view 
        returns (Solution memory) 
    {
        if (!bountyExists[bountyId]) revert BountyNotFound();
        if (solutions[bountyId][solutionId].id == 0) revert SolutionNotFound();
        return solutions[bountyId][solutionId];
    }

    /**
     * @notice Get total number of bounties
     */
    function totalBounties() external view returns (uint256) {
        return _nextBountyId - 1;
    }

    /**
     * @notice Update agent registry address (admin only)
     */
    function setAgentRegistry(address _agentRegistry) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        agentRegistry = IAgentRegistry(_agentRegistry);
    }
}
