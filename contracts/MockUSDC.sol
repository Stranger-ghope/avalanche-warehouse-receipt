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
