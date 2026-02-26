/**
 * Web3 Workforce Logging Service
 * ─────────────────────────────────────────────────────────────────
 * Handles all blockchain interactions with the WorkforceLogger contract
 * on Polygon Amoy Testnet. Gracefully degrades if not configured.
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const { query } = require('../config/db');
const logger = require('../config/logger');

// ─── Contract ABI (functions used by this service) ───────────────────────────
const CONTRACT_ABI = [
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
    "inputs": [],
    "name": "getTotalTaskEvents",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
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
  }
];

class Web3Service {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.signer = null;
    this.initialized = false;
    this.contractAddress = null;
    this._init();
  }

  /**
   * Initialize the provider, signer and contract instance
   */
  async _init() {
    const { POLYGON_RPC_URL, ADMIN_PRIVATE_KEY, CONTRACT_ADDRESS } = process.env;

    // Graceful degradation: blockchain is optional
    if (!POLYGON_RPC_URL || !ADMIN_PRIVATE_KEY || !CONTRACT_ADDRESS ||
        CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      logger.warn('Web3: Blockchain logging disabled (contract not configured). Set ADMIN_PRIVATE_KEY and CONTRACT_ADDRESS in .env to enable.');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
      this.signer = new ethers.Wallet(ADMIN_PRIVATE_KEY, this.provider);
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.signer);
      this.contractAddress = CONTRACT_ADDRESS;
      this.initialized = true;

      const network = await this.provider.getNetwork();
      logger.info(`Web3: Connected to chain ${network.chainId} (${network.name}), contract: ${CONTRACT_ADDRESS}`);
    } catch (err) {
      logger.error('Web3: Initialization failed — blockchain logging disabled:', err.message);
    }
  }

  /**
   * Generate a deterministic SHA-256 activity hash
   * @param {string} taskId
   * @param {string} employeeId
   * @param {number} timestamp
   * @returns {string} hex string (32 bytes)
   */
  generateActivityHash(taskId, employeeId, timestamp) {
    return crypto
      .createHash('sha256')
      .update(`${taskId}:${employeeId}:${timestamp}`)
      .digest('hex');
  }

  /**
   * Generate a payroll proof hash
   * @param {string} employeeId
   * @param {number} amount
   * @param {number} timestamp
   */
  generatePayrollProofHash(employeeId, amount, timestamp) {
    return crypto
      .createHash('sha256')
      .update(`payroll:${employeeId}:${amount}:${timestamp}`)
      .digest('hex');
  }

  /**
   * Log task completion event on Polygon blockchain
   * @param {string} taskId   - HRMS task UUID
   * @param {string} employeeId - HRMS employee UUID
   * @returns {Promise<Object>} result with txHash and activityHash
   */
  async logTaskCompletion(taskId, employeeId) {
    if (!this.initialized) {
      logger.info(`Web3: Skipping blockchain log for task ${taskId} (not configured)`);
      return { success: false, reason: 'blockchain_not_configured' };
    }

    try {
      const timestamp = Date.now();
      const hashHex = this.generateActivityHash(taskId, employeeId, timestamp);
      // Convert 32-byte hex to bytes32
      const activityHashBytes32 = `0x${hashHex}`;

      logger.info(`Web3: Logging task completion on-chain: task=${taskId}, emp=${employeeId}`);

      // Estimate gas first to detect issues early
      const gasEstimate = await this.contract.logTaskCompletion.estimateGas(
        taskId,
        employeeId,
        activityHashBytes32
      );

      const tx = await this.contract.logTaskCompletion(
        taskId,
        employeeId,
        activityHashBytes32,
        { gasLimit: gasEstimate * 12n / 10n } // 20% buffer
      );

      logger.info(`Web3: TX submitted: ${tx.hash}`);
      const receipt = await tx.wait(1); // wait 1 confirmation

      // Persist to database
      await query(
        `INSERT INTO blockchain_logs (user_id, event_type, transaction_hash, block_number, activity_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT DO NOTHING`,
        [employeeId, 'task_completion', receipt.hash, receipt.blockNumber.toString(), hashHex]
      );

      logger.info(`Web3: Task completion logged — tx: ${receipt.hash}, block: ${receipt.blockNumber}`);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        activityHash: hashHex,
        explorerUrl: `https://www.oklink.com/amoy/tx/${receipt.hash}`,
      };
    } catch (err) {
      logger.error(`Web3: Task completion log failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Log payroll event on Polygon blockchain
   * @param {string} employeeId
   * @param {number} amountCents  - payment amount in cents
   */
  async logPayrollEvent(employeeId, amountCents) {
    if (!this.initialized) {
      return { success: false, reason: 'blockchain_not_configured' };
    }

    try {
      const timestamp = Date.now();
      const proofHashHex = this.generatePayrollProofHash(employeeId, amountCents, timestamp);
      const proofHashBytes32 = `0x${proofHashHex}`;

      const gasEstimate = await this.contract.logPayrollEvent.estimateGas(
        employeeId,
        amountCents,
        proofHashBytes32
      );

      const tx = await this.contract.logPayrollEvent(
        employeeId,
        amountCents,
        proofHashBytes32,
        { gasLimit: gasEstimate * 12n / 10n }
      );

      const receipt = await tx.wait(1);

      await query(
        `INSERT INTO blockchain_logs (user_id, event_type, transaction_hash, block_number, activity_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [employeeId, 'payroll_event', receipt.hash, receipt.blockNumber.toString(), proofHashHex]
      );

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        proofHash: proofHashHex,
        explorerUrl: `https://www.oklink.com/amoy/tx/${receipt.hash}`,
      };
    } catch (err) {
      logger.error(`Web3: Payroll log failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get on-chain task events for an employee (read-only, no gas)
   */
  async getEmployeeChainActivity(employeeId) {
    if (!this.initialized) return null;

    try {
      const events = await this.contract.getEmployeeTaskEvents(employeeId);
      const summary = await this.contract.activitySummaries(employeeId);
      return {
        events: events.map((e) => ({
          taskId: e.taskId,
          activityHash: e.activityHash,
          timestamp: new Date(Number(e.timestamp) * 1000).toISOString(),
          loggedBy: e.loggedBy,
        })),
        totalCompleted: Number(summary.totalTasksCompleted),
        lastActivity: summary.lastActivityTimestamp > 0
          ? new Date(Number(summary.lastActivityTimestamp) * 1000).toISOString()
          : null,
      };
    } catch (err) {
      logger.error('Web3: Get chain activity failed:', err.message);
      return null;
    }
  }

  /**
   * Check if blockchain logging is active
   */
  isActive() {
    return this.initialized;
  }

  /**
   * Get service status for health checks
   */
  getStatus() {
    return {
      enabled: this.initialized,
      network: this.initialized ? 'Polygon Amoy Testnet' : null,
      contract: this.contractAddress,
      explorerBase: 'https://www.oklink.com/amoy',
    };
  }
}

// Singleton instance
const web3Service = new Web3Service();
module.exports = web3Service;