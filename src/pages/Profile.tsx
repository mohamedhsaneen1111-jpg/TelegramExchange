import React, { useEffect, useState } from 'react';
import { supabase, type Profile, type Transaction } from '../lib/supabase';
import { User, MapPin, Calendar, LogOut, History, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch Profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(profileData);

        // Fetch Recent Transactions
        const { data: transactionsData } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        
        setTransactions((transactionsData as Transaction[]) || []);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const getTransactionIcon = (type: string) => {
    // Negative transactions (spending)
    if (['add_channel', 'spent_on_follower'].includes(type)) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    // Positive transactions (earning)
    return <TrendingUp className="w-4 h-4 text-green-500" />;
  };

  const formatType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600"></div>
        <div className="px-8 pb-8">
          <div className="relative -mt-12 mb-6">
            <div className="w-24 h-24 bg-white rounded-full p-1 shadow-lg inline-block">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name || ''} className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                  <User className="w-10 h-10" />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{profile.full_name}</h1>
              <p className="text-gray-500">@{profile.referral_code}</p>
            </div>
            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold">
              {profile.points.toFixed(1)} Points
            </div>
          </div>

          <div className="space-y-4 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-3 text-gray-600">
              <MapPin className="w-5 h-5 text-gray-400" />
              <span>{profile.country}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span>Joined {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-6">
          <History className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-bold text-gray-900">Recent Transactions</h2>
        </div>

        <div className="space-y-4">
          {transactions.length > 0 ? (
            transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    {getTransactionIcon(tx.type)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formatType(tx.type)}</p>
                    <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(1)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-4">No transactions yet.</p>
          )}
        </div>
      </div>

      <button 
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 text-red-600 bg-red-50 py-3 rounded-lg hover:bg-red-100 transition-colors font-medium"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
    </div>
  );
}
