import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  fetchWithRetry, 
  parseApiJson,
  SectionSkeleton, 
  SectionError 
} from '../utils/apiHelpers';
import { Asset } from '../types';
import { useAuth } from '../services/AuthProvider';
import { supabase } from '../services/supabase';
import { 
  Search, 
  Coins, 
  Layers, 
  Globe, 
  RefreshCw, 
  AlertCircle,
  Plus,
  CheckCircle2,
  XCircle,
  Trash2
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

  // Column sorting states
  const [sortBy, setSortBy] = useState<string>('symbol');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Delete Untrack confirmation states
  const [deleteConfirmSymbol, setDeleteConfirmSymbol] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk Importer states
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSymbolsInput, setBulkSymbolsInput] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string>('');
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);

  // Load Registry with Isolated Quote Lookups
  async function loadAssets(signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Assets Meta Directory via secure fallback retries
      const data = await fetchWithRetry('/api/assets', signal);
      if (signal?.aborted) return;
      setAssets(data);

      // 2. Query individual quotes in parallel with Promise.all
      // Wrap each lookup in a safe, isolated try-catch so individual quote failures do not block others
      try {
        const quotePromises = data.map(async (asset: Asset) => {
          try {
            const quote = await fetchWithRetry(`/api/quote/${encodeURIComponent(asset.symbol)}`, signal);
            return { symbol: asset.symbol, quote };
          } catch (quoteErr) {
            console.warn(`Quote retrieval skipped for ${asset.symbol}:`, quoteErr);
            return { symbol: asset.symbol, quote: null };
          }
        });

        const quotes = await Promise.all(quotePromises);
        if (signal?.aborted) return;

        // Perform atomic client-side merge into state cached collections
        setAssets(prevAssets => {
          return prevAssets.map(asset => {
            const matchedQuote = quotes.find(q => q.symbol === asset.symbol);
            if (matchedQuote && matchedQuote.quote) {
              return {
                ...asset,
                last_price: matchedQuote.quote.price ?? asset.last_price,
                change_percent: matchedQuote.quote.changePercent ?? asset.change_percent,
                last_date: matchedQuote.quote.date ?? asset.last_date
              };
            }
            return asset;
          });
        });
      } catch (parallelErr) {
        console.warn('Batch quotes retrieval error:', parallelErr);
      }

    } catch (e: any) {
      if (signal?.aborted) return;
      console.error('Error fetching assets pool:', e);
      setError(e.message || 'Assets list unavailable. Ensure database tables are synchronized.');
    } finally {
      setLoading(false);
    }
  }

  // Suggest Ticker Auto-Complete
  useEffect(() => {
    const q = importTicker.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const matches = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json());
        setSuggestions(matches.slice(0, 5));
      } catch (err) {
        console.warn('AutoComplete fetch failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [importTicker]);

  // Online Backup Matches Finder
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setOnlineMatches([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearchingOnline(true);
      try {
        const matches = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json());
        const filtered = matches.filter((m: any) => 
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
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const res = await fetch('/api/assets/import', {
        method: 'POST',
        headers,
        body: JSON.stringify({ symbol })
      });
      
      const outcome = await parseApiJson(res);

      if (!res.ok) {
        throw new Error(outcome?.detail || outcome?.error || `HTTP error ${res.status}`);
      }
      if (outcome?.error) throw new Error(outcome.error);
      if (!outcome?.symbol) throw new Error("No symbol returned from import.");

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

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = importTicker.trim();
    if (!query) return;
    
    setImporting(true);
    setImportMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const res = await fetch('/api/assets/import', {
        method: 'POST',
        headers,
        body: JSON.stringify({ symbol: query })
      });
      
      const outcome = await parseApiJson(res);

      if (!res.ok) {
        throw new Error(outcome?.detail || outcome?.error || `HTTP error ${res.status}`);
      }
      if (outcome?.error) throw new Error(outcome.error);
      if (!outcome?.symbol) throw new Error("No symbol returned from import.");

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

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmSymbol) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const res = await fetch(`/api/assets/${encodeURIComponent(deleteConfirmSymbol)}`, {
        method: 'DELETE',
        headers
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);

      setImportMessage({
        text: `Successfully removed cache, analysis and indices folder records of "${deleteConfirmSymbol.split('.')[0]}".`,
        isError: false
      });
      setDeleteConfirmSymbol(null);
      await loadAssets();
    } catch (err: any) {
      console.error('Failed to clear asset registry:', err);
      setImportMessage({
        text: err.message || 'Removal error occurred. Asset not modified.',
        isError: true
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const symbols = bulkSymbolsInput
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0);

    if (symbols.length === 0) return;
    
    if (symbols.length > 10) {
      setBulkSummary('Error: Live imports are capped at a maximum of 10 tickers at once to avoid service rate limits.');
      return;
    }

    setBulkProcessing(true);
    setBulkSummary(null);
    let successCount = 0;
    let failCount = 0;
    const failedList: string[] = [];

    const { data: { session } } = await supabase.auth.getSession();

    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      setBulkProgress(`Importing ${i + 1}/${symbols.length}: ${sym}...`);
      try {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        
        const res = await fetch('/api/assets/import', {
          method: 'POST',
          headers,
          body: JSON.stringify({ symbol: sym })
        });
        
        const outcome = await parseApiJson(res);

        if (!res.ok) {
          throw new Error(outcome?.detail || outcome?.error || `HTTP error ${res.status}`);
        }
        if (outcome?.error) throw new Error(outcome.error);
        if (!outcome?.symbol) throw new Error("No symbol returned from import.");

        await addCustomAsset(outcome.symbol);
        successCount++;
      } catch (err: any) {
        console.error(`Bulk import failed for ${sym}:`, err.message);
        failCount++;
        failedList.push(sym);
      }
    }

    setBulkProgress('');
    setBulkProcessing(false);
    
    let summaryText = `Bulk import complete. Successfully imported ${successCount} symbols.`;
    if (failCount > 0) {
      summaryText += ` ${failCount} failed to verify/import (${failedList.join(', ')}).`;
    }
    
    setBulkSummary(summaryText);
    setBulkSymbolsInput('');
    await loadAssets();
  };

  useEffect(() => {
    const controller = new AbortController();
    loadAssets(controller.signal);
    return () => controller.abort();
  }, []);

  // Client-side search and category segmentation on cached local memory assets
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

  const sortedAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortBy === 'symbol') {
        valA = a.symbol || '';
        valB = b.symbol || '';
      } else if (sortBy === 'price') {
        valA = a.last_price !== null && a.last_price !== undefined ? a.last_price : -999999;
        valB = b.last_price !== null && b.last_price !== undefined ? b.last_price : -999999;
      } else if (sortBy === 'change') {
        valA = a.change_percent !== null && a.change_percent !== undefined ? a.change_percent : -999999;
        valB = b.change_percent !== null && b.change_percent !== undefined ? b.change_percent : -999999;
      } else if (sortBy === 'updated') {
        valA = a.last_date || '';
        valB = b.last_date || '';
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return sortDir === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      }
    });
  }, [filteredAssets, sortBy, sortDir]);

  if (loading) {
    return (
      <div className="space-y-6" id="assets-loading-skeleton">
        <div className="flex items-center gap-3">
          <RefreshCw size={18} className="text-[#D4A843] animate-spin" />
          <span className="text-xs font-mono uppercase text-[#8892A4]">Loading registered assets and live valuations...</span>
        </div>
        <SectionSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] max-w-md mx-auto p-8 rounded-2xl bg-[#0C1018] border border-white/[0.05] shadow-xl text-center">
        <AlertCircle size={40} className="text-[#E05252] mb-4" />
        <h3 className="text-sm font-display font-semibold text-white mb-2 font-sans">Index Synchronization Failure</h3>
        <p className="text-xs text-[#8892A4] mb-6 font-body leading-relaxed">{error}</p>
        <button 
          onClick={() => loadAssets()}
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
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1 font-display">Asset Registry</h2>
          <p className="text-xs text-[#8892A4] font-body">Master indices catalog, tracking safe-haven precious ETFs, corporate equities, and currency benchmarks.</p>
        </div>
        <button 
          onClick={() => loadAssets()}
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

          {/* Importers container (Single / Bulk side-by-side) */}
          <div className="flex gap-2 relative font-sans w-full">
            <form onSubmit={handleImport} className="flex-1 flex bg-[#020408]/60 border border-white/[0.05] p-2 rounded-xl items-center gap-2 shadow-md">
              <div className="flex-1 flex items-center gap-1.5 px-2 font-mono">
                <Plus size={13} className="text-[#E8C070] shrink-0" />
                <input 
                  type="text" 
                  placeholder="IMPORT TICKER"
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
                className="px-3 py-1.5 bg-[#D4A843] hover:bg-[#E8C070] disabled:bg-neutral-800 disabled:text-neutral-500 text-[#05070C] font-semibold rounded-lg text-xs tracking-wider transition-all cursor-pointer font-data"
              >
                {importing ? '...' : 'ADD'}
              </button>
            </form>

            <button
              onClick={() => {
                setBulkSymbolsInput('');
                setBulkSummary(null);
                setBulkModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-[#D4A843]/10 hover:bg-[#D4A843]/20 text-[#E8C070] border border-[#D4A843]/20 font-bold rounded-xl text-xs uppercase transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center"
              title="Bulk watchlists import"
            >
              Bulk Import
            </button>

            {/* Suggestions drop down popup */}
            {suggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-14 bg-[#0D1018] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden divide-y divide-white/[0.03] max-h-60 overflow-y-auto font-data">
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
              <span className="text-[9px] text-[#4A5568] uppercase font-mono">Click &ldquo;Import&rdquo; to sync & analyze</span>
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
              ? 'bg-[#E05252]/10 border-[#E05252]/25 text-rose-300' 
              : 'bg-[#34A77A]/10 border-[#34A77A]/25 text-emerald-300'
          }`}>
          {importMessage.isError ? (
            <XCircle size={15} className="shrink-0 mt-0.5 text-[#E05252]" />
          ) : (
            <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-[#34A77A]" />
          )}
            <div className="flex-1">
              <span className="font-semibold block mb-0.5 uppercase tracking-wide text-[10px] font-mono">{importMessage.isError ? 'Registry Warning' : 'Import Successful'}</span>
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
          AGGREGATED REGISTRY · <span className="text-white font-bold">{filteredAssets.length}</span> / {assets.length} ITEMS CARRIED
        </span>
      </div>

      {/* DATAGRID ROW TABLE */}
      <div className="bg-[#05070C] border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden font-data">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs select-none">
            <thead>
              <tr className="border-b border-white/[0.03] text-[#4A5568] text-[9.5px] uppercase tracking-wider bg-black/20">
                <th 
                  onClick={() => handleSort('symbol')}
                  className="py-3.5 px-4 font-mono cursor-pointer hover:text-white transition-colors"
                >
                  Asset Ticker {sortBy === 'symbol' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-3.5 px-4">System Asset Name</th>
                <th className="py-3.5 px-4 font-body">Type segment</th>
                <th 
                  onClick={() => handleSort('price')}
                  className="py-3.5 px-4 font-mono cursor-pointer hover:text-white transition-colors"
                >
                  Valuation price {sortBy === 'price' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th 
                  onClick={() => handleSort('change')}
                  className="py-3.5 px-4 font-mono cursor-pointer hover:text-white transition-colors"
                >
                  Change % {sortBy === 'change' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th 
                  onClick={() => handleSort('updated')}
                  className="py-3.5 px-4 font-mono cursor-pointer hover:text-white transition-colors"
                >
                  Last Synchronized {sortBy === 'updated' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="py-3.5 px-4 text-right">Details & Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {sortedAssets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-5 text-center text-[#8892A4] font-body leading-relaxed">
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
                sortedAssets.map((asset) => {
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
                        {(asset.last_price !== null && asset.last_price !== undefined) ? `₹${Number(asset.last_price).toFixed(2)}` : '---'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[12px] font-semibold">
                        {asset.change_percent !== null && asset.change_percent !== undefined ? (
                          <span className={asset.change_percent >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            {asset.change_percent >= 0 ? "+" : ""}{asset.change_percent.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-zinc-500">---</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#8892A4] text-[11px]">{asset.last_date || 'N/A'}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-3 w-full">
                          <Link 
                            to={`/asset/${asset.symbol}`}
                            className="text-[#E8C070] hover:text-white font-bold uppercase tracking-wider hover:underline inline-flex items-center gap-1 text-[10px]"
                          >
                            Scan Analysis &rarr;
                          </Link>

                          {asset.is_preset !== 1 && (
                            <button
                              onClick={() => setDeleteConfirmSymbol(asset.symbol)}
                              className="text-neutral-500 hover:text-rose-400 transition-colors p-1 rounded hover:bg-white/[0.03] shrink-0 cursor-pointer"
                              title={`Remove custom asset ${asset.symbol}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DELETE CONFIRMATION OVERLAY MODAL */}
      {deleteConfirmSymbol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0C1018] border border-white/[0.08] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-5">
            <div className="flex items-center gap-2.5 text-rose-500">
              <AlertCircle size={22} className="shrink-0" />
              <h3 className="text-sm font-semibold text-white font-sans uppercase tracking-wider font-bold">Untrack custom asset?</h3>
            </div>
            
            <p className="text-xs text-[#8892A4] leading-relaxed font-mono">
              Remove <strong className="text-white">{deleteConfirmSymbol.split('.')[0]}</strong> from your watchlist? This will delete its price history too.
            </p>
            
            <div className="flex gap-2.5 justify-end text-[10px] font-bold uppercase tracking-wider">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirmSymbol(null)}
                className="px-3 py-2 bg-white/[0.02] border border-white/[0.05] text-[#8892A4] hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                No, Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/25 text-[#E05252] border border-rose-500/20 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                {deleting ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK WATCHLIST IMPORTER OVERLAY MODAL */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0C1018] border border-white/[0.08] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl relative space-y-4">
            <button 
              onClick={() => {
                if (!bulkProcessing) setBulkModalOpen(false);
              }}
              className="absolute top-4 right-4 text-[#8892A4] hover:text-white font-bold text-lg select-none cursor-pointer"
            >
              &times;
            </button>
            
            <div className="flex items-center gap-2">
              <Globe className="text-[#E8C070]" size={16} />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">Bulk Watchlist Importer</h3>
            </div>
            
            <form onSubmit={handleBulkImportSubmit} className="space-y-4">
              <p className="text-[10px] text-[#8892A4] leading-relaxed font-mono uppercase text-slate-400">
                Enter multiple symbols separated by commas:
              </p>
              
              <textarea
                placeholder="SBIN, COALINDIA, BAJFINANCE, WIPRO"
                rows={4}
                className="w-full bg-[#020408]/60 border border-white/[0.05] p-3 rounded-xl placeholder-[#4E5568] text-xs text-white focus:outline-none focus:border-[#D4A843]/45 font-mono outline-none resize-none"
                value={bulkSymbolsInput}
                onChange={(e) => setBulkSymbolsInput(e.target.value)}
                disabled={bulkProcessing}
              />
              
              {bulkProgress && (
                <div className="text-[10px] text-[#E8C070] font-mono animate-pulse flex items-center gap-1.5 uppercase">
                  <RefreshCw size={11} className="animate-spin" />
                  <span>{bulkProgress}</span>
                </div>
              )}
              
              {bulkSummary && (
                <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl text-[10.5px] text-zinc-300 font-mono leading-relaxed">
                  {bulkSummary}
                </div>
              )}
              
              <div className="flex gap-2.5 justify-end text-[10px] font-bold uppercase tracking-wider pt-1">
                <button
                  type="button"
                  disabled={bulkProcessing}
                  onClick={() => setBulkModalOpen(false)}
                  className="px-3 py-2 bg-white/[0.02] border border-white/[0.05] text-[#8892A4] hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={bulkProcessing || !bulkSymbolsInput.trim()}
                  className="px-3 py-2 bg-[#D4A843] hover:bg-[#E8C070] text-[#05070C] disabled:bg-neutral-800 disabled:text-neutral-500 rounded-xl transition-all cursor-pointer"
                >
                  {bulkProcessing ? 'Importing...' : 'Begin Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
