/*
# Update Claim Follow Reward Logic (Exchange System)

This migration updates the `claim_follow_reward` function to implement the core exchange logic:
1. Deducts 3 points from the Channel Owner for every new follower.
2. Checks if Channel Owner has enough points (>= 3) before allowing the follow.
3. Deactivates Channel Owner's channels automatically if points drop below 3.
4. Awards 3 points to the Follower.
5. Awards Commission to Referrer (unchanged).

## Query Description:
Updates the core business logic function to enforce point spending for followers.

## Metadata:
- Schema-Category: "Logic"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true
*/

CREATE OR REPLACE FUNCTION claim_follow_reward(channel_id_input UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_owner_id UUID;
  channel_owner_points FLOAT;
  referrer_id UUID;
  commission_amount FLOAT := 1.2; -- 40% of 3 points
  reward_amount FLOAT := 3.0;
  cost_amount FLOAT := 3.0;
BEGIN
  -- 1. Check if channel exists and get owner
  SELECT user_id INTO channel_owner_id
  FROM channels
  WHERE id = channel_id_input;

  IF channel_owner_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  -- Prevent self-following
  IF channel_owner_id = auth.uid() THEN
     RAISE EXCEPTION 'Cannot follow your own channel';
  END IF;

  -- 2. Check if user already followed
  IF EXISTS (SELECT 1 FROM follows WHERE user_id = auth.uid() AND channel_id = channel_id_input) THEN
    RAISE EXCEPTION 'Already followed';
  END IF;

  -- 3. Check if channel owner has enough points
  SELECT points INTO channel_owner_points
  FROM profiles
  WHERE id = channel_owner_id;

  -- If owner has less than 3 points, deactivate channel and stop
  IF channel_owner_points < cost_amount THEN
    UPDATE channels SET active = false WHERE id = channel_id_input;
    RAISE EXCEPTION 'This channel has run out of points and is paused.';
  END IF;

  -- 4. Record the follow
  INSERT INTO follows (user_id, channel_id)
  VALUES (auth.uid(), channel_id_input);

  -- 5. Deduct points from Channel Owner
  UPDATE profiles
  SET points = points - cost_amount
  WHERE id = channel_owner_id;

  INSERT INTO transactions (user_id, type, amount, description, source_user_id)
  VALUES (channel_owner_id, 'spent_on_follower', -cost_amount, 'Points spent on new follower', auth.uid());

  -- 6. Deactivate ALL of owner's channels if points dropped below threshold (since points are shared)
  -- We check the new balance
  IF (channel_owner_points - cost_amount) < cost_amount THEN
    UPDATE channels SET active = false WHERE user_id = channel_owner_id;
  END IF;

  -- 7. Add points to Follower (The User)
  UPDATE profiles
  SET points = points + reward_amount
  WHERE id = auth.uid();

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (auth.uid(), 'follow_reward', reward_amount, 'Earned from following channel');

  -- 8. Handle Referral Commission
  SELECT referred_by INTO referrer_id
  FROM profiles
  WHERE id = auth.uid();

  IF referrer_id IS NOT NULL THEN
    UPDATE profiles
    SET points = points + commission_amount,
        total_referral_earnings = total_referral_earnings + commission_amount
    WHERE id = referrer_id;

    INSERT INTO transactions (user_id, type, amount, description, source_user_id)
    VALUES (referrer_id, 'referral_commission', commission_amount, 'Commission from referral task', auth.uid());
  END IF;

END;
$$;
