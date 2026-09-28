// src/components/wallet/AssetInspector.tsx
import React, { useState } from 'react';

interface TokenBalance {
    contractId: string;
    symbol: string;
    name: string;
    balance: string;
    usdValue: string;
    iconUrl?: string;
}

interface AssetInspectorProps {
    nativeXlmBalance: string;
    nativeXlmUsd: string;
    tokens: TokenBalance[];
    onAddToken: (contractId: string) => void;
}

export const AssetInspector: React.FC<AssetInspectorProps> = ({
    nativeXlmBalance,
    nativeXlmUsd,
    tokens,
    onAddToken,
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [customContractId, setCustomContractId] = useState('');

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customContractId.trim()) return;
        onAddToken(customContractId.trim());
        setCustomContractId('');
        setIsModalOpen(false);
    };

    const truncateId = (id: string) => `${id.slice(0, 4)}...${id.slice(-4)}`;

    return (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 max-w-md w-full">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <div className="flex items-center space-x-2">
                    <span className="text-xl">💼</span>
                    <h3 className="text-base font-semibold text-slate-200">Asset Balances</h3>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-400 transition-colors cursor-pointer"
                >
                    + Add Token
                </button>
            </div>

            <div className="space-y-3 mb-6">
                {/* Native XLM Asset */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                    <div className="flex items-center space-x-3">
                        <div className="h-9 w-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-xs">
                            XLM
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-slate-200">Stellar Lumens</h4>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Native Asset</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-mono text-sm font-semibold text-slate-100">{nativeXlmBalance} XLM</div>
                        <div className="font-mono text-xs text-slate-400">${nativeXlmUsd} USD</div>
                    </div>
                </div>

                {/* Custom SAC Tokens */}
                {tokens.map((token) => (
                    <div key={token.contractId} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                        <div className="flex items-center space-x-3">
                            <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-xs">
                                {token.symbol.slice(0, 3)}
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-slate-200">{token.name}</h4>
                                <span className="font-mono text-[10px] text-slate-400">{truncateId(token.contractId)}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-mono text-sm font-semibold text-slate-100">{token.balance} {token.symbol}</div>
                            <div className="font-mono text-xs text-slate-400">${token.usdValue} USD</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Custom Token Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
                        <h3 className="text-base font-semibold text-slate-200 mb-2">Add Custom SAC Token</h3>
                        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                            Enter the Stellar Asset Contract (SAC) ID to track custom balances in your wallet.
                        </p>
                        <form onSubmit={handleAddSubmit} className="space-y-4">
                            <input
                                type="text"
                                placeholder="C... (Contract ID)"
                                value={customContractId}
                                onChange={(e) => setCustomContractId(e.target.value)}
                                className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                            <div className="flex space-x-3">
                                <button
                                    type="submit"
                                    className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-medium text-white transition-colors cursor-pointer"
                                >
                                    Track Token
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-medium text-slate-300 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export interface AssetBalance {
  code: string;
  issuer?: string;
  contractId?: string;
  balance: string;
  usdValue: number;
  iconUrl?: string;
  isNative?: boolean;
}

interface AssetInspectorProps {
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