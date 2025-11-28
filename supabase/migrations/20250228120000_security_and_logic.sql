/*
  # Security Fixes & Logic Implementation
  
  ## Query Description:
  1. Fixes "Function Search Path Mutable" security advisories by setting `search_path = public`.
  2. Implements the 40% referral commission logic in reward functions.
  3. Implements the Ad reward logic.
  
  ## Metadata:
  - Schema-Category: "Safe"
  - Impact-Level: "Medium"
  - Requires-Backup: false
  - Reversible: true
  
  ## Security Implications:
  - Sets strict search_path for SECURITY DEFINER functions to prevent search path hijacking.
*/

-- 1. Secure the Trigger Function (if it exists, or create it)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email, referral_code)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    upper(substring(md5(random()::text) from 1 for 8)) -- Generate random 8-char code
  );
  RETURN new;
END;
$$;

-- 2. Secure & Implement set_referrer
CREATE OR REPLACE FUNCTION public.set_referrer(referral_code_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_referrer_id uuid;
  v_current_referrer uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if user already has a referrer
  SELECT referred_by INTO v_current_referrer FROM profiles WHERE id = v_user_id;
  IF v_current_referrer IS NOT NULL THEN
    RAISE EXCEPTION 'Referrer already set';
  END IF;

  -- Find referrer by code
  SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = referral_code_input;
  
  IF v_referrer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid referral code';
  END IF;

  IF v_referrer_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot refer yourself';
  END IF;

  -- Update user's referrer
  UPDATE profiles SET referred_by = v_referrer_id WHERE id = v_user_id;

  -- Reward Referrer (20 points)
  UPDATE profiles SET points = points + 20 WHERE id = v_referrer_id;
  
  -- Log Transaction for Referrer
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (v_referrer_id, 20, 'referral_signup', 'Bonus for inviting a new user');
END;
$$;

-- 3. Secure & Implement claim_follow_reward with 40% Commission
CREATE OR REPLACE FUNCTION public.claim_follow_reward(channel_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_channel_exists boolean;
  v_already_followed boolean;
  v_referrer_id uuid;
  v_points_earned int := 3;
  v_commission numeric := 0.4;
  v_referrer_bonus int;
BEGIN
  v_user_id := auth.uid();

  -- Check if channel exists
  SELECT EXISTS (SELECT 1 FROM channels WHERE id = channel_id_input) INTO v_channel_exists;
  IF NOT v_channel_exists THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  -- Check if already followed
  SELECT EXISTS (SELECT 1 FROM follows WHERE user_id = v_user_id AND channel_id = channel_id_input) INTO v_already_followed;
  IF v_already_followed THEN
    RAISE EXCEPTION 'Already followed';
  END IF;

  -- Insert follow
  INSERT INTO follows (user_id, channel_id) VALUES (v_user_id, channel_id_input);

  -- Update user points
  UPDATE profiles SET points = points + v_points_earned WHERE id = v_user_id;

  -- Log transaction
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (v_user_id, v_points_earned, 'earn_follow', 'Followed channel');

  -- Handle Referral Commission
  SELECT referred_by INTO v_referrer_id FROM profiles WHERE id = v_user_id;

  IF v_referrer_id IS NOT NULL THEN
    v_referrer_bonus := ROUND(v_points_earned * v_commission); -- 40% of 3 is 1.2 -> Rounds to 1
    IF v_referrer_bonus > 0 THEN
        UPDATE profiles SET points = points + v_referrer_bonus WHERE id = v_referrer_id;
        INSERT INTO transactions (user_id, amount, type, description)
        VALUES (v_referrer_id, v_referrer_bonus, 'referral_commission', 'Commission from referral follow task');
    END IF;
  END IF;
END;
$$;

-- 4. Secure & Implement claim_ad_reward with 40% Commission
CREATE OR REPLACE FUNCTION public.claim_ad_reward()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_referrer_id uuid;
  v_points_earned int := 2;
  v_commission numeric := 0.4;
  v_referrer_bonus int;
BEGIN
  v_user_id := auth.uid();

  -- Update user points
  UPDATE profiles SET points = points + v_points_earned WHERE id = v_user_id;

  -- Log transaction
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (v_user_id, v_points_earned, 'earn_ad', 'Watched rewarded ad');

  -- Handle Referral Commission
  SELECT referred_by INTO v_referrer_id FROM profiles WHERE id = v_user_id;

  IF v_referrer_id IS NOT NULL THEN
    v_referrer_bonus := ROUND(v_points_earned * v_commission); -- 40% of 2 is 0.8 -> Rounds to 1
    IF v_referrer_bonus > 0 THEN
        UPDATE profiles SET points = points + v_referrer_bonus WHERE id = v_referrer_id;
        INSERT INTO transactions (user_id, amount, type, description)
        VALUES (v_referrer_id, v_referrer_bonus, 'referral_commission', 'Commission from referral ad view');
    END IF;
  END IF;
END;
$$;
