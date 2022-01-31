// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.11;
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Whitelist.sol";

interface IVestingFactory {
    function deployVesting(
        address beneficiary,
        uint256 start,
        uint256 cliffDuration,
        uint256 duration,
        bool revocable,
        uint256 amount,
        IERC20 token,
        bytes32 salt,
        address owner,
        address tokenHolder
    ) external returns (address vestingAddress);
}

contract DemyToken is ERC20, Whitelist {
    uint256 private mockTime = 0; //TODO: delete this!
    IERC20 public tokenBUSD;
    using SafeMath for uint256;
    struct LockedBalance {
        address _address;
        uint256 _cliff;
        uint256 _start;
        uint256 _duration;
        uint256 _balance;
        uint256 _initDate;
    }

    mapping(uint8 => LockedBalance) public lockedAccounts;
    mapping(address => uint256) private _released;

    address public immutable liquidityAddress;
    address public immutable ecosystemAddress;
    address public immutable partnershipsAddress;
    address public immutable advisorsAddress;
    address public immutable teamAddress;
    uint256 public immutable maxSupply;
    uint256 private constant PERCENTAGE_FOR_SEED_MAX = 310;
    uint256 private constant PERCENTAGE_FOR_PRESALE_MAX = 640;
    uint256 private constant PERCENTAGE_FOR_LP = 630;
    uint256 private constant PERCENTAGE_FOR_ECOSYSTEM = 600;
    uint256 private constant PERCENTAGE_FOR_PARTNERSHIPS = 900;
    uint256 private constant PERCENTAGE_FOR_ADVISORS = 200;
    uint256 private constant PERCENTAGE_FOR_TEAM = 960;
    uint256 private constant TGE_FOR_PRESALE = 2000;
    uint256 private constant LOCKED_FOR_PRESALE = 8000;
    uint256 private constant TGE_FOR_PARTNERSHIPS = 1000;
    uint256 private constant TGE_FOR_ADVISORS = 1000;
    uint256 private constant PERCENTS_DIVIDER = 10000;
    uint256 public constant PRESALE_PRICE = 14000000000000000; // $0.014
    uint256 private preSaleAvailableBalance;
    uint256 private seederAvailableBalance;
    uint256 private liquidityAvailableBalance;
    address public immutable vestingFactoryAddress;
    address public stakeContractAddress;
    bool public seedersInitialized = false;

    event TokensReleased(address beneficiary, uint256 amount);
    event TokensPresaled(address buyer, uint256 amount);
    event MintedForLiquidity(uint256 amount);
    modifier onlyStakeContract() {
        require(
            msg.sender == stakeContractAddress,
            "Only stake contract can call this"
        );
        _;
    }

    constructor(
        uint256 _maxSupply,
        address _liquidityAddress,
        address _ecosystemAddress,
        address _partnershipsAddress,
        address _advisorsAddress,
        address _teamAddress,
        address _vestingFactoryAddress,
        address _busdAddress
    ) ERC20("Demy Token", "DEMY2") {
        maxSupply = _maxSupply;
        preSaleAvailableBalance = maxSupply.div(PERCENTS_DIVIDER).mul(
            PERCENTAGE_FOR_PRESALE_MAX
        );
        seederAvailableBalance = maxSupply.div(PERCENTS_DIVIDER).mul(
            PERCENTAGE_FOR_SEED_MAX
        );
        liquidityAvailableBalance = maxSupply.div(PERCENTS_DIVIDER).mul(
            PERCENTAGE_FOR_LP
        );
        liquidityAddress = _liquidityAddress;
        ecosystemAddress = _ecosystemAddress;
        partnershipsAddress = _partnershipsAddress;
        advisorsAddress = _advisorsAddress;
        teamAddress = _teamAddress;
        tokenBUSD = IERC20(_busdAddress);
        vestingFactoryAddress = _vestingFactoryAddress;
        uint256 mintForLiq = liquidityAvailableBalance.div(100).mul(2);
        liquidityAvailableBalance = liquidityAvailableBalance.sub(mintForLiq);
        _mint(liquidityAddress, mintForLiq); //TODO: 2% for the first phase
        _approve(
            address(this),
            vestingFactoryAddress,
            preSaleAvailableBalance.add(seederAvailableBalance)
        );
        uint256 advisorsMax = maxSupply.div(PERCENTS_DIVIDER).mul(
            PERCENTAGE_FOR_ADVISORS
        );
        uint256 advisorsTGE = advisorsMax.mul(TGE_FOR_ADVISORS).div(
            PERCENTS_DIVIDER
        );
        _mint(advisorsAddress, advisorsTGE);
        advisorsMax = advisorsMax.sub(advisorsTGE);
        // [address, clif, start, duration, amount]
        // ecosystem
        lockedAccounts[0] = LockedBalance(
            ecosystemAddress,
            0,
            72 weeks,
            80 weeks,
            maxSupply.div(PERCENTS_DIVIDER).mul(PERCENTAGE_FOR_ECOSYSTEM),
            getCurrentTime()
        );
        // partnerships
        lockedAccounts[1] = LockedBalance(
            partnershipsAddress,
            0,
            48 weeks,
            80 weeks,
            maxSupply.div(PERCENTS_DIVIDER).mul(PERCENTAGE_FOR_PARTNERSHIPS),
            getCurrentTime()
        );
        // team
        lockedAccounts[2] = LockedBalance(
            teamAddress,
            0,
            48 weeks,
            40 weeks,
            maxSupply.div(PERCENTS_DIVIDER).mul(PERCENTAGE_FOR_TEAM),
            getCurrentTime()
        );
        // advisors
        lockedAccounts[3] = LockedBalance(
            advisorsAddress,
            0,
            0,
            40 weeks,
            advisorsMax,
            getCurrentTime()
        );
    }

    function setStakeContract(address _address) public onlyOwner {
        stakeContractAddress = _address;
    }

    function mintForStakeContract(uint256 _amount)
        public
        onlyStakeContract
        returns (bool status)
    {
        require(totalSupply().add(_amount) <= maxSupply, "MAX SUPPLY");
        _mint(stakeContractAddress, _amount);
        return true;
    }

    function _calculateReleasableBalances(uint8 i)
        internal
        view
        returns (uint256 _amount)
    {
        uint256 amount;
        LockedBalance memory lockedAccount = lockedAccounts[i];
        lockedAccount._start = lockedAccount._start.add(
            lockedAccount._initDate
        );
        uint256 totalBalance = lockedAccount._balance +
            _released[lockedAccount._address];
        if (getCurrentTime() <= lockedAccount._start + lockedAccount._cliff) {
            amount = 0;
        } else if (
            getCurrentTime() >=
            lockedAccount._start.add(lockedAccount._duration)
        ) {
            amount = lockedAccount._balance;
        } else {
            amount =
                ((totalBalance * (getCurrentTime().sub(lockedAccount._start))) /
                    lockedAccount._duration) -
                _released[lockedAccount._address];
        }
        return amount;
    }

    function getLockedBalances(uint8 i)
        public
        view
        returns (
            address _address,
            uint256 _cliff,
            uint256 _start,
            uint256 _duration,
            uint256 _balance,
            uint256 released,
            uint256 releasable,
            uint256 _initDate
        )
    {
        LockedBalance memory lockedAccount = lockedAccounts[i];
        uint256 released_ = _released[lockedAccount._address];
        uint256 releasable_ = _calculateReleasableBalances(i);

        return (
            lockedAccount._address,
            lockedAccount._cliff,
            lockedAccount._start,
            lockedAccount._duration,
            lockedAccount._balance,
            released_,
            releasable_,
            lockedAccount._initDate
        );
    }

    function releaseLockedBalances() external onlyOwner {
        uint8 i = 0;
        while (i < 4) {
            uint256 amount = _calculateReleasableBalances(i);
            if (amount > 0) {
                LockedBalance memory lockedAccount = lockedAccounts[i];
                require(lockedAccount._balance >= amount, "Release error!");
                lockedAccounts[i]._balance = lockedAccount._balance.sub(amount);
                _mint(lockedAccount._address, amount);
                _released[lockedAccount._address] = _released[
                    lockedAccount._address
                ].add(amount);
                emit TokensReleased(lockedAccount._address, amount);
            }
            i += 1;
        }
    }

    function mintForLiquidity(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater then 0");
        require(
            amount <= liquidityAvailableBalance,
            "Not enough tokens in the reserve"
        );
        liquidityAvailableBalance = liquidityAvailableBalance.sub(amount);
        _mint(liquidityAddress, amount);
        emit MintedForLiquidity(amount);
    }

    function initSeeders(
        address[] memory seeders,
        uint256[] memory valuesOfSeeders
    ) external onlyOwner {
        require(
            seeders.length == valuesOfSeeders.length,
            "Lengths must be same!"
        );
        require(!seedersInitialized, "Already Initialized!");
        uint256 i = 0;
        while (i < seeders.length) {
            addSeeder(seeders[i], valuesOfSeeders[i]);
            i += 1;
        }
        seedersInitialized = true;
    }

    function addSeeder(address _seederAddress, uint256 amount)
        internal
        returns (address vestingAddress)
    {
        require(
            seederAvailableBalance >= amount,
            "Not enough tokens in the reserve"
        );
        seederAvailableBalance = seederAvailableBalance.sub(amount);
        _mint(address(this), amount);
        bytes32 salt = keccak256(
            abi.encodePacked(_seederAddress, address(this))
        );
        return
            IVestingFactory(vestingFactoryAddress).deployVesting(
                _seederAddress,
                getCurrentTime(),
                24 weeks,
                80 weeks,
                false,
                amount,
                this,
                salt,
                address(this),
                address(this)
            );
    }

    function buy(uint256 amount)
        public
        onlyWhitelisted
        returns (address vestingAddress)
    {
        require(amount > 0, "Amount must be greater then 0");
        uint256 busdBalance = tokenBUSD.balanceOf(address(msg.sender));
        uint256 cost = amount.mul(PRESALE_PRICE);
        require(busdBalance > cost, "Not enough BUSD balance!");
        require(
            tokenBUSD.allowance(address(msg.sender), address(this)) >= cost,
            "BUSD allowance too low"
        );
        require(
            amount <= preSaleAvailableBalance,
            "Not enough tokens in the reserve"
        );

        preSaleAvailableBalance = preSaleAvailableBalance.sub(cost);
        _safeTransferFrom(tokenBUSD, msg.sender, address(this), cost);
        uint256 lockedAmount = amount.mul(10**18).div(PERCENTS_DIVIDER).mul(
            LOCKED_FOR_PRESALE
        );
        uint256 releasedAmount = amount.mul(10**18).div(PERCENTS_DIVIDER).mul(
            TGE_FOR_PRESALE
        );
        _mint(msg.sender, releasedAmount);
        _mint(address(this), lockedAmount);
        emit TokensPresaled(msg.sender, amount);
        bytes32 salt = keccak256(abi.encodePacked(msg.sender, address(this)));
        return
            IVestingFactory(vestingFactoryAddress).deployVesting(
                msg.sender,
                getCurrentTime(),
                0,
                40 weeks,
                false,
                lockedAmount,
                this,
                salt,
                address(this),
                address(this)
            );
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

    function _safeTransferFrom(
        IERC20 token,
        address sender,
        address recipient,
        uint256 amount
    ) private {
        bool sent = token.transferFrom(sender, recipient, amount);
        require(sent, "Token transfer failed");
    }
}
