// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAgentRegistry {
    function isAgentOwner(address owner, uint256 agentId) external view returns (bool);
    function agentExists(uint256 agentId) external view returns (bool);
}

// VRF Consumer interface for random duels
interface IVRFConsumer {
    function requestRandomWords(uint256 duelId) external returns (uint256 requestId);
}

/**
 * @title HoneycombPredictDuel
 * @notice On-chain prediction duels for cryptocurrency price betting + VRF random duels
 * @dev 1v1 duels with BNB escrow - 90% to winner, 10% platform fee
 */
contract HoneycombPredictDuel is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant VRF_ROLE = keccak256("VRF_ROLE");

    enum DuelStatus { OPEN, LIVE, PENDING_VRF, SETTLED, CANCELLED, EXPIRED }
    enum Direction { UP, DOWN }
    enum DuelType { PRICE, RANDOM }

    struct Duel {
        uint256 id;
        string assetId;
        DuelType duelType;
        uint256 creatorAgentId;
        address creatorAddress;
        Direction creatorDirection;
        uint256 stakeAmount;
        uint256 durationSeconds;
        uint256 joinerAgentId;
        address joinerAddress;
        uint256 startPrice;
        uint256 endPrice;
        uint256 startTs;
        uint256 endTs;
        DuelStatus status;
        address winner;
        uint256 payout;
        uint256 fee;
        uint256 createdAt;
        uint256 vrfRequestId;
        uint256 vrfRandomWord;
    }

    IAgentRegistry public agentRegistry;
    IVRFConsumer public vrfConsumer;
    address public feeTreasury;
    uint256 public feePercentage = 10;
    
    uint256 private _nextDuelId = 1;
    
    mapping(uint256 => Duel) public duels;
    mapping(uint256 => bool) public duelExists;
    mapping(uint256 => uint256) public vrfRequestToDuel; // VRF requestId => duelId

    uint256 public constant MIN_STAKE = 0.001 ether;
    uint256 public constant MAX_STAKE = 100 ether;
    uint256 public constant MIN_DURATION = 1 minutes;
    uint256 public constant MAX_DURATION = 7 days;

    event DuelCreated(
        uint256 indexed duelId,
        uint256 indexed creatorAgentId,
        address indexed creator,
        string assetId,
        uint8 direction,
        uint8 duelType,
        uint256 stakeAmount,
        uint256 durationSeconds,
        uint256 timestamp
    );

    event DuelJoined(
        uint256 indexed duelId,
        uint256 indexed joinerAgentId,
        address indexed joiner,
        uint256 startPrice,
        uint256 startTs,
        uint256 endTs,
        uint256 timestamp
    );

    event DuelSettled(
        uint256 indexed duelId,
        address indexed winner,
        uint256 endPrice,
        uint256 payout,
        uint256 fee,
        uint256 timestamp
    );

    event RandomDuelSettled(
        uint256 indexed duelId,
        address indexed winner,
        uint256 randomWord,
        uint256 payout,
        uint256 fee,
        uint256 timestamp
    );

    event RandomnessRequested(
        uint256 indexed duelId,
        uint256 indexed requestId,
        uint256 timestamp
    );

    event RandomnessFulfilled(
        uint256 indexed duelId,
        uint256 indexed requestId,
        uint256 randomWord,
        uint256 timestamp
    );

    event DuelCancelled(
        uint256 indexed duelId,
        address indexed creator,
        uint256 refundAmount,
        uint256 timestamp
    );

    event DuelExpired(
        uint256 indexed duelId,
        uint256 refundAmount,
        uint256 timestamp
    );

    event FeeTransferred(
        uint256 indexed duelId,
        address indexed treasury,
        uint256 amount,
        uint256 timestamp
    );

    error DuelNotFound();
    error DuelNotOpen();
    error DuelNotLive();
    error DuelNotEnded();
    error DuelAlreadyEnded();
    error NotDuelCreator();
    error NotAgentOwner();
    error AgentNotFound();
    error InvalidStakeAmount();
    error InvalidDuration();
    error InvalidAssetId();
    error CannotJoinOwnDuel();
    error TransferFailed();
    error InvalidFeePercentage();
    error ZeroAddress();
    error StakeMismatch();
    error NoWinner();
    error InvalidDuelType();
    error VRFNotConfigured();
    error InvalidVRFRequest();
    error DuelNotPendingVRF();

    constructor(address _agentRegistry, address _feeTreasury) {
        if (_agentRegistry == address(0)) revert ZeroAddress();
        if (_feeTreasury == address(0)) revert ZeroAddress();
        
        agentRegistry = IAgentRegistry(_agentRegistry);
        feeTreasury = _feeTreasury;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(VRF_ROLE, msg.sender);
    }

    /**
     * @notice Create a new prediction duel with escrowed stake
     * @param agentId The creator's agent ID
     * @param assetId Asset symbol (e.g., "BTC", "ETH", "BNB")
     * @param direction Creator's prediction (0 = UP, 1 = DOWN)
     * @param durationSeconds Duration of the duel once started
     */
    function createDuel(
        uint256 agentId,
        string calldata assetId,
        Direction direction,
        uint256 durationSeconds
    ) 
        external 
        payable 
        nonReentrant 
        returns (uint256 duelId) 
    {
        return _createDuel(agentId, assetId, direction, durationSeconds, DuelType.PRICE);
    }

    /**
     * @notice Create a new duel with specified type (PRICE or RANDOM)
     * @param agentId The creator's agent ID
     * @param assetId Asset symbol (e.g., "BTC", "ETH", "BNB") - used for display in RANDOM duels
     * @param direction Creator's prediction (0 = UP, 1 = DOWN)
     * @param durationSeconds Duration of the duel once started
     * @param duelType 0 = PRICE (oracle-settled), 1 = RANDOM (VRF-settled)
     */
    function createDuelWithType(
        uint256 agentId,
        string calldata assetId,
        Direction direction,
        uint256 durationSeconds,
        DuelType duelType
    ) 
        external 
        payable 
        nonReentrant 
        returns (uint256 duelId) 
    {
        if (duelType == DuelType.RANDOM && address(vrfConsumer) == address(0)) {
            revert VRFNotConfigured();
        }
        return _createDuel(agentId, assetId, direction, durationSeconds, duelType);
    }

    function _createDuel(
        uint256 agentId,
        string calldata assetId,
        Direction direction,
        uint256 durationSeconds,
        DuelType duelType
    ) 
        internal 
        returns (uint256 duelId) 
    {
        if (!agentRegistry.agentExists(agentId)) revert AgentNotFound();
        if (!agentRegistry.isAgentOwner(msg.sender, agentId)) revert NotAgentOwner();
        if (bytes(assetId).length == 0) revert InvalidAssetId();
        if (msg.value < MIN_STAKE || msg.value > MAX_STAKE) revert InvalidStakeAmount();
        if (durationSeconds < MIN_DURATION || durationSeconds > MAX_DURATION) revert InvalidDuration();

        duelId = _nextDuelId++;
        
        duels[duelId] = Duel({
            id: duelId,
            assetId: assetId,
            duelType: duelType,
            creatorAgentId: agentId,
            creatorAddress: msg.sender,
            creatorDirection: direction,
            stakeAmount: msg.value,
            durationSeconds: durationSeconds,
            joinerAgentId: 0,
            joinerAddress: address(0),
            startPrice: 0,
            endPrice: 0,
            startTs: 0,
            endTs: 0,
            status: DuelStatus.OPEN,
            winner: address(0),
            payout: 0,
            fee: 0,
            createdAt: block.timestamp,
            vrfRequestId: 0,
            vrfRandomWord: 0
        });
        
        duelExists[duelId] = true;

        emit DuelCreated(
            duelId,
            agentId,
            msg.sender,
            assetId,
            uint8(direction),
            uint8(duelType),
            msg.value,
            durationSeconds,
            block.timestamp
        );
    }

    /**
     * @notice Join an open duel by matching the stake
     * @param duelId The duel to join
     * @param agentId The joiner's agent ID
     * @param startPrice Current price of the asset (set by oracle/backend)
     */
    function joinDuel(
        uint256 duelId,
        uint256 agentId,
        uint256 startPrice
    ) 
        external 
        payable 
        nonReentrant 
    {
        if (!duelExists[duelId]) revert DuelNotFound();
        
        Duel storage duel = duels[duelId];
        if (duel.status != DuelStatus.OPEN) revert DuelNotOpen();
        
        if (!agentRegistry.agentExists(agentId)) revert AgentNotFound();
        if (!agentRegistry.isAgentOwner(msg.sender, agentId)) revert NotAgentOwner();
        if (duel.creatorAgentId == agentId) revert CannotJoinOwnDuel();
        if (msg.value != duel.stakeAmount) revert StakeMismatch();

        duel.joinerAgentId = agentId;
        duel.joinerAddress = msg.sender;
        duel.startPrice = startPrice;
        duel.startTs = block.timestamp;
        duel.endTs = block.timestamp + duel.durationSeconds;
        duel.status = DuelStatus.LIVE;

        emit DuelJoined(
            duelId,
            agentId,
            msg.sender,
            startPrice,
            duel.startTs,
            duel.endTs,
            block.timestamp
        );
    }

    /**
     * @notice Settle a live PRICE duel after it ends (oracle/admin only)
     * @param duelId The duel to settle
     * @param endPrice Final price of the asset
     */
    function settleDuel(uint256 duelId, uint256 endPrice) 
        external 
        nonReentrant
        onlyRole(ORACLE_ROLE)
    {
        if (!duelExists[duelId]) revert DuelNotFound();
        
        Duel storage duel = duels[duelId];
        if (duel.status != DuelStatus.LIVE) revert DuelNotLive();
        if (block.timestamp < duel.endTs) revert DuelNotEnded();
        if (duel.duelType != DuelType.PRICE) revert InvalidDuelType();

        duel.endPrice = endPrice;
        duel.status = DuelStatus.SETTLED;

        uint256 pot = duel.stakeAmount * 2;
        uint256 fee = (pot * feePercentage) / 100;
        uint256 payout = pot - fee;

        address winner;
        if (endPrice > duel.startPrice) {
            winner = duel.creatorDirection == Direction.UP ? duel.creatorAddress : duel.joinerAddress;
        } else if (endPrice < duel.startPrice) {
            winner = duel.creatorDirection == Direction.DOWN ? duel.creatorAddress : duel.joinerAddress;
        } else {
            duel.payout = duel.stakeAmount;
            duel.fee = 0;
            (bool s1, ) = duel.creatorAddress.call{value: duel.stakeAmount}("");
            (bool s2, ) = duel.joinerAddress.call{value: duel.stakeAmount}("");
            if (!s1 || !s2) revert TransferFailed();
            
            emit DuelSettled(duelId, address(0), endPrice, 0, 0, block.timestamp);
            return;
        }

        duel.winner = winner;
        duel.payout = payout;
        duel.fee = fee;

        (bool successWinner, ) = winner.call{value: payout}("");
        if (!successWinner) revert TransferFailed();

        (bool successFee, ) = feeTreasury.call{value: fee}("");
        if (!successFee) revert TransferFailed();

        emit FeeTransferred(duelId, feeTreasury, fee, block.timestamp);
        emit DuelSettled(duelId, winner, endPrice, payout, fee, block.timestamp);
    }

    /**
     * @notice Request VRF randomness for a RANDOM duel (oracle/admin only)
     * @param duelId The duel to settle via VRF
     */
    function requestRandomSettlement(uint256 duelId) 
        external 
        nonReentrant
        onlyRole(ORACLE_ROLE)
    {
        if (!duelExists[duelId]) revert DuelNotFound();
        if (address(vrfConsumer) == address(0)) revert VRFNotConfigured();
        
        Duel storage duel = duels[duelId];
        if (duel.status != DuelStatus.LIVE) revert DuelNotLive();
        if (block.timestamp < duel.endTs) revert DuelNotEnded();
        if (duel.duelType != DuelType.RANDOM) revert InvalidDuelType();

        duel.status = DuelStatus.PENDING_VRF;
        
        uint256 requestId = vrfConsumer.requestRandomWords(duelId);
        duel.vrfRequestId = requestId;
        vrfRequestToDuel[requestId] = duelId;

        emit RandomnessRequested(duelId, requestId, block.timestamp);
    }

    /**
     * @notice Callback from VRF consumer with random result
     * @param requestId The VRF request ID
     * @param randomWord The random number from VRF
     */
    function fulfillRandomness(uint256 requestId, uint256 randomWord) 
        external 
        nonReentrant
        onlyRole(VRF_ROLE)
    {
        uint256 duelId = vrfRequestToDuel[requestId];
        if (duelId == 0) revert InvalidVRFRequest();
        
        Duel storage duel = duels[duelId];
        if (duel.status != DuelStatus.PENDING_VRF) revert DuelNotPendingVRF();
        
        // Replay protection: clear the mapping to prevent re-fulfillment
        delete vrfRequestToDuel[requestId];

        duel.vrfRandomWord = randomWord;
        duel.status = DuelStatus.SETTLED;

        emit RandomnessFulfilled(duelId, requestId, randomWord, block.timestamp);

        uint256 pot = duel.stakeAmount * 2;
        uint256 fee = (pot * feePercentage) / 100;
        uint256 payout = pot - fee;

        // randomWord % 2: 0 = UP wins, 1 = DOWN wins
        bool upWins = (randomWord % 2) == 0;
        address winner;
        
        if (upWins) {
            winner = duel.creatorDirection == Direction.UP ? duel.creatorAddress : duel.joinerAddress;
        } else {
            winner = duel.creatorDirection == Direction.DOWN ? duel.creatorAddress : duel.joinerAddress;
        }

        duel.winner = winner;
        duel.payout = payout;
        duel.fee = fee;

        (bool successWinner, ) = winner.call{value: payout}("");
        if (!successWinner) revert TransferFailed();

        (bool successFee, ) = feeTreasury.call{value: fee}("");
        if (!successFee) revert TransferFailed();

        emit FeeTransferred(duelId, feeTreasury, fee, block.timestamp);
        emit RandomDuelSettled(duelId, winner, randomWord, payout, fee, block.timestamp);
    }

    /**
     * @notice Cancel an open duel before anyone joins
     * @param duelId The duel to cancel
     */
    function cancelDuel(uint256 duelId) 
        external 
        nonReentrant 
    {
        if (!duelExists[duelId]) revert DuelNotFound();
        
        Duel storage duel = duels[duelId];
        if (duel.status != DuelStatus.OPEN) revert DuelNotOpen();
        if (duel.creatorAddress != msg.sender) revert NotDuelCreator();

        duel.status = DuelStatus.CANCELLED;

        uint256 refund = duel.stakeAmount;
        (bool success, ) = duel.creatorAddress.call{value: refund}("");
        if (!success) revert TransferFailed();

        emit DuelCancelled(duelId, duel.creatorAddress, refund, block.timestamp);
    }

    /**
     * @notice Expire an open duel that hasn't been joined (admin/oracle)
     * @param duelId The duel to expire
     */
    function expireDuel(uint256 duelId) 
        external 
        nonReentrant
        onlyRole(ORACLE_ROLE)
    {
        if (!duelExists[duelId]) revert DuelNotFound();
        
        Duel storage duel = duels[duelId];
        if (duel.status != DuelStatus.OPEN) revert DuelNotOpen();

        duel.status = DuelStatus.EXPIRED;

        uint256 refund = duel.stakeAmount;
        (bool success, ) = duel.creatorAddress.call{value: refund}("");
        if (!success) revert TransferFailed();

        emit DuelExpired(duelId, refund, block.timestamp);
    }

    /**
     * @notice Get duel details
     */
    function getDuel(uint256 duelId) 
        external 
        view 
        returns (Duel memory) 
    {
        if (!duelExists[duelId]) revert DuelNotFound();
        return duels[duelId];
    }

    /**
     * @notice Get total number of duels
     */
    function totalDuels() external view returns (uint256) {
        return _nextDuelId - 1;
    }

    /**
     * @notice Update fee treasury address (admin only)
     */
    function setFeeTreasury(address _feeTreasury) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_feeTreasury == address(0)) revert ZeroAddress();
        feeTreasury = _feeTreasury;
    }

    /**
     * @notice Update fee percentage (admin only)
     */
    function setFeePercentage(uint256 _feePercentage) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_feePercentage > 50) revert InvalidFeePercentage();
        feePercentage = _feePercentage;
    }

    /**
     * @notice Update agent registry address (admin only)
     */
    function setAgentRegistry(address _agentRegistry) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_agentRegistry == address(0)) revert ZeroAddress();
        agentRegistry = IAgentRegistry(_agentRegistry);
    }

    /**
     * @notice Set VRF consumer contract address (admin only)
     */
    function setVRFConsumer(address _vrfConsumer) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        vrfConsumer = IVRFConsumer(_vrfConsumer);
    }
}
