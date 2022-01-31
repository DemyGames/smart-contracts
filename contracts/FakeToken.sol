// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FakeToken is ERC20 {
    constructor() public ERC20("Fake BUSD Token", "BUSD") {
        _mint(address(this), 0);
    }

    function claim() public {
        _mint(msg.sender, 10000 * (10**18));
    }
}
