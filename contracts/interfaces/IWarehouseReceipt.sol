// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IWarehouseReceipt {
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

    function getReceipt(uint256 tokenId) external view returns (WarehouseReceiptData memory);
    function activateReceipt(uint256 tokenId) external;
    function markClaimed(uint256 tokenId) external;
    function markDefaulted(uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
    function totalSupply() external view returns (uint256);
    function warehouseAgents(address) external view returns (bool);
    function approvedMfis(address) external view returns (bool);
}
