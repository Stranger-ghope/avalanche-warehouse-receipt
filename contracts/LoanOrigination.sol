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
