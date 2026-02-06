// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./HoneycombToken.sol";
import "./interfaces/IPancakeSwap.sol";

interface IBondingCurveMarket {
    struct MarketState {
        uint256 nativeReserve;
        uint256 tokenReserve;
        uint256 totalRaisedNative;
        uint256 tradingStartTime;
        bool graduated;
        bool initialized;
    }
    
    function markets(address token) external view returns (
        uint256 nativeReserve,
        uint256 tokenReserve,
        uint256 totalRaisedNative,
        uint256 tradingStartTime,
        bool graduated,
        bool initialized
    );
    
    function getMarketState(address token) external view returns (MarketState memory);
    function withdrawForMigration(address token) external returns (uint256 nativeAmount, uint256 tokenAmount);
}

/**
 * @title HoneycombMigration
 * @notice Handles DEX migration when tokens graduate from bonding curve
 * @dev Migrates liquidity to PancakeSwap V2 and locks LP tokens
 */
contract HoneycombMigration is Ownable, ReentrancyGuard {
    
    IBondingCurveMarket public market;
    IPancakeRouter02 public router;
    IPancakeFactory public factory;
    address public wbnb;
    address public lpLockAddress;
    address public treasury;
    
    mapping(address => bool) public migrated;
    mapping(address => address) public tokenPairs;
    mapping(address => uint256) public lpAmounts;
    
    uint256 public constant MIN_LIQUIDITY = 1000;
    uint256 public slippageBps = 50;

    event Migrated(
        address indexed token,
        address indexed pair,
        uint256 lpAmount,
        uint256 nativeAdded,
        uint256 tokenAdded,
        uint256 timestamp
    );
    event SlippageUpdated(uint256 newSlippageBps);
    event LpLockAddressUpdated(address newLpLockAddress);
    event TreasuryUpdated(address newTreasury);
    event RouterUpdated(address newRouter);
    event DustCollected(address token, uint256 amount);

    error TokenNotGraduated();
    error AlreadyMigrated();
    error MigrationFailed();
    error InsufficientLiquidity();
    error InvalidAddress();
    error TransferFailed();

    constructor(
        address _market,
        address _router,
        address _wbnb,
        address _lpLockAddress,
        address _treasury
    ) Ownable(msg.sender) {
        if (_market == address(0) || _router == address(0) || _wbnb == address(0)) revert InvalidAddress();
        if (_lpLockAddress == address(0) || _treasury == address(0)) revert InvalidAddress();
        
        market = IBondingCurveMarket(_market);
        router = IPancakeRouter02(_router);
        factory = IPancakeFactory(router.factory());
        wbnb = _wbnb;
        lpLockAddress = _lpLockAddress;
        treasury = _treasury;
    }

    /**
     * @notice Migrate a graduated token to PancakeSwap
     * @param token The token address to migrate
     * @dev Anyone can call this once a token is graduated
     */
    function migrate(address token) external nonReentrant {
        if (migrated[token]) revert AlreadyMigrated();
        
        IBondingCurveMarket.MarketState memory state = market.getMarketState(token);
        if (!state.graduated) revert TokenNotGraduated();
        if (state.nativeReserve < MIN_LIQUIDITY || state.tokenReserve < MIN_LIQUIDITY) revert InsufficientLiquidity();
        
        migrated[token] = true;
        
        (uint256 nativeReserve, uint256 tokenReserve) = market.withdrawForMigration(token);
        
        HoneycombToken honeycombToken = HoneycombToken(token);
        honeycombToken.mint(address(this), tokenReserve);
        
        honeycombToken.approve(address(router), tokenReserve);
        
        uint256 minNative = (nativeReserve * (10000 - slippageBps)) / 10000;
        uint256 minTokens = (tokenReserve * (10000 - slippageBps)) / 10000;
        
        (uint256 tokenAdded, uint256 nativeAdded, uint256 liquidity) = router.addLiquidityETH{value: nativeReserve}(
            token,
            tokenReserve,
            minTokens,
            minNative,
            address(this),
            block.timestamp + 300
        );
        
        if (liquidity == 0) revert MigrationFailed();
        
        address pair = factory.getPair(token, wbnb);
        tokenPairs[token] = pair;
        lpAmounts[token] = liquidity;
        
        IPancakePair(pair).transfer(lpLockAddress, liquidity);
        
        _collectDust(token, tokenReserve - tokenAdded);
        if (address(this).balance > 0) {
            _collectNativeDust();
        }
        
        emit Migrated(token, pair, liquidity, nativeAdded, tokenAdded, block.timestamp);
    }

    /**
     * @notice Check if a token is eligible for migration
     * @param token The token address to check
     * @return eligible True if token can be migrated
     */
    function canMigrate(address token) external view returns (bool eligible) {
        if (migrated[token]) return false;
        
        IBondingCurveMarket.MarketState memory state = market.getMarketState(token);
        return state.graduated && state.nativeReserve >= MIN_LIQUIDITY && state.tokenReserve >= MIN_LIQUIDITY;
    }

    /**
     * @notice Get migration info for a token
     * @param token The token address
     * @return pair The LP pair address
     * @return lpAmount The amount of LP tokens locked
     * @return isMigrated Whether the token has been migrated
     */
    function getMigrationInfo(address token) external view returns (
        address pair,
        uint256 lpAmount,
        bool isMigrated
    ) {
        return (tokenPairs[token], lpAmounts[token], migrated[token]);
    }

    function _collectDust(address token, uint256 tokenDust) internal {
        if (tokenDust > 0) {
            HoneycombToken(token).transfer(treasury, tokenDust);
            emit DustCollected(token, tokenDust);
        }
    }

    function _collectNativeDust() internal {
        uint256 nativeDust = address(this).balance;
        if (nativeDust > 0) {
            (bool success, ) = treasury.call{value: nativeDust}("");
            if (!success) revert TransferFailed();
            emit DustCollected(address(0), nativeDust);
        }
    }

    function setSlippageBps(uint256 _slippageBps) external onlyOwner {
        require(_slippageBps <= 1000, "Slippage too high");
        slippageBps = _slippageBps;
        emit SlippageUpdated(_slippageBps);
    }

    function setLpLockAddress(address _lpLockAddress) external onlyOwner {
        if (_lpLockAddress == address(0)) revert InvalidAddress();
        lpLockAddress = _lpLockAddress;
        emit LpLockAddressUpdated(_lpLockAddress);
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert InvalidAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setRouter(address _router) external onlyOwner {
        if (_router == address(0)) revert InvalidAddress();
        router = IPancakeRouter02(_router);
        factory = IPancakeFactory(router.factory());
        emit RouterUpdated(_router);
    }

    function setMarket(address _market) external onlyOwner {
        if (_market == address(0)) revert InvalidAddress();
        market = IBondingCurveMarket(_market);
    }

    function emergencyWithdraw(address token) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = owner().call{value: address(this).balance}("");
            if (!success) revert TransferFailed();
        } else {
            uint256 balance = HoneycombToken(token).balanceOf(address(this));
            if (balance > 0) {
                HoneycombToken(token).transfer(owner(), balance);
            }
        }
    }

    receive() external payable {}
}
