// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title BAP578Marketplace
 * @notice Marketplace for trading BAP-578 Non-Fungible Agents (NFAs)
 * @dev Handles listing, buying, and fee distribution for NFA trades
 */
contract BAP578Marketplace is ReentrancyGuard, Ownable, Pausable {
    
    // Platform fee: 1% (100 basis points out of 10000)
    uint256 public constant PLATFORM_FEE_BPS = 100;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // Platform fee wallet
    address public feeWallet;
    
    // The BAP-578 NFA token contract
    IERC721 public nfaToken;
    
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }
    
    // tokenId => Listing
    mapping(uint256 => Listing) public listings;
    
    // Track all active listing token IDs
    uint256[] public activeListingIds;
    mapping(uint256 => uint256) public listingIdToIndex;
    
    // Events
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Unlisted(uint256 indexed tokenId, address indexed seller);
    event Sold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 platformFee
    );
    event FeeWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event NFATokenUpdated(address indexed oldToken, address indexed newToken);
    
    // Errors
    error NotTokenOwner();
    error NotListed();
    error AlreadyListed();
    error InvalidPrice();
    error InsufficientPayment();
    error TransferFailed();
    error CannotBuyOwnToken();
    error ZeroAddress();
    
    constructor(address _nfaToken, address _feeWallet) Ownable(msg.sender) {
        if (_nfaToken == address(0) || _feeWallet == address(0)) revert ZeroAddress();
        nfaToken = IERC721(_nfaToken);
        feeWallet = _feeWallet;
    }
    
    /**
     * @notice List an NFA for sale
     * @param tokenId The token ID to list
     * @param price The sale price in wei
     */
    function list(uint256 tokenId, uint256 price) external whenNotPaused {
        if (nfaToken.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (listings[tokenId].active) revert AlreadyListed();
        if (price == 0) revert InvalidPrice();
        
        // Seller must approve marketplace to transfer
        require(
            nfaToken.isApprovedForAll(msg.sender, address(this)) ||
            nfaToken.getApproved(tokenId) == address(this),
            "Marketplace not approved"
        );
        
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });
        
        // Track active listing
        listingIdToIndex[tokenId] = activeListingIds.length;
        activeListingIds.push(tokenId);
        
        emit Listed(tokenId, msg.sender, price);
    }
    
    /**
     * @notice Cancel a listing
     * @param tokenId The token ID to unlist
     */
    function unlist(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        if (!listing.active) revert NotListed();
        if (listing.seller != msg.sender) revert NotTokenOwner();
        
        _removeListing(tokenId);
        
        emit Unlisted(tokenId, msg.sender);
    }
    
    /**
     * @notice Buy a listed NFA
     * @param tokenId The token ID to purchase
     */
    function buy(uint256 tokenId) external payable nonReentrant whenNotPaused {
        Listing storage listing = listings[tokenId];
        if (!listing.active) revert NotListed();
        if (msg.value < listing.price) revert InsufficientPayment();
        if (listing.seller == msg.sender) revert CannotBuyOwnToken();
        
        address seller = listing.seller;
        uint256 price = listing.price;
        
        // Calculate fees (1% platform fee)
        uint256 platformFee = (price * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 sellerProceeds = price - platformFee;
        
        // Remove listing before transfers (prevent reentrancy)
        _removeListing(tokenId);
        
        // Transfer NFA to buyer
        nfaToken.safeTransferFrom(seller, msg.sender, tokenId);
        
        // Pay seller
        (bool sellerSuccess, ) = payable(seller).call{value: sellerProceeds}("");
        if (!sellerSuccess) revert TransferFailed();
        
        // Pay platform fee
        (bool feeSuccess, ) = payable(feeWallet).call{value: platformFee}("");
        if (!feeSuccess) revert TransferFailed();
        
        // Refund excess payment
        if (msg.value > price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - price}("");
            if (!refundSuccess) revert TransferFailed();
        }
        
        emit Sold(tokenId, seller, msg.sender, price, platformFee);
    }
    
    /**
     * @notice Get listing details
     * @param tokenId The token ID to query
     */
    function getListing(uint256 tokenId) external view returns (
        address seller,
        uint256 price,
        bool active
    ) {
        Listing storage listing = listings[tokenId];
        return (listing.seller, listing.price, listing.active);
    }
    
    /**
     * @notice Get all active listings
     */
    function getActiveListings() external view returns (uint256[] memory) {
        return activeListingIds;
    }
    
    /**
     * @notice Get count of active listings
     */
    function getActiveListingCount() external view returns (uint256) {
        return activeListingIds.length;
    }
    
    /**
     * @notice Calculate platform fee for a given price
     * @param price The sale price
     */
    function calculateFee(uint256 price) external pure returns (uint256) {
        return (price * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
    }
    
    // Admin functions
    
    /**
     * @notice Update the fee wallet
     * @param _feeWallet New fee wallet address
     */
    function setFeeWallet(address _feeWallet) external onlyOwner {
        if (_feeWallet == address(0)) revert ZeroAddress();
        address oldWallet = feeWallet;
        feeWallet = _feeWallet;
        emit FeeWalletUpdated(oldWallet, _feeWallet);
    }
    
    /**
     * @notice Update the NFA token contract
     * @param _nfaToken New NFA token address
     */
    function setNFAToken(address _nfaToken) external onlyOwner {
        if (_nfaToken == address(0)) revert ZeroAddress();
        address oldToken = address(nfaToken);
        nfaToken = IERC721(_nfaToken);
        emit NFATokenUpdated(oldToken, _nfaToken);
    }
    
    /**
     * @notice Pause the marketplace
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause the marketplace
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Internal functions
    
    function _removeListing(uint256 tokenId) internal {
        listings[tokenId].active = false;
        
        // Remove from active listings array
        uint256 index = listingIdToIndex[tokenId];
        uint256 lastIndex = activeListingIds.length - 1;
        
        if (index != lastIndex) {
            uint256 lastTokenId = activeListingIds[lastIndex];
            activeListingIds[index] = lastTokenId;
            listingIdToIndex[lastTokenId] = index;
        }
        
        activeListingIds.pop();
        delete listingIdToIndex[tokenId];
    }
}
