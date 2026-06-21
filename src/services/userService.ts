import { doc, getDoc, setDoc, collection, getCountFromServer } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export interface UserProfile {
  uid: string;
  userId: string; // for compatibility with legacy firestore.rules
  email: string;
  displayName: string;
  createdAt: string;
  
  // Plan fields
  plan: 'free' | 'pro_early' | 'pro_paid';
  isPro: boolean;
  
  // Early access fields
  earlyAccessNumber: number | null;  // e.g. 42 (out of 100)
  earlyAccessGrantedAt: string | null;
  earlyAccessExpiresAt: string | null; // createdAt + 30 days
  
  // Pro paid fields  
  proStartDate: string | null;
  proEndDate: string | null;
  razorpaySubscriptionId: string | null;
}

export async function createOrGetUserProfile(user: any): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    // Existing user — return profile
    if (userSnap.exists()) {
      const data = userSnap.data();
      const email = (user.email || '').toLowerCase().trim();
      console.log('Checking founder access for:', email);
      if (email === 'faisaldarjee9@gmail.com' || email === 'faisaldarjee998@gmail.com') {
        console.log('Founder match found, granting lifetime pro');
      }

      const targets = [
        {
          prefix: 'faisaldarjee998',
          updates: {
            plan: 'pro_paid' as const,
            isPro: true,
            earlyAccessNumber: 1,
            proStartDate: '2026-06-21T00:00:00.000Z',
            proEndDate: '2099-12-31T00:00:00.000Z',
            razorpaySubscriptionId: 'founder_lifetime_access',
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
        await setDoc(userRef, updatedProfile, { merge: true });
        if (email === 'faisaldarjee9@gmail.com' || email === 'faisaldarjee998@gmail.com') {
          console.log('Founder pro grant complete');
        }
        return updatedProfile as UserProfile;
      }
      
      if (matched && (email === 'faisaldarjee9@gmail.com' || email === 'faisaldarjee998@gmail.com')) {
        console.log('Founder pro grant complete');
      }
      return data as UserProfile;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
  
  // New user — check early access count
  let totalUsers = 0;
  try {
    const usersCollection = collection(db, 'users');
    const snapshot = await getCountFromServer(usersCollection);
    totalUsers = snapshot.data().count;
  } catch (err) {
    console.error('Failed to get user count, defaulting to 0:', err);
  }
  
  const isEarlyAccess = totalUsers < 100;
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setDate(expiryDate.getDate() + 30); // 30 days
  
  const profile: UserProfile = {
    uid: user.uid,
    userId: user.uid, // compatible with rules requiring .userId
    email: user.email || '',
    displayName: user.displayName || '',
    createdAt: now.toISOString(),
    
    plan: isEarlyAccess ? 'pro_early' : 'free',
    isPro: isEarlyAccess,
    
    earlyAccessNumber: isEarlyAccess ? totalUsers + 1 : null,
    earlyAccessGrantedAt: isEarlyAccess ? now.toISOString() : null,
    earlyAccessExpiresAt: isEarlyAccess ? expiryDate.toISOString() : null,
    
    proStartDate: null,
    proEndDate: null,
    razorpaySubscriptionId: null,
  };
  
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, profile);
    return profile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function checkAndUpdateProStatus(uid: string): Promise<UserProfile | undefined> {
  const path = `users/${uid}`;
  let data: UserProfile;
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return undefined;
    data = userSnap.data() as UserProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
  
  let needsUpdate = false;
  const updatedData = { ...data };
  
  // Check early access expiry
  if (data.plan === 'pro_early' && data.earlyAccessExpiresAt) {
    const expiry = new Date(data.earlyAccessExpiresAt);
    const now = new Date();
    
    if (now > expiry) {
      updatedData.plan = 'free';
      updatedData.isPro = false;
      needsUpdate = true;
    }
  }
  
  // Check pro_paid expiry
  if (data.plan === 'pro_paid' && data.proEndDate) {
    const expiry = new Date(data.proEndDate);
    const now = new Date();
    
    if (now > expiry) {
      updatedData.plan = 'free';
      updatedData.isPro = false;
      needsUpdate = true;
    }
  }
  
  if (needsUpdate) {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, updatedData);
      return updatedData;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }
  
  return data;
}
