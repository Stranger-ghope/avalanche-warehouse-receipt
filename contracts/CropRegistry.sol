// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CropRegistry is Ownable {
    struct CropDefinition {
        string name;
        string[] metricKeys;
        uint256 minQualityScore;
        bool active;
    }

    mapping(bytes32 => CropDefinition) public cropDefinitions;
    bytes32[] public cropList;

    event CropRegistered(bytes32 indexed cropType, string name);
    event CropUpdated(bytes32 indexed cropType, bool active);

    constructor() Ownable(msg.sender) {}

    function registerCrop(
        bytes32 cropType,
        string calldata name,
        string[] calldata metricKeys,
        uint256 minQualityScore
    ) external onlyOwner {
        require(cropDefinitions[cropType].active == false, "Crop already registered");
        require(bytes(name).length > 0, "Name cannot be empty");

        cropDefinitions[cropType] = CropDefinition({
            name: name,
            metricKeys: metricKeys,
            minQualityScore: minQualityScore,
            active: true
        });
        cropList.push(cropType);

        emit CropRegistered(cropType, name);
    }

    function updateCrop(
        bytes32 cropType,
        string calldata name,
        string[] calldata metricKeys,
        uint256 minQualityScore,
        bool active
    ) external onlyOwner {
        require(cropDefinitions[cropType].active != false || active == true, "Crop not found");

        cropDefinitions[cropType] = CropDefinition({
            name: name,
            metricKeys: metricKeys,
            minQualityScore: minQualityScore,
            active: active
        });

        emit CropUpdated(cropType, active);
    }

    function setCropActive(bytes32 cropType, bool active) external onlyOwner {
        require(cropDefinitions[cropType].active != false || active == true, "Crop not found");
        cropDefinitions[cropType].active = active;
        emit CropUpdated(cropType, active);
    }

    function isCropActive(bytes32 cropType) external view returns (bool) {
        return cropDefinitions[cropType].active;
    }

    function getCropDefinition(bytes32 cropType) external view returns (CropDefinition memory) {
        require(cropDefinitions[cropType].active != false || bytes(cropDefinitions[cropType].name).length > 0, "Crop not found");
        return cropDefinitions[cropType];
    }

    function getCropCount() external view returns (uint256) {
        return cropList.length;
    }

    function getCropAt(uint256 index) external view returns (bytes32) {
        require(index < cropList.length, "Index out of bounds");
        return cropList[index];
    }
}
