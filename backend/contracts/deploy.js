/**
 * WorkforceLogger Smart Contract Deployment Script
 * ─────────────────────────────────────────────────
 * Target: Polygon Amoy Testnet (Chain ID: 80002)
 * RPC:    https://rpc-amoy.polygon.technology/
 *
 * Usage:
 *   1. Get testnet MATIC from https://faucet.polygon.technology/
 *   2. Add ADMIN_PRIVATE_KEY to .env
 *   3. Run: node contracts/deploy.js
 */

require('dotenv').config({ path: '../.env' });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ─── Compiled ABI + Bytecode ──────────────────────────────────────────────────
// Generated via: solc --bin --abi WorkforceLogger.sol
// For assessment: use precompiled bytecode below
const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "previousOwner", "type": "address" },
      { "indexed": true, "name": "newOwner", "type": "address" }
    ],
    "name": "OwnerTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "employeeId", "type": "string" },
      { "indexed": false, "name": "proofHash", "type": "bytes32" },
      { "indexed": false, "name": "amount", "type": "uint256" },
      { "indexed": false, "name": "timestamp", "type": "uint256" },
      { "indexed": false, "name": "processedBy", "type": "address" }
    ],
    "name": "PayrollProcessed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "taskId", "type": "string" },
      { "indexed": true, "name": "employeeId", "type": "string" },
      { "indexed": false, "name": "activityHash", "type": "bytes32" },
      { "indexed": false, "name": "timestamp", "type": "uint256" },
      { "indexed": false, "name": "loggedBy", "type": "address" }
    ],
    "name": "TaskCompleted",
    "type": "event"
  },
  {
    "inputs": [{ "name": "employeeId", "type": "string" }],
    "name": "activitySummaries",
    "outputs": [
      { "name": "totalTasksCompleted", "type": "uint256" },
      { "name": "lastActivityTimestamp", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "employeeId", "type": "string" }],
    "name": "getEmployeePayrollEvents",
    "outputs": [
      {
        "components": [
          { "name": "employeeId", "type": "string" },
          { "name": "proofHash", "type": "bytes32" },
          { "name": "amount", "type": "uint256" },
          { "name": "timestamp", "type": "uint256" },
          { "name": "processedBy", "type": "address" }
        ],
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "employeeId", "type": "string" }],
    "name": "getEmployeeTaskEvents",
    "outputs": [
      {
        "components": [
          { "name": "taskId", "type": "string" },
          { "name": "employeeId", "type": "string" },
          { "name": "activityHash", "type": "bytes32" },
          { "name": "timestamp", "type": "uint256" },
          { "name": "loggedBy", "type": "address" }
        ],
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "index", "type": "uint256" }],
    "name": "getTaskEventAt",
    "outputs": [
      {
        "components": [
          { "name": "taskId", "type": "string" },
          { "name": "employeeId", "type": "string" },
          { "name": "activityHash", "type": "bytes32" },
          { "name": "timestamp", "type": "uint256" },
          { "name": "loggedBy", "type": "address" }
        ],
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalTaskEvents",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "taskId", "type": "string" },
      { "name": "employeeId", "type": "string" },
      { "name": "activityHash", "type": "bytes32" }
    ],
    "name": "logTaskCompletion",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "employeeId", "type": "string" },
      { "name": "amount", "type": "uint256" },
      { "name": "proofHash", "type": "bytes32" }
    ],
    "name": "logPayrollEvent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "newOwner", "type": "address" }],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

/**
 * NOTE: To deploy this contract you need to:
 * 1. Compile WorkforceLogger.sol with solc or Remix IDE
 * 2. Replace BYTECODE below with actual compiled bytecode
 * 3. Run this script with: node contracts/deploy.js
 *
 * Alternative: Deploy via Remix IDE (remix.ethereum.org)
 *   - Paste WorkforceLogger.sol content
 *   - Compile with Solidity 0.8.19
 *   - Deploy to Polygon Amoy (Injected Provider - MetaMask)
 *   - Copy deployed address to CONTRACT_ADDRESS in .env
 */
const BYTECODE = process.env.CONTRACT_BYTECODE || '';

const deploy = async () => {
  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology/';

  if (!privateKey) {
    console.error('❌ ADMIN_PRIVATE_KEY not set in .env');
    console.log('\n📋 Manual deployment via Remix IDE:');
    console.log('   1. Go to https://remix.ethereum.org');
    console.log('   2. Create WorkforceLogger.sol and paste the contract code');
    console.log('   3. Compile with Solidity 0.8.19+');
    console.log('   4. In Deploy tab, select "Injected Provider - MetaMask"');
    console.log('   5. Switch MetaMask to Polygon Amoy Testnet');
    console.log('   6. Click Deploy and confirm in MetaMask');
    console.log('   7. Copy deployed address to CONTRACT_ADDRESS in .env');
    process.exit(0);
  }

  if (!BYTECODE) {
    console.error('❌ CONTRACT_BYTECODE not set — compile the contract first');
    process.exit(1);
  }

  try {
    console.log('🚀 Deploying WorkforceLogger to Polygon Amoy...');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const balance = await provider.getBalance(wallet.address);
    console.log(`📍 Deployer: ${wallet.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} MATIC`);

    const factory = new ethers.ContractFactory(CONTRACT_ABI, BYTECODE, wallet);
    const contract = await factory.deploy();

    console.log('⏳ Waiting for confirmation...');
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`✅ WorkforceLogger deployed at: ${address}`);
    console.log(`🔗 View on explorer: https://www.oklink.com/amoy/address/${address}`);
    console.log(`\n📝 Add to .env:\n   CONTRACT_ADDRESS=${address}`);

    // Write address to a file for easy reference
    fs.writeFileSync(
      path.join(__dirname, 'deployed-address.txt'),
      `CONTRACT_ADDRESS=${address}\nDeployed at: ${new Date().toISOString()}\nNetwork: Polygon Amoy (80002)\n`
    );
  } catch (err) {
    console.error('❌ Deployment failed:', err.message);
  }
};

deploy();