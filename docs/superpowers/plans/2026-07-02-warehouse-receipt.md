# Warehouse Receipt System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deployable CropRegistry + WarehouseReceipt ERC-721 system on Avalanche C-chain for digital collateralization of smallholder harvests.

**Architecture:** Two-contract design. `CropRegistry` holds extensible commodity definitions (maize, then rice, coffee, etc.). `WarehouseReceipt` is the core ERC-721 token contract that references the registry for validation. Access control uses OpenZeppelin's `Ownable` plus role mappings for warehouse agents and approved MFIs.

**Tech Stack:** Solidity ^0.8.28, Hardhat, OpenZeppelin Contracts 5.x, Ethers.js v6, TypeScript, Chai

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `hardhat.config.ts`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize project and install dependencies**

Run:
```bash
cd "D:\ALL WEBSITES\AVALANCHE"
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts typescript ts-node @types/node
npx hardhat init --typescript
```

Select "Create a TypeScript project" when hardhat init prompts. For the existing package.json, hardhat will merge its config.

- [ ] **Step 2: Verify the setup compiles**

Run:
```bash
npx hardhat compile
```

Expected: `Compiled 1 Solidity file (or "Nothing to compile")` with no errors. A `Lock.sol` and `Lock.ts` test may be auto-generated — delete them in the next step.

- [ ] **Step 3: Clean up boilerplate and configure hardhat**

Delete auto-generated files:
```bash
rm contracts/Lock.sol test/Lock.ts
```

Write `hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    fuji: {
      url: process.env.FUJI_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
```

Write `.gitignore`:
```
node_modules/
artifacts/
cache/
typechain-types/
.env
```

- [ ] **Step 4: Install and compile clean**

Run:
```bash
npm install
npx hardhat compile
```

Expected: `Nothing to compile` (clean state, ready for our contracts).

- [ ] **Step 5: Commit**

```bash
git add package.json hardhat.config.ts tsconfig.json .gitignore
git commit -m "chore: scaffold Hardhat project for WarehouseReceipt system"
```

---

### Task 2: CropRegistry Contract

**Files:**
- Create: `contracts/CropRegistry.sol`
- Create: `test/CropRegistry.test.ts`
- Create: `scripts/deploy-crop-registry.ts`

- [ ] **Step 1: Write the CropRegistry contract**

```solidity
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
```

- [ ] **Step 2: Write the CropRegistry tests**

