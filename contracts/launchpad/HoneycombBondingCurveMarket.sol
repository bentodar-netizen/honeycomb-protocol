// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./HoneycombToken.sol";

interface ITokenFactory {
    function isHoneycombToken(address token) external view returns (bool);
}

/**
 * @title HoneycombBondingCurveMarket
 * @notice Bonding curve market for trading Honeycomb tokens against native coin
 * @dev Uses constant product AMM (x*y=k) with virtual reserves
 */
contract HoneycombBondingCurveMarket is Ownable, ReentrancyGuard {
    
    struct MarketState {
        uint256 nativeReserve;
        uint256 tokenReserve;
        uint256 totalRaisedNative;
        uint256 tradingStartTime;
        bool graduated;
        bool initialized;
    }

    ITokenFactory public factory;
    address public feeVault;
    address public migrationContract;
    
    mapping(address => MarketState) public markets;
    mapping(address => mapping(address => uint256)) public lastTradeTime;

    uint256 public constant FEE_BPS = 100;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    uint256 public graduationThreshold;
    uint256 public cooldownSeconds;
    uint256 public maxBuyPerTx;
    uint256 public launchDelay;
    uint256 public initialVirtualNative;
    uint256 public initialVirtualToken;

    event MarketInitialized(address indexed token, uint256 nativeReserve, uint256 tokenReserve, uint256 tradingStart);
    event Trade(address indexed token, address indexed trader, bool isBuy, uint256 nativeAmt, uint256 tokenAmt, uint256 fee, uint256 price);
    event Graduated(address indexed token, uint256 totalRaised);

    error TokenNotFromFactory();
    error MarketNotInitialized();
    error MarketAlreadyInitialized();
    error TokenGraduated();
    error TradingNotStarted();
    error CooldownActive();
    error ExceedsMaxBuy();
    error SlippageExceeded();
    error InsufficientNative();
    error TransferFailed();
    error ZeroAmount();
    error OnlyMigrationContract();
    error NotGraduated();
    error AlreadyWithdrawn();

    constructor(
        address _factory,
        address _feeVault,
        uint256 _graduationThreshold,
        uint256 _cooldownSeconds,
        uint256 _maxBuyPerTx,
        uint256 _launchDelay,
        uint256 _initialVirtualNative,
        uint256 _initialVirtualToken
    ) Ownable(msg.sender) {
        factory = ITokenFactory(_factory);
        feeVault = _feeVault;
        graduationThreshold = _graduationThreshold;
        cooldownSeconds = _cooldownSeconds;
        maxBuyPerTx = _maxBuyPerTx;
        launchDelay = _launchDelay;
        initialVirtualNative = _initialVirtualNative;
        initialVirtualToken = _initialVirtualToken;
    }

    function initializeMarket(address token) external {
        if (!factory.isHoneycombToken(token)) revert TokenNotFromFactory();
        MarketState storage state = markets[token];
        if (state.initialized) revert MarketAlreadyInitialized();

        state.nativeReserve = initialVirtualNative;
        state.tokenReserve = initialVirtualToken;
        state.tradingStartTime = block.timestamp + launchDelay;
        state.initialized = true;

        emit MarketInitialized(token, initialVirtualNative, initialVirtualToken, state.tradingStartTime);
    }

    function buy(address token, uint256 minTokensOut) external payable nonReentrant returns (uint256 tokensOut) {
        if (msg.value == 0) revert ZeroAmount();
        
        MarketState storage state = markets[token];
        _validateTrade(token, state);

        uint256 fee = (msg.value * FEE_BPS) / BPS_DENOMINATOR;
        uint256 nativeIn = msg.value - fee;

        uint256 k = state.nativeReserve * state.tokenReserve;
        uint256 newNativeReserve = state.nativeReserve + nativeIn;
        uint256 newTokenReserve = k / newNativeReserve;
        tokensOut = state.tokenReserve - newTokenReserve;

        if (tokensOut < minTokensOut) revert SlippageExceeded();
        if (tokensOut > maxBuyPerTx) revert ExceedsMaxBuy();

        state.nativeReserve = newNativeReserve;
        state.tokenReserve = newTokenReserve;
        state.totalRaisedNative += nativeIn;
        lastTradeTime[token][msg.sender] = block.timestamp;

        _sendNative(feeVault, fee);
        HoneycombToken(token).mint(msg.sender, tokensOut);

        uint256 priceAfter = (state.nativeReserve * 1e18) / state.tokenReserve;
        emit Trade(token, msg.sender, true, msg.value, tokensOut, fee, priceAfter);

        _checkGraduation(token, state);
    }

    function sell(address token, uint256 tokenAmountIn, uint256 minNativeOut) external nonReentrant returns (uint256 nativeOut) {
        if (tokenAmountIn == 0) revert ZeroAmount();
        
        MarketState storage state = markets[token];
        _validateTrade(token, state);

        uint256 k = state.nativeReserve * state.tokenReserve;
        uint256 newTokenReserve = state.tokenReserve + tokenAmountIn;
        uint256 newNativeReserve = k / newTokenReserve;
        uint256 grossNativeOut = state.nativeReserve - newNativeReserve;

        uint256 fee = (grossNativeOut * FEE_BPS) / BPS_DENOMINATOR;
        nativeOut = grossNativeOut - fee;

        if (nativeOut < minNativeOut) revert SlippageExceeded();
        if (nativeOut > address(this).balance) revert InsufficientNative();

        state.nativeReserve = newNativeReserve;
        state.tokenReserve = newTokenReserve;
        lastTradeTime[token][msg.sender] = block.timestamp;

        // Transfer tokens from seller to market, then burn
        // This allows routers/bots to sell on behalf of users via approve+transferFrom
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmountIn);
        HoneycombToken(token).burn(address(this), tokenAmountIn);
        
        _sendNative(feeVault, fee);
        _sendNative(msg.sender, nativeOut);

        uint256 priceAfter = (state.nativeReserve * 1e18) / state.tokenReserve;
        emit Trade(token, msg.sender, false, grossNativeOut, tokenAmountIn, fee, priceAfter);
    }

    function _sendNative(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    function _validateTrade(address token, MarketState storage state) internal view {
        if (!state.initialized) revert MarketNotInitialized();
        if (state.graduated) revert TokenGraduated();
        if (block.timestamp < state.tradingStartTime) revert TradingNotStarted();
        if (block.timestamp < lastTradeTime[token][msg.sender] + cooldownSeconds) revert CooldownActive();
    }

    function _checkGraduation(address token, MarketState storage state) internal {
        if (!state.graduated && state.totalRaisedNative >= graduationThreshold) {
            state.graduated = true;
            emit Graduated(token, state.totalRaisedNative);
        }
    }

    function getBuyQuote(address token, uint256 nativeIn) external view returns (uint256 tokensOut, uint256 fee) {
        MarketState storage state = markets[token];
        if (!state.initialized) return (0, 0);

        fee = (nativeIn * FEE_BPS) / BPS_DENOMINATOR;
        uint256 nativeAfterFee = nativeIn - fee;

        uint256 k = state.nativeReserve * state.tokenReserve;
        uint256 newNativeReserve = state.nativeReserve + nativeAfterFee;
        tokensOut = state.tokenReserve - (k / newNativeReserve);
    }

    function getSellQuote(address token, uint256 tokenAmountIn) external view returns (uint256 nativeOut, uint256 fee) {
        MarketState storage state = markets[token];
        if (!state.initialized) return (0, 0);

        uint256 k = state.nativeReserve * state.tokenReserve;
        uint256 newTokenReserve = state.tokenReserve + tokenAmountIn;
        uint256 grossNativeOut = state.nativeReserve - (k / newTokenReserve);

        fee = (grossNativeOut * FEE_BPS) / BPS_DENOMINATOR;
        nativeOut = grossNativeOut - fee;
    }

    function getPrice(address token) external view returns (uint256) {
        MarketState storage state = markets[token];
        if (!state.initialized || state.tokenReserve == 0) return 0;
        return (state.nativeReserve * 1e18) / state.tokenReserve;
    }

    function getMarketState(address token) external view returns (MarketState memory) {
        return markets[token];
    }

    function setGraduationThreshold(uint256 _threshold) external onlyOwner { graduationThreshold = _threshold; }
    function setCooldownSeconds(uint256 _cooldown) external onlyOwner { cooldownSeconds = _cooldown; }
    function setMaxBuyPerTx(uint256 _maxBuy) external onlyOwner { maxBuyPerTx = _maxBuy; }
    function setLaunchDelay(uint256 _delay) external onlyOwner { launchDelay = _delay; }
    function setFactory(address _factory) external onlyOwner { factory = ITokenFactory(_factory); }
    function setFeeVault(address _feeVault) external onlyOwner { feeVault = _feeVault; }
    function setMigrationContract(address _migration) external onlyOwner { migrationContract = _migration; }

    /**
     * @notice Withdraw reserves for DEX migration (only callable by migration contract)
     * @param token The token to withdraw reserves for
     * @return nativeAmount The amount of native tokens withdrawn
     * @return tokenAmount The amount of tokens to mint for liquidity
     */
    function withdrawForMigration(address token) external returns (uint256 nativeAmount, uint256 tokenAmount) {
        if (msg.sender != migrationContract) revert OnlyMigrationContract();
        
        MarketState storage state = markets[token];
        if (!state.graduated) revert NotGraduated();
        if (state.nativeReserve == 0 && state.tokenReserve == 0) revert AlreadyWithdrawn();
        
        nativeAmount = state.nativeReserve;
        tokenAmount = state.tokenReserve;
        
        state.nativeReserve = 0;
        state.tokenReserve = 0;
        
        _sendNative(msg.sender, nativeAmount);
    }

    receive() external payable {}
}
