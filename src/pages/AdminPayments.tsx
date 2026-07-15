import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, X, Clipboard, RefreshCw, AlertCircle, Coins } from 'lucide-react';
import { useAuth } from '../services/AuthProvider';

interface PaymentRequest {
  id: string;
  user_id: string;
  email: string;
  utr: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export function AdminPayments() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('prism_admin_key') || 'PrismAdmin2026#9x');

  const { userProfile } = useAuth();

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/payments', {
        headers: {
          'X-Admin-Key': adminKey
        }
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Invalid Admin Key. Please configure it in your Local Storage or the box below.');
        }
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      setRequests(data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch payment requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.email === 'faisaldarjee9@gmail.com') {
      fetchPayments();
    }
  }, [userProfile, adminKey]);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setActionLoading(requestId);
    try {
      const res = await fetch('/api/admin/payments/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ requestId, action })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process action.');
      }

      // Refresh list
      await fetchPayments();
    } catch (err: any) {
      alert(err.message || 'Failed to perform payment action.');
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`Copied: ${text}`);
  };

  if (userProfile?.email !== 'faisaldarjee9@gmail.com') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 bg-[#090b11] border border-slate-850 rounded-2xl">
        <AlertCircle className="text-rose-500 w-12 h-12 mb-4 animate-bounce" />
        <h2 className="text-lg font-display font-semibold text-white">ACCESS DENIED</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-sm">
          This panel is restricted to the administrator account (faisaldarjee9@gmail.com) only.
        </p>
      </div>
    );
  }

  // Group metrics
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* HEADER PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-5">
        <div>
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck className="text-amber-500 w-5 h-5" />
            <h2 className="text-lg font-display font-semibold uppercase tracking-wider">UPI Payments Manager</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review, verify, and approve user UTR transaction reference submissions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
            <span className="text-[10px] font-mono text-slate-500">Key:</span>
            <input 
              type="password"
              value={adminKey}
              onChange={(e) => {
                setAdminKey(e.target.value);
                localStorage.setItem('prism_admin_key', e.target.value);
              }}
              className="bg-transparent border-none text-xs text-amber-500 focus:outline-none w-36 font-mono"
            />
          </div>
          <button 
            onClick={fetchPayments}
            className="p-2 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">Pending Approval</span>
            <h3 className="text-2xl font-display font-semibold text-amber-500 mt-1">{pendingCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <RefreshCw size={18} className="animate-pulse" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">Approved Subscriptions</span>
            <h3 className="text-2xl font-display font-semibold text-emerald-500 mt-1">{approvedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Check size={18} />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">Rejected Submissions</span>
            <h3 className="text-2xl font-display font-semibold text-rose-500 mt-1">{rejectedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
            <X size={18} />
          </div>
        </div>
      </div>

      {/* TABLE PANEL */}
      <div className="bg-[#090b11] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-850 bg-slate-900/20 flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Reference Ledger</h4>
          <span className="text-[10px] text-slate-500 font-mono">Total Requests: {requests.length}</span>
        </div>

        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw size={24} className="animate-spin text-amber-500" />
            <span className="text-xs font-mono">Loading transaction ledger...</span>
          </div>
        ) : error ? (
          <div className="p-10 text-center text-rose-400">
            <p className="text-xs font-mono">{error}</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center text-slate-500 font-mono text-xs">
            No payment reference submissions found in records.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 uppercase tracking-widest font-mono text-[9px] bg-slate-900/10">
                  <th className="py-3 px-5">Submission Date</th>
                  <th className="py-3 px-5">User Email</th>
                  <th className="py-3 px-5">UTR / Ref Number</th>
                  <th className="py-3 px-5 text-right">Amount</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 font-sans">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-[10px] text-slate-400">
                      {new Date(req.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 font-medium text-white">
                      {req.email || req.user_id}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-amber-400 font-semibold">{req.utr}</span>
                        <button 
                          onClick={() => copyToClipboard(req.utr)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                        >
                          <Clipboard size={10} />
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-bold text-white">
                      ₹{req.amount}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border ${
                        req.status === 'approved' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : req.status === 'rejected'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {req.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={actionLoading === req.id}
                            onClick={() => handleAction(req.id, 'approve')}
                            className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            disabled={actionLoading === req.id}
                            onClick={() => handleAction(req.id, 'reject')}
                            className="p-1.5 bg-rose-500 hover:bg-rose-600 text-slate-950 font-bold rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
