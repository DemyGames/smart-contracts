// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TokenVesting is Ownable {
    using SafeERC20 for IERC20;
    event TokensReleased(address token, uint256 amount);
    event TokenVestingRevoked(address token);
    address private _beneficiary;
    uint256 private _cliff;
    uint256 private _start;
    uint256 private _duration;
    bool private _revocable;
    mapping(address => uint256) private _released;
    mapping(address => bool) private _revoked;
    uint256 private mockTime;

    constructor(
        address beneficiary_,
        uint256 start_,
        uint256 cliffDuration_,
        uint256 duration_,
        bool revocable_
    ) {
        require(beneficiary_ != address(0), "TV: not valif b");
        require(cliffDuration_ <= duration_, "TV: cltd");
        require(duration_ > 0, "TokenVesting: duration is 0");
        require(start_ + duration_ > getCurrentTime(), "TV: ft b ct");

        _beneficiary = beneficiary_;
        _revocable = revocable_;
        _duration = duration_;
        _cliff = start_ + cliffDuration_;
        _start = start_;
    }

    function setCurrentTime(uint256 _time) external {
        mockTime = _time;
    }

    function getCurrentTime() internal view virtual returns (uint256) {
        if (mockTime == 0) {
            return block.timestamp;
        }
        return mockTime;
    }

    /**
     * @return the beneficiary of the tokens.
     */
    function beneficiary() public view returns (address) {
        return _beneficiary;
    }

    /**
     * @return the cliff time of the token vesting.
     */
    function cliff() public view returns (uint256) {
        return _cliff;
    }

    /**
     * @return the start time of the token vesting.
     */
    function start() public view returns (uint256) {
        return _start;
    }

    /**
     * @return the duration of the token vesting.
     */
    function duration() public view returns (uint256) {
        return _duration;
    }

    /**
     * @return true if the vesting is revocable.
     */
    function revocable() public view returns (bool) {
        return _revocable;
    }

    /**
     * @return the amount of the token released.
     */
    function released(address token) public view returns (uint256) {
        return _released[token];
    }

    /**
     * @return true if the token is revoked.
     */
    function revoked(address token) public view returns (bool) {
        return _revoked[token];
    }

    /**
     * @notice Transfers vested tokens to beneficiary.
     * @param token ERC20 token which is being vested
     */
    function release(IERC20 token) public {
        uint256 unreleased = _releasableAmount(token);

        require(unreleased > 0, "TokenVesting: no tokens are due");

        _released[address(token)] = _released[address(token)] + unreleased;

        token.safeTransfer(_beneficiary, unreleased);

        emit TokensReleased(address(token), unreleased);
    }

    function revoke(IERC20 token) public onlyOwner {
        require(_revocable, "TokenVesting: cannot revoke");
        require(!_revoked[address(token)], "token already revoked");

        uint256 balance = token.balanceOf(address(this));

        uint256 unreleased = _releasableAmount(token);
        uint256 refund = balance - unreleased;

        _revoked[address(token)] = true;

        token.safeTransfer(owner(), refund);

        emit TokenVestingRevoked(address(token));
    }

    function _releasableAmount(IERC20 token) private view returns (uint256) {
        return _vestedAmount(token) - _released[address(token)];
    }

    function _vestedAmount(IERC20 token) private view returns (uint256) {
        uint256 currentBalance = token.balanceOf(address(this));
        uint256 totalBalance = currentBalance + _released[address(token)];
        if (getCurrentTime() < _cliff) {
            return 0;
        } else if (
            getCurrentTime() >= _start + _duration || _revoked[address(token)]
        ) {
            return totalBalance;
        } else {
            return (totalBalance * (getCurrentTime() - _start)) / _duration;
        }
    }

    function releasableAmount(IERC20 token) public view returns (uint256) {
        return _releasableAmount(token);
    }

    function vestedAmount(IERC20 token) public view returns (uint256) {
        return _vestedAmount(token);
    }
}
