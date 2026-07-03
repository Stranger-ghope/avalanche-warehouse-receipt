# AgriVault Grant Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AgriVault from a mock-data prototype to a grant-winning demo with live contract reads, USDC lending via LoanOrigination, a YieldVault pool, and a forex-resilience narrative — all on Fuji testnet at zero cost.

**Architecture:** Three new Solidity contracts (MockUSDC, LoanOrigination, YieldVault) that extend the existing tri-party system. LoanOrigination escrows USDC and disburses on receipt activation, bridging WarehouseReceipt with stablecoin lending. Frontend rewired from mock data to live `useReadContract` / `useWriteContract` calls with role-based write flows.

**Tech Stack:** Solidity ^0.8.28 (Hardhat, Chai), Next.js 14 (wagmi v2, viem, Tailwind)

---

## File Structure

### Smart Contracts
| Action | File | Responsibility |
|---|---|---|
| Create | `contracts/MockUSDC.sol` | ERC-20 with 6 decimals + `faucet()` for test minting |
| Create | `contracts/interfaces/IWarehouseReceipt.sol` | Interface for cross-contract calls to WarehouseReceipt |
| Create | `contracts/LoanOrigination.sol` | Escrows USDC, disburses loans on receipt activation |
| Create | `contracts/YieldVault.sol` | Simple deposit pool with owner-set APY |
| Modify | `scripts/deploy-all.ts` | Add MockUSDC + LoanOrigination + YieldVault deployment |
| Create | `test/MockUSDC.test.ts` | 3 tests |
| Create | `test/LoanOrigination.test.ts` | 8 tests |
| Create | `test/YieldVault.test.ts` | 5 tests |
| Modify | `test/Integration.test.ts` | Add full loan-flow integration test |

### Frontend
| Action | File | Responsibility |
|---|---|---|
| Modify | `frontend/src/config/contracts.ts` | Add MockUSDC, LoanOrigination, YieldVault ABIs + addresses; add write function ABIs for WarehouseReceipt |
| Modify | `frontend/src/hooks/useRole.ts` | Check MFI status via LoanOrigination.authorizedMfis instead of WarehouseReceipt |
| Create | `frontend/src/hooks/useMockUSDC.ts` | Balance, approve, faucet |
| Create | `frontend/src/hooks/useLoanOrigination.ts` | Pool info, activateLoan, repayLoan, defaultLoan, authorizedMfis |
| Create | `frontend/src/hooks/useYieldVault.ts` | Deposit, withdraw, balance, totalAssets, APY |
| Create | `frontend/src/components/StatsBar.tsx` | 4-metric dashboard summary (TVL, loans, receipts, yield%) |
| Create | `frontend/src/components/LoanCard.tsx` | Active loan card with role-based actions |
| Modify | `frontend/src/app/page.tsx` | Remove mock data, wire live reads, add StatsBar, Loans, Yield sections, write flows |

---

### Task 1: MockUSDC Contract + Tests

**Files:**
- Create: `contracts/MockUSDC.sol`
- Create: `test/MockUSDC.test.ts`

- [ ] **Step 1: Write MockUSDC contract**

`contracts/MockUSDC.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    uint8 private constant _DECIMALS = 6;

    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1_000_000_000 * 10 ** _DECIMALS);
    }

    function decimals() public view virtual override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Anyone can mint test USDC (demo convenience, not for mainnet)
    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

- [ ] **Step 2: Write MockUSDC tests**

`test/MockUSDC.test.ts`:
```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("MockUSDC", function () {
  async function deployFixture() {
    const [deployer, user] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("MockUSDC");
    const usdc = await factory.deploy();
    return { usdc, deployer, user };
  }

  it("should have correct name, symbol, decimals", async function () {
    const { usdc } = await loadFixture(deployFixture);
    expect(await usdc.name()).to.equal("Mock USDC");
    expect(await usdc.symbol()).to.equal("USDC");
    expect(await usdc.decimals()).to.equal(6);
  });

  it("should mint initial supply to deployer", async function () {
    const { usdc, deployer } = await loadFixture(deployFixture);
    const balance = await usdc.balanceOf(deployer.address);
    expect(balance).to.equal(1_000_000_000n * 10n ** 6n);
  });

  it("should allow faucet to mint to anyone", async function () {
    const { usdc, user } = await loadFixture(deployFixture);
    await usdc.faucet(user.address, 1000n * 10n ** 6n);
    expect(await usdc.balanceOf(user.address)).to.equal(1000n * 10n ** 6n);
  });
});
```

- [ ] **Step 3: Run MockUSDC tests**

Run: `npx hardhat test test/MockUSDC.test.ts`
Expected: 3 passing

- [ ] **Step 4: Commit**

```bash
git add contracts/MockUSDC.sol test/MockUSDC.test.ts
git commit -m "feat: add MockUSDC contract with faucet for testnet lending"
```

---

### Task 2: IWarehouseReceipt Interface

**Files:**
- Create: `contracts/interfaces/IWarehouseReceipt.sol`

- [ ] **Step 1: Write the interface**

`contracts/interfaces/IWarehouseReceipt.sol`:
```solidity
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
```

- [ ] **Step 2: Commit**

```bash
git add contracts/interfaces/IWarehouseReceipt.sol
git commit -m "feat: add IWarehouseReceipt interface for cross-contract calls"
```

---

### Task 3: LoanOrigination Contract

**Files:**
- Create: `contracts/LoanOrigination.sol`

- [ ] **Step 1: Write LoanOrigination contract**

`contracts/LoanOrigination.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IWarehouseReceipt.sol";