```typescript
import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

describe("CropRegistry", function () {
  async function deployFixture() {
    const [owner, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("CropRegistry");
    const registry = await factory.deploy();
    return { registry, owner, other };
  }

  const MAIZE = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
  const RICE = ethers.keccak256(ethers.toUtf8Bytes("RICE"));

  it("should deploy with correct owner", async function () {
    const { registry, owner } = await loadFixture(deployFixture);
    expect(await registry.owner()).to.equal(owner.address);
  });

  it("should register a new crop", async function () {
    const { registry } = await loadFixture(deployFixture);
    const tx = await registry.registerCrop(
      MAIZE, "Maize", ["moisture_content", "grade", "defect_rate"], 50
    );
    await expect(tx).to.emit(registry, "CropRegistered").withArgs(MAIZE, "Maize");

    expect(await registry.isCropActive(MAIZE)).to.be.true;
    expect(await registry.getCropCount()).to.equal(1n);
    expect(await registry.getCropAt(0)).to.equal(MAIZE);
  });

  it("should not allow non-owner to register", async function () {
    const { registry, other } = await loadFixture(deployFixture);
    await expect(
      registry.connect(other).registerCrop(MAIZE, "Maize", [], 50)
    ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
  });

  it("should not allow duplicate registration", async function () {
    const { registry } = await loadFixture(deployFixture);
    await registry.registerCrop(MAIZE, "Maize", [], 50);
    await expect(
      registry.registerCrop(MAIZE, "Maize", [], 50)
    ).to.be.revertedWith("Crop already registered");
  });

  it("should toggle crop active status", async function () {
    const { registry } = await loadFixture(deployFixture);
    await registry.registerCrop(MAIZE, "Maize", [], 50);
    await registry.setCropActive(MAIZE, false);
    expect(await registry.isCropActive(MAIZE)).to.be.false;
  });

  it("should return crop definition", async function () {
    const { registry } = await loadFixture(deployFixture);
    await registry.registerCrop(
      MAIZE, "Maize", ["moisture_content", "grade"], 50
    );
    const def = await registry.getCropDefinition(MAIZE);
    expect(def.name).to.equal("Maize");
    expect(def.minQualityScore).to.equal(50n);
    expect(def.active).to.be.true;
    expect(def.metricKeys).to.deep.equal(["moisture_content", "grade"]);
  });

  it("should revert for unregistered crop", async function () {
    const { registry } = await loadFixture(deployFixture);
    await expect(
      registry.getCropDefinition(ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN")))
    ).to.be.revertedWith("Crop not found");
  });

  it("should update an existing crop", async function () {
    const { registry } = await loadFixture(deployFixture);
    await registry.registerCrop(MAIZE, "Maize", ["moisture_content"], 50);
    await registry.updateCrop(
      MAIZE, "Maize Premium", ["moisture_content", "grade", "defect_rate"], 70, true
    );
    const def = await registry.getCropDefinition(MAIZE);
    expect(def.name).to.equal("Maize Premium");
    expect(def.minQualityScore).to.equal(70n);
    expect(def.metricKeys).to.have.lengthOf(3);
  });

  it("should list multiple crops", async function () {
    const { registry } = await loadFixture(deployFixture);
    await registry.registerCrop(MAIZE, "Maize", [], 50);
    await registry.registerCrop(RICE, "Rice", [], 40);
    expect(await registry.getCropCount()).to.equal(2n);
    expect(await registry.getCropAt(0)).to.equal(MAIZE);
    expect(await registry.getCropAt(1)).to.equal(RICE);
  });
});
```

- [ ] **Step 3: Run the CropRegistry tests**

Run:
```bash
npx hardhat test test/CropRegistry.test.ts
```

Expected: All tests passing (green checkmarks).

- [ ] **Step 4: Write the deploy script**

```typescript
import hre from "hardhat";

async function main() {
  const factory = await hre.ethers.getContractFactory("CropRegistry");
  const registry = await factory.deploy();
  await registry.waitForDeployment();
  console.log("CropRegistry deployed to:", await registry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Commit**

```bash
git add contracts/CropRegistry.sol test/CropRegistry.test.ts scripts/deploy-crop-registry.ts
git commit -m "feat: add CropRegistry contract with tests"
```

---

### Task 3: WarehouseReceipt Core Contract

**Files:**
- Create: `contracts/WarehouseReceipt.sol`
- Create: `test/WarehouseReceipt.test.ts`
- Create: `scripts/deploy-warehouse-receipt.ts`

- [ ] **Step 1: Write the WarehouseReceipt contract**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./CropRegistry.sol";

contract WarehouseReceipt is ERC721, Ownable {
    enum ReceiptStatus { Issued, Active, Claimed, Defaulted, Expired }

    struct WarehouseReceiptData {
        uint256 id;
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

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _receipts[tokenId] = WarehouseReceiptData({
            id: tokenId,
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

    function activateReceipt(uint256 tokenId, address mfi) external onlyApprovedMFI {
        WarehouseReceiptData storage receipt = _receipts[tokenId];
        require(receipt.status == ReceiptStatus.Issued, "WHR: receipt not in Issued status");
        require(block.timestamp <= receipt.expiryDate, "WHR: receipt expired");
        require(mfi != address(0), "WHR: invalid MFI address");

        receipt.status = ReceiptStatus.Active;
        receipt.mfi = mfi;

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
}
```

- [ ] **Step 2: Write the WarehouseReceipt tests**

