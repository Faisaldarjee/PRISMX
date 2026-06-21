import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

export interface UserProfile {
  userId: string;
  email: string;
  displayName?: string;
  createdAt: any;
  vIPStatus: 'FREE' | 'PRO' | 'ELITE';
  isPro?: boolean;
  plan?: string;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(['GOLDBEES.NS', 'SILVERBEES.NS']);
  const [portfolio, setPortfolio] = useState<PortfolioPurchase[]>([]);
  const [notifications, setNotifications] = useState<SignalNotification[]>([]);

  // Synchronize Google Sign-In redirect result on mount
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log('Redirect authentication succeeded:', result.user);
        }
      })
      .catch((error) => {
        console.warn('Redirect authentication error:', error);
      });
  }, []);

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
            title: 'Welcome to PRISMX',
            message: 'Your guest workspace is ready. Explore the Smart Swing scanner or search any NSE stock.',
            type: 'WELCOME',
            timestamp: new Date(),
            read: false
          }
        ]);
      }
    }
  }, [user]);

  // Auth state listener
  useEffect(() => {
    let unsubWatchlist: (() => void) | null = null;
    let unsubPortfolio: (() => void) | null = null;
    let unsubNotifications: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentFirebaseUser) => {
      // First clean up any active subscriptions!
      if (unsubWatchlist) { unsubWatchlist(); unsubWatchlist = null; }
      if (unsubPortfolio) { unsubPortfolio(); unsubPortfolio = null; }
      if (unsubNotifications) { unsubNotifications(); unsubNotifications = null; }

      setUser(currentFirebaseUser);
      
      if (currentFirebaseUser) {
        console.log('[Auth] Step 2: User authenticated with Firebase', currentFirebaseUser.email);
        const uId = currentFirebaseUser.uid;
        // 1. Sync UserProfile
        const userDocRef = doc(db, 'users', uId);
        
        const syncProfile = async () => {
          console.log('[Auth] Step 3: Writing user profile to Firestore');
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            const initialProfile: UserProfile = {
              userId: uId,
              email: currentFirebaseUser.email || '',
              displayName: currentFirebaseUser.displayName || currentFirebaseUser.email?.split('@')[0] || 'Member',
              createdAt: serverTimestamp(),
              vIPStatus: 'FREE',
              isPro: false,
              plan: 'free',
              interestedSymbols: ['TATAMOTORS.NS', 'RELIANCE.NS', 'ADANIPOWER.NS'] // set smart defaults
            };
            await setDoc(userDocRef, initialProfile);
            setUserProfile(initialProfile);
          } else {
            const data = userDoc.data();
            const email = (currentFirebaseUser.email || '').toLowerCase().trim();
            const targets = [
              {
                prefix: 'faisaldarjee998',
                updates: {
                  plan: 'pro_early' as const,
                  isPro: true,
                  earlyAccessNumber: 1,
                  earlyAccessGrantedAt: '2026-06-10T00:00:00.000Z',
                  earlyAccessExpiresAt: '2026-07-10T00:00:00.000Z',
                }
              },
              {
                prefix: 'faisaldarjee9',
                updates: {
                  plan: 'pro_paid' as const,
                  isPro: true,
                  earlyAccessNumber: 2,
                  proStartDate: '2026-06-21T00:00:00.000Z',
                  proEndDate: '2099-12-31T00:00:00.000Z',
                  razorpaySubscriptionId: 'founder_lifetime_access',
                }
              },
              {
                prefix: 'cpppatel2026',
                updates: {
                  plan: 'pro_early' as const,
                  isPro: true,
                  earlyAccessNumber: 3,
                  earlyAccessGrantedAt: '2026-06-13T00:00:00.000Z',
                  earlyAccessExpiresAt: '2026-07-13T00:00:00.000Z',
                }
              },
              {
                prefix: 'aditiuike04',
                updates: {
                  plan: 'pro_early' as const,
                  isPro: true,
                  earlyAccessNumber: 4,
                  earlyAccessGrantedAt: '2026-06-15T00:00:00.000Z',
                  earlyAccessExpiresAt: '2026-07-15T00:00:00.000Z',
                }
              }
            ];

            const matched = targets.find(t => 
              email === `${t.prefix}@gmail.com` || 
              email === t.prefix
            );

            if (matched && (data.plan !== matched.updates.plan || !data.isPro || data.earlyAccessNumber !== matched.updates.earlyAccessNumber)) {
              console.log(`[Auto-Upgrade Client] Upgrading user ${email} to Pro Early Access...`);
              const updatedProfile = {
                ...data,
                ...matched.updates
              };
              await setDoc(userDocRef, updatedProfile, { merge: true });
              setUserProfile(updatedProfile as unknown as UserProfile);
            } else {
              setUserProfile(data as UserProfile);
            }
          }
        };

        try {
          const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firestore sync timed out')), 6000)
          );
          await Promise.race([syncProfile(), timeout]);
          console.log('[Auth] Step 4: Profile sync complete');
        } catch (err) {
          console.warn('[Auth] Unable to sync profile or timed out. Gracefully falling back to default user profile:', err);
          setUserProfile({
            userId: uId,
            email: currentFirebaseUser.email || '',
            displayName: currentFirebaseUser.displayName || 'Member',
            createdAt: new Date(),
            vIPStatus: 'FREE',
            interestedSymbols: ['TATAMOTORS.NS', 'RELIANCE.NS']
          });
        }

        // 2. Sync Watchlist with real-time Firestore subscription
        const wlDocRef = doc(db, 'users', uId, 'watchlist', 'default');
        unsubWatchlist = onSnapshot(wlDocRef, (snap) => {
          if (snap.exists()) {
            setWatchlist(snap.data().symbols || []);
          } else {
            // Seed defaults to Firestore if empty
            setDoc(wlDocRef, { userId: uId, symbols: ['GOLDBEES.NS', 'SILVERBEES.NS', 'TATAMOTORS.NS'] }).catch(console.error);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${uId}/watchlist/default`);
        });

        // 3. Sync Portfolio with real-time Firestore subscription
        const pCollRef = collection(db, 'users', uId, 'portfolio');
        unsubPortfolio = onSnapshot(pCollRef, (snap) => {
          const items: PortfolioPurchase[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            items.push({
              purchaseId: docSnap.id,
              userId: uId,
              symbol: data.symbol,
              buyPrice: Number(data.buyPrice),
              quantity: Number(data.quantity),
              date: data.date,
              systematicAmount: data.systematicAmount ? Number(data.systematicAmount) : undefined
            });
          });
          setPortfolio(items);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${uId}/portfolio`);
        });

        // 4. Sync Notifications
        const nCollRef = collection(db, 'users', uId, 'notifications');
        unsubNotifications = onSnapshot(nCollRef, (snap) => {
          const alerts: SignalNotification[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            alerts.push({
              notificationId: docSnap.id,
              userId: uId,
              symbol: data.symbol,
              signal: data.signal,
              price: Number(data.price),
              description: data.description,
              timestamp: data.timestamp?.toDate() || new Date(),
              read: !!data.read
            });
          });
          // Sort notifications so latest are first
          alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          setNotifications(alerts);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${uId}/notifications`);
        });
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubWatchlist) unsubWatchlist();
      if (unsubPortfolio) unsubPortfolio();
      if (unsubNotifications) unsubNotifications();
    };
  }, []);

  // Set loading false if auth state is settled and user is null
  useEffect(() => {
    if (!user) {
      setLoading(false);
    }
  }, [user]);

  // Synchronize user profile to backend cache (for background tasks fallbacks: crons & email dispatch)
  useEffect(() => {
    const syncProfileToServer = async () => {
      if (!user || !userProfile) return;
      try {
        const token = await user.getIdToken();
        await fetch('/api/user/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            uid: user.uid,
            email: userProfile.email || user.email || '',
            displayName: userProfile.displayName || user.displayName || '',
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
      const res = await createUserWithEmailAndPassword(auth, emailStr, passwordStr);
      if (res.user) {
        await updateProfile(res.user, { displayName: name });
        // Seat user profile
        const uId = res.user.uid;
        const initialProfile: UserProfile = {
          userId: uId,
          email: emailStr,
          displayName: name,
          createdAt: new Date().toISOString(),
          vIPStatus: 'FREE',
          isPro: false,
          plan: 'free',
          interestedSymbols: ['TATAMOTORS.NS', 'RELIANCE.NS', 'ADANIPOWER.NS']
        };
        await setDoc(doc(db, 'users', uId), initialProfile);
        setUserProfile(initialProfile);
      }
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const logIn = async (emailStr: string, passwordStr: string) => {
    return signInWithEmailAndPassword(auth, emailStr, passwordStr).then(() => {
      // Listener handles profile loading
    });
  };

  const logInGoogle = async (useRedirect = false) => {
    console.log('[Auth] Step 1: Popup opening...');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    if (useRedirect) {
      return signInWithRedirect(auth, provider);
    }
    return signInWithPopup(auth, provider).then((result) => {
      console.log('[Auth] Google popup sign-in successful');
      return result;
    });
  };

  const logOut = async () => {
    return signOut(auth);
  };

  const passwordReset = async (emailStr: string) => {
    return sendPasswordResetEmail(auth, emailStr);
  };

  // Watchlist Toggle
  const toggleWatchlist = async (symbol: string) => {
    const symUpper = symbol.toUpperCase();
    const updated = watchlist.includes(symUpper)
      ? watchlist.filter(s => s !== symUpper)
      : [...watchlist, symUpper];

    if (user) {
      const parentPath = `users/${user.uid}/watchlist/default`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'watchlist', 'default'), {
          userId: user.uid,
          symbols: updated,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, parentPath);
      }
    } else {
      setWatchlist(updated);
      localStorage.setItem('guest_watchlist', JSON.stringify(updated));
    }
  };

  // Interests update
  const updateInterests = async (symbols: string[]) => {
    const formatted = symbols.map(s => s.toUpperCase());
    if (user) {
      const profileRef = doc(db, 'users', user.uid);
      try {
        await setDoc(profileRef, { interestedSymbols: formatted }, { merge: true });
        if (userProfile) {
          setUserProfile({ ...userProfile, interestedSymbols: formatted });
        } else {
          setUserProfile({
            userId: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Member',
            createdAt: new Date(),
            vIPStatus: 'FREE',
            interestedSymbols: formatted
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
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
        vIPStatus: 'FREE',
        interestedSymbols: formatted
      });
    }
  };

  // Onboarding settings update (synchronized to user profile in Firebase)
  const updateOnboardingSettings = async (capital: number, riskPercent: number, focusMarkets: string[]) => {
    if (user && userProfile) {
      const profileRef = doc(db, 'users', user.uid);
      try {
        await setDoc(profileRef, {
          onboarded: true,
          capital: Number(capital),
          riskPercent: Number(riskPercent),
          focusMarkets
        }, { merge: true });
        setUserProfile({
          ...userProfile,
          onboarded: true,
          capital: Number(capital),
          riskPercent: Number(riskPercent),
          focusMarkets
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    }
  };

  // Register custom imported asset in Firestore profile
  const addCustomAsset = async (symbol: string) => {
    const symUpper = symbol.toUpperCase().trim();
    if (!symUpper) return;

    if (user && userProfile) {
      const profileRef = doc(db, 'users', user.uid);
      const currentCustomList = userProfile.customAssets || [];
      if (!currentCustomList.includes(symUpper)) {
        const updated = [...currentCustomList, symUpper];
        try {
          await setDoc(profileRef, {
            customAssets: updated
          }, { merge: true });
          setUserProfile({
            ...userProfile,
            customAssets: updated
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      }
    } else {
      // Guest mode
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

  // Update Notification Preferences (Firestore & Local Fallbacks)
  const updateNotificationPrefs = async (newPrefs: any) => {
    if (user && userProfile) {
      const profileRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(profileRef, {
          notificationPrefs: newPrefs
        });
        setUserProfile({
          ...userProfile,
          notificationPrefs: newPrefs
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    } else {
      localStorage.setItem('prism_guest_notif_prefs', JSON.stringify(newPrefs));
    }
  };

  // Add Portfolio Purchase
  const addPurchase = async (item: Omit<PortfolioPurchase, 'purchaseId' | 'userId'>) => {
    if (user) {
      const collPath = `users/${user.uid}/portfolio`;
      try {
        await addDoc(collection(db, 'users', user.uid, 'portfolio'), {
          ...item,
          buyPrice: Number(item.buyPrice),
          quantity: Number(item.quantity),
          createdAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, collPath);
      }
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
      const docPath = `users/${user.uid}/portfolio/${purchaseId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'portfolio', purchaseId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
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
      const docPath = `users/${user.uid}/notifications/${notificationId}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'notifications', notificationId), {
          read: true
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      }
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
      try {
        const nColl = collection(db, 'users', user.uid, 'notifications');
        const snap = await getDocs(nColl);
        const promises = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
        await Promise.all(promises);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/notifications`);
      }
    } else {
      setNotifications([]);
      localStorage.setItem('guest_notifications', JSON.stringify([]));
    }
  };

  const processingAlertsRef = useRef<Set<string>>(new Set());

  // AI & Analytics Interest Matcher Notification Generator
  // Automatically generates tailored signal notification items if an asset of interest has a BUY or SELL setup
  const generateAlertForInterestedSymbols = async (predictions: any[], assets: any[]) => {
    const interests = userProfile?.interestedSymbols || ['TATAMOTORS.NS', 'ADANIPOWER.NS', 'SUZLON.NS'];
    if (!predictions || predictions.length === 0) return;

    // Filter relevant predictions
    const matchedPredictions = predictions.filter(p => 
      interests.some(interest => p.symbol.toUpperCase().includes(interest.toUpperCase()))
    );

    if (matchedPredictions.length === 0) return;

    for (const pred of matchedPredictions) {
      const symbolUpper = pred.symbol.toUpperCase();
      
      const busyKey = `${user?.uid || 'guest'}_${symbolUpper}_${pred.signal}_${Math.floor(Date.now() / 15000)}`; // 15s lock
      if (processingAlertsRef.current.has(busyKey)) {
        continue;
      }
      processingAlertsRef.current.add(busyKey);

      // Let's check if we already have an unread notification matching this symbol + signal state
      const existingAlert = notifications.find(n => 
        n.symbol.toUpperCase() === symbolUpper && 
        n.signal === pred.signal &&
        (Date.now() - new Date(n.timestamp).getTime() < 12 * 60 * 60 * 1000) // generated in last 12 hours
      );

      if (!existingAlert) {
        const foundAsset = assets.find(a => a.symbol.toUpperCase() === symbolUpper);
        const currentPrice = foundAsset ? Number(foundAsset.last_price || 0) : 100;

        let description = '';
        if (pred.signal === 'BUY') {
          description = `🔥 SMART ALERT: ${symbolUpper} interest trigger active! PRISMX systems recommend buying ${symbolUpper} directly supporting long-term accumulation near current price ₹${currentPrice.toLocaleString('en-IN')}. Confidence: ${pred.confidence}%.`;
        } else if (pred.signal === 'SELL') {
          description = `⚠️ RISK UPDATE: ${symbolUpper} is entering profit booking or overbought territories around ₹${currentPrice.toLocaleString('en-IN')}. Consider holding purchases or booking partial swing targets.`;
        } else {
          description = `💼 STATUS PREVIEW: ${symbolUpper} is currently trending NEUTRAL. PRISMX systems indicate standard accumulation conditions are active.`;
        }

        if (user) {
          try {
            await addDoc(collection(db, 'users', user.uid, 'notifications'), {
              symbol: symbolUpper,
              signal: pred.signal || 'HOLD',
              price: currentPrice,
              description,
              timestamp: serverTimestamp(),
              read: false
            });
          } catch (e) {
            console.warn('Silent failure seeding auto interest signal alert:', e);
          }
        } else {
          // Sync guest notifications
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
          const updated = [guestAlert, ...notifications].slice(0, 30); // limit to latest 30
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
