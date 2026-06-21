import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  userId: string;
  email: string;
  displayName?: string;
  createdAt: any;
  isPro?: boolean;
  plan?: string;
  earlyAccessNumber?: number | null;
  earlyAccessGrantedAt?: string | null;
  earlyAccessExpiresAt?: string | null;
  proStartDate?: string | null;
  proEndDate?: string | null;
  razorpaySubscriptionId?: string | null;
  interestedSymbols: string[];
  onboarded?: boolean;
  capital?: number;
  riskPercent?: number;
  focusMarkets?: string[];
  customAssets?: string[];
  notificationPrefs?: any;
}

export interface Watchlist {
  userId: string;
  symbols: string[];
}

export interface PortfolioPurchase {
  purchaseId: string;
  userId: string;
  symbol: string;
  buyPrice: number;
  quantity: number;
  date: string;
  systematicAmount?: number;
}

export interface SignalNotification {
  notificationId: string;
  userId: string;
  symbol: string;
  signal: string;
  price: number;
  description: string;
  timestamp: Date;
  read: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userProfile: UserProfile | null;
  watchlist: string[];
  portfolio: PortfolioPurchase[];
  notifications: SignalNotification[];
  signUp: (emailStr: string, passwordStr: string, name: string) => Promise<void>;
  logIn: (emailStr: string, passwordStr: string) => Promise<void>;
  logInGoogle: (useRedirect?: boolean) => Promise<void>;
  logOut: () => Promise<void>;
  passwordReset: (emailStr: string) => Promise<void>;
  toggleWatchlist: (symbol: string) => Promise<void>;
  updateInterests: (symbols: string[]) => Promise<void>;
  updateOnboardingSettings: (capital: number, riskPercent: number, focusMarkets: string[]) => Promise<void>;
  addCustomAsset: (symbol: string) => Promise<void>;
  addPurchase: (item: Omit<PortfolioPurchase, 'purchaseId' | 'userId'>) => Promise<void>;
  removePurchase: (purchaseId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  generateAlertForInterestedSymbols: (predictions: any[], assets: any[]) => Promise<void>;
  updateNotificationPrefs: (newPrefs: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// Maps Postgres snake_case fields to frontend camelCase UserProfile fields
function mapProfile(p: any): UserProfile {
  return {
    userId: p.id,
    email: p.email,
    displayName: p.display_name,
    createdAt: p.created_at,
    plan: p.plan,
    isPro: p.is_pro,
    earlyAccessNumber: p.early_access_number,
    earlyAccessGrantedAt: p.early_access_granted_at,
    earlyAccessExpiresAt: p.early_access_expires_at,
    proStartDate: p.pro_start_date,
    proEndDate: p.pro_end_date,
    razorpaySubscriptionId: p.razorpay_subscription_id,
    interestedSymbols: p.interested_symbols || [],
    customAssets: p.custom_assets || [],
    onboarded: p.onboarded,
    capital: p.capital ? Number(p.capital) : undefined,
    riskPercent: p.risk_percent ? Number(p.risk_percent) : undefined,
    focusMarkets: p.focus_markets || [],
    notificationPrefs: p.notification_prefs
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(['GOLDBEES.NS', 'SILVERBEES.NS']);
  const [portfolio, setPortfolio] = useState<PortfolioPurchase[]>([]);
  const [notifications, setNotifications] = useState<SignalNotification[]>([]);

  // Local storage guest fallbacks when offline or unauthenticated
  useEffect(() => {
    if (!user) {
      const storedWatchlist = localStorage.getItem('guest_watchlist');
      if (storedWatchlist) {
        setWatchlist(JSON.parse(storedWatchlist));
      } else {
        setWatchlist(['GOLDBEES.NS', 'SILVERBEES.NS', 'TATAMOTORS.NS']);
      }

      const storedPortfolio = localStorage.getItem('guest_portfolio');
      if (storedPortfolio) {
        setPortfolio(JSON.parse(storedPortfolio));
      } else {
        setPortfolio([
          { purchaseId: 'p1', symbol: 'GOLDBEES.NS', buyPrice: 58.5, quantity: 100, date: '2026-05-15' },
          { purchaseId: 'p2', symbol: 'SILVERBEES.NS', buyPrice: 78.2, quantity: 150, date: '2026-05-20' }
        ]);
      }

      const storedNotifications = localStorage.getItem('guest_notifications');
      if (storedNotifications) {
        setNotifications(JSON.parse(storedNotifications).map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) })));
      } else {
        setNotifications([
          {
            notificationId: 'n_welcome',
            userId: 'guest',
            symbol: 'PRISMX',
            signal: 'WELCOME',
            price: 0,
            description: 'Your guest workspace is ready. Explore the Smart Swing scanner or search any NSE stock.',
            timestamp: new Date(),
            read: false
          }
        ]);
      }
    }
  }, [user]);