```typescript
import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

describe("WarehouseReceipt", function () {
  async function deployFixture() {
    const [owner, agent, mfi, farmer, other] = await ethers.getSigners();

    // Deploy CropRegistry
    const cropFactory = await ethers.getContractFactory("CropRegistry");
    const registry = await cropFactory.deploy();

    // Register MAIZE
    const MAIZE = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
    await registry.registerCrop(MAIZE, "Maize", ["moisture_content", "grade"], 50);

    // Deploy WarehouseReceipt
    const receiptFactory = await ethers.getContractFactory("WarehouseReceipt");
    const receipt = await receiptFactory.deploy(await registry.getAddress());

    // Set up roles
    await receipt.addWarehouseAgent(agent.address);
    await receipt.addApprovedMfi(mfi.address);

    return { receipt, registry, owner, agent, mfi, farmer, other, MAIZE };
  }

  it("should deploy with correct registry", async function () {
    const { receipt, registry } = await loadFixture(deployFixture);
    expect(await receipt.cropRegistry()).to.equal(await registry.getAddress());
  });

  it("should allow owner to add warehouse agent", async function () {
    const { receipt, agent, other } = await loadFixture(deployFixture);
    expect(await receipt.warehouseAgents(agent.address)).to.be.true;
    await expect(
      receipt.connect(other).addWarehouseAgent(other.address)
    ).to.be.revertedWithCustomError(receipt, "OwnableUnauthorizedAccount");
  });

  it("should allow owner to add/remove MFI", async function () {
    const { receipt, mfi } = await loadFixture(deployFixture);
    expect(await receipt.approvedMfis(mfi.address)).to.be.true;
    await receipt.removeApprovedMfi(mfi.address);
    expect(await receipt.approvedMfis(mfi.address)).to.be.false;
  });

  it("should issue a receipt", async function () {
    const { receipt, agent, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days

    const tx = await receipt.connect(agent).issueReceipt(
      farmer.address,
      1000, // quantityKg
      expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE,
      50000, // estimatedValueUsd $50
      75, // qualityScore
      "ipfs://QmTest"
    );

    await expect(tx)
      .to.emit(receipt, "ReceiptIssued")
      .withArgs(0, farmer.address, MAIZE, 1000, 50000);

    const tokenId = 0;
    expect(await receipt.ownerOf(tokenId)).to.equal(farmer.address);

    const data = await receipt.getReceipt(tokenId);
    expect(data.farmer).to.equal(farmer.address);
    expect(data.warehouseAgent).to.equal(agent.address);
    expect(data.quantityKg).to.equal(1000n);
    expect(data.qualityScore).to.equal(75n);
    expect(data.status).to.equal(0); // Issued
  });

  it("should not issue receipt for inactive crop", async function () {
    const { receipt, agent, farmer, registry, MAIZE } = await loadFixture(deployFixture);
    await registry.setCropActive(MAIZE, false);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    await expect(
      receipt.connect(agent).issueReceipt(
        farmer.address, 1000, expiry,
        ethers.encodeBytes32String("WH-001"),
        MAIZE, 50000, 75, "ipfs://QmTest"
      )
    ).to.be.revertedWith("WHR: crop not active");
  });

  it("should not issue with zero quantity", async function () {
    const { receipt, agent, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    await expect(
      receipt.connect(agent).issueReceipt(
        farmer.address, 0, expiry,
        ethers.encodeBytes32String("WH-001"),
        MAIZE, 50000, 75, "ipfs://QmTest"
      )
    ).to.be.revertedWith("WHR: quantity must be > 0");
  });

  it("should not issue from non-agent", async function () {
    const { receipt, other, farmer, MAIZE } = await loadFixture(deployFixture);

    await expect(
      receipt.connect(other).issueReceipt(
        farmer.address, 1000, 0,
        ethers.encodeBytes32String("WH-001"),
        MAIZE, 50000, 75, "ipfs://QmTest"
      )
    ).to.be.revertedWith("WHR: caller is not a warehouse agent");
  });

  it("should activate a receipt", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );

    const tx = await receipt.connect(mfi).activateReceipt(0, mfi.address);
    await expect(tx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, 1); // Active

    const data = await receipt.getReceipt(0);
    expect(data.status).to.equal(1); // Active
    expect(data.mfi).to.equal(mfi.address);
  });

  it("should mark receipt claimed", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );
    await receipt.connect(mfi).activateReceipt(0, mfi.address);

    const tx = await receipt.connect(mfi).markClaimed(0);
    await expect(tx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, 2); // Claimed
  });

  it("should mark receipt defaulted", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );
    await receipt.connect(mfi).activateReceipt(0, mfi.address);

    const tx = await receipt.connect(mfi).markDefaulted(0);
    await expect(tx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, 3); // Defaulted
  });

  it("should not transition from Issued to Claimed directly", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );

    await expect(
      receipt.connect(mfi).markClaimed(0)
    ).to.be.revertedWith("WHR: receipt not Active");
  });

  it("should expire an active receipt after expiry date", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(deployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 1; // 1 second from now
    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );

    // Advance time past expiry
    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine", []);

    await receipt.expireReceipt(0);
    const data = await receipt.getReceipt(0);
    expect(data.status).to.equal(4); // Expired
  });
});
```

