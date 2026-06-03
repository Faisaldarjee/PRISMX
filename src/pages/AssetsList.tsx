import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAssets, importAsset, searchAssets } from '../api';
import { Asset } from '../types';
import { useAuth } from '../services/AuthProvider';
import { 
  Search, 
  Coins, 
  Layers, 
  Globe, 
  RefreshCw, 
  AlertCircle,
  Plus,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export function AssetsList() {
  const { addCustomAsset } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState<'ALL' | 'ETF' | 'STOCK' | 'MACRO'>('ALL');
  
  // Importer states
  const [importTicker, setImportTicker] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Online search triggered by main search input filter
  const [onlineMatches, setOnlineMatches] = useState<any[]>([]);
  const [searchingOnline, setSearchingOnline] = useState(false);

  useEffect(() => {
    const q = importTicker.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const matches = await searchAssets(q);
        setSuggestions(matches.slice(0, 5));
      } catch (err) {
        console.warn('AutoComplete fetch failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [importTicker]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setOnlineMatches([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearchingOnline(true);
      try {
        const matches = await searchAssets(q);
        const filtered = matches.filter(m => 
          !assets.some(local => local.symbol.toLowerCase() === m.symbol.toLowerCase())
        );
        setOnlineMatches(filtered.slice(0, 4));
      } catch (err) {
        console.warn('Online fallback search failed:', err);
      } finally {
        setSearchingOnline(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, assets]);

  async function handleImportBySymbol(symbol: string) {
    setImporting(true);
    setImportMessage(null);
    try {
      const outcome = await importAsset(symbol);
      await addCustomAsset(outcome.symbol);
      setImportMessage({
        text: `Successfully registered "${outcome.symbol}" (${outcome.name}) in system database. Historical indices loaded successfully!`,
        isError: false
      });
      setSearchQuery(''); 
      setOnlineMatches([]);
      await loadAssets();
    } catch (err: any) {
      console.error('Failed to import stock ticker:', err);
      setImportMessage({
        text: err.message || 'Verification failure. Please ensure the ticker exists on Yahoo Finance.',
        isError: true
      });
    } finally {
      setImporting(false);
    }
  }

  async function loadAssets() {
    setLoading(true);
    setError(null);
    try {
      const data = await getAssets();
      setAssets(data);
    } catch (e: any) {
      console.error('Error fetching assets pool:', e);
      setError(e.message || 'Assets list unavailable. Ensure database tables are synchronized.');
    } finally {
      setLoading(false);
    }
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = importTicker.trim();
    if (!query) return;
    
    setImporting(true);
    setImportMessage(null);
    try {
      const outcome = await importAsset(query);
      await addCustomAsset(outcome.symbol);
      if (outcome.alreadyExists) {
        setImportMessage({
          text: `Asset "${outcome.symbol}" (${outcome.name}) is already tracked in your system directory.`,
          isError: false
        });
      } else {
        setImportMessage({
          text: `Successfully registered "${outcome.symbol}" (${outcome.name}) in system. Loading pricing historical indices...`,
          isError: false
        });
      }
      setImportTicker('');
      await loadAssets();
    } catch (err: any) {
      console.error('Failed to import stock ticker:', err);
      setImportMessage({
        text: err.message || 'Verification failure. Please ensure the ticker exists on Yahoo Finance.',
        isError: true
      });
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      if (selectedSegmentFilter !== 'ALL') {
        if (a.type.toUpperCase() !== selectedSegmentFilter) return false;
      }
      const query = searchQuery.toLowerCase();
      return (
        a.symbol.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query) ||
        a.type.toLowerCase().includes(query)
      );
    });
  }, [assets, searchQuery, selectedSegmentFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RefreshCw size={36} className="text-[#D4A843] animate-spin" />
        <p className="font-data text-xs text-[#8892A4] animate-pulse uppercase tracking-widest">CATALOGING_MASTER_REGISTRY...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] max-w-md mx-auto p-8 rounded-2xl bg-[#0C1018] border border-white/[0.05] shadow-xl text-center">
        <AlertCircle size={40} className="text-[#FF4757] mb-4" />
        <h3 className="text-sm font-display font-semibold text-white mb-2 font-sans">Index Synchronization Failure</h3>
        <p className="text-xs text-[#8892A4] mb-6 font-body leading-relaxed">{error}</p>
        <button 
          onClick={loadAssets}
          className="px-4 py-2 bg-[#D4A843]/10 hover:bg-[#D4A843]/20 text-[#E8C070] border border-[#D4A843]/20 text-[10px] font-data font-bold rounded-xl uppercase transition-all"
        >
          Retry Asset Fetch
        </button>
      </div>
    );
  }

  return (
    <div id="assets-list-vue" className="space-y-8 animate-fadeIn">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[rgba(255,255,255,0.05)] pb-5 font-sans">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-white mb-1 font-display">Asset Registry</h2>
          <p className="text-xs text-[#8892A4] font-body">Master indices catalog, tracking safe-haven precious ETFs, corporate equities, and currency benchmarks.</p>
        </div>
        <button 
          onClick={loadAssets}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.02] hover:bg-white/[0.05] text-[#8892A4] hover:text-white rounded-lg text-xs font-data border border-[rgba(255,255,255,0.04)] font-mono"
        >
          <RefreshCw size={11} />
          REFRESH_REGISTRY
        </button>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="space-y-3 font-data">
        <div id="filter-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Watchlist Filter Search Input */}
          <div className="lg:col-span-2 flex bg-[#020408]/60 border border-white/[0.05] p-3 rounded-xl items-center gap-3 shadow-md">
            <Search size={15} className="text-[#8892A4] shrink-0" />
            <input 
              type="text" 
              placeholder="Filter active catalog by symbol or name (e.g. goldbees, reliance, silverbees)..."
              className="placeholder-[#4A5568] text-xs bg-transparent border-none text-[#F0F4FF] focus:outline-none w-full font-mono outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Dynamic Stock Importer Selector */}
          <div className="relative font-sans">
            <form onSubmit={handleImport} className="flex bg-[#020408]/60 border border-white/[0.05] p-2 rounded-xl items-center gap-2 shadow-md">
              <div className="flex-1 flex items-center gap-1.5 px-2 font-mono">
                <Plus size={13} className="text-[#E8C070] shrink-0" />
                <input 
                  type="text" 
                  placeholder="IMPORT NSE TICKER"
                  className="placeholder-[#4A5568] text-xs bg-transparent border-none text-white focus:outline-none w-full font-bold uppercase outline-none"
                  value={importTicker}
                  onChange={(e) => setImportTicker(e.target.value)}
                  disabled={importing}
                />
                {searching && <RefreshCw size={11} className="animate-spin text-slate-500 shrink-0" />}
              </div>
              
              <button
                type="submit"
                disabled={importing || !importTicker.trim()}
                className="px-3.5 py-1.5 bg-[#D4A843] hover:bg-[#E8C070] disabled:bg-neutral-800 disabled:text-neutral-500 text-[#05070C] font-semibold rounded-lg text-xs tracking-wider transition-all cursor-pointer font-data"
              >
                {importing ? 'Importing...' : 'IMPORT'}
              </button>
            </form>

            {/* Suggestions drop down popup */}
            {suggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1.5 bg-[#0D1018] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden divide-y divide-white/[0.03] max-h-60 overflow-y-auto font-data">
                <div className="p-2 text-[8px] text-[#4A5568] uppercase tracking-widest bg-black/40">
                  Online Market Suggestions
                </div>
                {suggestions.map((s) => (
                  <button
                    key={s.symbol}
                    type="button"
                    onClick={() => {
                      setImportTicker(s.symbol);
                      setSuggestions([]);
                    }}
                    className="w-full text-left p-3 hover:bg-white/[0.01] transition-all flex justify-between items-center gap-2"
                  >
                    <div className="truncate flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-[#E8C070] text-xs">{s.symbol}</span>
                        <span className="text-[8px] font-bold text-slate-400 bg-white/[0.03] px-1 py-0.5 rounded font-mono uppercase">{s.exchDisp || 'Global'}</span>
                      </div>
                      <div className="text-[10px] text-[#8892A4] font-body truncate mt-0.5">{s.name}</div>
                    </div>
                    <span className="text-[8.5px] text-[#4A5568] uppercase font-mono font-medium shrink-0">
                      {s.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Yahoo online matches found while searching locally */}
        {onlineMatches.length > 0 && (
          <div className="bg-white/[0.015] border border-white/[0.03] p-4 rounded-xl space-y-3 shadow-md animate-fadeIn">
            <div className="flex items-center gap-2 justify-between flex-wrap text-xs">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Globe className="text-[#E8C070]" size={13} />
                <span>Found on Yahoo Finance matching &ldquo;<strong>{searchQuery}</strong>&rdquo;:</span>
              </div>
              <span className="text-[9px] text-[#4A5568] uppercase">Click &ldquo;Import & Sync&rdquo; to analyze</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {onlineMatches.map((match) => (
                <div key={match.symbol} className="bg-[#05070C] border border-white/[0.02] p-3 rounded-xl flex items-center justify-between gap-3 hover:border-[#D4A843]/45 transition-all">
                  <div className="truncate flex-1">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="font-mono font-bold text-[#E8C070]">{match.symbol}</span>
                      <span className="text-[7.5px] text-[#8892A4] bg-white/[0.03] p-0.5 rounded uppercase font-mono">{match.exchDisp || 'Exch'}</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate mt-1 font-body">{match.name}</div>
                  </div>
                  <button
                    type="button"
                    disabled={importing}
                    onClick={() => handleImportBySymbol(match.symbol)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#D4A843]/10 hover:bg-[#D4A843]/20 text-[#E8C070] border border-[#D4A843]/20 font-bold rounded-lg text-[9px] uppercase shrink-0 transition-colors cursor-pointer"
                  >
                    Import
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback Messages */}
        {importMessage && (
          <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 shadow-md transition-all animate-fadeIn ${
            importMessage.isError 
              ? 'bg-[#FF4757]/10 border-[#FF4757]/25 text-rose-300' 
              : 'bg-[#00D084]/10 border-[#00D084]/25 text-emerald-300'
          }`}>
            {importMessage.isError ? (
              <XCircle size={15} className="shrink-0 mt-0.5 text-[#FF4757]" />
            ) : (
              <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-[#00D084]" />
            )}
            <div className="flex-1">
              <span className="font-semibold block mb-0.5 uppercase tracking-wide text-[10px] font-mono">{importMessage.isError ? 'IMPORT_ERROR' : 'REGISTRY_SYNC_COMPLETE'}</span>
              <p className="text-zinc-300 leading-relaxed font-mono text-[10.5px]">{importMessage.text}</p>
            </div>
            <button 
              type="button"
              onClick={() => setImportMessage(null)} 
              className="text-[#8892A4] hover:text-white font-bold font-mono px-1 bg-white/[0.04] rounded text-lg leading-none shrink-0"
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* Category Tabs Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.015] border border-white/[0.03] p-3 rounded-xl font-data">
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.03]">
          {(['ALL', 'ETF', 'STOCK', 'MACRO'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSelectedSegmentFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-[10.5px] font-semibold transition-all uppercase tracking-wide ${
                selectedSegmentFilter === tab
                  ? 'bg-[#D4A843] text-[#05070C] font-bold shadow'
                  : 'text-[#8892A4] hover:text-white'
              }`}
            >
              {tab === 'ALL' ? 'All Assets' : tab === 'ETF' ? 'Safe ETFs' : tab === 'STOCK' ? 'Equities' : 'Macro'}
            </button>
          ))}
        </div>
        
        <span className="text-[10px] text-[#8892A4] block sm:inline font-mono">
          AGGREGATED_REGISTRY // <span className="text-white font-bold">{filteredAssets.length}</span> / {assets.length} ITEMS CARRIED
        </span>
      </div>

      {/* DATAGRID ROW TABLE */}
      <div className="bg-[#05070C] border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden font-data">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.03] text-[#4A5568] text-[9.5px] uppercase tracking-wider bg-black/20">
                <th className="py-3.5 px-4 font-mono">Asset Ticker</th>
                <th className="py-3.5 px-4">System Asset Name</th>
                <th className="py-3.5 px-4 font-body">Type segment</th>
                <th className="py-3.5 px-4 font-mono">Valuation price</th>
                <th className="py-3.5 px-4 font-mono">Last Synchronized</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-5 text-center text-[#8892A4] font-body leading-relaxed">
                    <div className="max-w-md mx-auto">
                      <AlertCircle className="mx-auto mb-2 text-[#4A5568]" size={22} />
                      <p className="font-bold text-white mb-1 font-display">No local catalog matches matching &ldquo;{searchQuery}&rdquo;</p>
                      <p className="text-[11px] leading-relaxed">
                        We don't contain this symbol locally. Perform an online import by submitting the NSE ticker (e.g. <strong>RELIANCE</strong> or <strong>TCS</strong>) into the registry field to fetch it live!
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const isEtfType = asset.type === 'ETF';
                  
                  return (
                    <tr key={asset.symbol} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white text-sm">{asset.symbol.split('.')[0]}</td>
                      <td className="py-3.5 px-4 text-[#F0F4FF] truncate font-sans max-w-[200px]">{asset.name}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-bold text-[8.5px] uppercase tracking-wider ${
                          isEtfType 
                            ? 'bg-[#D4A843]/10 text-[#E8C070] border border-[#D4A843]/20' 
                            : asset.type === 'STOCK'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-900/20'
                              : 'bg-white/[0.03] text-zinc-400'
                        }`}>
                          {isEtfType ? <Coins size={10} /> : <Layers size={10} />}
                          {asset.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-white text-[12px] font-semibold">
                        {asset.last_price !== null ? `₹${asset.last_price.toFixed(2)}` : '---'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#8892A4] text-[11px]">{asset.last_date || 'N/A'}</td>
                      <td className="py-3.5 px-4 text-right">
                        {asset.type !== 'MACRO' ? (
                          <Link 
                            to={`/asset/${asset.symbol}`}
                            className="text-[#E8C070] hover:text-white font-bold uppercase tracking-wider hover:underline inline-flex items-center gap-1 text-[10px]"
                          >
                            Scan Analysis &rarr;
                          </Link>
                        ) : (
                          <span className="text-[#4A5568] italic text-[10px] uppercase">KPI Indices</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
