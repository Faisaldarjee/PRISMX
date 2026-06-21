import { useAuth } from '../services/AuthProvider';

export function useProStatus() {
  const { userProfile, loading } = useAuth();
  
  let daysRemaining = null;
  if (userProfile?.earlyAccessExpiresAt && userProfile?.plan === 'pro_early') {
    const expiry = new Date(userProfile.earlyAccessExpiresAt);
    const diff = expiry.getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  
  return {
    isPro: userProfile?.isPro || false,
    plan: userProfile?.plan || 'free',
    earlyAccessNumber: userProfile?.earlyAccessNumber || null,
    earlyAccessExpiresAt: userProfile?.earlyAccessExpiresAt || null,
    daysRemaining,
    loading,
  };
}
