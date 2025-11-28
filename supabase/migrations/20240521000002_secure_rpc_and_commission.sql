/*
# Security Updates & Referral Commission Logic

## Query Description:
1. Secures all RPC functions by explicitly setting `search_path` to prevent privilege escalation.
2. Implements the 40% referral commission logic within reward functions.
3. Ensures transactions are recorded for commissions.

## Metadata:
- Schema-Category: "Logic"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Functions modified: claim_follow_reward, claim_ad_reward, set_referrer
- Logic added: Automatic commission calculation and transfer
*/

-- Secure and Update claim_follow_reward
CREATE OR REPLACE FUNCTION public.claim_follow_reward(channel_id_input UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_referrer_id UUID;
  v_reward_amount NUMERIC := 3;
  v_commission_amount NUMERIC := 1.2; -- 40% of 3
BEGIN
  v_user_id := auth.uid();

  -- 1. Check if already followed
  IF EXISTS (SELECT 1 FROM public.follows WHERE user_id = v_user_id AND channel_id = channel_id_input) THEN
    RAISE EXCEPTION 'Already followed this channel';
  END IF;

  -- 2. Record the follow
  INSERT INTO public.follows (user_id, channel_id)
  VALUES (v_user_id, channel_id_input);

  -- 3. Give points to user
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_user_id, 'earn_follow', v_reward_amount, 'Followed channel');

  UPDATE public.profiles
  SET points = points + v_reward_amount
  WHERE id = v_user_id;

  -- 4. Handle Referral Commission
  SELECT referred_by INTO v_referrer_id FROM public.profiles WHERE id = v_user_id;

  IF v_referrer_id IS NOT NULL THEN
    INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (v_referrer_id, 'referral_commission', v_commission_amount, 'Commission from referral follow task');

    UPDATE public.profiles
    SET points = points + v_commission_amount
    WHERE id = v_referrer_id;
  END IF;

END;
$$;

-- Secure and Update claim_ad_reward
CREATE OR REPLACE FUNCTION public.claim_ad_reward()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_referrer_id UUID;
  v_reward_amount NUMERIC := 2;
  v_commission_amount NUMERIC := 0.8; -- 40% of 2
BEGIN
  v_user_id := auth.uid();

  -- 1. Give points to user
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_user_id, 'earn_ad', v_reward_amount, 'Watched ad');

  UPDATE public.profiles
  SET points = points + v_reward_amount
  WHERE id = v_user_id;

  -- 2. Handle Referral Commission
  SELECT referred_by INTO v_referrer_id FROM public.profiles WHERE id = v_user_id;

  IF v_referrer_id IS NOT NULL THEN
    INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (v_referrer_id, 'referral_commission', v_commission_amount, 'Commission from referral ad watch');

    UPDATE public.profiles
    SET points = points + v_commission_amount
    WHERE id = v_referrer_id;
  END IF;

END;
$$;

-- Secure set_referrer
CREATE OR REPLACE FUNCTION public.set_referrer(referral_code_input TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_referrer_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Check if already referred
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND referred_by IS NOT NULL) THEN
    RAISE EXCEPTION 'Referrer already set';
  END IF;

  -- Find referrer
  SELECT id INTO v_referrer_id FROM public.profiles WHERE referral_code = referral_code_input;

  IF v_referrer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid referral code';
  END IF;

  IF v_referrer_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot refer yourself';
  END IF;

  -- Set referrer
  UPDATE public.profiles
  SET referred_by = v_referrer_id
  WHERE id = v_user_id;

  -- Reward Referrer (The 20 points for signup)
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (v_referrer_id, 'referral_signup', 20, 'User used your referral code');

  UPDATE public.profiles
  SET points = points + 20
  WHERE id = v_referrer_id;

END;
$$;