- [ ] **Step 3: Run the WarehouseReceipt tests**

Run:
```bash
npx hardhat test test/WarehouseReceipt.test.ts
```

Expected: All tests passing (green checkmarks).

- [ ] **Step 4: Write the deploy script**

```typescript
import hre from "hardhat";

async function main() {
  const cropRegistryAddress = process.env.CROP_REGISTRY_ADDRESS || "";
  if (!cropRegistryAddress) {
    throw new Error("CROP_REGISTRY_ADDRESS env var required");
  }

  const factory = await hre.ethers.getContractFactory("WarehouseReceipt");
  const receipt = await factory.deploy(cropRegistryAddress);
  await receipt.waitForDeployment();
  console.log("WarehouseReceipt deployed to:", await receipt.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Run all tests together**

Run:
```bash
npx hardhat test
```

Expected: All tests from both test files passing.

- [ ] **Step 6: Commit**

```bash
git add contracts/WarehouseReceipt.sol test/WarehouseReceipt.test.ts scripts/deploy-warehouse-receipt.ts
git commit -m "feat: add WarehouseReceipt ERC-721 contract with tests"
```

---

### Task 4: Integration Test — Full Tri-Party Flow

**Files:**
- Create: `test/Integration.test.ts`

- [ ] **Step 1: Write the end-to-end integration tests**

```typescript
import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

