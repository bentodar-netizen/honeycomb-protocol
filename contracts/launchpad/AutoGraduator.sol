// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBondingCurveMarket {
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

interface ITokenFactory {
    function allTokens(uint256 index) external view returns (address);
    function totalTokens() external view returns (uint256);
}

/**
 * @title AutoGraduator
 * @notice Keeper contract that automatically triggers graduation when threshold is met
 * @dev Can be called by anyone (permissionless) or by automated keepers
 */
contract AutoGraduator is Ownable, ReentrancyGuard {
    
    IBondingCurveMarket public bondingCurveMarket;
    IMigration public migration;
    ITokenFactory public tokenFactory;

    uint256 public minGasForGraduation = 300000; // Minimum gas needed for graduation
    uint256 public maxTokensPerCheck = 50; // Max tokens to check per call
    uint256 public graduatorRewardBps = 50; // 0.5% reward for triggering graduation
    uint256 public constant BPS_DENOMINATOR = 10000;

    mapping(address => bool) public graduatedTokens;
    mapping(address => uint256) public graduationTimestamp;
    
    address[] public pendingTokens; // Tokens awaiting graduation
    uint256 public totalGraduations;

    event GraduationTriggered(
        address indexed token,
        address indexed graduator,
        uint256 totalRaised,
        uint256 reward,
        uint256 timestamp
    );

    event TokenAddedToPending(address indexed token, uint256 timestamp);
    event TokenRemovedFromPending(address indexed token, uint256 timestamp);

    error AlreadyGraduated();
    error NotReadyForGraduation();
    error InsufficientGas();
    error GraduationFailed();

    constructor(
        address _bondingCurveMarket,
        address _migration,
        address _tokenFactory
    ) Ownable(msg.sender) {
        bondingCurveMarket = IBondingCurveMarket(_bondingCurveMarket);
        migration = IMigration(_migration);
        tokenFactory = ITokenFactory(_tokenFactory);
    }

    /**
     * @notice Check if a token is ready for graduation
     */
    function isReadyForGraduation(address token) public view returns (bool) {
        if (graduatedTokens[token]) return false;
        return migration.canMigrate(token);
    }

    /**
     * @notice Get all tokens ready for graduation
     * @param startIndex Index to start checking from
     * @param count Number of tokens to check
     */
    function getReadyTokens(uint256 startIndex, uint256 count) 
        external 
        view 
        returns (address[] memory readyTokens, uint256 readyCount) 
    {
        uint256 totalTokens = tokenFactory.totalTokens();
        if (startIndex >= totalTokens) return (new address[](0), 0);
        
        uint256 endIndex = startIndex + count;
        if (endIndex > totalTokens) endIndex = totalTokens;
        
        address[] memory tempReady = new address[](endIndex - startIndex);
        uint256 foundCount = 0;
        
        for (uint256 i = startIndex; i < endIndex; i++) {
            address token = tokenFactory.allTokens(i);
            if (isReadyForGraduation(token)) {
                tempReady[foundCount] = token;
                foundCount++;
            }
        }
        
        readyTokens = new address[](foundCount);
        for (uint256 i = 0; i < foundCount; i++) {
            readyTokens[i] = tempReady[i];
        }
        readyCount = foundCount;
    }

    /**
     * @notice Trigger graduation for a single token
     * @dev Anyone can call this - the caller receives a small reward
     */
    function graduateToken(address token) external nonReentrant returns (bool success) {
        if (gasleft() < minGasForGraduation) revert InsufficientGas();
        if (graduatedTokens[token]) revert AlreadyGraduated();
        if (!migration.canMigrate(token)) revert NotReadyForGraduation();

        // Get total raised before graduation
        (,, uint256 totalRaised,,,) = bondingCurveMarket.markets(token);

        // Execute graduation
        try migration.migrate(token) {
            graduatedTokens[token] = true;
            graduationTimestamp[token] = block.timestamp;
            totalGraduations++;

            // Calculate and send reward to graduator
            uint256 reward = (totalRaised * graduatorRewardBps) / BPS_DENOMINATOR;
            if (reward > 0 && address(this).balance >= reward) {
                (bool sent, ) = msg.sender.call{value: reward}("");
                if (!sent) reward = 0; // Continue even if reward fails
            }

            emit GraduationTriggered(token, msg.sender, totalRaised, reward, block.timestamp);
            return true;
        } catch {
            revert GraduationFailed();
        }
    }

    /**
     * @notice Batch graduate multiple tokens
     * @param tokens Array of token addresses to graduate
     */
    function batchGraduate(address[] calldata tokens) 
        external 
        nonReentrant 
        returns (uint256 successCount) 
    {
        if (gasleft() < minGasForGraduation * tokens.length) revert InsufficientGas();
        
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (graduatedTokens[token]) continue;
            if (!migration.canMigrate(token)) continue;

            (,, uint256 totalRaised,,,) = bondingCurveMarket.markets(token);

            try migration.migrate(token) {
                graduatedTokens[token] = true;
                graduationTimestamp[token] = block.timestamp;
                totalGraduations++;
                successCount++;

                uint256 reward = (totalRaised * graduatorRewardBps) / BPS_DENOMINATOR;
                if (reward > 0 && address(this).balance >= reward) {
                    (bool sent, ) = msg.sender.call{value: reward}("");
                    if (sent) {
                        emit GraduationTriggered(token, msg.sender, totalRaised, reward, block.timestamp);
                    } else {
                        emit GraduationTriggered(token, msg.sender, totalRaised, 0, block.timestamp);
                    }
                } else {
                    emit GraduationTriggered(token, msg.sender, totalRaised, 0, block.timestamp);
                }
            } catch {
                // Continue to next token
            }
        }
    }

    /**
     * @notice Scan and graduate all ready tokens
     * @param startIndex Index to start scanning from
     */
    function scanAndGraduate(uint256 startIndex) 
        external 
        nonReentrant 
        returns (uint256 successCount, uint256 nextIndex) 
    {
        uint256 totalTokens = tokenFactory.totalTokens();
        if (startIndex >= totalTokens) return (0, totalTokens);
        
        uint256 endIndex = startIndex + maxTokensPerCheck;
        if (endIndex > totalTokens) endIndex = totalTokens;
        
        for (uint256 i = startIndex; i < endIndex && gasleft() > minGasForGraduation; i++) {
            address token = tokenFactory.allTokens(i);
            if (graduatedTokens[token]) continue;
            if (!migration.canMigrate(token)) continue;

            (,, uint256 totalRaised,,,) = bondingCurveMarket.markets(token);

            try migration.migrate(token) {
                graduatedTokens[token] = true;
                graduationTimestamp[token] = block.timestamp;
                totalGraduations++;
                successCount++;

                uint256 reward = (totalRaised * graduatorRewardBps) / BPS_DENOMINATOR;
                if (reward > 0 && address(this).balance >= reward) {
                    (bool sent, ) = msg.sender.call{value: reward}("");
                    emit GraduationTriggered(token, msg.sender, totalRaised, sent ? reward : 0, block.timestamp);
                } else {
                    emit GraduationTriggered(token, msg.sender, totalRaised, 0, block.timestamp);
                }
            } catch {
                // Continue to next token
            }
        }
        
        nextIndex = endIndex;
    }

    /**
     * @notice Check a specific token's graduation status
     */
    function getGraduationStatus(address token) external view returns (
        bool isGraduated,
        bool isReady,
        uint256 totalRaised,
        uint256 threshold,
        uint256 graduatedAt
    ) {
        isGraduated = graduatedTokens[token];
        isReady = !isGraduated && migration.canMigrate(token);
        (,, totalRaised,,,) = bondingCurveMarket.markets(token);
        threshold = bondingCurveMarket.graduationThreshold();
        graduatedAt = graduationTimestamp[token];
    }

    /**
     * @notice Update configuration (owner only)
     */
    function setConfig(
        uint256 _minGasForGraduation,
        uint256 _maxTokensPerCheck,
        uint256 _graduatorRewardBps
    ) external onlyOwner {
        minGasForGraduation = _minGasForGraduation;
        maxTokensPerCheck = _maxTokensPerCheck;
        graduatorRewardBps = _graduatorRewardBps;
    }

    /**
     * @notice Update contract addresses (owner only)
     */
    function setContracts(
        address _bondingCurveMarket,
        address _migration,
        address _tokenFactory
    ) external onlyOwner {
        if (_bondingCurveMarket != address(0)) bondingCurveMarket = IBondingCurveMarket(_bondingCurveMarket);
        if (_migration != address(0)) migration = IMigration(_migration);
        if (_tokenFactory != address(0)) tokenFactory = ITokenFactory(_tokenFactory);
    }

    /**
     * @notice Fund the contract for graduator rewards
     */
    function fund() external payable {}

    /**
     * @notice Withdraw funds (owner only)
     */
    function withdraw(address to, uint256 amount) external onlyOwner {
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
    }

    receive() external payable {}
}
