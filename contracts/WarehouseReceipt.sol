// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./CropRegistry.sol";

contract WarehouseReceipt is ERC721, Ownable {
    enum ReceiptStatus { Issued, Active, Claimed, Defaulted, Expired }

    struct WarehouseReceiptData {
        address farmer;
        address warehouseAgent;
        address mfi;
        uint256 quantityKg;
        uint256 expiryDate;
        bytes32 warehouseId;
        ReceiptStatus status;
        bytes32 cropType;
        uint256 estimatedValueUsd;
        uint256 qualityScore;
        string metadataUri;
    }

    CropRegistry public cropRegistry;

    uint256 private _nextTokenId;
    mapping(uint256 => WarehouseReceiptData) private _receipts;

    mapping(address => bool) public warehouseAgents;
    mapping(address => bool) public approvedMfis;

    event ReceiptIssued(
        uint256 indexed tokenId,
        address indexed farmer,
        bytes32 indexed cropType,
        uint256 quantityKg,
        uint256 estimatedValueUsd
    );
    event ReceiptStatusUpdated(uint256 indexed tokenId, ReceiptStatus status);
    event WarehouseAgentUpdated(address indexed agent, bool active);
    event MfiUpdated(address indexed mfi, bool active);

    modifier onlyWarehouseAgent() {
        require(warehouseAgents[msg.sender], "WHR: caller is not a warehouse agent");
        _;
    }

    modifier onlyApprovedMFI() {
        require(approvedMfis[msg.sender], "WHR: caller is not an approved MFI");
        _;
    }

    constructor(address _cropRegistry) ERC721("WarehouseReceipt", "WHR") Ownable(msg.sender) {
        require(_cropRegistry != address(0), "WHR: invalid registry address");
        cropRegistry = CropRegistry(_cropRegistry);
    }

    function addWarehouseAgent(address agent) external onlyOwner {
        require(agent != address(0), "WHR: invalid address");
        warehouseAgents[agent] = true;
        emit WarehouseAgentUpdated(agent, true);
    }

    function removeWarehouseAgent(address agent) external onlyOwner {
        warehouseAgents[agent] = false;
        emit WarehouseAgentUpdated(agent, false);
    }

    function addApprovedMfi(address mfi) external onlyOwner {
        require(mfi != address(0), "WHR: invalid address");
        approvedMfis[mfi] = true;
        emit MfiUpdated(mfi, true);
    }

    function removeApprovedMfi(address mfi) external onlyOwner {
        approvedMfis[mfi] = false;
        emit MfiUpdated(mfi, false);
    }

    function issueReceipt(
        address farmer,
        uint256 quantityKg,
        uint256 expiryDate,
        bytes32 warehouseId,
        bytes32 cropType,
        uint256 estimatedValueUsd,
        uint256 qualityScore,
        string calldata metadataUri
    ) external onlyWarehouseAgent returns (uint256) {
        require(farmer != address(0), "WHR: invalid farmer address");
        require(quantityKg > 0, "WHR: quantity must be > 0");
        require(expiryDate > block.timestamp, "WHR: expiry must be in the future");
        require(cropRegistry.isCropActive(cropType), "WHR: crop not active");
        require(qualityScore <= 100, "WHR: quality score out of range");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _receipts[tokenId] = WarehouseReceiptData({
            farmer: farmer,
            warehouseAgent: msg.sender,
            mfi: address(0),
            quantityKg: quantityKg,
            expiryDate: expiryDate,
            warehouseId: warehouseId,
            status: ReceiptStatus.Issued,
            cropType: cropType,
            estimatedValueUsd: estimatedValueUsd,
            qualityScore: qualityScore,
            metadataUri: metadataUri
        });

        _safeMint(farmer, tokenId);

        emit ReceiptIssued(tokenId, farmer, cropType, quantityKg, estimatedValueUsd);
        return tokenId;
    }

    function activateReceipt(uint256 tokenId) external onlyApprovedMFI {
        WarehouseReceiptData storage receipt = _receipts[tokenId];
        require(receipt.status == ReceiptStatus.Issued, "WHR: receipt not in Issued status");
        require(block.timestamp <= receipt.expiryDate, "WHR: receipt expired");

        receipt.status = ReceiptStatus.Active;
        receipt.mfi = msg.sender;

        emit ReceiptStatusUpdated(tokenId, ReceiptStatus.Active);
    }

    function markClaimed(uint256 tokenId) external onlyApprovedMFI {
        WarehouseReceiptData storage receipt = _receipts[tokenId];
        require(receipt.status == ReceiptStatus.Active, "WHR: receipt not Active");
        receipt.status = ReceiptStatus.Claimed;
        emit ReceiptStatusUpdated(tokenId, ReceiptStatus.Claimed);
    }

    function markDefaulted(uint256 tokenId) external onlyApprovedMFI {
        WarehouseReceiptData storage receipt = _receipts[tokenId];
        require(receipt.status == ReceiptStatus.Active, "WHR: receipt not Active");
        receipt.status = ReceiptStatus.Defaulted;
        emit ReceiptStatusUpdated(tokenId, ReceiptStatus.Defaulted);
    }

    function expireReceipt(uint256 tokenId) external {
        WarehouseReceiptData storage receipt = _receipts[tokenId];
        require(receipt.status == ReceiptStatus.Issued || receipt.status == ReceiptStatus.Active, "WHR: invalid status");
        require(block.timestamp > receipt.expiryDate, "WHR: receipt not yet expired");
        receipt.status = ReceiptStatus.Expired;
        emit ReceiptStatusUpdated(tokenId, ReceiptStatus.Expired);
    }

    function getReceipt(uint256 tokenId) external view returns (WarehouseReceiptData memory) {
        require(_ownerOf(tokenId) != address(0), "WHR: token does not exist");
        return _receipts[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "WHR: token does not exist");
        return _receipts[tokenId].metadataUri;
    }

    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            require(_receipts[tokenId].status != ReceiptStatus.Active, "WHR: cannot transfer active receipt");
        }
        return super._update(to, tokenId, auth);
    }
}
