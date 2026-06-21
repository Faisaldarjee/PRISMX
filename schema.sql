-- ==========================================
-- 1. USER PROFILES TABLE (plan, status, preferences)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro_early', 'pro_paid')),
  is_pro BOOLEAN DEFAULT false,
  
  early_access_number INTEGER,
  early_access_granted_at TIMESTAMPTZ,
  early_access_expires_at TIMESTAMPTZ,
  
  pro_start_date TIMESTAMPTZ,
  pro_end_date TIMESTAMPTZ,
  razorpay_subscription_id TEXT,

  interested_symbols TEXT[] DEFAULT '{}',
  custom_assets TEXT[] DEFAULT '{}',
  onboarded BOOLEAN DEFAULT false,
  capital NUMERIC,
  risk_percent NUMERIC,
  focus_markets TEXT[] DEFAULT '{}',
  notification_prefs JSONB DEFAULT '{"notifyHighConfidence": true, "notifyEarnings": true, "notifySector": true, "notifySip": true, "notifyAllSignals": false, "channelInApp": true, "channelEmail": true, "channelPush": false, "minConfidence": 80}'::jsonb
);

-- ==========================================
-- 2. WATCHLISTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.watchlists (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  symbols TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. PORTFOLIOS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  buy_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  date TEXT NOT NULL,
  systematic_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. NOTIFICATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  signal TEXT NOT NULL,
  price NUMERIC NOT NULL,
  description TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT false
);

-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for public.user_profiles
CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies for public.watchlists
CREATE POLICY "Users can view own watchlist" ON public.watchlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own watchlist" ON public.watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own watchlist" ON public.watchlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own watchlist" ON public.watchlists FOR DELETE USING (auth.uid() = user_id);

-- Policies for public.portfolios
CREATE POLICY "Users can view own portfolio" ON public.portfolios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolio" ON public.portfolios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolio" ON public.portfolios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolio" ON public.portfolios FOR DELETE USING (auth.uid() = user_id);

-- Policies for public.notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 6. AUTO-CREATE USER PROFILE ON SIGNUP TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  is_early BOOLEAN;
BEGIN
  -- Count existing profiles to determine early access range
  SELECT COUNT(*) INTO user_count FROM public.user_profiles;
  is_early := user_count < 100;
  
  INSERT INTO public.user_profiles (
    id, email, display_name, photo_url,
    plan, is_pro,
    early_access_number, early_access_granted_at, early_access_expires_at,
    interested_symbols
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN is_early THEN 'pro_early' ELSE 'free' END,
    is_early,
    CASE WHEN is_early THEN user_count + 1 ELSE NULL END,
    CASE WHEN is_early THEN NOW() ELSE NULL END,
    CASE WHEN is_early THEN NOW() + INTERVAL '30 days' ELSE NULL END,
    ARRAY['TATAMOTORS.NS', 'RELIANCE.NS', 'ADANIPOWER.NS']
  );

  -- Create a default empty watchlist for the user
  INSERT INTO public.watchlists (user_id, symbols)
  VALUES (NEW.id, ARRAY['GOLDBEES.NS', 'SILVERBEES.NS', 'TATAMOTORS.NS']);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 7. FOUNDER ACCOUNTS AUTO-UPGRADE MANUAL RUN
-- ==========================================
-- UPDATE public.user_profiles
-- SET 
--   plan = 'pro_paid',
--   is_pro = true,
--   pro_start_date = NOW(),
--   pro_end_date = '2099-12-31'::timestamptz,
--   razorpay_subscription_id = 'founder_lifetime_access'
-- WHERE email IN ('faisaldarjee9@gmail.com', 'faisaldarjee998@gmail.com');