  // Auth state listener and database syncing
  useEffect(() => {
    let watchlistsChannel: any = null;
    let portfoliosChannel: any = null;
    let notificationsChannel: any = null;

    const syncUserSession = async (sessionUser: User | null) => {
      setUser(sessionUser);

      // Clean up previous real-time subscriptions
      if (watchlistsChannel) { watchlistsChannel.unsubscribe(); watchlistsChannel = null; }
      if (portfoliosChannel) { portfoliosChannel.unsubscribe(); portfoliosChannel = null; }
      if (notificationsChannel) { notificationsChannel.unsubscribe(); notificationsChannel = null; }

      if (sessionUser) {
        const uId = sessionUser.id;
        console.log('[Auth] User authenticated with Supabase:', sessionUser.email);

        // 1. Fetch & Check User Profile Expiration
        const loadProfile = async () => {
          const { data: profileData, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', uId)
            .maybeSingle();

          if (error) {
            console.error('Error fetching user profile:', error.message);
            return;
          }

          if (profileData) {
            let currentPlan = profileData.plan;
            let currentIsPro = profileData.is_pro;

            // Check pro_early access expiry
            if (profileData.plan === 'pro_early' && profileData.early_access_expires_at) {
              const expiry = new Date(profileData.early_access_expires_at);
              if (new Date() > expiry) {
                console.log('[Auth] Pro Early Access expired, reverting to Free...');
                const { error: updateErr } = await supabase
                  .from('user_profiles')
                  .update({ plan: 'free', is_pro: false })
                  .eq('id', uId);

                if (!updateErr) {
                  currentPlan = 'free';
                  currentIsPro = false;
                }
              }
            }

            // Check pro_paid expiry
            if (profileData.plan === 'pro_paid' && profileData.pro_end_date) {
              const expiry = new Date(profileData.pro_end_date);
              if (new Date() > expiry) {
                console.log('[Auth] Pro Paid Subscription expired, reverting to Free...');
                const { error: updateErr } = await supabase
                  .from('user_profiles')
                  .update({ plan: 'free', is_pro: false })
                  .eq('id', uId);

                if (!updateErr) {
                  currentPlan = 'free';
                  currentIsPro = false;
                }
              }
            }

            setUserProfile(mapProfile({
              ...profileData,
              plan: currentPlan,
              is_pro: currentIsPro
            }));
          }
        };

        await loadProfile();

        // 2. Load and subscribe to Watchlist changes
        const loadWatchlist = async () => {
          const { data, error } = await supabase
            .from('watchlists')
            .select('symbols')
            .eq('user_id', uId)
            .maybeSingle();

          if (!error && data) {
            setWatchlist(data.symbols || []);
          }
        };

        await loadWatchlist();

        watchlistsChannel = supabase
          .channel(`public:watchlists:${uId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlists', filter: `user_id=eq.${uId}` }, (payload) => {
            if (payload.new && (payload.new as any).symbols) {
              setWatchlist((payload.new as any).symbols);
            }
          })
          .subscribe();

        // 3. Load and subscribe to Portfolio changes
        const loadPortfolio = async () => {
          const { data, error } = await supabase
            .from('portfolios')
            .select('*')
            .eq('user_id', uId);

          if (!error && data) {
            setPortfolio(data.map(item => ({
              purchaseId: item.id,
              userId: item.user_id,
              symbol: item.symbol,
              buyPrice: Number(item.buy_price),
              quantity: Number(item.quantity),
              date: item.date,
              systematicAmount: item.systematic_amount ? Number(item.systematic_amount) : undefined
            })));
          }
        };

        await loadPortfolio();

        portfoliosChannel = supabase
          .channel(`public:portfolios:${uId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'portfolios', filter: `user_id=eq.${uId}` }, () => {
            loadPortfolio();
          })
          .subscribe();

        // 4. Load and subscribe to Notifications changes
        const loadNotifications = async () => {
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', uId)
            .order('timestamp', { ascending: false });

          if (!error && data) {
            setNotifications(data.map(n => ({
              notificationId: n.id,
              userId: n.user_id,
              symbol: n.symbol,
              signal: n.signal,
              price: Number(n.price),
              description: n.description,
              timestamp: new Date(n.timestamp),
              read: n.read
            })));
          }
        };

        await loadNotifications();

        notificationsChannel = supabase
          .channel(`public:notifications:${uId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uId}` }, () => {
            loadNotifications();
          })
          .subscribe();
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    };

    // Initialize session and set listeners
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncUserSession(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUserSession(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
      if (watchlistsChannel) watchlistsChannel.unsubscribe();
      if (portfoliosChannel) portfoliosChannel.unsubscribe();
      if (notificationsChannel) notificationsChannel.unsubscribe();
    };
  }, []);

  // Synchronize user profile updates to backend SQL cache (optional background sync support)
  useEffect(() => {
    const syncProfileToServer = async () => {
      if (!user || !userProfile) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        await fetch('/api/user/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            uid: user.id,
            email: userProfile.email || user.email || '',
            displayName: userProfile.displayName || '',
            interestedSymbols: userProfile.interestedSymbols || [],
            notificationPrefs: userProfile.notificationPrefs || null
          })
        });
      } catch (err) {
        console.warn('[syncProfileToServer] background sync failed:', err);
      }
    };

