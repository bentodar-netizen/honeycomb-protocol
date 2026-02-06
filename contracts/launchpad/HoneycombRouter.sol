// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./HoneycombBondingCurveMarket.sol";
import "./HoneycombToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title HoneycombRouter
 * @notice Router contract for bot compatibility - provides standard swap interface
 * @dev Wraps bonding curve market calls in a familiar router pattern
 */
contract HoneycombRouter {
    HoneycombBondingCurveMarket public immutable market;
    address public immutable WBNB;
    
    event Swap(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address to
    );

    constructor(address _market, address _wbnb) {
        market = HoneycombBondingCurveMarket(payable(_market));
        WBNB = _wbnb;
    }

    /**
     * @notice Swap exact BNB for tokens
     * @param amountOutMin Minimum tokens to receive
     * @param path Token path [WBNB, token]
     * @param to Recipient address
     * @param deadline Transaction deadline
     */
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts) {
        require(deadline >= block.timestamp, "Router: EXPIRED");
        require(path.length == 2, "Router: INVALID_PATH");
        require(path[0] == WBNB, "Router: INVALID_PATH");
        
        address token = path[1];
        
        uint256 tokensOut = market.buy{value: msg.value}(token, amountOutMin);
        
        if (to != address(this)) {
            IERC20(token).transfer(to, tokensOut);
        }
        
        amounts = new uint256[](2);
        amounts[0] = msg.value;
        amounts[1] = tokensOut;
        
        emit Swap(msg.sender, WBNB, token, msg.value, tokensOut, to);
    }

    /**
     * @notice Swap exact tokens for BNB
     * @param amountIn Amount of tokens to sell
     * @param amountOutMin Minimum BNB to receive
     * @param path Token path [token, WBNB]
     * @param to Recipient address
     * @param deadline Transaction deadline
     */
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(deadline >= block.timestamp, "Router: EXPIRED");
        require(path.length == 2, "Router: INVALID_PATH");
        require(path[1] == WBNB, "Router: INVALID_PATH");
        
        address token = path[0];
        
        IERC20(token).transferFrom(msg.sender, address(this), amountIn);
        IERC20(token).approve(address(market), amountIn);
        
        uint256 nativeOut = market.sell(token, amountIn, amountOutMin);
        
        (bool success, ) = to.call{value: nativeOut}("");
        require(success, "Router: ETH_TRANSFER_FAILED");
        
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = nativeOut;
        
        emit Swap(msg.sender, token, WBNB, amountIn, nativeOut, to);
    }

    /**
     * @notice Get amounts out for a swap
     */
    function getAmountsOut(uint256 amountIn, address[] calldata path) 
        external 
        view 
        returns (uint256[] memory amounts) 
    {
        require(path.length == 2, "Router: INVALID_PATH");
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        
        if (path[0] == WBNB) {
            (uint256 tokensOut, ) = market.getBuyQuote(path[1], amountIn);
            amounts[1] = tokensOut;
        } else {
            (uint256 nativeOut, ) = market.getSellQuote(path[0], amountIn);
            amounts[1] = nativeOut;
        }
    }

    /**
     * @notice Check if a token is tradeable
     */
    function isTokenActive(address token) external view returns (bool) {
        HoneycombBondingCurveMarket.MarketState memory state = market.getMarketState(token);
        return state.initialized && !state.graduated;
    }

    /**
     * @notice Get token price in native
     */
    function getTokenPrice(address token) external view returns (uint256) {
        return market.getPrice(token);
    }

    receive() external payable {}
}
