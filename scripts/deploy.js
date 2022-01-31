// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const FakeToken = await hre.ethers.getContractFactory("FakeToken");
  const fakeToken = await FakeToken.deploy();

  await fakeToken.deployed();

  const TokenVestingFactory = await hre.ethers.getContractFactory(
    "TokenVestingFactory"
  );
  const tokenVestingFactory = await TokenVestingFactory.deploy();

  await tokenVestingFactory.deployed();

  console.log("Token vesting deployed to:", tokenVestingFactory.address);

  const DemyToken = await hre.ethers.getContractFactory("DemyToken");
  const demyToken = await DemyToken.deploy(
    tokenVestingFactory.address,
    fakeToken.address
  );
  await demyToken.deployed();
  await fakeToken.claim();
  await fakeToken.approve(demyToken.address, 10000000000000);
  await demyToken.buy(1);
  const balance = await demyToken.balanceOf(demyToken.address);
  console.log("Balance:", balance);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