    if (user && userProfile) {
      syncProfileToServer();
    }
  }, [user, userProfile]);

  // Auth Operations
  const signUp = async (emailStr: string, passwordStr: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailStr,
        password: passwordStr,
        options: {
          data: {
            full_name: name
          }
        }
      });
      if (error) throw error;
      console.log('[Auth] SignUp initiated successfully:', data.user?.email);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const logIn = async (emailStr: string, passwordStr: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: emailStr,
      password: passwordStr
    });
    if (error) throw error;
  };

  const logInGoogle = async (useRedirect = true) => {
    console.log('[Auth] Google OAuth initiated...');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard'
      }
    });
    if (error) throw error;
  };

  const logOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign out error:', error.message);
  };

  const passwordReset = async (emailStr: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(emailStr, {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (error) throw error;
  };

  // Watchlist Toggle
  const toggleWatchlist = async (symbol: string) => {
    const symUpper = symbol.toUpperCase();
    const updated = watchlist.includes(symUpper)
      ? watchlist.filter(s => s !== symUpper)
      : [...watchlist, symUpper];

    if (user) {
      const { error } = await supabase
        .from('watchlists')
        .upsert({ user_id: user.id, symbols: updated });
      if (error) console.error('Watchlist sync error:', error.message);
    } else {
      setWatchlist(updated);
      localStorage.setItem('guest_watchlist', JSON.stringify(updated));
    }
  };

  // Interests update
  const updateInterests = async (symbols: string[]) => {
    const formatted = symbols.map(s => s.toUpperCase());
    if (user) {
      const { error } = await supabase
        .from('user_profiles')
        .update({ interested_symbols: formatted })
        .eq('id', user.id);
      
      if (!error && userProfile) {
        setUserProfile({ ...userProfile, interestedSymbols: formatted });
      }
    } else {
      // Simulating guest profile
      const stored = localStorage.getItem('guest_profile') || '{}';
      const parsed = JSON.parse(stored);
      parsed.interestedSymbols = formatted;
      localStorage.setItem('guest_profile', JSON.stringify(parsed));
      setUserProfile({
        userId: 'guest',
        email: 'guest@prism.app',
        displayName: 'Guest',
        createdAt: new Date(),
        interestedSymbols: formatted
      });
    }
  };

  // Onboarding settings update
  const updateOnboardingSettings = async (capital: number, riskPercent: number, focusMarkets: string[]) => {
    if (user && userProfile) {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          onboarded: true,
          capital: Number(capital),
          risk_percent: Number(riskPercent),
          focus_markets: focusMarkets
        })
        .eq('id', user.id);

      if (!error) {
        setUserProfile({
          ...userProfile,
          onboarded: true,
          capital: Number(capital),
          riskPercent: Number(riskPercent),
          focusMarkets
        });
      }
    }
  };

  // Register custom imported asset in profile
  const addCustomAsset = async (symbol: string) => {
    const symUpper = symbol.toUpperCase().trim();
    if (!symUpper) return;

    if (user && userProfile) {
      const currentCustomList = userProfile.customAssets || [];
      if (!currentCustomList.includes(symUpper)) {
        const updated = [...currentCustomList, symUpper];
        const { error } = await supabase
          .from('user_profiles')
          .update({ custom_assets: updated })
          .eq('id', user.id);

        if (!error) {
          setUserProfile({
            ...userProfile,
            customAssets: updated
          });
        }
      }
    } else {
      const stored = localStorage.getItem('guest_custom_assets') || '[]';
      try {
        const parsed = JSON.parse(stored) as string[];
        if (!parsed.includes(symUpper)) {
          parsed.push(symUpper);
          localStorage.setItem('guest_custom_assets', JSON.stringify(parsed));
        }
      } catch (e) {
        localStorage.setItem('guest_custom_assets', JSON.stringify([symUpper]));
      }
    }
  };

  // Update Notification Preferences
  const updateNotificationPrefs = async (newPrefs: any) => {
    if (user && userProfile) {
      const { error } = await supabase
        .from('user_profiles')
        .update({ notification_prefs: newPrefs })
        .eq('id', user.id);

      if (!error) {
        setUserProfile({
          ...userProfile,
          notificationPrefs: newPrefs
        });
      }
    } else {
      localStorage.setItem('prism_guest_notif_prefs', JSON.stringify(newPrefs));
    }
  };

  // Add Portfolio Purchase
  const addPurchase = async (item: Omit<PortfolioPurchase, 'purchaseId' | 'userId'>) => {
    if (user) {
      const { error } = await supabase
        .from('portfolios')
        .insert({
          user_id: user.id,
          symbol: item.symbol,
          buy_price: Number(item.buyPrice),
          quantity: Number(item.quantity),
          date: item.date,
          systematic_amount: item.systematicAmount ? Number(item.systematicAmount) : null
        });
      if (error) console.error('Add purchase error:', error.message);
    } else {
      const generatedId = 'p_guest_' + Date.now();
      const newPurchase: PortfolioPurchase = {
        purchaseId: generatedId,
        userId: 'guest',
        ...item
      };
      const updated = [...portfolio, newPurchase];
      setPortfolio(updated);
      localStorage.setItem('guest_portfolio', JSON.stringify(updated));
    }
  };

  // Remove Portfolio Purchase
  const removePurchase = async (purchaseId: string) => {
    if (user) {
      const { error } = await supabase
        .from('portfolios')
        .delete()
        .eq('id', purchaseId);
      if (error) console.error('Delete purchase error:', error.message);
    } else {
      const updated = portfolio.filter(p => p.purchaseId !== purchaseId);
      setPortfolio(updated);
      localStorage.setItem('guest_portfolio', JSON.stringify(updated));
    }
  };

  // Read Notification
  const markNotificationRead = async (notificationId: string) => {
    const isLocalOnly = notificationId.startsWith('n_guest_') || notificationId.startsWith('n_welcome');
    if (user && !isLocalOnly) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      if (error) console.error('Read notification error:', error.message);
    } else {
      const updated = notifications.map(n => 
        n.notificationId === notificationId ? { ...n, read: true } : n
      );
      setNotifications(updated);
      localStorage.setItem('guest_notifications', JSON.stringify(updated));
    }
  };

  // Clear Alerts
  const clearAllNotifications = async () => {
    if (user) {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);
      if (error) console.error('Clear notifications error:', error.message);
    } else {
      setNotifications([]);
      localStorage.setItem('guest_notifications', JSON.stringify([]));
    }
  };

  const processingAlertsRef = useRef<Set<string>>(new Set());

  // AI & Analytics Interest Matcher Notification Generator
  const generateAlertForInterestedSymbols = async (predictions: any[], assets: any[]) => {
    const interests = userProfile?.interestedSymbols || ['TATAMOTORS.NS', 'ADANIPOWER.NS', 'SUZLON.NS'];
    if (!predictions || predictions.length === 0) return;

    const matchedPredictions = predictions.filter(p => 
      interests.some(interest => p.symbol.toUpperCase().includes(interest.toUpperCase()))
    );

    if (matchedPredictions.length === 0) return;

    for (const pred of matchedPredictions) {
      const symbolUpper = pred.symbol.toUpperCase();
      
      const busyKey = `${user?.id || 'guest'}_${symbolUpper}_${pred.signal}_${Math.floor(Date.now() / 15000)}`; // 15s lock
      if (processingAlertsRef.current.has(busyKey)) {
        continue;
      }
      processingAlertsRef.current.add(busyKey);

      const existingAlert = notifications.find(n => 
        n.symbol.toUpperCase() === symbolUpper && 
        n.signal === pred.signal &&
        (Date.now() - new Date(n.timestamp).getTime() < 12 * 60 * 60 * 1000)
      );

      if (!existingAlert) {
        const foundAsset = assets.find(a => a.symbol.toUpperCase() === symbolUpper);
        const currentPrice = foundAsset ? Number(foundAsset.last_price || 0) : 100;

        let description = '';
        if (pred.signal === 'BUY') {
          description = `🔥 SMART ALERT: ${symbolUpper} interest trigger active! PRISMX systems recommend buying ${symbolUpper} directly supporting long-term accumulation near current price ₹${currentPrice.toLocaleString('en-IN')}. Confidence: ${pred.confidence}%.`;
        } else if (pred.signal === 'SELL') {
          description = `⚠️ RISK UPDATE: ${symbolUpper} is entering profit booking territories around ₹${currentPrice.toLocaleString('en-IN')}. Consider booking swing targets.`;
        } else {
          description = `💼 STATUS PREVIEW: ${symbolUpper} is trending NEUTRAL. PRISMX systems indicate standard accumulation.`;
        }

        if (user) {
          try {
            await supabase
              .from('notifications')
              .insert({
                user_id: user.id,
                symbol: symbolUpper,
                signal: pred.signal || 'HOLD',
                price: currentPrice,
                description,
                read: false
              });
          } catch (e) {
            console.warn('Silent failure seeding auto interest signal alert:', e);
          }
        } else {
          const guestAlert: SignalNotification = {
            notificationId: 'n_guest_' + Date.now() + Math.random().toString(36).substr(2, 5),
            userId: 'guest',
            symbol: symbolUpper,
            signal: pred.signal || 'HOLD',
            price: currentPrice,
            description,
            timestamp: new Date(),
            read: false
          };
          const updated = [guestAlert, ...notifications].slice(0, 30);
          setNotifications(updated);
          localStorage.setItem('guest_notifications', JSON.stringify(updated));
        }
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      userProfile,
      watchlist,
      portfolio,
      notifications,
      signUp,
      logIn,
      logInGoogle,
      logOut,
      passwordReset,
      toggleWatchlist,
      updateInterests,
      updateOnboardingSettings,
      addCustomAsset,
      addPurchase,
      removePurchase,
      markNotificationRead,
      clearAllNotifications,
      generateAlertForInterestedSymbols,
      updateNotificationPrefs
    }}>
      {children}
    </AuthContext.Provider>
  );
};
