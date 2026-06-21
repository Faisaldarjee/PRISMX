import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthProvider';
import { 
  Bell, 
  Mail, 
  Smartphone, 
  Clock, 
  Check, 
  AlertTriangle, 
  Sliders, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Sparkles 
} from 'lucide-react';

export interface NotificationPrefs {
  notifyHighConfidence: boolean;
  notifyEarnings: boolean;
  notifySector: boolean;
  notifySip: boolean;
  notifyAllSignals: boolean;
  channelInApp: boolean;
  channelEmail: boolean;
  channelPush: boolean;
  timing: 'immediately' | 'daily' | 'both';
  minConfidence: number;
}

const DEFAULT_PREFS: NotificationPrefs = {
  notifyHighConfidence: true,
  notifyEarnings: true,
  notifySector: true,
  notifySip: true,
  notifyAllSignals: false,
  channelInApp: true,
  channelEmail: true,
  channelPush: false,
  timing: 'immediately',
  minConfidence: 80
};

export const NotificationPreferences: React.FC = () => {
  const { user, userProfile, updateNotificationPrefs } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [fcmSupported, setFcmSupported] = useState(true);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');

  // Load preferences
  useEffect(() => {
    if (user && userProfile?.notificationPrefs) {
      setPrefs({ ...DEFAULT_PREFS, ...userProfile.notificationPrefs });
    } else {
      // Guest local storage recovery
      const local = localStorage.getItem('prism_guest_notif_prefs');
      if (local) {
        try {
          setPrefs(JSON.parse(local));
        } catch {
          // ignore cache issue
        }
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission);
    } else {
      setFcmSupported(false);
    }
  }, [user, userProfile]);

  // Request push notifications permissions
  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      
      if (permission === 'granted') {
        const updated = { ...prefs, channelPush: true };
        setPrefs(updated);
        await savePrefs(updated);
      } else {
        const updated = { ...prefs, channelPush: false };
        setPrefs(updated);
        await savePrefs(updated);
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  };

  const savePrefs = async (newPrefs: NotificationPrefs) => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await updateNotificationPrefs(newPrefs);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Prefs save issue:', err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationPrefs) => {
    // Prevent toggling Push directly if permission not granted
    if (key === 'channelPush' && permissionState !== 'granted') {
      requestPushPermission();
      return;
    }

    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    savePrefs(updated);
  };

  const handleConfidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const updated = { ...prefs, minConfidence: val };
    setPrefs(updated);
  };

  const handleConfidenceRelease = () => {
    savePrefs(prefs);
  };

  const handleTimingChange = (timing: NotificationPrefs['timing']) => {
    const updated = { ...prefs, timing };
    setPrefs(updated);
    savePrefs(updated);
  };

  return (
    <div id="notif-prefs-panel" className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 md:p-5 space-y-5">
      {/* Panel Header */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-850/60">
        <div className="flex items-center gap-2">
          <Sliders className="text-blue-400 stroke-[2.5]" size={16} />
          <h3 className="text-xs font-black tracking-wider uppercase font-mono text-slate-200">Alert Engine Settings</h3>
        </div>
        {saveStatus === 'success' && (
          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-950/45 px-2 py-0.5 rounded-md border border-emerald-500/15">
            <Check size={10} /> Auto-Saved
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="text-[10px] text-rose-400 font-mono flex items-center gap-1 bg-rose-950/45 px-2 py-0.5 rounded-md border border-rose-500/15">
            <AlertTriangle size={10} /> Save Failed
          </span>
        )}
      </div>

      {/* Trigger Categories section */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-slate-500 tracking-wider font-mono uppercase">What events trigger alerts?</h4>
        
        <div className="space-y-2">
          {/* High Confidence Toggles */}
          <div className="flex items-start justify-between p-2.5 rounded-xl bg-slate-955/40 border border-slate-850/60 hover:border-slate-800 transition-colors">
            <div className="space-y-0.5 pr-4">
              <span className="text-[11px] font-bold text-slate-200 block">High Confidence Signals</span>
              <span className="text-[10px] text-slate-400 block leading-relaxed">
                Receive Alerts for BUY or SELL signals that exceed your threshold limit.
              </span>
            </div>
            <button 
              onClick={() => handleToggle('notifyHighConfidence')}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                prefs.notifyHighConfidence ? 'bg-blue-500' : 'bg-slate-800'
              }`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                prefs.notifyHighConfidence ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Earnings warnings */}
          <div className="flex items-start justify-between p-2.5 rounded-xl bg-slate-955/40 border border-slate-850/60 hover:border-slate-800 transition-colors">
            <div className="space-y-0.5 pr-4">
              <span className="text-[11px] font-bold text-slate-200 block">Earnings Warnings</span>
              <span className="text-[10px] text-slate-400 block leading-relaxed">
                Alert within 3 days of quarterly results for symbols on your watchlist.
              </span>
            </div>
            <button 
              onClick={() => handleToggle('notifyEarnings')}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                prefs.notifyEarnings ? 'bg-blue-500' : 'bg-slate-800'
              }`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                prefs.notifyEarnings ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Sector Momentum updates */}
          <div className="flex items-start justify-between p-2.5 rounded-xl bg-slate-955/40 border border-slate-850/60 hover:border-slate-800 transition-colors">
            <div className="space-y-0.5 pr-4">
              <span className="text-[11px] font-bold text-slate-200 block">Sector Momentum Sweeps</span>
              <span className="text-[10px] text-slate-400 block leading-relaxed">
                Notifies you immediately when sector ratings exceed extreme indices (85+ Score).
              </span>
            </div>
            <button 
              onClick={() => handleToggle('notifySector')}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                prefs.notifySector ? 'bg-blue-500' : 'bg-slate-800'
              }`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                prefs.notifySector ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* ETF SIP updates */}
          <div className="flex items-start justify-between p-2.5 rounded-xl bg-slate-955/40 border border-slate-850/60 hover:border-slate-800 transition-colors">
            <div className="space-y-0.5 pr-4">
              <span className="text-[11px] font-bold text-slate-200 block">ETF SIP Timing Alarm</span>
              <span className="text-[10px] text-slate-400 block leading-relaxed">
                Triggers when GOLDBEES or SILVERBEES RSI falls below oversold (RSI &lt; 35).
              </span>
            </div>
            <button 
              onClick={() => handleToggle('notifySip')}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                prefs.notifySip ? 'bg-blue-500' : 'bg-slate-800'
              }`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                prefs.notifySip ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Confidence Minimum Limit Slider */}
      <div className="p-3 bg-slate-955/35 border border-slate-850 rounded-xl space-y-2">
        <div className="flex justify-between items-center font-mono">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Confidence Threshold</span>
          <span className="text-[11px] font-bold text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-500/10">
            {prefs.minConfidence}% Confidence
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-505 font-mono">60%</span>
          <input 
            type="range"
            min="60"
            max="95"
            value={prefs.minConfidence}
            onChange={handleConfidenceChange}
            onMouseUp={handleConfidenceRelease}
            onTouchEnd={handleConfidenceRelease}
            className="flex-1 accent-blue-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-slate-505 font-mono">95%</span>
        </div>
        <p className="text-[9px] text-slate-500 italic font-medium leading-relaxed font-sans">
          🔥 Filters signals using specialized ML validation values. Higher values provide extreme reliability but less frequent signals.
        </p>
      </div>

      {/* Routing Delivery Channels */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-slate-500 tracking-wider font-mono uppercase">Delivery Routing Channels</h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* In-app channel toggle */}
          <button
            onClick={() => handleToggle('channelInApp')}
            className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all text-left cursor-pointer ${
              prefs.channelInApp 
                ? 'bg-blue-950/20 border-blue-500/40 text-blue-400' 
                : 'bg-slate-950/10 border-slate-850 text-slate-500'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Bell size={14} className={prefs.channelInApp ? 'text-blue-400' : 'text-slate-600'} />
              <div className={`w-3 h-3 rounded-md flex items-center justify-center border ${
                prefs.channelInApp ? 'bg-blue-500/20 border-blue-400' : 'border-slate-700'
              }`}>
                {prefs.channelInApp && <Check size={8} className="stroke-[2.5]" />}
              </div>
            </div>
            <span className="text-[11px] font-bold block">In-App Hub</span>
            <span className="text-[9px] text-slate-400 leading-snug">Immediate pop messages inside the sidebar.</span>
          </button>

          {/* Email channel toggle */}
          <button
            onClick={() => handleToggle('channelEmail')}
            className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all text-left cursor-pointer ${
              prefs.channelEmail 
                ? 'bg-blue-950/20 border-blue-500/40 text-blue-400' 
                : 'bg-slate-950/10 border-slate-850 text-slate-500'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Mail size={14} className={prefs.channelEmail ? 'text-blue-400' : 'text-slate-600'} />
              <div className={`w-3 h-3 rounded-md flex items-center justify-center border ${
                prefs.channelEmail ? 'bg-blue-500/20 border-blue-400' : 'border-slate-700'
              }`}>
                {prefs.channelEmail && <Check size={8} className="stroke-[2.5]" />}
              </div>
            </div>
            <span className="text-[11px] font-bold block">Email Alerts</span>
            <span className="text-[9px] text-slate-400 leading-snug">HTML trade summaries fired directly via Resend.</span>
          </button>

          {/* Web Push channel toggle */}
          <button
            onClick={() => handleToggle('channelPush')}
            disabled={!fcmSupported}
            className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all text-left disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer ${
              prefs.channelPush 
                ? 'bg-blue-950/20 border-blue-500/40 text-blue-400' 
                : 'bg-slate-950/10 border-slate-850 text-slate-500'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Smartphone size={14} className={prefs.channelPush ? 'text-blue-400' : 'text-slate-600'} />
              <div className={`w-3 h-3 rounded-md flex items-center justify-center border ${
                prefs.channelPush ? 'bg-blue-500/20 border-blue-400' : 'border-slate-700'
              }`}>
                {prefs.channelPush && <Check size={8} className="stroke-[2.5]" />}
              </div>
            </div>
            <span className="text-[11px] font-bold block">Browser Push</span>
            <span className="text-[9px] text-slate-400 leading-snug">
              {permissionState === 'denied' 
                ? 'Blocked by browser permissions.' 
                : 'Immediate notices on desktop / mobile.'}
            </span>
          </button>
        </div>
      </div>

      {/* Timing Schedule configurations */}
      <div className="space-y-3 pt-1">
        <h4 className="text-[10px] font-bold text-slate-500 tracking-wider font-mono uppercase">Delivery Timing Schedule</h4>
        
        <div className="grid grid-cols-3 gap-2 bg-slate-950/45 p-1 rounded-xl border border-slate-850/60 font-mono text-[10px] select-none">
          <button
            onClick={() => handleTimingChange('immediately')}
            className={`py-1.5 px-2 rounded-lg font-bold text-center transition-colors cursor-pointer ${
              prefs.timing === 'immediately' 
                ? 'bg-blue-500 text-slate-100' 
                : 'text-slate-450 hover:text-slate-350'
            }`}
          >
            Immediate Alert
          </button>
          
          <button
            onClick={() => handleTimingChange('daily')}
            className={`py-1.5 px-2 rounded-lg font-bold text-center transition-colors cursor-pointer ${
              prefs.timing === 'daily' 
                ? 'bg-blue-500 text-slate-100' 
                : 'text-slate-450 hover:text-slate-350'
            }`}
          >
            4 PM Digest
          </button>
          
          <button
            onClick={() => handleTimingChange('both')}
            className={`py-1.5 px-2 rounded-lg font-bold text-center transition-colors cursor-pointer ${
              prefs.timing === 'both' 
                ? 'bg-blue-500 text-slate-100' 
                : 'text-slate-450 hover:text-slate-350'
            }`}
          >
            Both Streams
          </button>
        </div>
      </div>
    </div>
  );
};
