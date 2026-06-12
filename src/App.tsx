import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { SmartSwing } from './pages/SmartSwing';
import { AssetsList } from './pages/AssetsList';
import { IntelligenceHub } from './pages/IntelligenceHub';
import { AssetDetail } from './pages/AssetDetail';
import { SipTracker } from './pages/SipTracker';
import { Accuracy } from './pages/Accuracy';
import { MarketingHub } from './pages/MarketingHub';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Privacy from './pages/legal/Privacy';
import Terms from './pages/legal/Terms';
import Disclaimer from './pages/legal/Disclaimer';
import { BangOnLogo } from './components/BangOnLogo';
import { AuthProvider, useAuth } from './services/AuthProvider';
import { AuthModal } from './components/AuthModal';
import { importAsset } from './api';
import { 
  TrendingUp, 
  Layers, 
  Award, 
  HelpCircle, 
  Activity, 
  Menu, 
  X, 
  Coins, 
  ShieldCheck, 
  Sparkles,
  Bell,
  LogOut,
  User as UserIcon,
  Check,
  Settings,
  AlertTriangle,
  Flame
} from 'lucide-react';

function getNSEStatus() {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric'
    });
    const parts = formatter.formatToParts(now);
    const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
    
    const day = partMap.weekday;
    const hour = parseInt(partMap.hour);
    const minute = parseInt(partMap.minute);
    
    const isWeekend = day === 'Sat' || day === 'Sun';
    if (isWeekend) {
      return { status: 'CLOSED', message: 'Weekend Close (IST)', color: 'text-amber-500 bg-amber-500/10 border border-amber-500/20' };
    }
    
    const timeInMinutes = hour * 60 + minute;
    const preMarketStart = 9 * 60; // 9:00 AM
    const marketStart = 9 * 60 + 15; // 9:15 AM
    const marketEnd = 15 * 60 + 30; // 3:30 PM
    
    if (timeInMinutes >= preMarketStart && timeInMinutes < marketStart) {
      return { status: 'PRE-OPEN', message: 'NSE Pre-Open (IST)', color: 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/20' };
    } else if (timeInMinutes >= marketStart && timeInMinutes <= marketEnd) {
      return { status: 'LIVE', message: 'NSE Market Open (IST)', color: 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 animate-pulse' };
    } else {
      return { status: 'CLOSED', message: 'NSE Market Closed (IST)', color: 'text-slate-400 bg-slate-900 border border-slate-800' };
    }
  } catch (e) {
    return { status: 'LIVE', message: 'NSE Active (IST)', color: 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 animate-pulse' };
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [marketHours, setMarketHours] = useState(getNSEStatus());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showInterestSettings, setShowInterestSettings] = useState(false);

  const [guestMode, setGuestMode] = useState(false);

  useEffect(() => {
    localStorage.removeItem('bangon_guest_mode');
    setGuestMode(false);
  }, []);

  const [onboarded, setOnboarded] = useState(() => {
    return localStorage.getItem('bangon_onboarded') === 'true';
  });

  const { 
    user, 
    userProfile, 
    logOut, 
    notifications, 
    markNotificationRead, 
    clearAllNotifications,
    updateInterests,
    updateOnboardingSettings,
    addCustomAsset
  } = useAuth();

  // Watch intervals for market hours
  useEffect(() => {
    const timer = setInterval(() => {
      setMarketHours(getNSEStatus());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Sync Firebase onboarding status with state and local storage
  useEffect(() => {
    if (user && userProfile) {
      if (userProfile.onboarded) {
        localStorage.setItem('bangon_onboarded', 'true');
        if (userProfile.capital) {
          localStorage.setItem('bangon_capital', userProfile.capital.toString());
        }
        if (userProfile.riskPercent) {
          localStorage.setItem('bangon_risk', userProfile.riskPercent.toString());
        }
        if (userProfile.focusMarkets) {
          localStorage.setItem('bangon_focus_markets', JSON.stringify(userProfile.focusMarkets));
        }
        setOnboarded(true);
        // Dispatch to update active tab/context values in other open components
        window.dispatchEvent(new Event('storage'));
      } else {
        // If they are logged in but don't have onboarding in their Firebase profile yet,
        // let's check if they have it in localStorage (onboarded as guest before log in) and sync it!
        const hasLocalOnboarded = localStorage.getItem('bangon_onboarded') === 'true';
        if (hasLocalOnboarded) {
          const cap = Number(localStorage.getItem('bangon_capital') || '50000');
          const risk = Number(localStorage.getItem('bangon_risk') || '2');
          let markets: string[] = ['etfs', 'large-cap'];
          try {
            markets = JSON.parse(localStorage.getItem('bangon_focus_markets') || '["etfs", "large-cap"]');
          } catch (e) {}
          
          updateOnboardingSettings(cap, risk, markets).then(() => {
            setOnboarded(true);
          }).catch(console.error);
        }
      }
    }
  }, [user, userProfile, updateOnboardingSettings]);

  // Close modals and clean guest flags upon sign in
  useEffect(() => {
    if (user) {
      setAuthModalOpen(false);
      setGuestMode(false);
      localStorage.removeItem('bangon_guest_mode');
    }
  }, [user]);

  // Merge guest custom assets to logged-in user profile on sign in
  useEffect(() => {
    if (user && userProfile) {
      const guestCustom = localStorage.getItem('guest_custom_assets');
      if (guestCustom) {
        try {
          const parsed = JSON.parse(guestCustom) as string[];
          if (parsed && parsed.length > 0) {
            const syncSeq = async () => {
              for (const sym of parsed) {
                try {
                  await addCustomAsset(sym);
                } catch (e) {
                  console.error('Error syncing guest custom asset:', e);
                }
              }
              localStorage.removeItem('guest_custom_assets');
            };
            syncSeq();
          }
        } catch (e) {}
      }
    }
  }, [user, userProfile]);

  // Synchronously heal/pre-register custom imported assets on the server
  useEffect(() => {
    const customList: string[] = [];
    if (user && userProfile && userProfile.customAssets) {
      customList.push(...userProfile.customAssets);
    } else if (!user) {
      // In guest mode, read from localStorage
      const guestCustom = localStorage.getItem('guest_custom_assets');
      if (guestCustom) {
        try {
          const parsed = JSON.parse(guestCustom) as string[];
          customList.push(...parsed);
        } catch (e) {}
      }
    }

    if (customList.length > 0) {
      // Background trigger import for each custom asset sequentially
      // to ensure the server's transient SQLite database knows about them.
      const syncCustomAssets = async () => {
        for (const symbol of customList) {
          try {
            await importAsset(symbol);
          } catch (e) {
            console.warn(`[App sync] Silent recovery failed for custom asset ${symbol}:`, e);
          }
        }
      };
      syncCustomAssets();
    }
  }, [user, userProfile?.customAssets]);

  const handleLogout = async () => {
    localStorage.removeItem('bangon_guest_mode');
    localStorage.removeItem('bangon_onboarded');
    localStorage.removeItem('bangon_capital');
    localStorage.removeItem('bangon_risk');
    localStorage.removeItem('bangon_focus_markets');
    localStorage.removeItem('guest_custom_assets');
    setGuestMode(false);
    setOnboarded(false);
    await logOut();
  };

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  // List of standard toggleable symbols in dashboard interests
  const POPULAR_ASSETS = [
    { symbol: 'ADANIPOWER.NS', label: 'Adani Power' },
    { symbol: 'SUZLON.NS', label: 'Suzlon Energy' },
    { symbol: 'TATAMOTORS.NS', label: 'Tata Motors' },
    { symbol: 'RELIANCE.NS', label: 'Reliance Industries' },
    { symbol: 'GOLDBEES.NS', label: 'Gold BeES' },
    { symbol: 'SILVERBEES.NS', label: 'Silver BeES' },
    { symbol: 'WAAREEENER.NS', label: 'Waaree Energies' }
  ];

  const userInterests = userProfile?.interestedSymbols || ['TATAMOTORS.NS', 'ADANIPOWER.NS', 'SUZLON.NS'];

  const handleToggleInterest = async (symbol: string) => {
    const isInterested = userInterests.includes(symbol);
    const updated = isInterested 
      ? userInterests.filter(s => s !== symbol)
      : [...userInterests, symbol];
    await updateInterests(updated);
  };

  // 1. Conditional landing screen & stand-alone legal systems
  const isLegalPage = location.pathname === '/privacy' || 
                       location.pathname === '/terms' || 
                       location.pathname === '/disclaimer';

  if (isLegalPage) {
    return (
      <Routes>
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
      </Routes>
    );
  }

  const isLandingOnlyRoute = location.pathname === '/landing' || location.pathname === '/home';

  if (isLandingOnlyRoute || !user) {
    return (
      <>
        <Landing 
          onEnterGuestMode={() => {
            if (user) {
              navigate('/');
            } else {
              setAuthModalOpen(true);
            }
          }} 
          onOpenAuth={() => setAuthModalOpen(true)} 
        />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </>
    );
  }

  // 2. Conditional onboarding screen
  if (!onboarded) {
    return (
      <Onboarding 
        onComplete={(capital, risk, markets) => {
          localStorage.setItem('bangon_onboarded', 'true');
          localStorage.setItem('bangon_capital', capital.toString());
          localStorage.setItem('bangon_risk', risk.toString());
          localStorage.setItem('bangon_focus_markets', JSON.stringify(markets));
          
          if (user) {
            updateOnboardingSettings(capital, risk, markets)
              .then(() => setOnboarded(true))
              .catch(() => setOnboarded(true)); // fallback to load the dashboard anyway
          } else {
            setOnboarded(true);
          }
        }} 
        onSkip={() => {
          localStorage.setItem('bangon_onboarded', 'true');
          // provide safe defaults for guest or cloud
          const cap = 50000;
          const risk = 2;
          const markets = ['etfs', 'large-cap'];
          localStorage.setItem('bangon_capital', cap.toString());
          localStorage.setItem('bangon_risk', risk.toString());
          localStorage.setItem('bangon_focus_markets', JSON.stringify(markets));

          if (user) {
            updateOnboardingSettings(cap, risk, markets)
              .then(() => setOnboarded(true))
              .catch(() => setOnboarded(true));
          } else {
            setOnboarded(true);
          }
        }} 
        onCancel={() => {
          if (user) {
            handleLogout();
          } else {
            localStorage.removeItem('bangon_guest_mode');
            setGuestMode(false);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#05070C] text-[#F0F4FF] font-body selection:bg-[#D4A843]/30 flex flex-col md:flex-row relative overflow-hidden">
      {/* Ambient background blur circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[rgba(212,168,67,0.02)] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[rgba(0,208,132,0.02)] rounded-full blur-[120px] pointer-events-none" />

      {/* MOBILE UPPER HEADER BAR */}
      <header className="md:hidden flex h-16 border-b border-[rgba(255,255,255,0.05)] bg-[#05070C]/90 backdrop-blur-md sticky top-0 z-50 items-center justify-between px-6 w-full">
        <Link to="/" className="flex items-center">
          <BangOnLogo size={32} showText={true} />
        </Link>
        
        <div className="flex items-center gap-2">
          {/* Notif Bell */}
          <button 
            onClick={() => setNotifOpen(!notifOpen)}
            className="p-2 text-[#8892A4] hover:text-[#F0F4FF] relative bg-transparent border border-[rgba(255,255,255,0.06)] rounded-lg transition-colors"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#00D084] font-data text-[8px] font-black leading-none text-black animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 px-2 border border-[rgba(255,255,255,0.06)] text-[#8892A4] hover:text-[#F0F4FF] rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>

      {/* SIDEBAR NAVIGATION (PERSISTENT DESKTOP) */}
      <aside className="hidden md:flex flex-col w-56 bg-[rgba(255,255,255,0.02)] backdrop-blur-lg border-r border-[rgba(255,255,255,0.05)] p-5 z-40 shrink-0 select-none justify-between h-screen sticky top-0">
        <div className="space-y-6">
          {/* Logo segment with subtle gold gradient glow */}
          <div className="flex flex-col gap-1 pb-4 border-b border-[rgba(255,255,255,0.04)] relative">
            <div className="absolute inset-x-0 bottom-0 top-0 bg-radial from-[#D4A843]/15 via-transparent to-transparent blur-md -z-10 pointer-events-none" />
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center">
                <BangOnLogo size={36} showText={true} />
              </Link>
            </div>
          </div>

          {/* User Account / Profile Sync Segment */}
          <div className="glass-card p-4 space-y-3 transition-colors bg-white/[0.02] border border-white/[0.04] rounded-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-[#D4A843]/10 to-transparent blur-sm pointer-events-none" />
            {user ? (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#D4A843] to-[#E8C070] flex items-center justify-center font-data text-xs font-black text-[#05070C] uppercase shadow-md animate-float">
                    {userProfile?.displayName ? userProfile.displayName.charAt(0) : user.email?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-[#F0F4FF] truncate font-body">
                      {userProfile?.displayName || user.email?.split('@')[0]}
                    </h4>
                    <span className="text-[8.5px] text-[#D4A843] font-data border border-[#D4A843]/20 px-1 py-0.2 rounded bg-[#D4A843]/5 uppercase tracking-wide">PRO PLAN</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <button 
                    onClick={() => setNotifOpen(true)}
                    className="flex-1 py-1 rounded-lg bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.05)] text-[9.5px] font-data text-center flex items-center justify-center gap-1 text-[#8892A4] hover:text-[#F0F4FF] transition-colors"
                  >
                    <Bell size={10} /> ALERTS ({unreadCount})
                  </button>
                  <button 
                    onClick={() => handleLogout()}
                    title="Logout"
                    className="p-1.5 rounded-lg bg-[rgba(255,255,255,0.03)] hover:bg-[#FF4757]/15 border border-[rgba(255,255,255,0.05)] hover:border-[#FF4757]/30 text-[#8892A4] hover:text-[#FF4757] transition-colors"
                  >
                    <LogOut size={11} />
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2 text-center">
                <div className="space-y-0.5">
                  <h4 className="text-[11px] font-medium text-[#8892A4] font-body tracking-tight">GUEST_MODE_ACTIVE</h4>
                  <p className="text-[9px] text-[#4A5568] font-data leading-normal">Data is cached locally</p>
                </div>
                <button 
                  onClick={() => setAuthModalOpen(true)}
                  className="w-full py-1.5 bg-[#D4A843] hover:bg-[#E8C070] text-[#05070C] text-[10.5px] font-data tracking-wider rounded-lg cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-[#D4A843]/10"
                >
                  SECURE_CLOUD_SYNC
                </button>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <NavLink 
              to="/" 
              className={({ isActive }) => 
                `flex items-center gap-2.5 px-3 py-2 rounded-lg border-l-2 font-body text-[12.5px] transition-all duration-150 ${
                  isActive 
                    ? 'nav-active text-white font-medium' 
                    : 'border-l-transparent text-[#8892A4] hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
                }`
              }
            >
              <Activity size={14} className="nav-icon" />
              Dashboard
            </NavLink>

            <NavLink 
              to="/smart-swing" 
              className={({ isActive }) => 
                `flex items-center gap-2.5 px-3 py-2 rounded-lg border-l-2 font-body text-[12.5px] transition-all duration-150 ${
                  isActive 
                    ? 'nav-active text-white font-medium' 
                    : 'border-l-transparent text-[#8892A4] hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
                }`
              }
            >
              <TrendingUp size={14} className="nav-icon" />
              Smart Swing
            </NavLink>

            <NavLink 
              to="/assets" 
              className={({ isActive }) => 
                `flex items-center gap-2.5 px-3 py-2 rounded-lg border-l-2 font-body text-[12.5px] transition-all duration-150 ${
                  isActive 
                    ? 'nav-active text-white font-medium' 
                    : 'border-l-transparent text-[#8892A4] hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
                }`
              }
            >
              <Layers size={14} className="nav-icon" />
              Assets index
            </NavLink>

            <NavLink 
              to="/sip" 
              className={({ isActive }) => 
                `flex items-center gap-2.5 px-3 py-2 rounded-lg border-l-2 font-body text-[12.5px] transition-all duration-150 ${
                  isActive 
                    ? 'nav-active text-white font-medium' 
                    : 'border-l-transparent text-[#8892A4] hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
                }`
              }
            >
              <Coins size={14} className="nav-icon" />
              SIP Strategy Hub
            </NavLink>

            <NavLink 
              to="/accuracy" 
              className={({ isActive }) => 
                `flex items-center gap-2.5 px-3 py-2 rounded-lg border-l-2 font-body text-[12.5px] transition-all duration-150 ${
                  isActive 
                    ? 'nav-active text-white font-medium' 
                    : 'border-l-transparent text-[#8892A4] hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
                }`
              }
            >
              <Award size={14} className="nav-icon" />
              Accuracy Matrix
            </NavLink>

            <NavLink 
              to="/marketing-hub" 
              className={({ isActive }) => 
                `flex items-center gap-2.5 px-3 py-2 rounded-lg border-l-2 font-body text-[12.5px] transition-all duration-150 ${
                  isActive 
                    ? 'nav-active text-white font-medium' 
                    : 'border-l-transparent text-[#8892A4] hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
                }`
              }
            >
              <Flame size={14} className="nav-icon text-amber-500 animate-pulse" />
              Launch/Creator Hub
            </NavLink>
          </nav>
          
          <div className="pt-2.5 px-1 border-t border-[rgba(255,255,255,0.04)] mt-2">
            <Link 
              to="/landing" 
              className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-mono text-[#8892A4] hover:text-[#D4A843] transition-colors"
            >
              ← Back to landing page
            </Link>
          </div>
        </div>

        {/* Sidebar Footer Info */}
        <div className="space-y-3.5 border-t border-[rgba(255,255,255,0.04)] pt-4 mt-auto">
          {/* Indian Market Hours Pulse Indicator */}
          <div className="p-3 bg-[rgba(255,255,255,0.01)] rounded-lg border border-[rgba(255,255,255,0.03)]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] text-[#4A5568] font-data uppercase tracking-wider">Trading Desk</span>
              <span className={`text-[8px] font-data font-bold px-1.5 py-0.5 rounded uppercase leading-none ${
                marketHours.status === 'NSE OPEN' ? 'bg-[#00D084]/10 text-[#00D084]' : 'bg-[#FF4757]/10 text-[#FF4757]'
              }`}>
                {marketHours.status}
              </span>
            </div>
            <p className="text-[10px] text-[#8892A4] font-body truncate mt-1">{marketHours.message}</p>
          </div>

          <div className="py-1 px-2.5 bg-[rgba(255,255,255,0.02)] rounded-lg border border-transparent flex items-center justify-between">
            <span className="text-[8.5px] text-[#4A5568] font-data uppercase tracking-wider leading-none">SIGNALS</span>
            <div className="flex items-center gap-1 text-[9.5px] font-data font-bold text-[#00D084] leading-none">
              ★ BANG_ON_ACTIVE
            </div>
          </div>
        </div>
      </aside>

      {/* OVERLAY MOBILE NAVIGATION DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div 
            className="absolute left-0 top-0 bottom-0 w-64 bg-[#090d16] border-r border-slate-800 p-6 flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                <BangOnLogo size={36} showText={true} />
              </Link>
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Mobile Account Details */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-850/60">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center font-mono text-[10px] font-black text-black uppercase">
                      {userProfile?.displayName ? userProfile.displayName.charAt(0) : user.email?.charAt(0)}
                    </div>
                    <span className="text-xs font-black font-mono truncate text-slate-200">
                      {userProfile?.displayName || user.email?.split('@')[0]}
                    </span>
                  </div>
                  <button 
                    onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                    className="w-full py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-[10px] font-bold font-mono text-zinc-400 hover:text-white flex items-center justify-center gap-1.5"
                  >
                    <LogOut size={10} /> Logout
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => { setMobileMenuOpen(false); setAuthModalOpen(true); }}
                  className="w-full py-1.5 bg-emerald-500 text-black font-mono text-xs font-black uppercase text-center rounded-lg"
                >
                  🔐 Login Cloud Sync
                </button>
              )}
            </div>

            <nav className="space-y-3">
              <NavLink 
                to="/" 
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-mono uppercase tracking-wider text-xs font-bold ${
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-850'
                  }`
                }
              >
                <Activity size={15} />
                Dashboard
              </NavLink>

              <NavLink 
                to="/smart-swing" 
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-mono uppercase tracking-wider text-xs font-bold ${
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-850'
                  }`
                }
              >
                <TrendingUp size={15} />
                Smart Swing
              </NavLink>

              <NavLink 
                to="/assets" 
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-mono uppercase tracking-wider text-xs font-bold ${
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-850'
                  }`
                }
              >
                <Layers size={15} />
                Assets index
              </NavLink>

              <NavLink 
                to="/sip" 
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-mono uppercase tracking-wider text-xs font-bold ${
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-850'
                  }`
                }
              >
                <Coins size={15} />
                SIP & Strategy Hub
              </NavLink>

              <NavLink 
                to="/accuracy" 
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-mono uppercase tracking-wider text-xs font-bold ${
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-850'
                  }`
                }
              >
                <Award size={15} />
                Accuracy
              </NavLink>

              <NavLink 
                to="/marketing-hub" 
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-mono uppercase tracking-wider text-xs font-bold ${
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-850'
                  }`
                }
              >
                <Flame size={15} className="text-amber-500 animate-pulse" />
                Launch/Creator Hub
              </NavLink>
              
              <Link
                to="/landing"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl font-mono uppercase tracking-wider text-[11px] font-bold text-[#8892A4] hover:text-[#D4A843] transition-colors"
              >
                ← Back to landing page
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* MAIN BODY AREA */}
      <div id="main-content-scroll" className="flex-1 overflow-y-auto h-screen relative z-10 w-full">
        {/* TOP MARQUEE TICKER (SUBTLE DESKTOP BAR) */}
        <div className="hidden border-b border-slate-850/60 bg-[#05070a] h-11 md:flex items-center w-full select-none relative overflow-hidden">
          <div className="px-5 h-full bg-[#05070a] border-r border-[#1e293b] flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-amber-500 font-bold shrink-0 z-10 relative">
            <Sparkles size={11} className="animate-pulse text-amber-500" />
            DISCLAIMER
          </div>
          <div className="flex-1 overflow-hidden h-full relative flex items-center z-0">
            <div className="flex gap-16 whitespace-nowrap animate-marquee shrink-0">
              <span className="font-mono text-[10px] text-amber-400/95 uppercase tracking-widest leading-none font-medium shrink-0 flex items-center gap-2">
                ⚠️ THIS IS NOT FINANCIAL ADVICE. THIS PORTAL OPERATES STRICTLY AS AN EDUCATIONAL AND RESEARCH TOOL ONLY.
              </span>
              <span className="font-mono text-[10px] text-amber-400/95 uppercase tracking-widest leading-none font-medium shrink-0 flex items-center gap-2">
                ⚠️ THIS IS NOT FINANCIAL ADVICE. THIS PORTAL OPERATES STRICTLY AS AN EDUCATIONAL AND RESEARCH TOOL ONLY.
              </span>
            </div>
          </div>

          {/* Quick Real-Time Alerts Bell on desktop bar */}
          <button 
            onClick={() => setNotifOpen(!notifOpen)}
            className="mr-6 p-1.5 hover:text-emerald-400 text-slate-400 transition-colors flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold tracking-wider rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-850 shrink-0 z-20 cursor-pointer"
          >
            <Bell size={13} className={unreadCount > 0 ? "animate-swing" : ""} />
            Alerts
            <span className="px-1.5 py-0.5 rounded bg-slate-950 font-black text-slate-200">
              {unreadCount}
            </span>
          </button>
        </div>

        <main className="max-w-7xl mx-auto p-6 lg:p-10 space-y-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/smart-swing" element={<SmartSwing />} />
            <Route path="/intelligence" element={<IntelligenceHub />} />
            <Route path="/assets" element={<AssetsList />} />
            <Route path="/asset/:symbol" element={<AssetDetail />} />
            <Route path="/sip" element={<SipTracker />} />
            <Route path="/accuracy" element={<Accuracy />} />
            <Route path="/marketing-hub" element={<MarketingHub />} />
          </Routes>
        </main>
      </div>

      {/* AUTH MODAL DIALOG */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* NOTIFICATIONS & USER INTERACTION CENTRE (SLIDING DRAWER) */}
      {notifOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={() => setNotifOpen(false)}>
          <div 
            className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-screen flex flex-col p-6 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white">
                <Bell size={18} className="text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-black font-mono uppercase tracking-wider">Smart Signal Notifications</h3>
              </div>
              <button 
                onClick={() => setNotifOpen(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-Header / Settings Toggle */}
            <div className="my-3 py-2 px-3.5 bg-slate-955/60 border border-slate-850 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 font-mono uppercase font-bold block">User Alert Interests</span>
                <span className="text-[11px] text-emerald-400 font-black font-mono">
                  {userInterests.length} Target Stocks Active
                </span>
              </div>
              <button 
                onClick={() => setShowInterestSettings(!showInterestSettings)}
                className="p-1 px-2.5 rounded-lg border border-slate-800 hover:border-slate-705 bg-slate-950/40 text-[10px] font-bold font-mono text-slate-300 hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Settings size={11} /> {showInterestSettings ? 'Hide Settings' : 'Configure'}
              </button>
            </div>

            {/* Dynamic Interest Preferences (Simplest checkbox configuration layout possible) */}
            {showInterestSettings && (
              <div className="p-4 rounded-xl border border-slate-850 bg-slate-950/40 space-y-3 mb-4 animate-fadeIn">
                <div className="flex justify-between items-baseline">
                  <h4 className="text-[10px] font-black tracking-wider uppercase font-mono text-indigo-400">Target Notification Toggles</h4>
                  <p className="text-[9px] text-slate-500 font-mono">Select what systems track for you</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  {POPULAR_ASSETS.map((asset) => {
                    const active = userInterests.includes(asset.symbol);
                    return (
                      <button 
                        key={asset.symbol}
                        onClick={() => handleToggleInterest(asset.symbol)}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                          active 
                            ? 'bg-slate-850 border-emerald-500/30 text-emerald-400 font-bold' 
                            : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        <span className="truncate">{asset.label}</span>
                        {active ? <Check size={11} className="text-emerald-400 shrink-0 ml-1" /> : <div className="w-2 h-2 rounded-full bg-slate-800 scale-75 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9px] text-slate-500 leading-normal italic font-mono">
                  💡 Interests like Suzlon, Adani Power or Tata Motors are monitored daily. Instantly alerts you inside this center with precise buy & accumulation actions!
                </p>
              </div>
            )}

            {/* Options Panel */}
            {notifications.length > 0 && (
              <div className="flex justify-end gap-2.5 mb-3 font-mono">
                <button 
                  onClick={() => clearAllNotifications()}
                  className="text-[10px] font-bold text-rose-450 hover:text-rose-400 py-1"
                >
                  Clear All Logs
                </button>
              </div>
            )}

            {/* Notification Alerts List */}
            <div className="flex-1 space-y-3 select-none">
              {notifications.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
                  <Flame className="text-slate-700 animate-pulse mb-3" size={24} />
                  <p className="text-[11px] font-mono text-slate-500 font-bold uppercase tracking-wider">No Active Alerts</p>
                  <p className="text-[10px] font-sans text-slate-600 mt-1 max-w-xs">
                    Try checking stock interests or refreshing dashboard predictions to trigger smart recommendation alerts.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif.notificationId}
                    onClick={() => !notif.read && markNotificationRead(notif.notificationId)}
                    className={`p-3.5 border rounded-xl flex flex-col gap-2 relative group transition-colors cursor-pointer ${
                      notif.read 
                        ? 'bg-slate-955/30 border-slate-850 text-slate-400' 
                        : 'bg-slate-850/40 hover:bg-slate-850 border-slate-750 text-slate-200'
                    }`}
                  >
                    {!notif.read && (
                      <span className="absolute top-3 right-3 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                    )}
                    
                    <div className="flex justify-between items-baseline font-mono text-[9px]">
                      <span className={`px-1.5 py-0.5 rounded font-black tracking-wider uppercase leading-none whitespace-nowrap text-[8px] ${
                        notif.signal === 'BUY' ? 'bg-emerald-950/45 text-emerald-400' : 'bg-rose-950/45 text-rose-400'
                      }`}>
                        {notif.signal === 'BUY' ? 'RECOMMENDED ACCUMULATION':'HOLD / TAKE GAINS'}
                      </span>
                      <span className="text-zinc-500 leading-none shrink-0">
                        {notif.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-[11px] font-sans font-medium leading-relaxed">
                      {notif.description}
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-mono border-t border-slate-850/60 pt-2 text-zinc-500">
                      <span>Symbol: <strong className="text-slate-300 font-bold">{notif.symbol}</strong></span>
                      <span>Trigger Price: <strong className="text-amber-400 font-bold">₹{notif.price.toLocaleString('en-IN')}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
