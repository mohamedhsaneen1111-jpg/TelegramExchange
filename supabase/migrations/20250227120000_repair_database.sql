/*
  # Database Repair & Setup Script
  
  ## Description
  This script ensures all necessary tables, functions, and triggers exist.
  It is designed to be idempotent (safe to run multiple times).
  
  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "High"
  - Requires-Backup: false
  - Reversible: false
*/

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create PROFILES table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  country text,
  avatar_url text,
  points int default 0,
  referral_code text unique default substring(md5(random()::text), 0, 8),
  referred_by uuid references public.profiles(id),
  total_referral_earnings int default 0,
  created_at timestamptz default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles Policies (Drop first to avoid conflicts if they exist with different names)
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- 3. Create CHANNELS table
create table if not exists public.channels (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  platform text check (platform in ('telegram', 'youtube', 'tiktok')),
  name text,
  url text,
  image_url text,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.channels enable row level security;

drop policy if exists "Channels are viewable by everyone" on public.channels;
create policy "Channels are viewable by everyone" on public.channels
  for select using (true);

drop policy if exists "Users can insert own channels" on public.channels;
create policy "Users can insert own channels" on public.channels
  for insert with check (auth.uid() = user_id);

-- 4. Create FOLLOWS table
create table if not exists public.follows (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  channel_id uuid references public.channels(id),
  created_at timestamptz default now(),
  unique(user_id, channel_id)
);

alter table public.follows enable row level security;

drop policy if exists "Users can view their follows" on public.follows;
create policy "Users can view their follows" on public.follows
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their follows" on public.follows;
create policy "Users can insert their follows" on public.follows
  for insert with check (auth.uid() = user_id);

-- 5. Create TRANSACTIONS table
create table if not exists public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  type text,
  amount int,
  description text,
  source_user_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.transactions enable row level security;

drop policy if exists "Users can view their transactions" on public.transactions;
create policy "Users can view their transactions" on public.transactions
  for select using (auth.uid() = user_id);

-- 6. USER CREATION TRIGGER (Critical for Signup)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, points)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    0
  )
  on conflict (id) do nothing; -- Prevent errors if profile exists
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Re-create trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. RPC: Claim Follow Reward (Secure)
create or replace function public.claim_follow_reward(channel_id_input uuid)
returns void as $$
declare
  channel_owner uuid;
  referrer_id uuid;
begin
  -- Check if already followed
  if exists (select 1 from public.follows where user_id = auth.uid() and channel_id = channel_id_input) then
    raise exception 'Already followed';
  end if;

  -- Get channel owner
  select user_id into channel_owner from public.channels where id = channel_id_input;

  -- Insert follow record
  insert into public.follows (user_id, channel_id)
  values (auth.uid(), channel_id_input);

  -- Add points to user (3 pts)
  update public.profiles set points = points + 3 where id = auth.uid();
  
  -- Record transaction
  insert into public.transactions (user_id, type, amount, description)
  values (auth.uid(), 'follow_reward', 3, 'Followed a channel');

  -- REFERRAL COMMISSION (40% of 3 = 1.2 -> rounded to 1 or 2? Let's give 1 for simplicity or use float. Requirement says 40%)
  -- 40% of 3 is 1.2. Let's give 1 point to be safe with integers, or 2 if generous. 
  -- Let's use 1 point for now.
  select referred_by into referrer_id from public.profiles where id = auth.uid();
  
  if referrer_id is not null then
    update public.profiles 
    set points = points + 1, 
        total_referral_earnings = total_referral_earnings + 1 
    where id = referrer_id;
    
    insert into public.transactions (user_id, type, amount, description, source_user_id)
    values (referrer_id, 'referral_commission', 1, 'Commission from referral task', auth.uid());
  end if;

end;
$$ language plpgsql security definer set search_path = public;

-- 8. RPC: Claim Ad Reward
create or replace function public.claim_ad_reward()
returns void as $$
declare
  referrer_id uuid;
begin
  -- Add points (2 pts)
  update public.profiles set points = points + 2 where id = auth.uid();

  -- Record transaction
  insert into public.transactions (user_id, type, amount, description)
  values (auth.uid(), 'ad_reward', 2, 'Watched an ad');

  -- REFERRAL COMMISSION (40% of 2 = 0.8 -> Round to 1)
  select referred_by into referrer_id from public.profiles where id = auth.uid();
  
  if referrer_id is not null then
    update public.profiles 
    set points = points + 1, 
        total_referral_earnings = total_referral_earnings + 1 
    where id = referrer_id;
    
    insert into public.transactions (user_id, type, amount, description, source_user_id)
    values (referrer_id, 'referral_commission', 1, 'Commission from referral ad', auth.uid());
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- 9. RPC: Set Referrer
create or replace function public.set_referrer(referral_code_input text)
returns void as $$
declare
  referrer_id uuid;
begin
  -- Find referrer by code
  select id into referrer_id from public.profiles where referral_code = referral_code_input;

  if referrer_id is null then
    raise exception 'Invalid referral code';
  end if;

  if referrer_id = auth.uid() then
    raise exception 'Self-referral not allowed';
  end if;

  -- Update user profile
  update public.profiles 
  set referred_by = referrer_id 
  where id = auth.uid() and referred_by is null;

  -- Give Bonus to Referrer (20 pts)
  if found then
    update public.profiles set points = points + 20 where id = referrer_id;
    
    insert into public.transactions (user_id, type, amount, description, source_user_id)
    values (referrer_id, 'referral_signup', 20, 'New user referred', auth.uid());
  end if;
end;
$$ language plpgsql security definer set search_path = public;
