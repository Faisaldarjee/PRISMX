import React from 'react';
import { supabase } from '../services/supabase';

export async function authFetch(url: string, signal?: AbortSignal) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.warn('authFetch: No active session for', url);
    return null;
  }
  
  try {
    const response = await fetch(url, {
      signal,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 401 || response.status === 403) {
      console.error(`authFetch: Authentication error ${response.status} on`, url);
      return null;
    }
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    console.error('authFetch error:', err.message);
    return null;
  }
}

export async function fetchWithRetry(
  url: string,
  signal: AbortSignal,
  retries = 2
): Promise<any> {
  const isProtected = url.includes('/api/predict') || url.includes('/api/gemini') || url.includes('/api/retrain');
  for (let i = 0; i <= retries; i++) {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (isProtected) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }
      const res = await fetch(url, { signal, headers });
      if (res.status === 401 || res.status === 403) {
        if (isProtected) {
          console.warn('[API Auth] 401/403 persisted in fetchWithRetry.');
        }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // 1s, 2s backoff
    }
  }
}

export const SectionSkeleton = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-5 h-5 border-2 border-[#D4A843]/30 border-t-[#D4A843] rounded-full animate-spin" />
  </div>
);

export const SectionError = ({ message }: { message: string }) => (
  <div className="text-[#8892A4] text-sm text-center py-6 font-sans">
    {message}
  </div>
);
