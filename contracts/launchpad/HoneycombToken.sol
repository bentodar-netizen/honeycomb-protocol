// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title HoneycombToken
 * @notice ERC20 token created by the Honeycomb Token Factory
 * @dev Minting is restricted to the Market contract for bonding curve operations
 */
contract HoneycombToken is ERC20 {
    address public immutable factory;
    address public market;
    string public metadataCID;
    uint256 public creatorBeeId;
    
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens

    error NotFactory();
    error NotMarket();
    error MarketAlreadySet();
    error MaxSupplyExceeded();

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    modifier onlyMarket() {
        if (msg.sender != market) revert NotMarket();
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _metadataCID,
        uint256 _creatorBeeId
    ) ERC20(_name, _symbol) {
        factory = msg.sender;
        metadataCID = _metadataCID;
        creatorBeeId = _creatorBeeId;
    }

    /**
     * @notice Set the market contract address (can only be called once by factory)
     */
    function setMarket(address _market) external onlyFactory {
        if (market != address(0)) revert MarketAlreadySet();
        market = _market;
    }

    /**
     * @notice Mint tokens (only market can call)
     */
    function mint(address to, uint256 amount) external onlyMarket {
        if (totalSupply() + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens held by the market (for sells via bonding curve)
     */
    function burn(address from, uint256 amount) external onlyMarket {
        _burn(from, amount);
    }

    /**
     * @notice Allow token holders to burn their own tokens
     */
    function burnSelf(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
