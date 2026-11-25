'use client';

import React, { useState } from 'react';

export interface AssetBalance {
  code: string;
  issuer?: string;
  contractId?: string;
  balance: string;
  usdValue: number;
  iconUrl?: string;
  isNative?: boolean;
}

export interface AssetInspectorProps {
  initialAssets?: AssetBalance[];
  onAddCustomToken?: (contractId: string, assetCode: string) => Promise<boolean>;
  className?: string;
}

export const AssetInspector: React.FC<AssetInspectorProps> = ({
  initialAssets = [
    { code: 'XLM', balance: '1,450.25', usdValue: 174.03, isNative: true, iconUrl: 'https://assets.coingecko.com/coins/images/100/large/Stellar_symbol_black_%281%29.png' }
  ],
  onAddCustomToken,
  className = '',
}) => {
  const [assets, setAssets] = useState<AssetBalance[]>(initialAssets);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contractInput, setContractInput] = useState('');
  const [codeSymbolInput, setCodeSymbolInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleAddTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractInput.trim() || !codeSymbolInput.trim()) {
      setErrorMessage('Please provide both a token contract ID/address and asset code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      if (onAddCustomToken) {
        await onAddCustomToken(contractInput.trim(), codeSymbolInput.trim());
      }

      // Add to local state
      const newAsset: AssetBalance = {
        code: codeSymbolInput.trim().toUpperCase(),
        contractId: contractInput.trim(),
        balance: '0.00',
        usdValue: 0.00,
      };

      setAssets(prev => [...prev, newAsset]);
      setContractInput('');
      setCodeSymbolInput('');
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to add custom token.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Asset Balances</h3>
          <p className="text-sm text-gray-500">Native XLM and tracked Soroban Asset Contract (SAC) tokens</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
        >
          Add Custom Token
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {assets.map((asset, idx) => (
          <div key={asset.contractId || asset.code || idx} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                {asset.iconUrl ? (
                  <img src={asset.iconUrl} alt={asset.code} className="w-6 h-6 object-contain" />
                ) : (
                  <span className="text-xs font-bold text-gray-700">{asset.code.slice(0, 3)}</span>
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900">{asset.code}</span>
                  {asset.isNative && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">Native</span>
                  )}
                  {asset.contractId && (
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded">SAC</span>
                  )}
                </div>
                {asset.contractId && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-xs">
                    {asset.contractId}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900">{asset.balance}</p>
              <p className="text-xs text-gray-500">${asset.usdValue.toFixed(2)} USD</p>
            </div>
          </div>
        ))}
      </div>

      {/* Add Custom Token Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Add Custom SAC Token</h3>
            <p className="text-sm text-gray-500 mb-4">Enter the contract address and symbol of the Soroban Asset Contract you wish to track.</p>
            
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleAddTokenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Token Symbol / Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. USDC"
                  value={codeSymbolInput}
                  onChange={(e) => setCodeSymbolInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Contract Address (SAC)
                </label>
                <input
                  type="text"
                  placeholder="C..."
                  value={contractInput}
                  onChange={(e) => setContractInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Adding...' : 'Add Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
