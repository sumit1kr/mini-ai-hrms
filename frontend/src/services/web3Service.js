import api from './api';

/**
 * Connect wallet address to user profile
 */
export const connectWalletToProfile = async (walletAddress) => {
  return api.post('/web3/connect-wallet', { walletAddress });
};

/**
 * Disconnect wallet from user profile
 */
export const disconnectWalletFromProfile = async () => {
  return api.post('/web3/disconnect-wallet');
};

/**
 * Get blockchain status
 */
export const getBlockchainStatus = async () => {
  return api.get('/web3/status');
};

/**
 * Get my blockchain activity logs
 */
export const getMyBlockchainLogs = async () => {
  return api.get('/web3/my-blockchain-logs');
};

/**
 * Get blockchain activity for a specific user (admin only)
 */
export const getUserBlockchainActivity = async (userId) => {
  return api.get(`/web3/activity/${userId}`);
};

/**
 * Get all organization blockchain logs (admin only)
 */
export const getOrgBlockchainLogs = async () => {
  return api.get('/web3/org-logs');
};
