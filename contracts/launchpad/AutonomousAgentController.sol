// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ITokenFactory {
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata metadataCID,
        uint256 creatorBeeId,
        bytes32 salt
    ) external returns (address tokenAddress);
    function predictTokenAddress(
        string calldata name,
        string calldata symbol,
        string calldata metadataCID,
        uint256 creatorBeeId,
        bytes32 salt
    ) external view returns (address);
}

interface IBondingCurveMarket {
    function buy(address token, uint256 minTokensOut) external payable returns (uint256 tokensOut);
    function sell(address token, uint256 tokenAmountIn, uint256 minNativeOut) external returns (uint256 nativeOut);
    function markets(address token) external view returns (
        uint256 nativeReserve,
        uint256 tokenReserve,
        uint256 totalRaisedNative,
        uint256 tradingStartTime,
        bool graduated,
        bool initialized
    );
    function graduationThreshold() external view returns (uint256);
}

interface IMigration {
    function canMigrate(address token) external view returns (bool);
    function migrate(address token) external;
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title AutonomousAgentController
 * @notice Enables AI agents to execute launchpad transactions without human signatures
 * @dev Agents register with delegated executor addresses that can act on their behalf
 */
contract AutonomousAgentController is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    struct Agent {
        uint256 id;
        address owner;
        address executor; // Delegated address that can execute on behalf of agent
        string metadataCID;
        bool canDeployToken;
        bool canLaunch;
        bool canGraduate;
        bool canTrade;
        bool isActive;
        uint256 createdAt;
        uint256 totalTokensLaunched;
        uint256 totalTradesExecuted;
        uint256 totalGraduations;
    }

    struct TokenLaunch {
        address tokenAddress;
        uint256 agentId;
        string narrative;
        uint256 graduationTargetBnb;
        uint8 liquidityPercent;
        uint256 createdAt;
        bool graduated;
    }

    ITokenFactory public tokenFactory;
    IBondingCurveMarket public bondingCurveMarket;
    IMigration public migration;

    uint256 private _nextAgentId = 1;
    
    mapping(uint256 => Agent) public agents;
    mapping(address => uint256) public ownerToAgentId;
    mapping(address => uint256) public executorToAgentId;
    mapping(address => TokenLaunch) public tokenLaunches;
    mapping(uint256 => address[]) public agentTokens;
    
