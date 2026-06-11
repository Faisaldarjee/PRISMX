import React, { createContext, useContext, useState, useEffect } from 'react';
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
  interestedSymbols: string[];
  onboarded?: boolean;
  capital?: number;
  riskPercent?: number;
  focusMarkets?: string[];
  customAssets?: string[];
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
            symbol: 'GOLDBEES.NS',
            signal: 'BUY',
            price: 60.1,
            description: 'Welcome to Bang On AI! Track your favorite Indian volatility SIP alerts with dynamic interest syncing.',
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
        const uId = currentFirebaseUser.uid;
        // 1. Sync UserProfile
        const userDocRef = doc(db, 'users', uId);
        try {
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            const initialProfile: UserProfile = {
              userId: uId,
              email: currentFirebaseUser.email || '',
              displayName: currentFirebaseUser.displayName || currentFirebaseUser.email?.split('@')[0] || 'Member',
              createdAt: serverTimestamp(),
              vIPStatus: 'FREE',
              interestedSymbols: ['TATAMOTORS.NS', 'RELIANCE.NS', 'ADANIPOWER.NS'] // set smart defaults
            };
            await setDoc(userDocRef, initialProfile);
            setUserProfile(initialProfile);
          } else {
            setUserProfile(userDoc.data() as UserProfile);
          }
        } catch (err) {
          console.warn('Unable to sync profile:', err);
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
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    if (useRedirect) {
      return signInWithRedirect(auth, provider);
    }
    return signInWithPopup(auth, provider).then(() => {
      // Success popup login
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
    if (user && userProfile) {
      const profileRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(profileRef, { interestedSymbols: formatted });
        setUserProfile({ ...userProfile, interestedSymbols: formatted });
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
        email: 'guest@bangon.ai',
        displayName: 'Guest Trader',
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
        await updateDoc(profileRef, {
          onboarded: true,
          capital: Number(capital),
          riskPercent: Number(riskPercent),
          focusMarkets
        });
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
          await updateDoc(profileRef, {
            customAssets: updated
          });
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
        await updateDoc(doc(db, 'users', user.uid, 'notifications', notificationId), {
          read: true
        });
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
          description = `🔥 SMART ALERT: ${symbolUpper} interest trigger active! Bang On systems recommend buying ${symbolUpper} directly supporting long-term accumulation near current price ₹${currentPrice.toLocaleString('en-IN')}. Confidence: ${pred.confidence}%.`;
        } else if (pred.signal === 'SELL') {
          description = `⚠️ RISK UPDATE: ${symbolUpper} is entering profit booking or overbought territories around ₹${currentPrice.toLocaleString('en-IN')}. Consider holding purchases or booking partial swing targets.`;
        } else {
          description = `💼 STATUS PREVIEW: ${symbolUpper} is currently trending NEUTRAL. Bang On system indicates standard accumulation conditions are active.`;
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
      generateAlertForInterestedSymbols
    }}>
      {children}
    </AuthContext.Provider>
  );
};
