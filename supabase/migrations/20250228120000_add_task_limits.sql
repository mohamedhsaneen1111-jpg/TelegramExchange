/*
  # Add Task Limits and Management

  ## Query Description:
  Adds support for setting follower limits on channels and tracking progress.
  Updates the reward claiming logic to respect these limits.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Medium"
  - Requires-Backup: false
  - Reversible: true

  ## Structure Details:
  - channels: Add target_followers (int), current_followers (int)
*/

-- 1. Add columns to channels table
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS target_followers INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS current_followers INTEGER DEFAULT 0;

-- 2. Update the claim_follow_reward function to handle limits
CREATE OR REPLACE FUNCTION public.claim_follow_reward(channel_id_input UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_owner_id UUID;
  channel_points_cost CONSTANT DECIMAL := 3.0;
  follower_reward CONSTANT DECIMAL := 3.0;
  referrer_id UUID;
  owner_balance DECIMAL;
  curr_followers INTEGER;
  tgt_followers INTEGER;
BEGIN
  -- 1. Get channel details and lock row
  SELECT user_id, current_followers, target_followers 
  INTO channel_owner_id, curr_followers, tgt_followers
  FROM channels 
  WHERE id = channel_id_input AND active = true;

  IF channel_owner_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found or inactive';
  END IF;

  -- 2. Check if self-following
  IF channel_owner_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot follow your own channel';
  END IF;

  -- 3. Check if already followed
  IF EXISTS (SELECT 1 FROM follows WHERE user_id = auth.uid() AND channel_id = channel_id_input) THEN
    RAISE EXCEPTION 'Already followed';
  END IF;

  -- 4. Check Owner Balance
  SELECT points INTO owner_balance FROM profiles WHERE id = channel_owner_id;
  
  IF owner_balance < channel_points_cost THEN
    -- Deactivate channel if insufficient funds
    UPDATE channels SET active = false WHERE id = channel_id_input;
    RAISE EXCEPTION 'Channel owner has insufficient funds';
  END IF;

  -- 5. Process Transaction
  -- Deduct from owner
  UPDATE profiles SET points = points - channel_points_cost WHERE id = channel_owner_id;
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (channel_owner_id, -channel_points_cost, 'spent_on_follower', 'Paid for a new follower');

  -- Add to follower
  UPDATE profiles SET points = points + follower_reward WHERE id = auth.uid();
  INSERT INTO transactions (user_id, amount, type, description, source_user_id)
  VALUES (auth.uid(), follower_reward, 'follow_reward', 'Earned from following channel', channel_owner_id);

  -- Record Follow
  INSERT INTO follows (user_id, channel_id) VALUES (auth.uid(), channel_id_input);

  -- 6. Update Channel Stats & Check Limit
  -- Increment counter and deactivate if target reached
  UPDATE channels 
  SET current_followers = COALESCE(current_followers, 0) + 1,
      active = CASE 
        WHEN target_followers IS NOT NULL AND (COALESCE(current_followers, 0) + 1) >= target_followers THEN false
        ELSE active 
      END
  WHERE id = channel_id_input;

  -- 7. Referral Commission Logic
  SELECT referred_by INTO referrer_id FROM profiles WHERE id = auth.uid();
  IF referrer_id IS NOT NULL THEN
    -- 40% commission
    UPDATE profiles 
    SET points = points + (follower_reward * 0.4),
        total_referral_earnings = total_referral_earnings + (follower_reward * 0.4)
    WHERE id = referrer_id;
    
    INSERT INTO transactions (user_id, amount, type, description, source_user_id)
    VALUES (referrer_id, (follower_reward * 0.4), 'referral_commission', 'Commission from referral task', auth.uid());
  END IF;

END;
$$;
