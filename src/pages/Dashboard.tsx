import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Profile, type Channel } from '../lib/supabase';
import { Coins, Plus, PlayCircle, Users, ArrowUpRight, ArrowRight, Send, Youtube, Video } from 'lucide-react';

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [featuredChannels, setFeaturedChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription: any;

    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 1. Fetch Initial Profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(profileData);

        // 2. Setup Real-time Subscription for Profile (Points)
        subscription = supabase
          .channel('dashboard_profile')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`,
            },
            (payload) => {
              // Update profile state immediately when points change
              setProfile(payload.new as Profile);
            }
          )
          .subscribe();

        // 3. Fetch Featured Channels
        const { data: followed } = await supabase
          .from('follows')
          .select('channel_id')
          .eq('user_id', user.id);

        const followedIds = followed?.map(f => f.channel_id) || [];

        const { data: channelsData } = await supabase
          .from('channels')
          .select('*')
          .neq('user_id', user.id)
          .eq('active', true)
          .not('id', 'in', `(${followedIds.length ? followedIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
          .limit(4);

        setFeaturedChannels(channelsData || []);
      }
      setLoading(false);
    };

    fetchData();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  const getIcon = (platform: string) => {
    switch (platform) {
      case 'telegram': return <Send className="w-4 h-4 text-blue-500" />;
      case 'youtube': return <Youtube className="w-4 h-4 text-red-600" />;
      case 'tiktok': return <Video className="w-4 h-4 text-black" />;
      default: return <PlayCircle className="w-4 h-4" />;
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-8">
      {/* Balance Card with Animation Key */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Coins className="w-32 h-32" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-blue-100 font-medium">Total Balance</h2>
              <div className="flex items-baseline gap-2">
                {/* Key ensures animation triggers on change */}
                <span key={profile?.points} className="text-4xl font-bold animate-pulse-once">
                  {profile?.points?.toFixed(1) || 0}
                </span>
                <span className="text-blue-100">Points</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Coins className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/add-channel" className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Add Channel
            </Link>
            <Link to="/earn" className="flex-1 bg-white text-blue-600 py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
              <PlayCircle className="w-4 h-4" /> Earn Points
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Link to="/ads" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition-all group">
          <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <PlayCircle className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-gray-900">Watch Ads</h3>
          <p className="text-xs text-gray-500 mt-1">Earn 2 points per ad</p>
        </Link>

        <Link to="/referrals" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition-all group">
          <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-gray-900">Invite Friends</h3>
          <p className="text-xs text-gray-500 mt-1">Earn 20 pts + 40% commission</p>
        </Link>

        <Link to="/add-channel" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition-all group col-span-2 md:col-span-1">
          <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-gray-900">Promote Channel</h3>
          <p className="text-xs text-gray-500 mt-1">Get followers for your content</p>
        </Link>
      </div>

      {/* Featured Tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-lg">Available Tasks</h3>
          <Link to="/earn" className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:underline">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {featuredChannels.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {featuredChannels.map((channel) => (
              <div key={channel.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                  {channel.image_url ? (
                    <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover" />
                  ) : (
                    getIcon(channel.platform)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate text-sm">{channel.name}</h4>
                  <p className="text-xs text-gray-500 capitalize flex items-center gap-1">
                    {channel.platform}
                  </p>
                </div>
                <Link 
                  to="/earn"
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
                >
                  +3 pts
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl border border-gray-100 text-center text-gray-500 text-sm">
            No new tasks available right now.
          </div>
        )}
      </div>
    </div>
  );
}
