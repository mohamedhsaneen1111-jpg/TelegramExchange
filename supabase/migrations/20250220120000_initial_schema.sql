/*
  # Initial Schema for TelegramExchange

  ## Query Description:
  Sets up the core tables for the exchange platform: profiles, channels, follows, and transactions.
  Includes secure RPC functions to handle point rewards and referral commissions atomically.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "High"
  - Requires-Backup: false
  - Reversible: true

  ## Structure Details:
  - Tables: profiles, channels, follows, transactions
  - Functions: claim_follow_reward, claim_ad_reward, set_referrer, handle_new_user
*/

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  country text,
  avatar_url text,
  points integer default 0,
  referral_code text unique default substring(md5(random()::text) from 1 for 8),
  referred_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Channels Table
create table if not exists public.channels (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  platform text not null check (platform in ('telegram', 'youtube', 'tiktok')),
  name text not null,
  url text not null,
  image_url text,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Follows Table (Tracks who followed what to prevent duplicates)
create table if not exists public.follows (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  channel_id uuid references public.channels(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, channel_id)
);

-- 4. Transactions Table
create table if not exists public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  amount integer not null,
  type text not null, -- 'follow', 'ad_reward', 'referral_bonus', 'referral_commission'
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.follows enable row level security;
alter table public.transactions enable row level security;

-- Profiles: Public read (for leaderboards/referrals), Self update
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- Channels: Public read, Owner create/update
create policy "Channels are viewable by everyone." on public.channels for select using (true);
create policy "Users can create channels." on public.channels for insert with check (auth.uid() = user_id);
create policy "Users can update own channels." on public.channels for update using (auth.uid() = user_id);

-- Follows: Owner read/create
create policy "Users can see their follows." on public.follows for select using (auth.uid() = user_id);
create policy "Users can create follows." on public.follows for insert with check (auth.uid() = user_id);

-- Transactions: Owner read
create policy "Users can see their transactions." on public.transactions for select using (auth.uid() = user_id);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid errors on re-run
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RPC: Claim Follow Reward
create or replace function claim_follow_reward(channel_id_input uuid)
returns void as $$
declare
  v_user_id uuid;
  v_points_reward int := 3;
  v_referrer_id uuid;
  v_commission int;
begin
  v_user_id := auth.uid();

  -- Check if already followed
  if exists (select 1 from public.follows where user_id = v_user_id and channel_id = channel_id_input) then
    raise exception 'Already followed this channel';
  end if;

  -- Insert follow
  insert into public.follows (user_id, channel_id)
  values (v_user_id, channel_id_input);

  -- Update user points
  update public.profiles
  set points = points + v_points_reward
  where id = v_user_id;

  -- Log transaction
  insert into public.transactions (user_id, amount, type, description)
  values (v_user_id, v_points_reward, 'follow', 'Followed channel');

  -- Handle Referral Commission (40%)
  select referred_by into v_referrer_id from public.profiles where id = v_user_id;
  
  if v_referrer_id is not null then
    v_commission := round(v_points_reward * 0.4); 
    if v_commission > 0 then
      update public.profiles set points = points + v_commission where id = v_referrer_id;
      insert into public.transactions (user_id, amount, type, description)
      values (v_referrer_id, v_commission, 'referral_commission', 'Commission from referral follow');
    end if;
  end if;

end;
$$ language plpgsql security definer;

-- RPC: Watch Ad Reward
create or replace function claim_ad_reward()
returns void as $$
declare
  v_user_id uuid;
  v_points_reward int := 2;
  v_referrer_id uuid;
  v_commission int;
begin
  v_user_id := auth.uid();

  -- Update user points
  update public.profiles
  set points = points + v_points_reward
  where id = v_user_id;

  -- Log transaction
  insert into public.transactions (user_id, amount, type, description)
  values (v_user_id, v_points_reward, 'ad_reward', 'Watched ad');

  -- Handle Referral Commission (40%)
  select referred_by into v_referrer_id from public.profiles where id = v_user_id;
  
  if v_referrer_id is not null then
    v_commission := round(v_points_reward * 0.4);
    if v_commission > 0 then
        update public.profiles set points = points + v_commission where id = v_referrer_id;
        insert into public.transactions (user_id, amount, type, description)
        values (v_referrer_id, v_commission, 'referral_commission', 'Commission from referral ad watch');
    end if;
  end if;
end;
$$ language plpgsql security definer;

-- RPC: Set Referrer
create or replace function set_referrer(referral_code_input text)
returns void as $$
declare
  v_user_id uuid;
  v_referrer_id uuid;
  v_bonus int := 20;
begin
  v_user_id := auth.uid();
  
  -- Find referrer
  select id into v_referrer_id from public.profiles where referral_code = referral_code_input;
  
  if v_referrer_id is not null and v_referrer_id != v_user_id then
    -- Update current user's referrer if not already set
    update public.profiles set referred_by = v_referrer_id where id = v_user_id and referred_by is null;
    
    -- Only give bonus if update happened
    if found then
       -- Give bonus to referrer
       update public.profiles set points = points + v_bonus where id = v_referrer_id;
       insert into public.transactions (user_id, amount, type, description)
       values (v_referrer_id, v_bonus, 'referral_signup', 'User signed up with your code');
    end if;
  end if;
end;
$$ language plpgsql security definer;