describe("Integration: Full Tri-Party Flow", function () {
  async function fullDeployFixture() {
    const [owner, agent, mfi, farmer] = await ethers.getSigners();

    // Deploy registry
    const cropFactory = await ethers.getContractFactory("CropRegistry");
    const registry = await cropFactory.deploy();

    // Register crops
    const MAIZE = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
    const RICE = ethers.keccak256(ethers.toUtf8Bytes("RICE"));
    await registry.registerCrop(MAIZE, "Maize", ["moisture_content", "grade", "defect_rate"], 50);
    await registry.registerCrop(RICE, "Rice", ["moisture_content", "purity"], 40);

    // Deploy WarehouseReceipt
    const receiptFactory = await ethers.getContractFactory("WarehouseReceipt");
    const receipt = await receiptFactory.deploy(await registry.getAddress());

    // Configure roles
    await receipt.addWarehouseAgent(agent.address);
    await receipt.addApprovedMfi(mfi.address);

    return { receipt, registry, owner, agent, mfi, farmer, MAIZE, RICE };
  }

  it("should complete the full happy path: Issue → Activate → Claim", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(fullDeployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    // 1. Agent issues receipt for farmer
    const issueTx = await receipt.connect(agent).issueReceipt(
      farmer.address,
      2000, // 2000kg maize
      expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE,
      100000, // $100k estimated value
      82,    // quality score
      "ipfs://QmInspectionReport123"
    );
    await expect(issueTx).to.emit(receipt, "ReceiptIssued");
    expect(await receipt.ownerOf(0)).to.equal(farmer.address);

    // A non-MFI cannot activate
    await expect(
      receipt.connect(agent).activateReceipt(0, mfi.address)
    ).to.be.revertedWith("WHR: caller is not an approved MFI");

    // 2. MFI activates the receipt — commits to lending
    const activateTx = await receipt.connect(mfi).activateReceipt(0, mfi.address);
    await expect(activateTx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, 1);

    const activeReceipt = await receipt.getReceipt(0);
    expect(activeReceipt.status).to.equal(1); // Active
    expect(activeReceipt.mfi).to.equal(mfi.address);

    // 3. MFI marks as claimed (farmer repaid)
    const claimTx = await receipt.connect(mfi).markClaimed(0);
    await expect(claimTx).to.emit(receipt, "ReceiptStatusUpdated").withArgs(0, 2);

    const claimedReceipt = await receipt.getReceipt(0);
    expect(claimedReceipt.status).to.equal(2); // Claimed

    // Verify token data is still accessible
    expect(claimedReceipt.farmer).to.equal(farmer.address);
    expect(claimedReceipt.quantityKg).to.equal(2000n);
    expect(claimedReceipt.cropType).to.equal(MAIZE);
  });

  it("should complete Issue → Activate → Default path", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(fullDeployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    await receipt.connect(agent).issueReceipt(
      farmer.address, 1500, expiry,
      ethers.encodeBytes32String("WH-002"),
      MAIZE, 75000, 70, "ipfs://QmInspection456"
    );
    await receipt.connect(mfi).activateReceipt(0, mfi.address);
    await receipt.connect(mfi).markDefaulted(0);

    const data = await receipt.getReceipt(0);
    expect(data.status).to.equal(3); // Defaulted
  });

  it("should work with multiple crop types", async function () {
    const { receipt, agent, mfi, farmer, MAIZE, RICE } = await loadFixture(fullDeployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    // Issue maize receipt
    await receipt.connect(agent).issueReceipt(
      farmer.address, 2000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 100000, 82, "ipfs://QmMaize"
    );

    // Issue rice receipt
    await receipt.connect(agent).issueReceipt(
      farmer.address, 5000, expiry,
      ethers.encodeBytes32String("WH-002"),
      RICE, 250000, 90, "ipfs://QmRice"
    );

    // Verify both
    const maizeReceipt = await receipt.getReceipt(0);
    expect(maizeReceipt.cropType).to.equal(MAIZE);
    expect(maizeReceipt.quantityKg).to.equal(2000n);

    const riceReceipt = await receipt.getReceipt(1);
    expect(riceReceipt.cropType).to.equal(RICE);
    expect(riceReceipt.quantityKg).to.equal(5000n);

    // Both tokens owned by farmer
    expect(await receipt.ownerOf(0)).to.equal(farmer.address);
    expect(await receipt.ownerOf(1)).to.equal(farmer.address);
  });

  it("should prevent expired receipts from being activated", async function () {
    const { receipt, agent, mfi, farmer, MAIZE } = await loadFixture(fullDeployFixture);
    const expiry = Math.floor(Date.now() / 1000) + 1; // expires in 1 second

    await receipt.connect(agent).issueReceipt(
      farmer.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );

    // Advance past expiry
    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      receipt.connect(mfi).activateReceipt(0, mfi.address)
    ).to.be.revertedWith("WHR: receipt expired");
  });
});
```

- [ ] **Step 2: Run all tests**

Run:
```bash
npx hardhat test
```

Expected: All tests from all three test files passing.

- [ ] **Step 3: Commit**

```bash
git add test/Integration.test.ts
git commit -m "test: add integration tests for tri-party flow"
```

---

### Task 5: Deploy Script and Hardhat Task

**Files:**
- Create: `scripts/deploy-all.ts`
- Modify: `hardhat.config.ts`

- [ ] **Step 1: Write the full deployment script**

```typescript
import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. Deploy CropRegistry
  const cropFactory = await hre.ethers.getContractFactory("CropRegistry");
  const registry = await cropFactory.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("CropRegistry deployed to:", registryAddress);

  // 2. Register MAIZE crop
  const MAIZE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MAIZE"));
  const maizeTx = await registry.registerCrop(
    MAIZE,
    "Maize",
    ["moisture_content", "grade", "defect_rate"],
    50
  );
  await maizeTx.wait();
  console.log("MAIZE crop registered");

  // 3. Deploy WarehouseReceipt
  const receiptFactory = await hre.ethers.getContractFactory("WarehouseReceipt");
  const receipt = await receiptFactory.deploy(registryAddress);
  await receipt.waitForDeployment();
  const receiptAddress = await receipt.getAddress();
  console.log("WarehouseReceipt deployed to:", receiptAddress);

  // 4. Output summary
  console.log("\n=== Deployment Summary ===");
  console.log("CropRegistry:", registryAddress);
  console.log("WarehouseReceipt:", receiptAddress);
  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Add a Hardhat task for local verification**

