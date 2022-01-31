const { expect } = require("chai");
const { ethers } = require("hardhat");
const buyAmount = 100;
const maxSupplyP = "5000000000000000000000000000";
const maxSupply = ethers.BigNumber.from(maxSupplyP);

const [liqAddr, ecoAddr, psAddr, advAddr, teamAddr] = [
  "0x94223537465337bF2a563cCC389cd9EcC749a7BC",
  "0x80e387A2644A3B94Be313F1E316c39EaF519EfC7",
  "0x9e5C658602333cE2c87f32379E746A6EFAC53781",
  "0xc382D0c2c3f3Fc93af09CABd1bE5E5A7b83758A3",
  "0x6aE30109DfD91B9D448a3dfE55e978c5f70C4D59",
];
before(async function () {
  [this.owner, this.spender, this.spender2, this.spender3] =
    await ethers.getSigners();
  this.FakeToken = await ethers.getContractFactory("FakeToken");
  this.fakeToken = await this.FakeToken.deploy();
  await this.fakeToken.deployed();

  this.TokenVestingFactory = await ethers.getContractFactory(
    "TokenVestingFactory"
  );
  this.tokenVestingFactory = await this.TokenVestingFactory.deploy();

  await this.tokenVestingFactory.deployed();
  this.DemyToken = await ethers.getContractFactory("DemyToken");
  this.demyToken = await this.DemyToken.deploy(
    maxSupply,
    liqAddr,
    ecoAddr,
    psAddr,
    advAddr,
    teamAddr,
    this.tokenVestingFactory.address,
    this.fakeToken.address
  );
  await this.demyToken.deployed();
  this.VestingContract = await ethers.getContractFactory("TokenVesting");
  this.StakeContract = await ethers.getContractFactory("StakeContract");
  this.stakeContract = await this.StakeContract.deploy(this.demyToken.address);
});
describe("Demy Token", function () {
  const allowanceAmount =
    "115792089237316195423570985008687907853269984665640564039457584007913129639935";
  it("Should fake token allowed for main token contract", async function () {
    await this.fakeToken.claim();
    await this.fakeToken.connect(this.spender).claim();
    await this.fakeToken.connect(this.spender2).claim();
    await this.fakeToken.connect(this.spender3).claim();
    await this.fakeToken.approve(this.demyToken.address, allowanceAmount);
    await this.fakeToken
      .connect(this.spender)
      .approve(this.demyToken.address, allowanceAmount);
    await this.fakeToken
      .connect(this.spender2)
      .approve(this.demyToken.address, allowanceAmount);
    await this.fakeToken
      .connect(this.spender3)
      .approve(this.demyToken.address, allowanceAmount);
    expect(
      await this.fakeToken.allowance(this.owner.address, this.demyToken.address)
    ).to.equal(allowanceAmount);
  });
  it("Should init seeders", async function () {
    await this.demyToken.initSeeders(
      [this.spender2.address, this.spender3.address],
      [5, 10]
    );
    expect(await this.demyToken.seedersInitialized()).to.equal(true);
  });

  describe("Pre-sale", async function () {
    it("Should couldn't buy pre-sale demy tokens", async function () {
      await expect(
        this.demyToken.connect(this.spender).buy(buyAmount)
      ).to.be.revertedWith("Only white listed accounts");
      await expect(this.demyToken.buy(buyAmount)).to.be.revertedWith(
        "Only white listed accounts"
      );
    });
    it("Should could buy pre-sale demy tokens", async function () {
      await this.demyToken.addAddressToWhitelist(this.spender.address);
      await this.demyToken.connect(this.spender).buy(buyAmount);
      expect(await this.demyToken.balanceOf(this.spender.address)).to.equal(
        (((buyAmount * 20) / 100) * 10 ** 18).toString()
      );
    });
    it("Should could buy pre-sale demy tokens by owner", async function () {
      await this.demyToken.addAddressToWhitelist(this.owner.address);
      await this.demyToken.buy(buyAmount);
      expect(await this.demyToken.balanceOf(this.owner.address)).to.equal(
        (((buyAmount * 20) / 100) * 10 ** 18).toString()
      );
    });
  });

  describe("Only Owner can access", function () {
    it("Should addaddresstowhitelist function couldn't access without owner", async function () {
      await expect(
        this.demyToken
          .connect(this.spender2)
          .addAddressToWhitelist(this.owner.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Should releaseLockedBalances function couldn't access without owner", async function () {
      await this.demyToken.addAddressToWhitelist(this.owner.address);
      await expect(
        this.demyToken.connect(this.spender2).releaseLockedBalances()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Should mintForLiquidity couldn't access without owner", async function () {
      await expect(
        this.demyToken.connect(this.spender2).mintForLiquidity(523020)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Should setStakeContract couldn't access without owner", async function () {
      await expect(
        this.demyToken
          .connect(this.spender2)
          .setStakeContract(this.owner.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  describe("Vesting for presale", function () {
    it("Should be same address for owner", async function () {
      this.vestingAddress = await this.tokenVestingFactory.getVestingAddress(
        this.owner.address
      );
      this.vestingContract = await this.VestingContract.attach(
        this.vestingAddress
      );
      expect(await this.vestingContract.beneficiary()).to.equal(
        this.owner.address
      );
    });
    it("Should be same address for spender", async function () {
      this.vestingAddress = await this.tokenVestingFactory.getVestingAddress(
        this.spender.address
      );
      this.vestingContract = await this.VestingContract.attach(
        this.vestingAddress
      );
      expect(await this.vestingContract.beneficiary()).to.equal(
        this.spender.address
      );
    });
    it("Should be locked accounts balance equal to 80% of bought amount for owner", async function () {
      this.vestingAddress = await this.tokenVestingFactory.getVestingAddress(
        this.owner.address
      );
      this.vestingContract = await this.VestingContract.attach(
        this.vestingAddress
      );
      expect(await this.demyToken.balanceOf(this.vestingAddress)).to.equal(
        (((buyAmount * 80) / 100) * 10 ** 18).toString()
      );
    });
    it("Should be locked accounts balance equal to 80% of bought amount for spender", async function () {
      this.vestingAddress = await this.tokenVestingFactory.getVestingAddress(
        this.spender.address
      );
      this.vestingContract = await this.VestingContract.attach(
        this.vestingAddress
      );
      expect(await this.demyToken.balanceOf(this.vestingAddress)).to.equal(
        (((buyAmount * 80) / 100) * 10 ** 18).toString()
      );
    });
    it("Should be releasable amount", async function () {
      this.vestingAddress = await this.tokenVestingFactory.getVestingAddress(
        this.owner.address
      );
      this.vestingContract = await this.VestingContract.attach(
        this.vestingAddress
      );
      this.vestingContract.setCurrentTime(Math.floor(Date.now() / 100) * 2);
      expect(
        await this.vestingContract.vestedAmount(this.demyToken.address)
      ).to.equal((((buyAmount * 80) / 100) * 10 ** 18).toString());
    });
    it("Should be completely released for owner", async function () {
      this.vestingAddress = await this.tokenVestingFactory.getVestingAddress(
        this.owner.address
      );
      this.vestingContract = await this.VestingContract.attach(
        this.vestingAddress
      );
      await this.vestingContract.setCurrentTime(
        Math.floor(Date.now() / 1000) * 2
      );
      await this.vestingContract.release(this.demyToken.address);
      expect(await this.demyToken.balanceOf(this.owner.address)).to.equal(
        (buyAmount * 10 ** 18).toString()
      );
    });
  });
  describe("Locked Balances", function () {
    it("Should be staff balances equal as expected after mint phase", async function () {
      expect(await this.demyToken.balanceOf(liqAddr)).to.equal(
        maxSupply.mul(63).div(1000).mul(2).div(100)
      );
      expect(await this.demyToken.balanceOf(ecoAddr)).to.equal("0");
      expect(await this.demyToken.balanceOf(psAddr)).to.equal("0");
      expect(await this.demyToken.balanceOf(advAddr)).to.equal(
        maxSupply.mul(2).div(100).mul(10).div(100)
      );
      expect(await this.demyToken.balanceOf(teamAddr)).to.equal("0");

      const ecosystemL = await this.demyToken.getLockedBalances(0);
      const partnershipsL = await this.demyToken.getLockedBalances(1);
      const teamL = await this.demyToken.getLockedBalances(2);
      const advisorsL = await this.demyToken.getLockedBalances(3);
      expect(ecosystemL._balance).to.equal(maxSupply.mul(60).div(1000));
      expect(ecosystemL.released).to.equal(0);
      expect(partnershipsL._balance).to.equal(maxSupply.mul(90).div(1000));
      // expect(partnershipsL.released).to.equal(0);
      expect(teamL._balance).to.equal(maxSupply.mul(96).div(1000));
      // expect(teamL.released).to.equal(0);
      expect(advisorsL._balance).to.equal(
        maxSupply.mul(20).div(1000).mul(9).div(10)
      );
      // expect(advisorsL.released).to.equal(0);
    });
    it("Should be ecosystem account balance equal after 1 month", async function () {
      const z = await this.demyToken.getLockedBalances(0);
      this.demyToken.setCurrentTime(z._initDate.add(2419200));
      await this.demyToken.releaseLockedBalances();
      expect(await this.demyToken.balanceOf(ecoAddr)).to.equal(0);
      expect(z.releasable).to.equal(0);
      expect(z._balance).to.equal(maxSupply.mul(6).div(100));
      expect(z.released).to.equal(0);
    });
    it("Should be advisors account balance equal after 1 month", async function () {
      const y = await this.demyToken.getLockedBalances(3);
      this.demyToken.setCurrentTime(y._initDate.add(2419200));
      await this.demyToken.releaseLockedBalances();
      const z = await this.demyToken.getLockedBalances(3);
      const currentTime = await this.demyToken.getCurrentTime();
      const amount = maxSupply
        .mul(20)
        .div(1000)
        .mul(9)
        .div(10)
        .div(y._duration)
        .mul(currentTime.sub(y._initDate));

      const balance = await this.demyToken.balanceOf(advAddr);
      expect(Math.floor(ethers.utils.formatEther(balance))).to.equal(
        Math.floor(
          ethers.utils.formatEther(
            maxSupply.mul(20).div(1000).mul(1).div(10).add(amount)
          )
        )
      );
      expect(Math.floor(ethers.utils.formatEther(z._balance))).to.equal(
        Math.floor(
          ethers.utils.formatEther(
            maxSupply.mul(20).div(1000).mul(9).div(10).sub(amount)
          )
        )
      );
    });
    it("Should be ecosystem account balance equal after 16 month", async function () {
      const z = await this.demyToken.getLockedBalances(0);
      this.demyToken.setCurrentTime(z._initDate.add(2419200 * 16));
      await this.demyToken.releaseLockedBalances();
      expect(await this.demyToken.balanceOf(ecoAddr)).to.equal(0);
      expect(z.releasable).to.equal(0);
      expect(z._balance).to.equal(maxSupply.mul(6).div(100));
      expect(z.released).to.equal(0);
    });

    it("Should be advisors account balance equal after 16 month", async function () {
      const y = await this.demyToken.getLockedBalances(3);
      this.demyToken.setCurrentTime(y._initDate.add(2419200 * 16));
      await this.demyToken.releaseLockedBalances();
      const z = await this.demyToken.getLockedBalances(3);
      const currentTime = await this.demyToken.getCurrentTime();
      const amount = maxSupply
        .mul(20)
        .div(1000)
        .mul(9)
        .div(10)
        .div(y._duration)
        .mul(currentTime.sub(y._start));
      expect(Math.floor(ethers.utils.formatEther(z._balance))).to.gt(
        Math.floor(
          ethers.utils.formatEther(
            maxSupply.mul(20).div(1000).mul(9).div(10).sub(amount)
          )
        )
      );
    });

    it("Should be ecosystem account balance equal after 18 month", async function () {
      const z = await this.demyToken.getLockedBalances(0);
      this.demyToken.setCurrentTime(z._initDate.add(2419200 * 18));
      await this.demyToken.releaseLockedBalances();
      const y = await this.demyToken.getLockedBalances(0);
      const balance = await this.demyToken.balanceOf(ecoAddr);
      expect(Math.floor(balance)).to.equal(0);
      expect(y.releasable).to.equal(0);
      expect(y.released).to.equal(balance);
      expect(y._balance).to.equal(maxSupply.mul(60).div(1000).sub(balance));
    });

    it("Should be ecosystem account balance equal after 20 month", async function () {
      const z = await this.demyToken.getLockedBalances(0);
      this.demyToken.setCurrentTime(z._initDate.add(2419200 * 20));
      await this.demyToken.releaseLockedBalances();
      const y = await this.demyToken.getLockedBalances(0);
      const currentTime = await this.demyToken.getCurrentTime();
      const amount = maxSupply
        .mul(60)
        .div(1000)
        .div(y._duration)
        .mul(currentTime.sub(y._start.add(y._initDate)));
      const balance = await this.demyToken.balanceOf(ecoAddr);
      expect(Math.floor(balance)).to.equal(Math.floor(amount));
      expect(y.releasable).to.equal(0);
      expect(y.released).to.equal(balance);
      expect(y._balance).to.equal(maxSupply.mul(60).div(1000).sub(balance));
    });
    it("Should be staff balances equal as expected after final release", async function () {
      this.demyToken.setCurrentTime(Math.floor(Date.now() / 100) * 2);
      await this.demyToken.releaseLockedBalances();
      const ecosystemL = await this.demyToken.getLockedBalances(0);
      const partnershipsL = await this.demyToken.getLockedBalances(1);
      const teamL = await this.demyToken.getLockedBalances(2);
      const advisorsL = await this.demyToken.getLockedBalances(3);
      expect(await this.demyToken.balanceOf(ecoAddr)).to.equal(
        maxSupply.mul(60).div(1000)
      );
      expect(ecosystemL.releasable).to.equal(0);
      expect(ecosystemL._balance).to.equal(0);
      expect(ecosystemL.released).to.equal(maxSupply.mul(60).div(1000));

      expect(await this.demyToken.balanceOf(psAddr)).to.equal(
        maxSupply.mul(90).div(1000)
      );
      expect(partnershipsL.releasable).to.equal(0);
      expect(partnershipsL._balance).to.equal(0);
      expect(partnershipsL.released).to.equal(maxSupply.mul(90).div(1000));

      expect(await this.demyToken.balanceOf(teamAddr)).to.equal(
        maxSupply.mul(96).div(1000)
      );
      expect(teamL.releasable).to.equal(0);
      expect(teamL._balance).to.equal(0);
      expect(teamL.released).to.equal(maxSupply.mul(96).div(1000));

      expect(await this.demyToken.balanceOf(advAddr)).to.equal(
        maxSupply.mul(20).div(1000)
      );
      expect(advisorsL.releasable).to.equal(0);
      expect(advisorsL._balance).to.equal(0);
      expect(advisorsL.released).to.equal(
        maxSupply.mul(20).div(1000).mul(9).div(10)
      );
    });
  });
  describe("Stake Contract", function () {
    it("Should be deployed", async function () {
      expect(await this.stakeContract.stakingTokenAddress()).to.equal(
        this.demyToken.address
      );
    });
    it("Should be setted", async function () {
      await expect(this.demyToken.setStakeContract(this.stakeContract.address))
        .to.not.reverted;
    });
    it("Should demy token allowed for stake contract", async function () {
      await this.demyToken.approve(this.stakeContract.address, allowanceAmount);
      await this.demyToken
        .connect(this.spender)
        .approve(this.stakeContract.address, allowanceAmount);
      await this.demyToken
        .connect(this.spender2)
        .approve(this.stakeContract.address, allowanceAmount);
      expect(
        await this.demyToken.allowance(
          this.owner.address,
          this.stakeContract.address
        )
      ).to.equal(allowanceAmount);
      expect(
        await this.demyToken
          .connect(this.spender)
          .allowance(this.spender.address, this.stakeContract.address)
      ).to.equal(allowanceAmount);
      expect(
        await this.demyToken
          .connect(this.spender2)
          .allowance(this.spender2.address, this.stakeContract.address)
      ).to.equal(allowanceAmount);
      expect(
        await this.demyToken
          .connect(this.spender3)
          .allowance(this.spender3.address, this.stakeContract.address)
      ).to.equal(0);
    });
    it("Should be staked", async function () {
      this.stakeContract.stake(1000);
      const stakes = await this.stakeContract.hasStake(this.owner.address);
      const stakesAlt = await this.stakeContract.hasStake(this.spender.address);
      expect(stakes.stakes.length).to.equal(1);
      expect(stakesAlt.stakes.length).to.equal(0);
      const stakeContractBalance = await this.demyToken.balanceOf(
        this.stakeContract.address
      );
      expect(stakeContractBalance).to.equal(1000);
      await expect(
        this.stakeContract.connect(this.spender3).stake(1)
      ).to.be.revertedWith("Cannot stake more than you own");
    });
    it("Should be stake rewards are correct", async function () {
      const stakes = await this.stakeContract.hasStake(this.owner.address);
      expect(stakes.stakes[0].claimable).to.equal(0);
      await this.stakeContract.setCurrentTime(
        stakes.stakes[0].since.add(31536000)
      );
    });
    it("Should be stake rewards are correct after 1 month", async function () {
      const stakes = await this.stakeContract.hasStake(this.owner.address);
      await this.stakeContract.setCurrentTime(
        stakes.stakes[0].since.add(31536000 / 12)
      );
      const stakesNew = await this.stakeContract.hasStake(this.owner.address);
      expect(stakesNew.stakes[0].claimable).to.equal(Math.floor(139 / 12));
    });
    it("Should be stake rewards are correct after 1 year", async function () {
      const stakes = await this.stakeContract.hasStake(this.owner.address);
      await this.stakeContract.setCurrentTime(
        stakes.stakes[0].since.add(31536000)
      );
      const stakesNew = await this.stakeContract.hasStake(this.owner.address);
      expect(stakesNew.stakes[0].claimable).to.equal(139);
    });
    it("Should be reward was claimed after 1 year", async function () {
      const balance = await this.demyToken.balanceOf(this.owner.address);
      const stakes = await this.stakeContract.hasStake(this.owner.address);
      await this.stakeContract.setCurrentTime(
        stakes.stakes[0].since.add(31536000)
      );
      await this.stakeContract.claim();
      const stakesNew2 = await this.stakeContract.hasStake(this.owner.address);
      const balanceNew = await this.demyToken.balanceOf(this.owner.address);
      expect(stakesNew2.stakes[0].claimable).to.equal(0);
      expect(balanceNew).to.equal(balance.add(139));
    });
    it("Should be staked again", async function () {
      this.stakeContract.stake(1000);
      const stakes = await this.stakeContract.hasStake(this.owner.address);
      const stakesAlt = await this.stakeContract.hasStake(this.spender.address);
      expect(stakes.stakes.length).to.equal(2);
      expect(stakesAlt.stakes.length).to.equal(0);
      const stakeContractBalance = await this.demyToken.balanceOf(
        this.stakeContract.address
      );
      expect(stakeContractBalance).to.equal(1861);
    });
    it("Should be couldn't unstake", async function () {
      await expect(this.stakeContract.unstake(23213123)).to.be.revertedWith(
        "Staking: Cannot withdraw more than you have staked"
      );
      await expect(
        this.stakeContract.connect(this.spender).unstake(1)
      ).to.be.revertedWith("You must stake first");
    });
    it("Should be partially unstaked after 6 months", async function () {
      const stakes = await this.stakeContract.hasStake(this.owner.address);
      const stakeAmount = 250;
      await this.stakeContract.setCurrentTime(
        stakes.stakes[0].since.add(31536000 / 2)
      );
      await this.stakeContract.unstake(stakeAmount);
      const stakesNew = await this.stakeContract.hasStake(this.owner.address);
      expect(stakesNew.stakes[0].claimable).to.equal(0);
      expect(stakesNew.totalAmount).to.equal(
        stakes.totalAmount.sub(stakeAmount)
      );
      const detail = await this.stakeContract.getUnstakeDetail(
        this.owner.address
      );
      expect(detail.balance).to.equal(stakeAmount);
      await expect(this.stakeContract.unstake(stakeAmount)).to.be.revertedWith(
        "You have an active unstake countdown"
      );
    });
    it("Should be stakes have withdrawn", async function () {
      const balance = await this.demyToken.balanceOf(this.owner.address);
      await expect(
        this.stakeContract.connect(this.spender).withdraw()
      ).to.be.revertedWith("You must unstake first");
      const detail = await this.stakeContract.getUnstakeDetail(
        this.owner.address
      );
      await expect(this.stakeContract.withdraw()).to.be.revertedWith(
        "You must wait 7 days"
      );
      await this.stakeContract.setCurrentTime(detail.startedAt.add(604800));
      await expect(this.stakeContract.withdraw()).to.not.revertedWith(
        "You must wait 7 days"
      );
      const balanceNew = await this.demyToken.balanceOf(this.owner.address);
      expect(balanceNew.sub(balance)).to.equal(250);
    });
    it("Should be unstaked again", async function () {
      const stakeAmount = 1750;
      await expect(this.stakeContract.unstake(1751)).to.be.revertedWith(
        "Staking: Cannot withdraw more than you have staked"
      );
      await this.stakeContract.unstake(stakeAmount);
      await expect(this.stakeContract.unstake(1)).to.be.revertedWith(
        "You have an active unstake countdown"
      );
    });
    it("Should be stakes have withdrawn again", async function () {
      const balance = await this.demyToken.balanceOf(this.owner.address);
      await expect(
        this.stakeContract.connect(this.spender).withdraw()
      ).to.be.revertedWith("You must unstake first");
      const detail = await this.stakeContract.getUnstakeDetail(
        this.owner.address
      );
      await expect(this.stakeContract.withdraw()).to.be.revertedWith(
        "You must wait 7 days"
      );
      await this.stakeContract.setCurrentTime(detail.startedAt.add(604800));
      await expect(this.stakeContract.withdraw()).to.not.reverted;
      const balanceNew = await this.demyToken.balanceOf(this.owner.address);
      expect(balanceNew.sub(balance)).to.equal(1750);
    });
  });
});
