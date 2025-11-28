/*
  # Update Schema & Logic
  
  ## Query Description: 
  Updates the database to match the specific user requirements:
  1. Adds `total_referral_earnings` to profiles.
  2. Adds `active` to channels.
  3. Adds `source_user_id` to transactions for better tracking.
  4. Updates RPC functions to handle the new schema and referral logic.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Medium"
  - Requires-Backup: false
  - Reversible: true
  
  ## Structure Details:
  - profiles: +total_referral_earnings
  - channels: +active, +created_at
  - transactions: +source_user_id
*/

-- 1. Update Tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_referral_earnings NUMERIC DEFAULT 0;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source_user_id UUID REFERENCES auth.users(id);

-- 2. Helper Function for Commission
CREATE OR REPLACE FUNCTION public.handle_referral_commission(
  referrer_id UUID,
  amount NUMERIC,
  source_user_id UUID
) RETURNS void AS $$
BEGIN
  -- Insert transaction for referrer
  INSERT INTO public.transactions (user_id, amount, type, description, source_user_id)
  VALUES (
    referrer_id, 
    amount, 
    'referral_commission', 
    'Commission from user ' || source_user_id,
    source_user_id
  );

  -- Update referrer's points and total earnings
  UPDATE public.profiles 
  SET 
    points = points + amount,
    total_referral_earnings = total_referral_earnings + amount
  WHERE id = referrer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Update Follow Reward Logic
CREATE OR REPLACE FUNCTION public.claim_follow_reward(channel_id_input UUID)
RETURNS void AS $$
DECLARE
  channel_owner_id UUID;
  referrer_id UUID;
BEGIN
  -- Check if already followed
  IF EXISTS (SELECT 1 FROM public.follows WHERE user_id = auth.uid() AND channel_id = channel_id_input) THEN
    RAISE EXCEPTION 'Already followed';
  END IF;

  -- Insert follow record
  INSERT INTO public.follows (user_id, channel_id) VALUES (auth.uid(), channel_id_input);

  -- Reward User (3 points)
  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (auth.uid(), 3, 'follow_reward', 'Followed channel');

  UPDATE public.profiles SET points = points + 3 WHERE id = auth.uid();

  -- Handle Referral Commission (40% of 3 = 1.2)
  SELECT referred_by INTO referrer_id FROM public.profiles WHERE id = auth.uid();
  
  IF referrer_id IS NOT NULL THEN
    PERFORM public.handle_referral_commission(referrer_id, 1.2, auth.uid());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Update Ad Reward Logic
CREATE OR REPLACE FUNCTION public.claim_ad_reward()
RETURNS void AS $$
DECLARE
  referrer_id UUID;
BEGIN
  -- Reward User (2 points)
  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (auth.uid(), 2, 'ad_reward', 'Watched ad');

  UPDATE public.profiles SET points = points + 2 WHERE id = auth.uid();

  -- Handle Referral Commission (40% of 2 = 0.8)
  SELECT referred_by INTO referrer_id FROM public.profiles WHERE id = auth.uid();
  
  IF referrer_id IS NOT NULL THEN
    PERFORM public.handle_referral_commission(referrer_id, 0.8, auth.uid());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