    address[] public allTokens;
    uint256 public totalAgents;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        address indexed executor,
        string metadataCID,
        uint256 timestamp
    );
    
    event AgentUpdated(
        uint256 indexed agentId,
        address executor,
        bool canDeployToken,
        bool canLaunch,
        bool canGraduate,
        bool canTrade,
        uint256 timestamp
    );

    event AgentDeactivated(uint256 indexed agentId, uint256 timestamp);
    event AgentActivated(uint256 indexed agentId, uint256 timestamp);

    event TokenLaunched(
        uint256 indexed agentId,
        address indexed tokenAddress,
        string name,
        string symbol,
        string narrative,
        uint256 graduationTargetBnb,
        uint256 timestamp
    );

    event AgentTrade(
        uint256 indexed agentId,
        address indexed tokenAddress,
        bool isBuy,
        uint256 nativeAmount,
        uint256 tokenAmount,
        uint256 timestamp
    );

    event TokenGraduated(
        uint256 indexed agentId,
        address indexed tokenAddress,
        uint256 totalRaised,
        uint256 timestamp
    );

    error AgentNotFound();
    error NotAgentOwner();
    error NotAgentExecutor();
    error AgentNotActive();
    error PermissionDenied();
    error InvalidExecutor();
    error AgentAlreadyExists();
    error TokenNotFromAgent();
    error GraduationNotReady();
    error InvalidMetadata();
    error TransferFailed();

    constructor(
        address _tokenFactory,
        address _bondingCurveMarket,
        address _migration
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);

        tokenFactory = ITokenFactory(_tokenFactory);
        bondingCurveMarket = IBondingCurveMarket(_bondingCurveMarket);
        migration = IMigration(_migration);
    }

    /**
     * @notice Register a new autonomous AI agent
     * @param executor Address that will execute transactions on behalf of the agent
     * @param metadataCID IPFS CID containing agent metadata
     * @return agentId The ID of the newly registered agent
     */
    function registerAgent(
        address executor,
        string calldata metadataCID
    ) external nonReentrant returns (uint256 agentId) {
        if (executor == address(0)) revert InvalidExecutor();
        if (bytes(metadataCID).length == 0) revert InvalidMetadata();
        if (ownerToAgentId[msg.sender] != 0) revert AgentAlreadyExists();
        if (executorToAgentId[executor] != 0) revert InvalidExecutor();

        agentId = _nextAgentId++;
        
        agents[agentId] = Agent({
            id: agentId,
            owner: msg.sender,
            executor: executor,
            metadataCID: metadataCID,
            canDeployToken: true,
            canLaunch: true,
            canGraduate: true,
            canTrade: true,
            isActive: true,
            createdAt: block.timestamp,
            totalTokensLaunched: 0,
            totalTradesExecuted: 0,
            totalGraduations: 0
        });

        ownerToAgentId[msg.sender] = agentId;
        executorToAgentId[executor] = agentId;
        totalAgents++;

        emit AgentRegistered(agentId, msg.sender, executor, metadataCID, block.timestamp);
    }

    /**
     * @notice Update agent executor and permissions
     * @param agentId Agent ID to update
     * @param newExecutor New executor address (or zero to keep current)
     * @param canDeployToken Permission to deploy tokens
     * @param canLaunch Permission to launch tokens
     * @param canGraduate Permission to trigger graduation
     * @param canTrade Permission to trade tokens
     */
    function updateAgent(
        uint256 agentId,
        address newExecutor,
        bool canDeployToken,
        bool canLaunch,
        bool canGraduate,
        bool canTrade
    ) external nonReentrant {
        Agent storage agent = agents[agentId];
        if (agent.id == 0) revert AgentNotFound();
        if (agent.owner != msg.sender) revert NotAgentOwner();

        if (newExecutor != address(0) && newExecutor != agent.executor) {
            if (executorToAgentId[newExecutor] != 0) revert InvalidExecutor();
            delete executorToAgentId[agent.executor];
            executorToAgentId[newExecutor] = agentId;
            agent.executor = newExecutor;
        }

        agent.canDeployToken = canDeployToken;
        agent.canLaunch = canLaunch;
        agent.canGraduate = canGraduate;
        agent.canTrade = canTrade;

        emit AgentUpdated(agentId, agent.executor, canDeployToken, canLaunch, canGraduate, canTrade, block.timestamp);
    }

    /**
     * @notice Deactivate an agent
     */
    function deactivateAgent(uint256 agentId) external {
        Agent storage agent = agents[agentId];
        if (agent.id == 0) revert AgentNotFound();
        if (agent.owner != msg.sender && !hasRole(ADMIN_ROLE, msg.sender)) revert NotAgentOwner();
        
        agent.isActive = false;
        emit AgentDeactivated(agentId, block.timestamp);
    }

    /**
     * @notice Reactivate an agent
     */
    function activateAgent(uint256 agentId) external {
        Agent storage agent = agents[agentId];
        if (agent.id == 0) revert AgentNotFound();
        if (agent.owner != msg.sender) revert NotAgentOwner();
        
        agent.isActive = true;
        emit AgentActivated(agentId, block.timestamp);
    }

    /**
     * @notice Launch a new token autonomously (called by agent executor)
     * @param name Token name
     * @param symbol Token symbol
     * @param metadataCID Token metadata IPFS CID
     * @param narrative Agent's narrative for this token launch
     * @param creatorBeeId On-chain Bee ID (0 for none)
     * @param salt CREATE2 salt for vanity address
     */
    function launchToken(
        string calldata name,
        string calldata symbol,
        string calldata metadataCID,
        string calldata narrative,
        uint256 creatorBeeId,
        bytes32 salt
    ) external nonReentrant returns (address tokenAddress) {
        uint256 agentId = executorToAgentId[msg.sender];
        if (agentId == 0) revert NotAgentExecutor();
        
        Agent storage agent = agents[agentId];
        if (!agent.isActive) revert AgentNotActive();
        if (!agent.canDeployToken) revert PermissionDenied();

        // Deploy token via factory
        tokenAddress = tokenFactory.createToken(name, symbol, metadataCID, creatorBeeId, salt);

        // Record the launch
        tokenLaunches[tokenAddress] = TokenLaunch({
            tokenAddress: tokenAddress,
            agentId: agentId,
            narrative: narrative,
            graduationTargetBnb: bondingCurveMarket.graduationThreshold(),
            liquidityPercent: 80,
            createdAt: block.timestamp,
            graduated: false
        });

        agentTokens[agentId].push(tokenAddress);
        allTokens.push(tokenAddress);
        agent.totalTokensLaunched++;

        emit TokenLaunched(agentId, tokenAddress, name, symbol, narrative, bondingCurveMarket.graduationThreshold(), block.timestamp);
    }

    /**
     * @notice Buy tokens autonomously (called by agent executor)
     * @param token Token address to buy
     * @param minTokensOut Minimum tokens to receive
     */
    function agentBuy(
        address token,
        uint256 minTokensOut
    ) external payable nonReentrant returns (uint256 tokensOut) {
        uint256 agentId = executorToAgentId[msg.sender];
        if (agentId == 0) revert NotAgentExecutor();
        
        Agent storage agent = agents[agentId];
        if (!agent.isActive) revert AgentNotActive();
        if (!agent.canTrade) revert PermissionDenied();

        tokensOut = bondingCurveMarket.buy{value: msg.value}(token, minTokensOut);
        agent.totalTradesExecuted++;

        // Transfer bought tokens to agent owner
        IERC20(token).transfer(agent.owner, tokensOut);

        emit AgentTrade(agentId, token, true, msg.value, tokensOut, block.timestamp);
    }

    /**
     * @notice Sell tokens autonomously (called by agent executor)
     * @param token Token address to sell
     * @param tokenAmount Amount of tokens to sell
     * @param minNativeOut Minimum native to receive
     */
    function agentSell(
        address token,
        uint256 tokenAmount,
        uint256 minNativeOut
    ) external nonReentrant returns (uint256 nativeOut) {
        uint256 agentId = executorToAgentId[msg.sender];
        if (agentId == 0) revert NotAgentExecutor();
        
        Agent storage agent = agents[agentId];
        if (!agent.isActive) revert AgentNotActive();
        if (!agent.canTrade) revert PermissionDenied();

        // Agent executor must have approval to spend tokens on behalf of owner
        // Token must be transferred from owner to this contract first
        IERC20(token).approve(address(bondingCurveMarket), tokenAmount);
        nativeOut = bondingCurveMarket.sell(token, tokenAmount, minNativeOut);
        agent.totalTradesExecuted++;

        // Transfer native to agent owner
        (bool success, ) = agent.owner.call{value: nativeOut}("");
        if (!success) revert TransferFailed();

        emit AgentTrade(agentId, token, false, nativeOut, tokenAmount, block.timestamp);
    }

    /**
     * @notice Trigger graduation for a token (called by agent executor or keeper)
     * @param token Token address to graduate
     */
    function triggerGraduation(address token) external nonReentrant {
        TokenLaunch storage launch = tokenLaunches[token];
        if (launch.tokenAddress == address(0)) revert TokenNotFromAgent();
        if (launch.graduated) revert GraduationNotReady();

        // Check if caller is authorized (agent executor or keeper)
        uint256 agentId = executorToAgentId[msg.sender];
        if (agentId == 0 && !hasRole(KEEPER_ROLE, msg.sender)) revert NotAgentExecutor();
        
        if (agentId != 0) {
            Agent storage agent = agents[agentId];
            if (!agent.isActive) revert AgentNotActive();
            if (!agent.canGraduate) revert PermissionDenied();
        }

        // Check if graduation is ready
        if (!migration.canMigrate(token)) revert GraduationNotReady();

        // Execute graduation
        migration.migrate(token);
        launch.graduated = true;

        if (agentId != 0) {
            agents[agentId].totalGraduations++;
        }

        (,, uint256 totalRaised,,,) = bondingCurveMarket.markets(token);
        emit TokenGraduated(launch.agentId, token, totalRaised, block.timestamp);
    }

    /**
     * @notice Check if an agent can graduate a specific token
     */
    function canAgentGraduate(uint256 agentId, address token) external view returns (bool) {
        Agent storage agent = agents[agentId];
        if (!agent.isActive || !agent.canGraduate) return false;
        
        TokenLaunch storage launch = tokenLaunches[token];
        if (launch.tokenAddress == address(0) || launch.graduated) return false;
        
        return migration.canMigrate(token);
    }

    /**
     * @notice Get agent by ID
     */
    function getAgent(uint256 agentId) external view returns (Agent memory) {
        return agents[agentId];
    }

    /**
     * @notice Get agent ID by owner
     */
    function getAgentByOwner(address owner) external view returns (uint256) {
        return ownerToAgentId[owner];
    }

    /**
     * @notice Get agent ID by executor
     */
    function getAgentByExecutor(address executor) external view returns (uint256) {
        return executorToAgentId[executor];
    }

    /**
     * @notice Get all tokens launched by an agent
     */
    function getAgentTokens(uint256 agentId) external view returns (address[] memory) {
        return agentTokens[agentId];
    }

    /**
     * @notice Get total tokens launched
     */
    function getTotalTokensLaunched() external view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @notice Get token launch info
     */
    function getTokenLaunch(address token) external view returns (TokenLaunch memory) {
        return tokenLaunches[token];
    }

    /**
     * @notice Update contract addresses (admin only)
     */
    function setContracts(
        address _tokenFactory,
        address _bondingCurveMarket,
        address _migration
    ) external onlyRole(ADMIN_ROLE) {
        if (_tokenFactory != address(0)) tokenFactory = ITokenFactory(_tokenFactory);
        if (_bondingCurveMarket != address(0)) bondingCurveMarket = IBondingCurveMarket(_bondingCurveMarket);
        if (_migration != address(0)) migration = IMigration(_migration);
    }

    /**
     * @notice Withdraw accidentally sent tokens (admin only)
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        IERC20(token).transfer(to, amount);
    }

    receive() external payable {}
}
