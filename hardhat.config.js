require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.11",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    dev: {
      url: "http://127.0.0.1:7545",
      mnemonic:
        "door unveil brother rigid iron answer mom balance water south spring virtual",
    },
    testnet: {
      url: "https://speedy-nodes-nyc.moralis.io/29a5230395957178e7f37874/bsc/testnet",
      chainId: 97,
      gas: 21000000,
      accounts: [
        `0x90859b0573d47262a135035b68a5f5a129cb5f8983b7b6c27ae2ea9d3175b4ad`,
      ],
      blockGasLimit: 2100000000,
      timeout: 60000,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: "HNZI6PWZJI994ZTWZCMCS22G2J8FX47P62",
  },
  mocha: {
    timeout: 4000000,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
