import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  full_name: string | null;
  country: string | null;
  avatar_url: string | null;
  points: number;
  referral_code: string;
  referred_by: string | null;
  total_referral_earnings: number;
};

export type Channel = {
  id: string;
  platform: 'telegram' | 'youtube' | 'tiktok';
  name: string;
  url: string;
  image_url: string | null;
  active: boolean;
  target_followers: number | null;
  current_followers: number;
  created_at?: string;
};

export type Transaction = {
  id: string;
  amount: number;
  type: 'signup_bonus' | 'referral_signup' | 'follow_reward' | 'ad_reward' | 'referral_commission' | 'add_channel' | 'daily_bonus' | 'spent_on_follower';
  description: string;
  created_at: string;
  source_user_id?: string;
};
