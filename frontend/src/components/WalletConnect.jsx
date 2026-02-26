import React, { useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { connectWalletToProfile, disconnectWalletFromProfile } from '../services/web3Service';

/**
 * WalletConnect — MetaMask wallet connection UI component
 * Shows connect button, wallet address, network status, and blockchain logs link
 */
const WalletConnect = ({ onWalletChange }) => {
  const {
    account,
    isConnecting,
    isCorrectNetwork,
    isMetaMaskInstalled,
    error,
    connectWallet,
    disconnectWallet,
    switchToPolygonAmoy,
    shortAddress,
  } = useWeb3();

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const handleConnect = async () => {
    const address = await connectWallet();
    if (address) {
      setSaving(true);
      setSaveMsg('');
      try {
        await connectWalletToProfile(address);
        setSaveMsg('Wallet linked to profile ✓');
        onWalletChange?.(address);
      } catch {
        setSaveMsg('Connected but failed to save to profile');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDisconnect = async () => {
    disconnectWallet();
    try {
      await disconnectWalletFromProfile();
    } catch {}
    setSaveMsg('');
    onWalletChange?.(null);
  };

  // ── Not installed ────────────────────────────────────────────────────────
  if (!isMetaMaskInstalled) {
    return (
      <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
        <span className="text-yellow-600">⚠️</span>
        <span className="text-yellow-700">
          MetaMask not installed.{' '}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            Install MetaMask
          </a>{' '}
          to enable blockchain features.
        </span>
      </div>
    );
  }

  // ── Not connected ────────────────────────────────────────────────────────
  if (!account) {
    return (
      <div className="space-y-2">
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50"
        >
          {isConnecting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <span>🦊</span>
              Connect MetaMask
            </>
          )}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────
  return (
    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🦊</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-mono font-semibold text-orange-800">
                {shortAddress}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(account)}
                className="text-xs text-orange-500 hover:text-orange-700"
                title="Copy address"
              >
                📋
              </button>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {isCorrectNetwork ? (
                <span className="text-xs text-green-600">● Polygon Amoy</span>
              ) : (
                <button
                  onClick={switchToPolygonAmoy}
                  className="text-xs text-red-600 underline"
                >
                  ⚠️ Wrong network — switch to Polygon Amoy
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleDisconnect}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          title="Disconnect wallet"
        >
          Disconnect
        </button>
      </div>

      {saving && (
        <p className="text-xs text-orange-600 flex items-center gap-1">
          <span className="w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
          Saving to profile...
        </p>
      )}

      {saveMsg && (
        <p className="text-xs text-green-700">{saveMsg}</p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Explorer link */}
      <a
        href={`https://www.oklink.com/amoy/address/${account}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs text-orange-600 hover:text-orange-800 underline"
      >
        View on Polygon Explorer →
      </a>
    </div>
  );
};

export default WalletConnect;