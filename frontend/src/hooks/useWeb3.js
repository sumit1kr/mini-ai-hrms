import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';

// Polygon Amoy Testnet configuration
const POLYGON_AMOY = {
  chainId: '0x13882',       // 80002 in hex
  chainName: 'Polygon Amoy Testnet',
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: ['https://rpc-amoy.polygon.technology/'],
  blockExplorerUrls: ['https://www.oklink.com/amoy'],
};

/**
 * useWeb3 — MetaMask wallet connection hook
 * Handles connect/disconnect, network switching, and account monitoring
 */
export const useWeb3 = () => {
  const [account, setAccount] = useState(() => localStorage.getItem('hrms_wallet') || null);
  const [provider, setProvider] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  const isMetaMaskInstalled = typeof window !== 'undefined' && Boolean(window.ethereum);

  // ─── Switch to Polygon Amoy ──────────────────────────────────────────────
  const switchToPolygonAmoy = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: POLYGON_AMOY.chainId }],
      });
    } catch (switchErr) {
      // Chain not added yet — add it
      if (switchErr.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [POLYGON_AMOY],
          });
        } catch (addErr) {
          throw new Error('Failed to add Polygon Amoy network to MetaMask');
        }
      } else {
        throw switchErr;
      }
    }
  }, []);

  // ─── Connect Wallet ──────────────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    if (!isMetaMaskInstalled) {
      setError('MetaMask not detected. Please install MetaMask to use blockchain features.');
      return null;
    }

    setIsConnecting(true);
    setError('');

    try {
      // Request accounts
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts.length) throw new Error('No accounts found');

      const address = accounts[0];

      // Switch to Polygon Amoy
      await switchToPolygonAmoy();

      // Create provider
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const network = await web3Provider.getNetwork();

      setProvider(web3Provider);
      setAccount(address);
      setChainId(network.chainId.toString());
      setIsCorrectNetwork(network.chainId === 80002n);

      localStorage.setItem('hrms_wallet', address);
      return address;
    } catch (err) {
      const msg = err.code === 4001
        ? 'Connection rejected by user'
        : err.message || 'Failed to connect wallet';
      setError(msg);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [isMetaMaskInstalled, switchToPolygonAmoy]);

  // ─── Disconnect Wallet ───────────────────────────────────────────────────
  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setChainId(null);
    setIsCorrectNetwork(false);
    setError('');
    localStorage.removeItem('hrms_wallet');
  }, []);

  // ─── Sign a message (for verification) ───────────────────────────────────
  const signMessage = useCallback(async (message) => {
    if (!provider) throw new Error('Wallet not connected');
    const signer = await provider.getSigner();
    return signer.signMessage(message);
  }, [provider]);

  // ─── Listen for account/chain changes ────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setAccount(accounts[0]);
        localStorage.setItem('hrms_wallet', accounts[0]);
      }
    };

    const handleChainChanged = (chainId) => {
      const decimal = parseInt(chainId, 16);
      setChainId(decimal.toString());
      setIsCorrectNetwork(decimal === 80002);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnectWallet]);

  // ─── Auto-connect if previously connected ────────────────────────────────
  useEffect(() => {
    const savedWallet = localStorage.getItem('hrms_wallet');
    if (savedWallet && window.ethereum) {
      // Silently check if still connected
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts) => {
          if (accounts.length && accounts[0].toLowerCase() === savedWallet.toLowerCase()) {
            const web3Provider = new ethers.BrowserProvider(window.ethereum);
            setProvider(web3Provider);
            setAccount(accounts[0]);
            web3Provider.getNetwork().then((n) => {
              setChainId(n.chainId.toString());
              setIsCorrectNetwork(n.chainId === 80002n);
            });
          } else {
            localStorage.removeItem('hrms_wallet');
            setAccount(null);
          }
        })
        .catch(() => {});
    }
  }, []);

  return {
    account,
    provider,
    chainId,
    isConnecting,
    isCorrectNetwork,
    isMetaMaskInstalled,
    error,
    connectWallet,
    disconnectWallet,
    switchToPolygonAmoy,
    signMessage,
    shortAddress: account ? `${account.slice(0, 6)}...${account.slice(-4)}` : null,
  };
};