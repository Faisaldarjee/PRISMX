import React, { useState } from 'react';
import { Lock, Sparkles, X, QrCode, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthProvider';

// EDIT THIS UPI ID FOR YOUR BUSINESS/PERSONAL ACCOUNT
const UPGRADE_UPI_ID = 'faisaldarjee9@okicici'; 
const UPGRADE_AMOUNT = '199';

interface ProGateProps {
  feature: string;
  children: React.ReactNode;
  isPro: boolean;
}

export default function ProGate({ feature, children, isPro }: ProGateProps) {
  const [showModal, setShowModal] = useState(false);
  const [utr, setUtr] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: ''
  });

  const { user } = useAuth();

  if (isPro) return <>{children}</>;

  // Build standard UPI string for apps/QR codes
  const transactionNote = user?.email ? `PRISMX PRO - ${user.email.split('@')[0]}` : 'PRISMX PRO UPGRADE';
  const encodedNote = encodeURIComponent(transactionNote);
  
  const upiLink = `upi://pay?pa=${UPGRADE_UPI_ID}&pn=PRISMX&am=${UPGRADE_AMOUNT}&cu=INR&tn=${encodedNote}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiLink)}`;

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setStatus({ type: 'error', message: 'Please sign in to upgrade your account.' });
      return;
    }

    const cleanUtr = utr.trim();
    if (!/^\d{12}$/.test(cleanUtr)) {
      setStatus({ type: 'error', message: 'Please enter a valid 12-digit UPI UTR number.' });
      return;
    }

    setLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/user/submit-payment', {
        method: 'POST',
        headers,
        body: JSON.stringify({ utr: cleanUtr, amount: Number(UPGRADE_AMOUNT) })
      });

      const outcome = await res.json();

      if (!res.ok) {
        throw new Error(outcome?.error || 'Failed to submit payment reference.');
      }

      setStatus({
        type: 'success',
        message: 'Transaction reference submitted! Our admin team will verify it and activate your PRO status within 1-2 hours.'
      });
      setUtr('');
    } catch (err: any) {
      console.error('UTR Submission Error:', err);
      setStatus({
        type: 'error',
        message: err.message || 'An error occurred during submission. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative rounded-lg overflow-hidden">
      {/* Blurred overlay of underlying feature */}
      <div className="blur-md pointer-events-none select-none opacity-25">
        {children}
      </div>
      
      {/* Absolute overlay locking the view */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#05070C]/85 backdrop-blur-sm p-4 text-center">
        <div className="w-9 h-9 rounded-full border border-[#D4A843]/30 flex items-center justify-center bg-[#D4A843]/10">
          <Lock size={15} className="text-[#D4A843]" />
        </div>
        <div>
          <p className="text-[#F0F4FF] text-xs font-sans font-semibold tracking-wide">
            {feature}
          </p>
          <p className="text-[#8892A4] text-[10px] font-sans mt-0.5">
            Available in Pro plan
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="text-[10px] font-sans font-semibold text-[#0A0A0C] bg-[#D4A843] hover:bg-[#c29633] transition-colors px-3.5 py-2 rounded-md font-bold cursor-pointer"
        >
          Upgrade ₹{UPGRADE_AMOUNT}/month
        </button>
      </div>

      {/* UPI Payment Upgrade Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-xl border border-[#D4A843]/20 bg-[#0B0E14] p-6 shadow-2xl relative">
            <button 
              onClick={() => {
                setShowModal(false);
                setStatus({ type: null, message: '' });
              }}
              className="absolute top-4 right-4 text-[#8892A4] hover:text-[#F0F4FF] transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-full border border-[#D4A843]/30 flex items-center justify-center bg-[#D4A843]/10 mb-2.5">
                <Sparkles size={18} className="text-[#D4A843] animate-pulse" />
              </div>
              <h3 className="text-sm font-sans font-bold text-[#F0F4FF] uppercase tracking-wider">
                Upgrade to PRISMX PRO
              </h3>
              <p className="text-[11px] text-[#8892A4] font-sans mt-1.5 leading-relaxed">
                Get full algorithmic setups, multi-agent signals, smart money maps, and an ad-free experience.
              </p>

              {/* UPI Option Box */}
              <div className="mt-4 w-full bg-[#111622] rounded-xl p-4 border border-[#D4A843]/10 flex flex-col items-center">
                <div className="flex justify-between items-center w-full text-xs border-b border-white/[0.04] pb-2 mb-3">
                  <span className="text-[#8892A4] font-sans">PRISMX Premium</span>
                  <span className="text-[#D4A843] font-bold font-sans">₹{UPGRADE_AMOUNT} / month</span>
                </div>

                {/* QR Code Container */}
                <div className="bg-white p-2 rounded-lg shadow-inner mb-3 border border-[#D4A843]/10">
                  <img 
                    src={qrImageUrl} 
                    alt="Scan to Pay UPI" 
                    className="w-32 h-32 block"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-[#8892A4] font-sans mb-3 text-center">
                  <QrCode size={11} className="text-[#D4A843]" />
                  <span>Scan QR Code with GPay, PhonePe, or Paytm</span>
                </div>

                {/* Mobile Direct Pay Button */}
                <a 
                  href={upiLink}
                  className="w-full py-2 px-3 bg-[#1A2234] hover:bg-[#253047] text-white border border-[#D4A843]/20 text-[10px] font-sans font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Smartphone size={12} className="text-[#D4A843]" />
                  Pay via UPI App on Mobile
                </a>
              </div>

              {/* UTR Submission Form */}
              <form onSubmit={handleSubmitPayment} className="w-full mt-4 space-y-3">
                <div className="text-left">
                  <label className="block text-[10px] font-semibold text-[#8892A4] font-sans mb-1 uppercase tracking-wider">
                    Enter 12-Digit UPI Ref No. (UTR)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={utr}
                    onChange={(e) => setUtr(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 617294817294"
                    className="w-full px-3 py-2 text-xs text-white bg-[#111622] border border-white/[0.08] rounded-lg focus:outline-none focus:border-[#D4A843] transition-colors font-sans font-medium"
                  />
                </div>

                {status.type && (
                  <div className={`p-2.5 rounded-lg flex items-start gap-2 text-left text-[10px] leading-relaxed font-sans ${
                    status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {status.type === 'success' ? (
                      <CheckCircle size={13} className="shrink-0 mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertCircle size={13} className="shrink-0 mt-0.5 text-rose-400" />
                    )}
                    <span>{status.message}</span>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={loading || status.type === 'success'}
                  className="w-full text-xs font-sans font-semibold text-[#0A0A0C] bg-[#D4A843] hover:bg-[#b88c32] disabled:bg-[#3E382A] disabled:text-[#8892A4] py-2.5 rounded-lg transition-colors font-bold cursor-pointer"
                >
                  {loading ? 'Submitting Reference...' : status.type === 'success' ? 'Submitted' : 'Submit Reference for Verification'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
