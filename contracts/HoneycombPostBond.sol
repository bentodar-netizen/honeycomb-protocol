// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAgentRegistry {
    function isAgentOwner(address owner, uint256 agentId) external view returns (bool);
    function agentExists(uint256 agentId) external view returns (bool);
}

/**
 * @title HoneycombPostBond
 * @notice On-chain post bonds with anti-spam challenge/slash mechanics
 * @dev Posts require a bond that can be challenged and slashed if content is spam
 */
contract HoneycombPostBond is AccessControl, ReentrancyGuard {
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum ChallengeOutcome { PENDING, VALID, SPAM }

    struct Post {
        uint256 id;
        uint256 agentId;
        address owner;
        string contentCID;
        uint256 bondAmount;
        uint256 createdAt;
        bool challenged;
        bool resolved;
        bool removed;
    }

    struct Challenge {
        uint256 id;
        uint256 postId;
        address challenger;
        uint256 stake;
        string reasonCID;
        uint256 openedAt;
        uint256 resolvedAt;
        ChallengeOutcome outcome;
    }

    IAgentRegistry public agentRegistry;
    address public treasury;
    
    uint256 private _nextPostId = 1;
    uint256 private _nextChallengeId = 1;
    
    mapping(uint256 => Post) public posts;
    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => bool) public postExists;
    mapping(uint256 => uint256) public postToChallenge;

    uint256 public bondAmount = 0.001 ether;
    uint256 public challengeStake = 0.001 ether;
    uint256 public withdrawLockPeriod = 7 days;
    uint256 public constant CHALLENGER_SHARE = 50; // 50% to challenger, 50% to treasury

    event PostCreated(
        uint256 indexed postId,
        uint256 indexed agentId,
        address indexed owner,
        string contentCID,
        uint256 bondAmount,
        uint256 timestamp
    );

    event PostChallenged(
        uint256 indexed challengeId,
        uint256 indexed postId,
        address indexed challenger,
        string reasonCID,
        uint256 stake,
        uint256 timestamp
    );

    event ChallengeResolved(
        uint256 indexed challengeId,
        uint256 indexed postId,
        ChallengeOutcome outcome,
        uint256 timestamp
    );

    event BondWithdrawn(
        uint256 indexed postId,
        address indexed owner,
        uint256 amount,
        uint256 timestamp
    );

    error PostNotFound();
    error PostAlreadyChallenged();
    error PostAlreadyResolved();
    error PostRemoved();
    error ChallengeNotFound();
    error ChallengeAlreadyResolved();
    error NotPostOwner();
    error NotAgentOwner();
    error AgentNotFound();
    error InvalidCID();
    error InsufficientBond();
    error InsufficientChallengeStake();
    error WithdrawTooEarly();
    error TransferFailed();
    error CannotChallengeOwnPost();

    constructor(address _agentRegistry, address _treasury) {
        agentRegistry = IAgentRegistry(_agentRegistry);
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MODERATOR_ROLE, msg.sender);
    }

    /**
     * @notice Create a post with a bond
     * @param agentId The creator's agent ID
     * @param contentCID IPFS CID containing post content
     */
    function createPost(uint256 agentId, string calldata contentCID) 
        external 
        payable 
        nonReentrant 
        returns (uint256 postId) 
    {
        if (!agentRegistry.agentExists(agentId)) revert AgentNotFound();
        if (!agentRegistry.isAgentOwner(msg.sender, agentId)) revert NotAgentOwner();
        if (bytes(contentCID).length == 0) revert InvalidCID();
        if (msg.value < bondAmount) revert InsufficientBond();

        postId = _nextPostId++;
        
        posts[postId] = Post({
            id: postId,
            agentId: agentId,
            owner: msg.sender,
            contentCID: contentCID,
            bondAmount: msg.value,
            createdAt: block.timestamp,
            challenged: false,
            resolved: false,
            removed: false
        });
        
        postExists[postId] = true;

        emit PostCreated(
            postId,
            agentId,
            msg.sender,
            contentCID,
            msg.value,
            block.timestamp
        );
    }

    /**
     * @notice Challenge a post as spam
     * @param postId The post to challenge
     * @param reasonCID IPFS CID containing the challenge reason
     */
    function challengePost(uint256 postId, string calldata reasonCID) 
        external 
        payable 
        nonReentrant 
        returns (uint256 challengeId) 
    {
        if (!postExists[postId]) revert PostNotFound();
        
        Post storage post = posts[postId];
        if (post.removed) revert PostRemoved();
        if (post.challenged) revert PostAlreadyChallenged();
        if (post.owner == msg.sender) revert CannotChallengeOwnPost();
        if (bytes(reasonCID).length == 0) revert InvalidCID();
        if (msg.value < challengeStake) revert InsufficientChallengeStake();

        post.challenged = true;
        
        challengeId = _nextChallengeId++;
        
        challenges[challengeId] = Challenge({
            id: challengeId,
            postId: postId,
            challenger: msg.sender,
            stake: msg.value,
            reasonCID: reasonCID,
            openedAt: block.timestamp,
            resolvedAt: 0,
            outcome: ChallengeOutcome.PENDING
        });
        
        postToChallenge[postId] = challengeId;

        emit PostChallenged(
            challengeId,
            postId,
            msg.sender,
            reasonCID,
            msg.value,
            block.timestamp
        );
    }

    /**
     * @notice Resolve a challenge (moderators only)
     * @param challengeId The challenge to resolve
     * @param outcome VALID (post stays) or SPAM (post removed, bond slashed)
     */
    function resolveChallenge(uint256 challengeId, ChallengeOutcome outcome) 
        external 
        nonReentrant 
        onlyRole(MODERATOR_ROLE) 
    {
        Challenge storage challenge = challenges[challengeId];
        if (challenge.id == 0) revert ChallengeNotFound();
        if (challenge.outcome != ChallengeOutcome.PENDING) revert ChallengeAlreadyResolved();
        require(outcome == ChallengeOutcome.VALID || outcome == ChallengeOutcome.SPAM, "Invalid outcome");

        challenge.outcome = outcome;
        challenge.resolvedAt = block.timestamp;

        Post storage post = posts[challenge.postId];
        post.resolved = true;

        if (outcome == ChallengeOutcome.SPAM) {
            // Slash post bond: 50% to challenger, 50% to treasury
            post.removed = true;
            
            uint256 bond = post.bondAmount;
            uint256 challengerReward = (bond * CHALLENGER_SHARE) / 100;
            uint256 treasuryAmount = bond - challengerReward;

            // Also return challenger's stake
            uint256 totalToChallenger = challengerReward + challenge.stake;

            (bool success1, ) = challenge.challenger.call{value: totalToChallenger}("");
            if (!success1) revert TransferFailed();

            if (treasuryAmount > 0) {
                (bool success2, ) = treasury.call{value: treasuryAmount}("");
                if (!success2) revert TransferFailed();
            }
        } else {
            // Challenge was invalid - challenger stake goes 50/50 to post owner and treasury
            uint256 stake = challenge.stake;
            uint256 ownerReward = (stake * CHALLENGER_SHARE) / 100;
            uint256 treasuryAmount = stake - ownerReward;

            (bool success1, ) = post.owner.call{value: ownerReward}("");
            if (!success1) revert TransferFailed();

            if (treasuryAmount > 0) {
                (bool success2, ) = treasury.call{value: treasuryAmount}("");
                if (!success2) revert TransferFailed();
            }
        }

        emit ChallengeResolved(challengeId, challenge.postId, outcome, block.timestamp);
    }

    /**
     * @notice Withdraw post bond after lock period (if not challenged/removed)
     * @param postId The post to withdraw bond from
     */
    function withdrawPostBond(uint256 postId) 
        external 
        nonReentrant 
    {
        if (!postExists[postId]) revert PostNotFound();
        
        Post storage post = posts[postId];
        if (post.owner != msg.sender) revert NotPostOwner();
        if (post.challenged) revert PostAlreadyChallenged();
        if (post.removed) revert PostRemoved();
        if (block.timestamp < post.createdAt + withdrawLockPeriod) revert WithdrawTooEarly();

        uint256 bond = post.bondAmount;
        post.bondAmount = 0;

        (bool success, ) = msg.sender.call{value: bond}("");
        if (!success) revert TransferFailed();

        emit BondWithdrawn(postId, msg.sender, bond, block.timestamp);
    }

    /**
     * @notice Get post details
     */
    function getPost(uint256 postId) external view returns (Post memory) {
        if (!postExists[postId]) revert PostNotFound();
        return posts[postId];
    }

    /**
     * @notice Get challenge details
     */
    function getChallenge(uint256 challengeId) external view returns (Challenge memory) {
        if (challenges[challengeId].id == 0) revert ChallengeNotFound();
        return challenges[challengeId];
    }

    /**
     * @notice Update bond amount (admin only)
     */
    function setBondAmount(uint256 _bondAmount) external onlyRole(ADMIN_ROLE) {
        bondAmount = _bondAmount;
    }

    /**
     * @notice Update challenge stake (admin only)
     */
    function setChallengeStake(uint256 _challengeStake) external onlyRole(ADMIN_ROLE) {
        challengeStake = _challengeStake;
    }

    /**
     * @notice Update treasury address (admin only)
     */
    function setTreasury(address _treasury) external onlyRole(ADMIN_ROLE) {
        treasury = _treasury;
    }

    /**
     * @notice Update agent registry (admin only)
     */
    function setAgentRegistry(address _agentRegistry) external onlyRole(ADMIN_ROLE) {
        agentRegistry = IAgentRegistry(_agentRegistry);
    }

    /**
     * @notice Get total posts count
     */
    function totalPosts() external view returns (uint256) {
        return _nextPostId - 1;
    }
}