Add to `hardhat.config.ts` after the `networks` config:

```typescript
task("check-receipt", "Check receipt details")
  .addParam("address", "WarehouseReceipt contract address")
  .addParam("tokenid", "Token ID to check")
  .setAction(async (args, hre) => {
    const receipt = await hre.ethers.getContractAt("WarehouseReceipt", args.address);
    const data = await receipt.getReceipt(args.tokenid);
    console.log("Receipt:", {
      id: data.id.toString(),
      farmer: data.farmer,
      warehouseAgent: data.warehouseAgent,
      mfi: data.mfi,
      quantityKg: data.quantityKg.toString(),
      expiryDate: new Date(Number(data.expiryDate) * 1000).toISOString(),
      status: ["Issued", "Active", "Claimed", "Defaulted", "Expired"][Number(data.status)],
      estimatedValueUsd: data.estimatedValueUsd.toString(),
      qualityScore: data.qualityScore.toString(),
    });
  });
```

Import at the top of `hardhat.config.ts`:
```typescript
import { task } from "hardhat/config";
```

- [ ] **Step 3: Run full test suite one final time**

Run:
```bash
npx hardhat test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy-all.ts
git commit -m "feat: add full deployment script and Hardhat task"
```

---

## Spec Coverage Check

| Spec Requirement | Covered In |
|---|---|
| Tri-party roles (Farmer, Warehouse Agent, MFI) | Task 3 — WarehouseReceipt role mappings |
| Universal receipt fields | Task 3 — WarehouseReceiptData struct |
| On-chain summary (cropType, estimatedValueUsd, qualityScore) | Task 3 — WarehouseReceiptData struct |
| Off-chain metadata via URI | Task 3 — metadataUri field |
| CropRegistry for extensibility | Task 2 — CropRegistry with register/update/toggle |
| Core contract validates crop is active via registry | Task 3 — issueReceipt calls cropRegistry.isCropActive() |
| Status lifecycle (Issued → Active → Claimed/Defaulted/Expired) | Task 3 — ReceiptStatus enum + transition functions |
| onlyWarehouseAgent guard | Task 3 — modifier + tests |
| onlyApprovedMFI guard | Task 3 — modifier + tests |
| Owner can add/remove agents and MFIs | Task 3 — add/remove functions + tests |
| ERC-721 standard | Task 3 — inherits ERC721 |
| Pilot: Maize crop definition | Task 2 — registerCrop test data |
| Integration: full happy & unhappy paths | Task 4 — Integration.test.ts |
