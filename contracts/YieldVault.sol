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