contract LoanOrigination is Ownable {
    IWarehouseReceipt public warehouseReceipt;
    IERC20 public usdc;

    struct LoanInfo {
        address farmer;
        uint256 amount;
        address mfi;
        bool active;
    }

    mapping(uint256 => LoanInfo) public loans;
    mapping(address => bool) public authorizedMfis;

    uint256 public activeLoanCount;

    event LoanActivated(uint256 indexed tokenId, address indexed farmer, uint256 amount);
    event LoanRepaid(uint256 indexed tokenId, address indexed farmer, uint256 amount);
    event LoanDefaulted(uint256 indexed tokenId);
    event MfiAuthorized(address indexed mfi, bool authorized);

    modifier onlyAuthorizedMfi() {
        require(authorizedMfis[msg.sender], "LO: not authorized");
        _;
    }

    constructor(address _warehouseReceipt, address _usdc) Ownable(msg.sender) {
        require(_warehouseReceipt != address(0), "LO: invalid receipt");
        require(_usdc != address(0), "LO: invalid usdc");
        warehouseReceipt = IWarehouseReceipt(_warehouseReceipt);
        usdc = IERC20(_usdc);
    }

    /// @notice Owner authorizes or revokes an MFI address
    function setMfiAuthorization(address mfi, bool authorized) external onlyOwner {
        authorizedMfis[mfi] = authorized;
        emit MfiAuthorized(mfi, authorized);
    }

    /// @notice Authorized MFI activates a loan — USDC is disbursed to the farmer,
    ///         receipt status moves to Active.
    function activateLoan(uint256 tokenId) external onlyAuthorizedMfi {
        IWarehouseReceipt.WarehouseReceiptData memory receipt = warehouseReceipt.getReceipt(tokenId);
        require(receipt.status == IWarehouseReceipt.ReceiptStatus.Issued, "LO: not issued");
        require(receipt.estimatedValueUsd > 0, "LO: zero value");

        uint256 amount = receipt.estimatedValueUsd;
        require(usdc.balanceOf(address(this)) >= amount, "LO: insufficient pool");

        loans[tokenId] = LoanInfo({
            farmer: receipt.farmer,
            amount: amount,
            mfi: msg.sender,
            active: true
        });
        activeLoanCount++;

        require(usdc.transfer(receipt.farmer, amount), "LO: transfer failed");

        warehouseReceipt.activateReceipt(tokenId);

        emit LoanActivated(tokenId, receipt.farmer, amount);
    }

    /// @notice Farmer repays the loan — USDC returns to pool, receipt marked Claimed
    function repayLoan(uint256 tokenId) external {
        LoanInfo storage loan = loans[tokenId];
        require(loan.active, "LO: not active");
        require(msg.sender == loan.farmer, "LO: not farmer");

        loan.active = false;
        activeLoanCount--;

        require(usdc.transferFrom(msg.sender, address(this), loan.amount), "LO: transfer failed");

        warehouseReceipt.markClaimed(tokenId);

        emit LoanRepaid(tokenId, msg.sender, loan.amount);
    }

    /// @notice Authorized MFI marks a loan as defaulted (collateral seizure)
    function defaultLoan(uint256 tokenId) external onlyAuthorizedMfi {
        LoanInfo storage loan = loans[tokenId];
        require(loan.active, "LO: not active");

        loan.active = false;
        activeLoanCount--;

        warehouseReceipt.markDefaulted(tokenId);

        emit LoanDefaulted(tokenId);
    }

    /// @notice USDC balance available for lending
    function poolBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add contracts/LoanOrigination.sol
git commit -m "feat: add LoanOrigination contract for USDC-backed receipt lending"
```

---

### Task 4: LoanOrigination Tests

**Files:**
- Create: `test/LoanOrigination.test.ts`

- [ ] **Step 1: Write LoanOrigination tests**

`test/LoanOrigination.test.ts`:
```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("LoanOrigination", function () {
  async function deployFixture() {
    const [owner, agent, mfi, farmer, other] = await ethers.getSigners();

    // Deploy MockUSDC
    const usdcFactory = await ethers.getContractFactory("MockUSDC");
    const usdc = await usdcFactory.deploy();

    // Deploy CropRegistry
    const cropFactory = await ethers.getContractFactory("CropRegistry");
    const registry = await cropFactory.deploy();
    const MAIZE = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
    await registry.registerCrop(MAIZE, "Maize", ["moisture_content"], 50);

    // Deploy WarehouseReceipt
    const receiptFactory = await ethers.getContractFactory("WarehouseReceipt");
    const receipt = await receiptFactory.deploy(await registry.getAddress());
    await receipt.addWarehouseAgent(agent.address);

    // Deploy LoanOrigination
    const loanFactory = await ethers.getContractFactory("LoanOrigination");
    const loan = await loanFactory.deploy(
      await receipt.getAddress(),
      await usdc.getAddress()
    );

    // Add LoanOrigination as approved MFI in WarehouseReceipt
    await receipt.addApprovedMfi(await loan.getAddress());

    // Add MFI as authorized in LoanOrigination
    await loan.setMfiAuthorization(mfi.address, true);

    // Fund MFI with USDC and have them deposit into LoanOrigination pool
    await usdc.faucet(mfi.address, 1_000_000n * 10n ** 6n);
    await usdc.connect(mfi).transfer(await loan.getAddress(), 500_000n * 10n ** 6n);

    // Issue a receipt
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt.connect(agent).issueReceipt(
      farmer.address,
      2000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 100_000, 82, "ipfs://QmTest"
    );

    return { usdc, receipt, loan, owner, agent, mfi, farmer, other, MAIZE };
  }

  it("should deploy with correct addresses", async function () {
    const { loan, receipt, usdc } = await loadFixture(deployFixture);
    expect(await loan.warehouseReceipt()).to.equal(await receipt.getAddress());
    expect(await loan.usdc()).to.equal(await usdc.getAddress());
  });

  it("should allow owner to authorize MFIs", async function () {
    const { loan, mfi, other } = await loadFixture(deployFixture);
    expect(await loan.authorizedMfis(mfi.address)).to.be.true;
    await loan.setMfiAuthorization(mfi.address, false);
    expect(await loan.authorizedMfis(mfi.address)).to.be.false;
    await expect(
      loan.connect(other).setMfiAuthorization(other.address, true)
    ).to.be.revertedWithCustomError(loan, "OwnableUnauthorizedAccount");
  });

  it("should activate loan and disburse USDC to farmer", async function () {
    const { loan, usdc, mfi, farmer } = await loadFixture(deployFixture);

    const farmerBalanceBefore = await usdc.balanceOf(farmer.address);
    expect(farmerBalanceBefore).to.equal(0n);

    await expect(loan.connect(mfi).activateLoan(0))
      .to.emit(loan, "LoanActivated")
      .withArgs(0, farmer.address, 100_000n * 10n ** 6n);

    const farmerBalance = await usdc.balanceOf(farmer.address);
    expect(farmerBalance).to.equal(100_000n * 10n ** 6n);

    expect(await loan.activeLoanCount()).to.equal(1n);

    const receiptData = await loan.loans(0);
    expect(receiptData.active).to.be.true;
    expect(receiptData.farmer).to.equal(farmer.address);
  });

  it("should not activate if caller is not authorized MFI", async function () {
    const { loan, agent } = await loadFixture(deployFixture);
    await expect(
      loan.connect(agent).activateLoan(0)
    ).to.be.revertedWith("LO: not authorized");
  });

  it("should not activate if pool has insufficient USDC", async function () {
    const { usdc, loan, mfi } = await loadFixture(deployFixture);

    // Drain the pool
    const poolBal = await usdc.balanceOf(await loan.getAddress());
    const [owner] = await ethers.getSigners();
    await usdc.connect(owner).transfer(await loan.getAddress(), 0); // just to get signer

    // Actually withdraw all from loan origination via transfer
    await loan.setMfiAuthorization(mfi.address, false);
    await loan.setMfiAuthorization(mfi.address, true);
    // This test is tricky because we need to remove the pool balance.
    // Instead, deploy with tiny pool:
    const [ , , , farmer2] = await ethers.getSigners();
    const cropFactory = await ethers.getContractFactory("CropRegistry");
    const registry = await cropFactory.deploy();
    const MAIZE = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
    await registry.registerCrop(MAIZE, "Maize", ["moisture_content"], 50);

    const receiptFactory = await ethers.getContractFactory("WarehouseReceipt");
    const receipt2 = await receiptFactory.deploy(await registry.getAddress());
    await receipt2.addWarehouseAgent(mfi.address);

    const usdcFactory = await ethers.getContractFactory("MockUSDC");
    const usdc2 = await usdcFactory.deploy();

    const loanFactory = await ethers.getContractFactory("LoanOrigination");
    const loan2 = await loanFactory.deploy(await receipt2.getAddress(), await usdc2.getAddress());
    await receipt2.addApprovedMfi(await loan2.getAddress());
    await loan2.setMfiAuthorization(mfi.address, true);

    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;
    await receipt2.connect(mfi).issueReceipt(
      farmer2.address, 1000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 50000, 75, "ipfs://QmTest"
    );

    // Pool has 0 USDC, activate should fail
    await expect(
      loan2.connect(mfi).activateLoan(0)
    ).to.be.revertedWith("LO: insufficient pool");
  });

  it("should repay loan", async function () {
    const { loan, usdc, mfi, farmer } = await loadFixture(deployFixture);

    // Activate
    await loan.connect(mfi).activateLoan(0);

    // Farmer approves and repays
    const loanAmount = 100_000n * 10n ** 6n;
    await usdc.connect(farmer).approve(await loan.getAddress(), loanAmount);

    await expect(loan.connect(farmer).repayLoan(0))
      .to.emit(loan, "LoanRepaid")
      .withArgs(0, farmer.address, loanAmount);

    expect(await loan.activeLoanCount()).to.equal(0n);

    const receiptData = await loan.loans(0);
    expect(receiptData.active).to.be.false;
  });

  it("should not allow non-farmer to repay", async function () {
    const { loan, mfi, other } = await loadFixture(deployFixture);

    await loan.connect(mfi).activateLoan(0);

    await expect(
      loan.connect(other).repayLoan(0)
    ).to.be.revertedWith("LO: not farmer");
  });

  it("should default loan", async function () {
    const { loan, mfi } = await loadFixture(deployFixture);

    await loan.connect(mfi).activateLoan(0);

    await expect(loan.connect(mfi).defaultLoan(0))
      .to.emit(loan, "LoanDefaulted")
      .withArgs(0);

    expect(await loan.activeLoanCount()).to.equal(0n);
  });
});
```

- [ ] **Step 2: Run LoanOrigination tests**

Run: `npx hardhat test test/LoanOrigination.test.ts`
Expected: 7-8 passing (one may be the complex insufficient-pool test)

- [ ] **Step 3: Commit**

```bash
git add test/LoanOrigination.test.ts
git commit -m "test: add LoanOrigination tests for activate, repay, default flows"
```

---

### Task 5: YieldVault Contract + Tests

**Files:**
- Create: `contracts/YieldVault.sol`
- Create: `test/YieldVault.test.ts`

- [ ] **Step 1: Write YieldVault contract**

`contracts/YieldVault.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract YieldVault is Ownable {
    IERC20 public usdc;

    mapping(address => uint256) public balances;
    uint256 public totalAssets_;
    uint256 public apyBps; // e.g. 820 = 8.2%

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event ApyUpdated(uint256 apyBps);

    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "YV: invalid usdc");
        usdc = IERC20(_usdc);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "YV: zero amount");
        require(usdc.transferFrom(msg.sender, address(this), amount), "YV: transfer failed");
        balances[msg.sender] += amount;
        totalAssets_ += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "YV: zero amount");
        require(balances[msg.sender] >= amount, "YV: insufficient balance");
        balances[msg.sender] -= amount;
        totalAssets_ -= amount;
        require(usdc.transfer(msg.sender, amount), "YV: transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    function totalAssets() external view returns (uint256) {
        return totalAssets_;
    }

    function setApy(uint256 _apyBps) external onlyOwner {
        apyBps = _apyBps;
        emit ApyUpdated(_apyBps);
    }
}
```

- [ ] **Step 2: Write YieldVault tests**

`test/YieldVault.test.ts`:
```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("YieldVault", function () {
  async function deployFixture() {
    const [owner, user] = await ethers.getSigners();

    const usdcFactory = await ethers.getContractFactory("MockUSDC");
    const usdc = await usdcFactory.deploy();
    await usdc.faucet(user.address, 10_000n * 10n ** 6n);

    const vaultFactory = await ethers.getContractFactory("YieldVault");
    const vault = await vaultFactory.deploy(await usdc.getAddress());

    return { usdc, vault, owner, user };
  }

  it("should deploy with correct USDC address", async function () {
    const { vault, usdc } = await loadFixture(deployFixture);
    expect(await vault.usdc()).to.equal(await usdc.getAddress());
  });

  it("should deposit and track balance", async function () {
    const { vault, usdc, user } = await loadFixture(deployFixture);
    const amount = 1000n * 10n ** 6n;

    await usdc.connect(user).approve(await vault.getAddress(), amount);
    await expect(vault.connect(user).deposit(amount))
      .to.emit(vault, "Deposited")
      .withArgs(user.address, amount);

    expect(await vault.balances(user.address)).to.equal(amount);
    expect(await vault.totalAssets()).to.equal(amount);
  });

  it("should withdraw", async function () {
    const { vault, usdc, user } = await loadFixture(deployFixture);
    const amount = 1000n * 10n ** 6n;

    await usdc.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount);

    await vault.connect(user).withdraw(amount);
    expect(await vault.balances(user.address)).to.equal(0n);
    expect(await vault.totalAssets()).to.equal(0n);
  });

  it("should not withdraw more than balance", async function () {
    const { vault, usdc, user } = await loadFixture(deployFixture);
    const amount = 1000n * 10n ** 6n;

    await usdc.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount);

    await expect(
      vault.connect(user).withdraw(amount + 1n)
    ).to.be.revertedWith("YV: insufficient balance");
  });

  it("should set APY (owner only)", async function () {
    const { vault, user } = await loadFixture(deployFixture);

    await vault.setApy(820);
    expect(await vault.apyBps()).to.equal(820);

    await expect(
      vault.connect(user).setApy(500)
    ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
  });
});
```

- [ ] **Step 3: Run YieldVault tests**

Run: `npx hardhat test test/YieldVault.test.ts`
Expected: 5 passing

- [ ] **Step 4: Commit**

```bash
git add contracts/YieldVault.sol test/YieldVault.test.ts
git commit -m "feat: add YieldVault deposit pool with owner-set APY"
```

---

### Task 6: Integration Tests — Full Loan Flow

**Files:**
- Modify: `test/Integration.test.ts`

- [ ] **Step 1: Add full loan-flow integration test**

Append to `test/Integration.test.ts` before the closing `});`:

```typescript

