/*
# Update Follow Logic - Cost Per Follow
This migration updates the claim_follow_reward function to implement the "Cost Per Follow" model.
- Channel Owner loses 3 points per follow.
- Follower gains 3 points.
- Channel is deactivated if owner has insufficient points (< 3).
*/

CREATE OR REPLACE FUNCTION claim_follow_reward(channel_id_input UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_channel_owner_id UUID;
  v_owner_points NUMERIC;
  v_referrer_id UUID;
  v_referral_bonus NUMERIC;
BEGIN
  -- Get current user (follower)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if already followed
  IF EXISTS (SELECT 1 FROM follows WHERE user_id = v_user_id AND channel_id = channel_id_input) THEN
    RAISE EXCEPTION 'Already followed';
  END IF;

  -- Get channel owner and their points
  SELECT c.user_id, p.points INTO v_channel_owner_id, v_owner_points
  FROM channels c
  JOIN profiles p ON c.user_id = p.id
  WHERE c.id = channel_id_input;

  IF v_channel_owner_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;
  
  -- Prevent self-follow
  IF v_channel_owner_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot follow your own channel';
  END IF;

  -- Check if owner has enough points
  IF v_owner_points < 3 THEN
    -- Deactivate channel automatically
    UPDATE channels SET active = false WHERE id = channel_id_input;
    RAISE EXCEPTION 'Channel paused: Owner has insufficient points';
  END IF;

  -- 1. Record the follow
  INSERT INTO follows (user_id, channel_id)
  VALUES (v_user_id, channel_id_input);

  -- 2. Deduct points from Channel Owner
  UPDATE profiles
  SET points = points - 3
  WHERE id = v_channel_owner_id;

  INSERT INTO transactions (user_id, type, amount, description, source_user_id)
  VALUES (v_channel_owner_id, 'spent_on_follower', -3, 'Paid for a new follower', v_user_id);

  -- 3. Add points to Follower (User)
  UPDATE profiles
  SET points = points + 3
  WHERE id = v_user_id;

  INSERT INTO transactions (user_id, type, amount, description, source_user_id)
  VALUES (v_user_id, 'follow_reward', 3, 'Followed a channel', NULL);

  -- 4. Handle Referral Commission (40% of 3 points = 1.2 points)
  SELECT referred_by INTO v_referrer_id FROM profiles WHERE id = v_user_id;
  
  IF v_referrer_id IS NOT NULL THEN
    v_referral_bonus := 3 * 0.40; -- 1.2 points
    
    -- Update referrer points
    UPDATE profiles 
    SET points = points + v_referral_bonus,
        total_referral_earnings = total_referral_earnings + v_referral_bonus
    WHERE id = v_referrer_id;

    -- Log transaction
    INSERT INTO transactions (user_id, type, amount, description, source_user_id)
    VALUES (v_referrer_id, 'referral_commission', v_referral_bonus, 'Commission from referral task', v_user_id);
  END IF;

  -- 5. Check if owner ran out of points after deduction to update active status immediately
  IF (v_owner_points - 3) < 3 THEN
    UPDATE channels SET active = false WHERE id = channel_id_input;
  END IF;

END;
$$;
