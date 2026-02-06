// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./BAP578Token.sol";
import "./IBAP578.sol";

/**
 * @title BAP578Registry - NFA Agent Registry
 * @notice Central registry for Non-Fungible Agents on Honeycomb
 * @dev Manages agent discovery, verification, and marketplace listings
 */
contract BAP578Registry is Ownable, ReentrancyGuard {
    
    /// @notice The BAP578 token contract
    BAP578Token public immutable nfaToken;
    
    /// @notice Agent verification status
    enum VerificationStatus { UNVERIFIED, PENDING, VERIFIED, REJECTED }
    
    /// @notice Agent listing for marketplace
    struct AgentListing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
        uint256 listedAt;
    }
    
    /// @notice Agent stats for leaderboards
    struct AgentStats {
        uint256 totalInteractions;
        uint256 totalRevenue;
        uint256 rating;
        uint256 ratingCount;
    }
    
    /// @notice Verification info for trusted agents
    struct VerificationInfo {
        VerificationStatus status;
        address verifier;
        uint256 verifiedAt;
        string badge;
    }
    
    /// @notice Mapping from token ID to listing
    mapping(uint256 => AgentListing) public listings;
    
    /// @notice Mapping from token ID to stats
    mapping(uint256 => AgentStats) public agentStats;
    
    /// @notice Mapping from token ID to verification
    mapping(uint256 => VerificationInfo) public verifications;
    
    /// @notice Mapping from category to agent IDs
    mapping(string => uint256[]) private _categoryAgents;
    
    /// @notice Agent categories
    mapping(uint256 => string) public agentCategories;
    
    /// @notice Authorized verifiers
    mapping(address => bool) public verifiers;
    
    /// @notice Marketplace fee percentage (basis points, 250 = 2.5%)
    uint256 public marketplaceFee = 250;
    
    /// @notice Fee recipient
    address public feeRecipient;
    
    /// @notice All listed token IDs
    uint256[] private _allListings;
    
    // ==================== Events ====================
    
    event AgentListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event AgentDelisted(uint256 indexed tokenId);
    event AgentSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event AgentVerified(uint256 indexed tokenId, address indexed verifier, string badge);
    event AgentRated(uint256 indexed tokenId, address indexed rater, uint256 rating);
    event AgentCategorized(uint256 indexed tokenId, string category);
    event VerifierUpdated(address indexed verifier, bool status);
    
    constructor(address tokenAddress_, address feeRecipient_) {
        nfaToken = BAP578Token(tokenAddress_);
        feeRecipient = feeRecipient_;
    }
    
    // ==================== Marketplace ====================
    
    /**
     * @notice List an agent for sale
     * @param tokenId The NFA token ID
     * @param price Sale price in BNB
     */
    function listAgent(uint256 tokenId, uint256 price) external nonReentrant {
        require(nfaToken.ownerOf(tokenId) == msg.sender, "Not owner");
        require(price > 0, "Price must be positive");
        require(!listings[tokenId].active, "Already listed");
        
        // Require approval
        require(
            nfaToken.getApproved(tokenId) == address(this) ||
            nfaToken.isApprovedForAll(msg.sender, address(this)),
            "Not approved"
        );
        
        listings[tokenId] = AgentListing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            active: true,
            listedAt: block.timestamp
        });
        
        _allListings.push(tokenId);
        
        emit AgentListed(tokenId, msg.sender, price);
    }
    
    /**
     * @notice Remove an agent listing
     * @param tokenId The NFA token ID
     */
    function delistAgent(uint256 tokenId) external {
        require(listings[tokenId].active, "Not listed");
        require(listings[tokenId].seller == msg.sender || owner() == msg.sender, "Not authorized");
        
        listings[tokenId].active = false;
        
        emit AgentDelisted(tokenId);
    }
    
    /**
     * @notice Buy a listed agent
     * @param tokenId The NFA token ID
     */
    function buyAgent(uint256 tokenId) external payable nonReentrant {
        AgentListing storage listing = listings[tokenId];
        require(listing.active, "Not for sale");
        require(msg.value >= listing.price, "Insufficient payment");
        require(nfaToken.ownerOf(tokenId) == listing.seller, "Seller no longer owns");
        
        listing.active = false;
        
        // Calculate fees
        uint256 fee = (listing.price * marketplaceFee) / 10000;
        uint256 sellerAmount = listing.price - fee;
        
        // Transfer NFT
        nfaToken.safeTransferFrom(listing.seller, msg.sender, tokenId);
        
        // Transfer payments
        (bool successSeller, ) = listing.seller.call{value: sellerAmount}("");
        require(successSeller, "Seller payment failed");
        
        if (fee > 0 && feeRecipient != address(0)) {
            (bool successFee, ) = feeRecipient.call{value: fee}("");
            require(successFee, "Fee payment failed");
        }
        
        // Refund excess
        if (msg.value > listing.price) {
            (bool refund, ) = msg.sender.call{value: msg.value - listing.price}("");
            require(refund, "Refund failed");
        }
        
        // Update stats
        agentStats[tokenId].totalRevenue += listing.price;
        
        emit AgentSold(tokenId, listing.seller, msg.sender, listing.price);
    }
    
    /**
     * @notice Update listing price
     */
    function updateListingPrice(uint256 tokenId, uint256 newPrice) external {
        require(listings[tokenId].active, "Not listed");
        require(listings[tokenId].seller == msg.sender, "Not seller");
        require(newPrice > 0, "Price must be positive");
        
        listings[tokenId].price = newPrice;
        
        emit AgentListed(tokenId, msg.sender, newPrice);
    }
    
    // ==================== Verification ====================
    
    /**
     * @notice Request verification for an agent
     * @param tokenId The NFA token ID
     */
    function requestVerification(uint256 tokenId) external {
        require(nfaToken.ownerOf(tokenId) == msg.sender, "Not owner");
        require(
            verifications[tokenId].status == VerificationStatus.UNVERIFIED ||
            verifications[tokenId].status == VerificationStatus.REJECTED,
            "Already pending or verified"
        );
        
        verifications[tokenId].status = VerificationStatus.PENDING;
    }
    
    /**
     * @notice Verify an agent (verifiers only)
     * @param tokenId The NFA token ID
     * @param badge Verification badge name
     */
    function verifyAgent(uint256 tokenId, string memory badge) external {
        require(verifiers[msg.sender], "Not a verifier");
        require(verifications[tokenId].status == VerificationStatus.PENDING, "Not pending");
        
        verifications[tokenId] = VerificationInfo({
            status: VerificationStatus.VERIFIED,
            verifier: msg.sender,
            verifiedAt: block.timestamp,
            badge: badge
        });
        
        emit AgentVerified(tokenId, msg.sender, badge);
    }
    
    /**
     * @notice Reject verification
     */
    function rejectVerification(uint256 tokenId) external {
        require(verifiers[msg.sender], "Not a verifier");
        require(verifications[tokenId].status == VerificationStatus.PENDING, "Not pending");
        
        verifications[tokenId].status = VerificationStatus.REJECTED;
    }
    
    // ==================== Categories & Rating ====================
    
    /**
     * @notice Set agent category
     */
    function setAgentCategory(uint256 tokenId, string memory category) external {
        require(nfaToken.ownerOf(tokenId) == msg.sender || owner() == msg.sender, "Not authorized");
        
        // Remove from old category
        string memory oldCategory = agentCategories[tokenId];
        if (bytes(oldCategory).length > 0) {
            _removeFromCategory(tokenId, oldCategory);
        }
        
        // Add to new category
        agentCategories[tokenId] = category;
        _categoryAgents[category].push(tokenId);
        
        emit AgentCategorized(tokenId, category);
    }
    
    function _removeFromCategory(uint256 tokenId, string memory category) internal {
        uint256[] storage agents = _categoryAgents[category];
        for (uint256 i = 0; i < agents.length; i++) {
            if (agents[i] == tokenId) {
                agents[i] = agents[agents.length - 1];
                agents.pop();
                break;
            }
        }
    }
    
    /**
     * @notice Rate an agent (1-5 stars)
     */
    function rateAgent(uint256 tokenId, uint256 rating) external {
        require(rating >= 1 && rating <= 5, "Rating must be 1-5");
        require(nfaToken.ownerOf(tokenId) != msg.sender, "Cannot rate own agent");
        
        AgentStats storage stats = agentStats[tokenId];
        
        // Calculate new average
        uint256 totalRating = stats.rating * stats.ratingCount + rating;
        stats.ratingCount++;
        stats.rating = totalRating / stats.ratingCount;
        
        emit AgentRated(tokenId, msg.sender, rating);
    }
    
    /**
     * @notice Record interaction for stats
     */
    function recordInteraction(uint256 tokenId) external {
        agentStats[tokenId].totalInteractions++;
    }
    
    // ==================== Views ====================
    
    /**
     * @notice Get all active listings
     */
    function getActiveListings() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < _allListings.length; i++) {
            if (listings[_allListings[i]].active) {
                count++;
            }
        }
        
        uint256[] memory activeIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < _allListings.length; i++) {
            if (listings[_allListings[i]].active) {
                activeIds[index] = _allListings[i];
                index++;
            }
        }
        
        return activeIds;
    }
    
    /**
     * @notice Get agents in a category
     */
    function getAgentsByCategory(string memory category) external view returns (uint256[] memory) {
        return _categoryAgents[category];
    }
    
    /**
     * @notice Check if agent is verified
     */
    function isVerified(uint256 tokenId) external view returns (bool) {
        return verifications[tokenId].status == VerificationStatus.VERIFIED;
    }
    
    /**
     * @notice Get full agent info (metadata + stats + verification)
     */
    function getFullAgentInfo(uint256 tokenId) external view returns (
        IBAP578.AgentMetadata memory metadata,
        AgentStats memory stats,
        VerificationInfo memory verification,
        AgentListing memory listing,
        string memory category
    ) {
        metadata = nfaToken.getAgentMetadata(tokenId);
        stats = agentStats[tokenId];
        verification = verifications[tokenId];
        listing = listings[tokenId];
        category = agentCategories[tokenId];
    }
    
    // ==================== Admin ====================
    
    function setVerifier(address verifier, bool status) external onlyOwner {
        verifiers[verifier] = status;
        emit VerifierUpdated(verifier, status);
    }
    
    function setMarketplaceFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        marketplaceFee = newFee;
    }
    
    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }
}