describe("Integration: Full Loan Flow (USDC + LoanOrigination)", function () {
  async function fullLoanFixture() {
    const [owner, agent, mfi, farmer] = await ethers.getSigners();

    // Deploy MockUSDC
    const usdcFactory = await ethers.getContractFactory("MockUSDC");
    const usdc = await usdcFactory.deploy();

    // Deploy CropRegistry
    const cropFactory = await ethers.getContractFactory("CropRegistry");
    const registry = await cropFactory.deploy();
    const MAIZE = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
    await registry.registerCrop(MAIZE, "Maize", ["moisture_content", "grade"], 50);

    // Deploy WarehouseReceipt
    const receiptFactory = await ethers.getContractFactory("WarehouseReceipt");
    const receipt = await receiptFactory.deploy(await registry.getAddress());
    await receipt.addWarehouseAgent(agent.address);

    // Deploy LoanOrigination
    const loanFactory = await ethers.getContractFactory("LoanOrigination");
    const loan = await loanFactory.deploy(
      await receipt.getAddress(),
      await usdc.getAddress()
    );

    // Wire LoanOrigination as approved MFI
    await receipt.addApprovedMfi(await loan.getAddress());
    await loan.setMfiAuthorization(mfi.address, true);

    // Fund MFI with USDC and deposit into loan pool
    await usdc.faucet(mfi.address, 1_000_000n * 10n ** 6n);
    await usdc.connect(mfi).transfer(await loan.getAddress(), 500_000n * 10n ** 6n);

    // Deploy YieldVault
    const vaultFactory = await ethers.getContractFactory("YieldVault");
    const vault = await vaultFactory.deploy(await usdc.getAddress());
    await vault.setApy(820); // 8.2%

    const expiry = Math.floor(Date.now() / 1000) + 86400 * 30;

    return { usdc, receipt, loan, vault, owner, agent, mfi, farmer, MAIZE, expiry };
  }

  it("should complete full flow: Issue → ActivateLoan → Repay", async function () {
    const { usdc, receipt, loan, agent, mfi, farmer, MAIZE, expiry } =
      await loadFixture(fullLoanFixture);

    // 1. Agent issues receipt
    await receipt.connect(agent).issueReceipt(
      farmer.address, 2000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 100_000, 82, "ipfs://QmTest"
    );

    // 2. MFI activates loan — USDC disbursed to farmer
    const farmerBalBefore = await usdc.balanceOf(farmer.address);
    expect(farmerBalBefore).to.equal(0n);

    await expect(loan.connect(mfi).activateLoan(0))
      .to.emit(loan, "LoanActivated")
      .withArgs(0, farmer.address, 100_000n * 10n ** 6n);

    expect(await usdc.balanceOf(farmer.address)).to.equal(100_000n * 10n ** 6n);
    expect(await loan.activeLoanCount()).to.equal(1n);

    // Verify receipt is Active
    const receiptData = await receipt.getReceipt(0);
    expect(receiptData.status).to.equal(1); // Active
    expect(receiptData.mfi).to.equal(await loan.getAddress());

    // 3. Farmer repays
    await usdc.connect(farmer).approve(await loan.getAddress(), 100_000n * 10n ** 6n);
    await expect(loan.connect(farmer).repayLoan(0))
      .to.emit(loan, "LoanRepaid")
      .withArgs(0, farmer.address, 100_000n * 10n ** 6n);

    expect(await loan.activeLoanCount()).to.equal(0n);

    // Verify receipt is Claimed
    const claimedData = await receipt.getReceipt(0);
    expect(claimedData.status).to.equal(2); // Claimed
  });

  it("should complete flow: Issue → ActivateLoan → Default", async function () {
    const { receipt, loan, agent, mfi, farmer, MAIZE, expiry } =
      await loadFixture(fullLoanFixture);

    await receipt.connect(agent).issueReceipt(
      farmer.address, 1500, expiry,
      ethers.encodeBytes32String("WH-002"),
      MAIZE, 75_000, 70, "ipfs://QmTest2"
    );

    await loan.connect(mfi).activateLoan(0);
    await loan.connect(mfi).defaultLoan(0);

    const data = await receipt.getReceipt(0);
    expect(data.status).to.equal(3); // Defaulted
  });

  it("should allow farmer to deposit USDC into YieldVault", async function () {
    const { usdc, receipt, loan, vault, agent, mfi, farmer, MAIZE, expiry } =
      await loadFixture(fullLoanFixture);

    // Issue + activate to give farmer USDC
    await receipt.connect(agent).issueReceipt(
      farmer.address, 2000, expiry,
      ethers.encodeBytes32String("WH-001"),
      MAIZE, 100_000, 82, "ipfs://QmTest"
    );
    await loan.connect(mfi).activateLoan(0);

    // Farmer deposits half into yield vault
    const depositAmount = 50_000n * 10n ** 6n;
    await usdc.connect(farmer).approve(await vault.getAddress(), depositAmount);
    await vault.connect(farmer).deposit(depositAmount);

    expect(await vault.balances(farmer.address)).to.equal(depositAmount);
    expect(await vault.totalAssets()).to.equal(depositAmount);
    expect(await vault.apyBps()).to.equal(820);
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npx hardhat test`
Expected: All tests passing (43 existing + ~15 new = ~58 total)

- [ ] **Step 3: Commit**

```bash
git add test/Integration.test.ts
git commit -m "test: add full loan flow integration tests with USDC + LoanOrigination"
```

---

### Task 7: Update Deploy Script

**Files:**
- Modify: `scripts/deploy-all.ts`

- [ ] **Step 1: Update deploy script**

Write `scripts/deploy-all.ts`:
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
    MAIZE, "Maize", ["moisture_content", "grade", "defect_rate"], 50
  );
  await maizeTx.wait();
  console.log("MAIZE crop registered");

  // 3. Deploy WarehouseReceipt
  const receiptFactory = await hre.ethers.getContractFactory("WarehouseReceipt");
  const receipt = await receiptFactory.deploy(registryAddress);
  await receipt.waitForDeployment();
  const receiptAddress = await receipt.getAddress();
  console.log("WarehouseReceipt deployed to:", receiptAddress);

  // 4. Deploy MockUSDC
  const usdcFactory = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await usdcFactory.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC deployed to:", usdcAddress);

  // 5. Deploy LoanOrigination
  const loanFactory = await hre.ethers.getContractFactory("LoanOrigination");
  const loan = await loanFactory.deploy(receiptAddress, usdcAddress);
  await loan.waitForDeployment();
  const loanAddress = await loan.getAddress();
  console.log("LoanOrigination deployed to:", loanAddress);

  // Wire LoanOrigination as approved MFI in WarehouseReceipt
  const addMfiTx = await receipt.addApprovedMfi(loanAddress);
  await addMfiTx.wait();
  console.log("LoanOrigination added as approved MFI");

  // 6. Deploy YieldVault
  const vaultFactory = await hre.ethers.getContractFactory("YieldVault");
  const vault = await vaultFactory.deploy(usdcAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("YieldVault deployed to:", vaultAddress);

  // Set initial APY (8.2%)
  await vault.setApy(820);
  console.log("YieldVault APY set to 8.2%");

  // 7. Output summary
  console.log("\n=== Deployment Summary ===");
  console.log("CropRegistry:", registryAddress);
  console.log("WarehouseReceipt:", receiptAddress);
  console.log("MockUSDC:", usdcAddress);
  console.log("LoanOrigination:", loanAddress);
  console.log("YieldVault:", vaultAddress);
  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Create local deployment config**

Write `scripts/deploy-local.ts` (deploys to local hardhat node, outputs JSON config for frontend):
```typescript
import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // Deploy all contracts
  const cropFactory = await hre.ethers.getContractFactory("CropRegistry");
  const registry = await cropFactory.deploy();
  await registry.waitForDeployment();

  const MAIZE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MAIZE"));
  await registry.registerCrop(MAIZE, "Maize", ["moisture_content", "grade", "defect_rate"], 50);

  const receiptFactory = await hre.ethers.getContractFactory("WarehouseReceipt");
  const receipt = await receiptFactory.deploy(await registry.getAddress());
  await receipt.waitForDeployment();

  const usdcFactory = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await usdcFactory.deploy();
  await usdc.waitForDeployment();

  const loanFactory = await hre.ethers.getContractFactory("LoanOrigination");
  const loan = await loanFactory.deploy(await receipt.getAddress(), await usdc.getAddress());
  await loan.waitForDeployment();

  await receipt.addApprovedMfi(await loan.getAddress());

  const vaultFactory = await hre.ethers.getContractFactory("YieldVault");
  const vault = await vaultFactory.deploy(await usdc.getAddress());
  await vault.waitForDeployment();
  await vault.setApy(820);

  // Write config
  const config = {
    cropRegistry: await registry.getAddress(),
    warehouseReceipt: await receipt.getAddress(),
    mockUSDC: await usdc.getAddress(),
    loanOrigination: await loan.getAddress(),
    yieldVault: await vault.getAddress(),
    deployer: deployer.address,
    network: hre.network.name,
  };

  const outPath = path.join(__dirname, "..", "frontend", "src", "config", "deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2));
  console.log("Config written to:", outPath);
  console.log(config);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy-all.ts scripts/deploy-local.ts
git commit -m "feat: update deploy scripts with LoanOrigination, MockUSDC, YieldVault"
```

---

### Task 8: Update Frontend Contract Config

**Files:**
- Modify: `frontend/src/config/contracts.ts`

- [ ] **Step 1: Add new contract addresses and ABIs to contracts.ts**

First, add the new addresses to `CONTRACT_ADDRESSES`:

```typescript
export const CONTRACT_ADDRESSES = {
  cropRegistry: "0x8BAd899c4C70CA7245AB34f437EB69ca80ff9eBe" as `0x${string}`,
  warehouseReceipt: "0x160f4bEcca5d84a58918342a7AFA6bF65b1E7eb9" as `0x${string}`,
  // New contracts (update after Fuji deployment):
  mockUSDC: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  loanOrigination: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  yieldVault: "0x0000000000000000000000000000000000000000" as `0x${string}`,
} as const;
```

Then, add the new ABIs after the existing `ReceiptData` interface:

```typescript
// ============================================================
// MockUSDC ABI (functions used by dashboard)
// ============================================================
export const MOCK_USDC_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address", internalType: "address" },
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "faucet",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
] as const;

// ============================================================
// LoanOrigination ABI
// ============================================================
export const LOAN_ORIGINATION_ABI = [
  {
    type: "function",
    name: "activateLoan",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "repayLoan",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "defaultLoan",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "authorizedMfis",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "loans",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "farmer", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "mfi", type: "address", internalType: "address" },
      { name: "active", type: "bool", internalType: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "activeLoanCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "poolBalance",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ============================================================
// YieldVault ABI
// ============================================================
export const YIELD_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balances",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalAssets",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "apyBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ----- Write-function ABIs for WarehouseReceipt (used by Agent/MFI flows) -----
export const WAREHOUSE_RECEIPT_WRITE_ABI = [
  {
    type: "function",
    name: "issueReceipt",
    inputs: [
      { name: "farmer", type: "address", internalType: "address" },
      { name: "quantityKg", type: "uint256", internalType: "uint256" },
      { name: "expiryDate", type: "uint256", internalType: "uint256" },
      { name: "warehouseId", type: "bytes32", internalType: "bytes32" },
      { name: "cropType", type: "bytes32", internalType: "bytes32" },
      { name: "estimatedValueUsd", type: "uint256", internalType: "uint256" },
      { name: "qualityScore", type: "uint256", internalType: "uint256" },
      { name: "metadataUri", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "activateReceipt",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/config/contracts.ts
git commit -m "feat(frontend): add ABIs for MockUSDC, LoanOrigination, YieldVault, and write functions"
```

---

### Task 9: New Frontend Hooks

**Files:**
- Create: `frontend/src/hooks/useMockUSDC.ts`
- Create: `frontend/src/hooks/useLoanOrigination.ts`
- Create: `frontend/src/hooks/useYieldVault.ts`

- [ ] **Step 1: Write useMockUSDC hook**

`frontend/src/hooks/useMockUSDC.ts` (reads `deployed-addresses.json` for contract addresses if available, otherwise falls back to CONTRACT_ADDRESSES):
```typescript
"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { MOCK_USDC_ABI, CONTRACT_ADDRESSES } from "@/config/contracts";

// During development, these addresses come from deployed-addresses.json.
// In production, they're set in contracts.ts. We export them from a single place
// so the hooks always reference the same source of truth.
export const MOCK_USDC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS as `0x${string}` ?? CONTRACT_ADDRESSES.mockUSDC;

export function useUSDCBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useUSDCAllowance(owner: `0x${string}` | undefined, spender: `0x${string}` | undefined) {
  return useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: MOCK_USDC_ABI,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!owner && !!spender },
  });
}

export function useUSDCApprove() {
  return useWriteContract();
}

export function useUSDCTransfer() {
  return useWriteContract();
}

export function useUSDCTransferFrom() {
  return useWriteContract();
}

export function useUSDCWrite() {
  return useWriteContract();
}

export function useUSDCWriteFaucet() {
  return useWriteContract();
}
```

- [ ] **Step 2: Write useLoanOrigination hook**

`frontend/src/hooks/useLoanOrigination.ts`:
```typescript
"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { LOAN_ORIGINATION_ABI, CONTRACT_ADDRESSES } from "@/config/contracts";

export const LOAN_ORIGINATION_ADDRESS = CONTRACT_ADDRESSES.loanOrigination;

export function useLoanInfo(tokenId: number | undefined) {
  return useReadContract({
    address: LOAN_ORIGINATION_ADDRESS,
    abi: LOAN_ORIGINATION_ABI,
    functionName: "loans",
    args: tokenId !== undefined ? [BigInt(tokenId)] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useIsAuthorizedMfi(address: `0x${string}` | undefined) {
  return useReadContract({
    address: LOAN_ORIGINATION_ADDRESS,
    abi: LOAN_ORIGINATION_ABI,
    functionName: "authorizedMfis",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useActiveLoanCount() {
  return useReadContract({
    address: LOAN_ORIGINATION_ADDRESS,
    abi: LOAN_ORIGINATION_ABI,
    functionName: "activeLoanCount",
  });
}

export function usePoolBalance() {
  return useReadContract({
    address: LOAN_ORIGINATION_ADDRESS,
    abi: LOAN_ORIGINATION_ABI,
    functionName: "poolBalance",
  });
}

export function useActivateLoan() {
  return useWriteContract();
}

export function useRepayLoan() {
  return useWriteContract();
}

export function useDefaultLoan() {
  return useWriteContract();
}
```

- [ ] **Step 3: Write useYieldVault hook**

`frontend/src/hooks/useYieldVault.ts`:
```typescript
"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { YIELD_VAULT_ABI, CONTRACT_ADDRESSES } from "@/config/contracts";

export const YIELD_VAULT_ADDRESS = CONTRACT_ADDRESSES.yieldVault;

export function useVaultBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_VAULT_ABI,
    functionName: "balances",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useVaultTotalAssets() {
  return useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_VAULT_ABI,
    functionName: "totalAssets",
  });
}

export function useVaultApy() {
  return useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_VAULT_ABI,
    functionName: "apyBps",
  });
}

export function useVaultDeposit() {
  return useWriteContract();
}

export function useVaultWithdraw() {
  return useWriteContract();
}
```

- [ ] **Step 4: Update useRole hook**

Modify `frontend/src/hooks/useRole.ts` to check MFI status via LoanOrigination instead of WarehouseReceipt:
```typescript
"use client";

import { useAccount } from "wagmi";
import { useIsWarehouseAgent } from "./useWarehouseReceipt";
import { useIsAuthorizedMfi } from "./useLoanOrigination";

export type Role = "farmer" | "agent" | "mfi" | "unverified" | "loading";

/** Determine the role of the connected wallet address.
 *  Agent = registered in WarehouseReceipt.warehouseAgents
 *  MFI = authorized in LoanOrigination.authorizedMfis
 *  Farmer = connected but not agent or mfi
 */
export function useRole(): { role: Role; isLoading: boolean } {
  const { address, isConnected } = useAccount();
  const { data: isAgent, isLoading: agentLoading } = useIsWarehouseAgent(address);
  const { data: isMfi, isLoading: mfiLoading } = useIsAuthorizedMfi(address);

  if (!isConnected || !address) return { role: "unverified", isLoading: false };
  if (agentLoading || mfiLoading) return { role: "loading", isLoading: true };

  if (isAgent) return { role: "agent", isLoading: false };
  if (isMfi) return { role: "mfi", isLoading: false };
  return { role: "farmer", isLoading: false };
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useMockUSDC.ts frontend/src/hooks/useLoanOrigination.ts frontend/src/hooks/useYieldVault.ts frontend/src/hooks/useRole.ts
git commit -m "feat(frontend): add USDC, LoanOrigination, YieldVault hooks and update role detection"
```

---

### Task 10: StatsBar Component

**Files:**
- Create: `frontend/src/components/StatsBar.tsx`

- [ ] **Step 1: Write StatsBar component**

`frontend/src/components/StatsBar.tsx`:
```typescript
"use client";

import { useTotalSupply } from "@/hooks/useWarehouseReceipt";
import { useActiveLoanCount, usePoolBalance } from "@/hooks/useLoanOrigination";
import { useVaultTotalAssets, useVaultApy } from "@/hooks/useYieldVault";

function formatUsd(val: bigint | undefined): string {
  if (val === undefined) return "—";
  // USDC has 6 decimals
  const formatted = Number(val) / 1_000_000;
  if (formatted >= 1000) return "$" + (formatted / 1000).toFixed(1) + "K";
  return "$" + formatted.toFixed(0);
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">
        {value}
        {suffix && <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

export function StatsBar() {
  const { data: totalSupply } = useTotalSupply();
  const { data: activeLoans } = useActiveLoanCount();
  const { data: poolBalance } = usePoolBalance();
  const { data: vaultTotal } = useVaultTotalAssets();
  const { data: apyBps } = useVaultApy();

  const loanPoolBalance = poolBalance ?? 0n;
  const yieldPoolBalance = vaultTotal ?? 0n;
  const totalVaultLocked = loanPoolBalance + yieldPoolBalance;

  const apyPct = apyBps !== undefined ? (Number(apyBps) / 100).toFixed(1) : "—";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Total Value Locked" value={formatUsd(totalVaultLocked)} />
      <StatCard label="Active Loans" value={activeLoans?.toString() ?? "0"} />
      <StatCard label="Receipts Issued" value={totalSupply?.toString() ?? "0"} />
      <StatCard label="Yield APY" value={apyPct} suffix="%" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/StatsBar.tsx
git commit -m "feat(frontend): add StatsBar component with TVL, loans, receipts, APY"
```

---

### Task 11: LoanCard Component

**Files:**
- Create: `frontend/src/components/LoanCard.tsx`

- [ ] **Step 1: Write LoanCard component**

`frontend/src/components/LoanCard.tsx`:
```typescript
"use client";

import { type ReceiptData } from "@/config/contracts";
import { StatusBadge } from "./StatusBadge";
import { useLoanInfo, useActivateLoan, useDefaultLoan } from "@/hooks/useLoanOrigination";
import { useUSDCAllowance, useUSDCApprove, MOCK_USDC_ADDRESS } from "@/hooks/useMockUSDC";
import { LOAN_ORIGINATION_ADDRESS } from "@/hooks/useLoanOrigination";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

function formatUsd(val: bigint): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(val) / 1_000_000
  );
}

interface LoanCardProps {
  receipt: ReceiptData;
  role: string;
}

export function LoanCard({ receipt, role }: LoanCardProps) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { data: loanInfo } = useLoanInfo(receipt.tokenId);
  const { data: allowance } = useUSDCAllowance(address, LOAN_ORIGINATION_ADDRESS);

  const { writeContract: writeActivate } = useActivateLoan();
  const { writeContract: writeRepay } = useUSDCApprove();
  const { writeContract: writeDefault } = useDefaultLoan();

  const isActive = loanInfo && (loanInfo as { active: boolean }).active;
  const loanAmount = loanInfo ? (loanInfo as { amount: bigint }).amount : 0n;

  const handleActivate = useCallback(() => {
    writeActivate({
      address: LOAN_ORIGINATION_ADDRESS,
      abi: (await import("@/config/contracts")).LOAN_ORIGINATION_ABI,
      functionName: "activateLoan",
      args: [BigInt(receipt.tokenId)],
    });
  }, [receipt.tokenId, writeActivate]);

  const handleRepay = useCallback(async () => {
    // First approve USDC transfer if needed
    const loanAmt = (await import("@/config/contracts")).LOAN_ORIGINATION_ABI
      ? BigInt(receipt.estimatedValueUsd) // We know the amount from receipt
      : 0n;

    if (!allowance || allowance < loanAmt) {
      await writeRepay({
        address: MOCK_USDC_ADDRESS,
        abi: (await import("@/config/contracts")).MOCK_USDC_ABI,
        functionName: "approve",
        args: [LOAN_ORIGINATION_ADDRESS, loanAmt],
      });
    }

    // Then repay
    writeRepay({
      address: LOAN_ORIGINATION_ADDRESS,
      abi: (await import("@/config/contracts")).LOAN_ORIGINATION_ABI,
      functionName: "repayLoan",
      args: [BigInt(receipt.tokenId)],
    });
  }, [receipt.tokenId, receipt.estimatedValueUsd, allowance, writeRepay]);

  const handleDefault = useCallback(() => {
    writeDefault({
      address: LOAN_ORIGINATION_ADDRESS,
      abi: (await import("@/config/contracts")).LOAN_ORIGINATION_ABI,
      functionName: "defaultLoan",
      args: [BigInt(receipt.tokenId)],
    });
  }, [receipt.tokenId, writeDefault]);

  if (!isActive) return null;

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-gray-400 font-mono">#{receipt.tokenId}</span>
          <h3 className="text-lg font-semibold text-gray-900">
            {receipt.cropType.slice(0, 10)} Loan
          </h3>
        </div>
        <StatusBadge status={receipt.status} />
      </div>

      <div className="space-y-1.5 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Loan Amount</span>
          <span className="font-medium text-gray-900">{formatUsd(loanAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Collateral</span>
          <span className="font-medium text-gray-900">{receipt.quantityKg.toString()} kg</span>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {role === "farmer" && (
          <button
            onClick={handleRepay}
            className="flex-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            Repay Loan
          </button>
        )}
        {role === "mfi" && (
          <button
            onClick={handleDefault}
            className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Mark Default
          </button>
        )}
      </div>
    </div>
  );
}
```

Wait, I used `await import` in the callbacks which is wrong for this pattern. Let me fix — the write contract calls need the ABI statically. Let me rewrite properly.

- [ ] **Step 1 (corrected): Write LoanCard component**

`frontend/src/components/LoanCard.tsx`:
```typescript
"use client";

import { useAccount } from "wagmi";
import { type ReceiptData } from "@/config/contracts";
import { StatusBadge } from "./StatusBadge";
import {
  LOAN_ORIGINATION_ABI,
  LOAN_ORIGINATION_ADDRESS,
  useLoanInfo,
  useActivateLoan,
  useRepayLoan,
  useDefaultLoan,
} from "@/hooks/useLoanOrigination";
import { MOCK_USDC_ABI, MOCK_USDC_ADDRESS, useUSDCAllowance, useUSDCApprove } from "@/hooks/useMockUSDC";

function formatUsd(val: bigint): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(val) / 1_000_000
  );
}

interface LoanCardProps {
  receipt: ReceiptData;
  role: string;
}

export function LoanCard({ receipt, role }: LoanCardProps) {
  const { address } = useAccount();
  const { data: loanInfo } = useLoanInfo(receipt.tokenId);
  const { data: allowance } = useUSDCAllowance(address, LOAN_ORIGINATION_ADDRESS);

  const { writeContract: writeActivate } = useActivateLoan();
  const { writeContract: writeApprove } = useUSDCApprove();
  const { writeContract: writeLoanRepay } = useRepayLoan();
  const { writeContract: writeDefault } = useDefaultLoan();

  const isActive = loanInfo ? (loanInfo as { active: boolean }).active : false;
  const loanAmount = loanInfo ? (loanInfo as { amount: bigint }).amount : 0n;

  const handleActivate = () => {
    writeActivate({
      address: LOAN_ORIGINATION_ADDRESS,
      abi: LOAN_ORIGINATION_ABI,
      functionName: "activateLoan",
      args: [BigInt(receipt.tokenId)],
    });
  };

  const handleRepay = () => {
    // Check if approval needed (amount to repay is the original loan amount)
    const repayAmount = BigInt(receipt.estimatedValueUsd);
    if (!allowance || allowance < repayAmount) {
      writeApprove({
        address: MOCK_USDC_ADDRESS,
        abi: MOCK_USDC_ABI,
        functionName: "approve",
        args: [LOAN_ORIGINATION_ADDRESS, repayAmount],
      });
    } else {
      writeLoanRepay({
        address: LOAN_ORIGINATION_ADDRESS,
        abi: LOAN_ORIGINATION_ABI,
        functionName: "repayLoan",
        args: [BigInt(receipt.tokenId)],
      });
    }
  };

  const handleDefault = () => {
    writeDefault({
      address: LOAN_ORIGINATION_ADDRESS,
      abi: LOAN_ORIGINATION_ABI,
      functionName: "defaultLoan",
      args: [BigInt(receipt.tokenId)],
    });
  };

  if (!isActive) return null;

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-gray-400 font-mono">#{receipt.tokenId}</span>
          <h3 className="text-lg font-semibold text-gray-900">Crop Loan</h3>
        </div>
        <StatusBadge status={receipt.status} />
      </div>

      <div className="space-y-1.5 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Loan Amount</span>
          <span className="font-medium text-gray-900">{formatUsd(loanAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Collateral</span>
          <span className="font-medium text-gray-900">{receipt.quantityKg.toString()} kg</span>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {role === "farmer" && (
          <button
            onClick={handleRepay}
            className="flex-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            Repay Loan
          </button>
        )}
        {role === "mfi" && (
          <button
            onClick={handleDefault}
            className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Mark Default
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/LoanCard.tsx
git commit -m "feat(frontend): add LoanCard component with repay/default actions"
```

---

### Task 12: Dashboard Page Rewrite

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Rewrite page.tsx with live data and write flows**

Replace entire `frontend/src/app/page.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { LoginButton } from "@/components/LoginButton";
import { ReceiptCard } from "@/components/ReceiptCard";
import { StatsBar } from "@/components/StatsBar";
import { LoanCard } from "@/components/LoanCard";
import { useRole } from "@/hooks/useRole";
import { useTotalSupply, useReceipt } from "@/hooks/useWarehouseReceipt";
import { useIsWarehouseAgent } from "@/hooks/useWarehouseReceipt";
import { useIsAuthorizedMfi, LOAN_ORIGINATION_ABI, LOAN_ORIGINATION_ADDRESS } from "@/hooks/useLoanOrigination";
import { useVaultBalance, useVaultTotalAssets, useVaultApy, YIELD_VAULT_ADDRESS, YIELD_VAULT_ABI } from "@/hooks/useYieldVault";
import { MOCK_USDC_ABI, MOCK_USDC_ADDRESS, useUSDCBalance, useUSDCAllowance } from "@/hooks/useMockUSDC";
import {
  WAREHOUSE_RECEIPT_WRITE_ABI,
  CONTRACT_ADDRESSES,
  RECEIPT_STATUS,
  type ReceiptData,
} from "@/config/contracts";
import { useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

// ─── Navbar ──────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-emerald-700">AgriVault</span>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Avalanche</span>
        </div>
        <LoginButton />
      </div>
    </nav>
  );
}

// ─── Role Banner ─────────────────────────────────────────────

function RoleBanner({ role }: { role: string }) {
  const banners: Record<string, { emoji: string; title: string; desc: string }> = {
    agent: {
      emoji: "\u{1F3DB}️",
      title: "Warehouse Agent",
      desc: "Inspect deposits and issue warehouse receipts to farmers.",
    },
    mfi: {
      emoji: "\u{1F3E6}",
      title: "MFI Manager",
      desc: "Activate loans, monitor repayments, and manage risk.",
    },
    farmer: {
      emoji: "\u{1F33E}",
      title: "Farmer",
      desc: "Your receipts serve as on-chain collateral for USDC loans.",
    },
    unverified: {
      emoji: "\u{1F464}",
      title: "Unverified",
      desc: "Connect your wallet and register as a participant.",
    },
  };
  const b = banners[role] ?? banners.unverified;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
      <span className="text-3xl">{b.emoji}</span>
      <div>
        <h2 className="font-semibold text-gray-900">{b.title}</h2>
        <p className="text-sm text-gray-500">{b.desc}</p>
      </div>
    </div>
  );
}

// ─── Section / Empty State ───────────────────────────────────

function SectionCard({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="col-span-full text-center py-12 text-gray-400">
      <p className="text-lg">{message}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

// ─── ReceiptById (wraps ReceiptCard with live data fetch) ─────

function ReceiptById({ tokenId, role }: { tokenId: number; role: string }) {
  const { data, isLoading, isError } = useReceipt(tokenId);
  if (isLoading) return <SkeletonCard />;
  if (isError || !data) return null;
  const receipt: ReceiptData = { ...(data as Omit<ReceiptData, "tokenId">), tokenId };
  return <ReceiptCard receipt={receipt} />;
}

// ─── LoanCardById (wraps LoanCard with live data fetch) ──────

function LoanCardById({ tokenId, role }: { tokenId: number; role: string }) {
  const { data, isLoading, isError } = useReceipt(tokenId);
  if (isLoading || isError || !data) return null;
  const receipt: ReceiptData = { ...(data as Omit<ReceiptData, "tokenId">), tokenId };
  return <LoanCard receipt={receipt} role={role} />;
}

// ─── Issue Receipt Form (Agent) ───────────────────────────────

function IssueReceiptForm({ onIssued }: { onIssued: () => void }) {
  const { writeContract } = useWriteContract();
  const queryClient = useQueryClient();
  const [farmer, setFarmer] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [estValue, setEstValue] = useState("");
  const [quality, setQuality] = useState("75");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const CROP_BYTES32 = "0x9a5e3d4c0a7d3f6b8e2c1a9b4d7e3f5c8a2b6d4e1f7a3c9b8e2d5f0a1b3c7d9";

  const handleSubmit = useCallback(async () => {
    if (!farmer || !quantityKg || !estValue) return;
    setIsSubmitting(true);
    const expiry = Math.floor(Date.now() / 1000) + 86400 * 60; // 60 days
    const warehouseId = ("0x" + Array.from(new TextEncoder().encode("WH-" + Date.now()))
      .map(b => b.toString(16).padStart(2, "0")).join("").padEnd(64, "0")) as `0x${string}`;

    writeContract({
      address: CONTRACT_ADDRESSES.warehouseReceipt,
      abi: WAREHOUSE_RECEIPT_WRITE_ABI,
      functionName: "issueReceipt",
      args: [
        farmer as `0x${string}`,
        BigInt(quantityKg),
        BigInt(expiry),
        warehouseId,
        CROP_BYTES32 as `0x${string}`,
        BigInt(Math.round(parseFloat(estValue) * 1_000_000)),
        BigInt(quality),
        "ipfs://QmPlaceholder",
      ],
    });
    // Reset after a short delay; real UX would wait for tx receipt
    setTimeout(() => {
      setFarmer("");
      setQuantityKg("");
      setEstValue("");
      setQuality("75");
      setIsSubmitting(false);
      queryClient.invalidateQueries();
      onIssued();
    }, 2000);
  }, [farmer, quantityKg, estValue, quality, writeContract, queryClient, onIssued]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">Issue New Receipt</h3>
      <div className="grid grid-cols-2 gap-3">
        <input
          className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Farmer Address (0x...)"
          value={farmer}
          onChange={(e) => setFarmer(e.target.value)}
        />
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Quantity (kg)"
          type="number"
          value={quantityKg}
          onChange={(e) => setQuantityKg(e.target.value)}
        />
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Est. Value (USD)"
          type="number"
          value={estValue}
          onChange={(e) => setEstValue(e.target.value)}
        />
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Quality Score (0-100)"
          type="number"
          min={0}
          max={100}
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !farmer || !quantityKg || !estValue}
        className="w-full px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 text-sm"
      >
        {isSubmitting ? "Submitting..." : "Issue Receipt"}
      </button>
    </div>
  );
}

// ─── Yield Pool Section ──────────────────────────────────────

function YieldSection({ address }: { address: `0x${string}` }) {
  const { writeContract } = useWriteContract();
  const { data: userBalance } = useVaultBalance(address);
  const { data: totalAssets } = useVaultTotalAssets();
  const { data: apyBps } = useVaultApy();
  const { data: usdcBalance } = useUSDCBalance(address);
  const { data: allowance } = useUSDCAllowance(address, YIELD_VAULT_ADDRESS);
  const [amount, setAmount] = useState("");

  const apyPct = apyBps !== undefined ? (Number(apyBps) / 100).toFixed(1) : "—";
  const userBal = userBalance ? (Number(userBalance) / 1_000_000).toFixed(2) : "0.00";
  const totalBal = totalAssets ? (Number(totalAssets) / 1_000_000).toFixed(2) : "0.00";
  const walletBal = usdcBalance ? (Number(usdcBalance) / 1_000_000).toFixed(2) : "0.00";

  const handleDeposit = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const depositAmount = BigInt(Math.round(parseFloat(amount) * 1_000_000));

    // Approve if needed
    if (!allowance || allowance < depositAmount) {
      writeContract({
        address: MOCK_USDC_ADDRESS,
        abi: MOCK_USDC_ABI,
        functionName: "approve",
        args: [YIELD_VAULT_ADDRESS, depositAmount],
      });
    }

    writeContract({
      address: YIELD_VAULT_ADDRESS,
      abi: YIELD_VAULT_ABI,
      functionName: "deposit",
      args: [depositAmount],
    });
  };

  const handleWithdraw = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const withdrawAmount = BigInt(Math.round(parseFloat(amount) * 1_000_000));
    writeContract({
      address: YIELD_VAULT_ADDRESS,
      abi: YIELD_VAULT_ABI,
      functionName: "withdraw",
      args: [withdrawAmount],
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Yield Pool</h3>
        <span className="text-sm text-emerald-600 font-medium">{apyPct}% APY</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-gray-500">Pool</p>
          <p className="text-lg font-semibold text-gray-900">{totalBal} USDC</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-gray-500">Your Deposit</p>
          <p className="text-lg font-semibold text-gray-900">{userBal} USDC</p>
        </div>
      </div>

      <p className="text-xs text-gray-400">Wallet: {walletBal} USDC</p>

      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Amount (USDC)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          onClick={handleDeposit}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          Deposit
        </button>
        <button
          onClick={handleWithdraw}
          className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition"
        >
          Withdraw
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────

export default function Dashboard() {
  const { isConnected, address } = useAccount();
  const { role, isLoading } = useRole();
  const { data: totalSupply } = useTotalSupply();

  // Build list of token IDs from total supply
  const supplyCount = Number(totalSupply ?? 0);
  const tokenIds = Array.from({ length: supplyCount }, (_, i) => i);

  // Filter receipts by role (we fetch them individually in ReceiptById)
  // For agent: show all (filter by Issued status happens on-chain or we do it here)
  // For MFI: show Issued receipts for activation
  // For farmer: show owned receipts

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {!isConnected ? (
          <div className="text-center py-24">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">AgriVault</h1>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Digital warehouse receipts on Avalanche. Bypassing Malawi&apos;s forex shortage with
              stablecoin-collateralized micro-loans for smallholder farmers.
            </p>
            <LoginButton />
          </div>
        ) : isLoading ? (
          <div className="text-center py-24 text-gray-400">Loading your role...</div>
        ) : (
          <>
            <RoleBanner role={role} />
            <StatsBar />

            {/* Farmer: My Receipts */}
            <SectionCard title="My Receipts" count={tokenIds.length}>
              {tokenIds.length === 0 ? (
                <EmptyState message="No receipts yet. Visit a warehouse agent to deposit your harvest." />
              ) : (
                tokenIds.map((id) => <ReceiptById key={id} tokenId={id} role={role} />)
              )}
            </SectionCard>

            {/* Agent: Unverified Deposits + Issue Form */}
            {role === "agent" && (
              <>
                <SectionCard title="Unverified Deposits" count={tokenIds.length}>
                  {tokenIds.length === 0 ? (
                    <EmptyState message="No pending deposits." />
                  ) : (
                    tokenIds.map((id) => <ReceiptById key={id} tokenId={id} role={role} />)
                  )}
                </SectionCard>
                <IssueReceiptForm onIssued={() => {}} />
              </>
            )}

            {/* MFI: Pending Approvals */}
            {role === "mfi" && (
              <SectionCard title="Pending Loan Approvals" count={tokenIds.length}>
                {tokenIds.length === 0 ? (
                  <EmptyState message="No receipts waiting for approval." />
                ) : (
                  tokenIds.map((id) => <ReceiptById key={id} tokenId={id} role={role} />)
                )}
              </SectionCard>
            )}

            {/* Active Loans (farmer + MFI) — LoanCardById internally fetches receipt data and renders only active loans */}
            {tokenIds.length > 0 && (
              <SectionCard title="Active Loans" count={tokenIds.length}>
                {tokenIds.map((id) => (
                  <LoanCardById key={id} tokenId={id} role={role} />
                ))}
              </SectionCard>
            )}

            {/* Yield Pool (farmers) */}
            {role === "farmer" && address && <YieldSection address={address} />}
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(frontend): rewrite dashboard with live contract reads, write flows, StatsBar, LoanCard, Yield pool"
```

---

### Task 13: Verify Build

- [ ] **Step 1: Build the frontend**

Run:
```bash
cd frontend
npx next build
```
Expected: Successful build with no TypeScript errors.

- [ ] **Step 2: Run all Hardhat tests**

Run:
```bash
npx hardhat test
```
Expected: All ~58 tests passing.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: fix build and test issues"
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| MockUSDC with 6 decimals + faucet | Task 1 |
| LoanOrigination contract (activate, repay, default) | Task 3 |
| LoanOrigination tests | Task 4 |
| YieldVault deposit pool | Task 5 |
| YieldVault tests | Task 5 |
| Full loan integration test | Task 6 |
| Updated deploy script | Task 7 |
| New contract ABIs in config | Task 8 |
| useMockUSDC hook | Task 9 |
| useLoanOrigination hook | Task 9 |
| useYieldVault hook | Task 9 |
| Role detection via LoanOrigination | Task 9 (useRole update) |
| StatsBar component (TVL, loans, receipts, APY) | Task 10 |
| LoanCard component (repay/default) | Task 11 |
| Live data dashboard (no mock data) | Task 12 |
| Issue receipt form (Agent flow) | Task 12 |
| Yield pool section (deposit/withdraw) | Task 12 |
