import React, { useEffect, useState } from 'react';
import { supabase, type Profile } from '../lib/supabase';
import { Copy, Users, Coins, CheckCheck } from 'lucide-react';

export default function Referrals() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [referralStats, setReferralStats] = useState({ count: 0, earnings: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData);

      // Get referral stats
      // 1. Count of people referred
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', user.id);

      // 2. Earnings from referrals (sum transactions)
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .in('type', ['referral_signup', 'referral_commission']);
      
      const totalEarnings = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

      setReferralStats({
        count: count || 0,
        earnings: totalEarnings
      });
    };
    fetchData();
  }, []);

  const handleCopy = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white text-center">
        <h1 className="text-3xl font-bold mb-2">Invite Friends</h1>
        <p className="text-blue-100 mb-8">Earn 20 points for every friend + 40% of their earnings!</p>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between max-w-md mx-auto border border-white/20">
          <div className="text-left">
            <p className="text-xs text-blue-200 uppercase tracking-wider font-medium">Your Referral Code</p>
            <p className="text-xl font-mono font-bold tracking-widest">{profile?.referral_code || '...'}</p>
          </div>
          <button 
            onClick={handleCopy}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            {copied ? <CheckCheck className="w-6 h-6 text-green-400" /> : <Copy className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{referralStats.count}</h3>
          <p className="text-sm text-gray-500">Friends Invited</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Coins className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{referralStats.earnings}</h3>
          <p className="text-sm text-gray-500">Points Earned</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 mb-4">How it works</h3>
        <ul className="space-y-4">
          <li className="flex gap-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">1</div>
            <p className="text-sm text-gray-600">Share your unique code with friends.</p>
          </li>
          <li className="flex gap-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">2</div>
            <p className="text-sm text-gray-600">They enter it when completing their profile.</p>
          </li>
          <li className="flex gap-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">3</div>
            <p className="text-sm text-gray-600">You get <span className="font-bold text-gray-900">20 points</span> instantly.</p>
          </li>
          <li className="flex gap-3">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">4</div>
            <p className="text-sm text-gray-600">You earn <span className="font-bold text-gray-900">40%</span> of all points they earn from tasks forever.</p>
          </li>
        </ul>
      </div>
    </div>
  );
}
