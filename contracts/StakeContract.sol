// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.11;
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

interface IDemyToken is IERC20 {
    function mintForStakeContract(uint256 _amount)
        external
        returns (bool status);
}

contract StakeContract {
    using SafeMath for uint256;
    using SafeERC20 for IDemyToken;
    IDemyToken public immutable stakingToken;
    address public immutable stakingTokenAddress;
    uint256 private mockTime = 0;

    constructor(address _stakingToken) {
        stakeholders.push();
        stakingToken = IDemyToken(_stakingToken);
        stakingTokenAddress = _stakingToken;
    }

    struct Stake {
        address user;
        uint256 amount;
        uint256 since;
        uint256 claimable;
    }
    struct Unstake {
        uint256 balance;
        uint256 startedAt;
    }
    struct Stakeholder {
        address user;
        uint256 unstakedAt;
        uint256 unstakedAmount;
        Stake[] addressStakes;
    }
    struct StakingSummary {
        uint256 totalAmount;
        Stake[] stakes;
    }

    Stakeholder[] internal stakeholders;
    mapping(address => uint256) internal stakes;
    mapping(address => Unstake) internal balances;
    event Staked(
        address indexed user,
        uint256 amount,
        uint256 index,
        uint256 timestamp
    );
    event Unstaked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    uint256 internal immutable rewardPerDay = 38356;
    uint256 internal immutable rewardPerDayDivider = 100000000;

    function withdraw() public {
        Unstake storage user = balances[msg.sender];
        require(user.balance > 0, "You must unstake first");
        require(
            getCurrentTime() >= user.startedAt.add(7 days),
            "You must wait 7 days"
        );
        uint256 userIndex = stakes[msg.sender];
        stakeholders[userIndex].unstakedAt = 0;
        _transfer(msg.sender, user.balance);
        user.balance = 0;
        user.startedAt = 0;
        emit Withdrawn(msg.sender, user.balance);
    }

    function unstake(uint256 _amount) public {
        uint256 userIndex = stakes[msg.sender];
        uint256 length = stakeholders[userIndex].addressStakes.length;
        uint256 amount = _amount;
        uint256 totalAmount;
        require(
            stakeholders[userIndex].unstakedAt == 0,
            "You have an active unstake countdown"
        );
        require(length > 0, "You must stake first");
        uint256 totalStakeAmount;
        StakingSummary memory summary = StakingSummary(
            0,
            stakeholders[stakes[msg.sender]].addressStakes
        );
        for (uint256 s = 0; s < summary.stakes.length; s += 1) {
            totalStakeAmount = totalStakeAmount + summary.stakes[s].amount;
        }
        require(
            totalStakeAmount >= amount,
            "Staking: Cannot withdraw more than you have staked"
        );
        for (uint256 s = 0; s < length; s += 1) {
            Stake memory current = stakeholders[userIndex].addressStakes[s];

            if (amount > 0) {
                uint256 _unstaked;
                if (current.amount >= amount) {
                    _unstaked = _unstake(amount, s);
                } else {
                    _unstaked = _unstake(current.amount, s);
                }

                if (amount >= _unstaked) {
                    amount = amount.sub(_unstaked);
                    totalAmount = totalAmount.add(_unstaked);
                } else {
                    totalAmount = totalAmount.add(amount);
                    amount = 0;
                }
            }
        }
        balances[msg.sender] = Unstake(totalAmount, getCurrentTime());
        stakeholders[userIndex].unstakedAt = getCurrentTime();
        stakeholders[userIndex].unstakedAmount = totalAmount;
        emit Unstaked(msg.sender, totalAmount);
    }

    function stake(uint256 _amount) public {
        require(
            _amount <= stakingToken.balanceOf(msg.sender),
            "Cannot stake more than you own"
        );
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        _stake(_amount);
    }

    function claim() public {
        uint256 userIndex = stakes[msg.sender];
        uint256 totalReward;
        for (
            uint256 s = 0;
            s < stakeholders[userIndex].addressStakes.length;
            s += 1
        ) {
            totalReward += _unstake(0, s);
        }
        _transfer(msg.sender, totalReward);
        emit RewardClaimed(msg.sender, totalReward);
    }

    function _addStakeholder(address staker) internal returns (uint256) {
        stakeholders.push();
        uint256 userIndex = stakeholders.length - 1;
        stakeholders[userIndex].user = staker;
        stakes[staker] = userIndex;
        return userIndex;
    }

    function _stake(uint256 _amount) internal {
        require(_amount > 0, "Cannot stake nothing");
        uint256 index = stakes[msg.sender];
        uint256 timestamp = getCurrentTime();
        if (index == 0) {
            index = _addStakeholder(msg.sender);
        }
        stakeholders[index].addressStakes.push(
            Stake(msg.sender, _amount, timestamp, 0)
        );
        emit Staked(msg.sender, _amount, index, timestamp);
    }

    function calculateStakeReward(Stake memory _currentStake)
        internal
        view
        returns (uint256)
    {
        return
            (getCurrentTime().sub(_currentStake.since))
                .mul(rewardPerDay)
                .div(1 days)
                .mul(_currentStake.amount)
                .div(rewardPerDayDivider);
    }

    function _unstake(uint256 amount, uint256 index)
        internal
        returns (uint256)
    {
        uint256 userIndex = stakes[msg.sender];
        Stake memory currentStake = stakeholders[userIndex].addressStakes[
            index
        ];
        require(
            currentStake.amount >= amount,
            "Staking: Cannot withdraw more than you have staked"
        );
        uint256 reward = calculateStakeReward(currentStake);
        currentStake.amount = currentStake.amount - amount;
        if (currentStake.amount == 0) {
            delete stakeholders[userIndex].addressStakes[index];
        } else {
            stakeholders[userIndex].addressStakes[index].amount = currentStake
                .amount;
            stakeholders[userIndex]
                .addressStakes[index]
                .since = getCurrentTime();
        }
        return amount + reward;
    }

    function getUnstakeDetail(address _staker)
        public
        view
        returns (Unstake memory user)
    {
        Unstake memory _user = balances[_staker];
        return _user;
    }

    function hasStake(address _staker)
        public
        view
        returns (StakingSummary memory)
    {
        uint256 totalStakeAmount;
        StakingSummary memory summary = StakingSummary(
            0,
            stakeholders[stakes[_staker]].addressStakes
        );
        for (uint256 s = 0; s < summary.stakes.length; s += 1) {
            uint256 availableReward = calculateStakeReward(summary.stakes[s]);
            summary.stakes[s].claimable = availableReward;
            totalStakeAmount = totalStakeAmount + summary.stakes[s].amount;
        }
        summary.totalAmount = totalStakeAmount;
        return summary;
    }

    function getCurrentTime() public view virtual returns (uint256) {
        if (mockTime == 0) {
            return block.timestamp;
        }
        return mockTime;
    }

    function setCurrentTime(uint256 _time) external {
        mockTime = _time;
    }

    function _transfer(address to, uint256 amount) private {
        require(amount > 0, "Cannot transfer nothing");
        uint256 thisBalance = stakingToken.balanceOf(address(this));
        if (thisBalance < amount) {
            uint256 _diff = amount.sub(thisBalance);
            require(
                stakingToken.mintForStakeContract(_diff) == true,
                "reverted"
            );
        }
        stakingToken.safeTransfer(to, amount);
    }
}
