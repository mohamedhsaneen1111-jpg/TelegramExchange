import React, { useEffect, useState } from 'react';
import { supabase, type Channel, type Profile } from '../lib/supabase';
import { ExternalLink, Check, Send, Youtube, Video, Loader2, Clock, RefreshCw, Coins } from 'lucide-react';
import { useToast } from '../lib/toast-context';

export default function Earn() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Anti-cheat state
  const [clickedLinks, setClickedLinks] = useState<Record<string, boolean>>({});
  const [timers, setTimers] = useState<Record<string, number>>({});

  const { showToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch Balance
    const { data: profile } = await supabase.from('profiles').select('points').eq('id', user.id).single();
    if (profile) setBalance(profile.points);

    // Get IDs of channels already followed
    const { data: followed } = await supabase
      .from('follows')
      .select('channel_id')
      .eq('user_id', user.id);

    const followedIds = followed?.map(f => f.channel_id) || [];

    // Fetch channels
    const { data } = await supabase
      .from('channels')
      .select('*')
      .neq('user_id', user.id)
      .eq('active', true)
      .not('id', 'in', `(${followedIds.length ? followedIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
      .limit(20);

    setChannels(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Realtime balance listener
    const subscription = supabase
      .channel('earn_balance')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        setBalance((payload.new as Profile).points);
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  // Timer countdown effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const newTimers = { ...prev };
        let changed = false;
        Object.keys(newTimers).forEach(key => {
          if (newTimers[key] > 0) {
            newTimers[key] -= 1;
            changed = true;
          }
        });
        return changed ? newTimers : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleOpenLink = (channel: Channel) => {
    window.open(channel.url, '_blank');
    setClickedLinks(prev => ({ ...prev, [channel.id]: true }));
    setTimers(prev => ({ ...prev, [channel.id]: 3 }));
  };

  const handleVerify = async (channelId: string) => {
    setProcessingId(channelId);
    try {
      const { error } = await supabase.rpc('claim_follow_reward', { channel_id_input: channelId });
      if (error) throw error;
      
      setChannels(prev => prev.filter(c => c.id !== channelId));
      showToast('Success! You earned 3 points.', 'success');
      // Balance will update automatically via Realtime subscription
    } catch (error) {
      console.error('Error claiming reward:', error);
      showToast('Failed to claim reward.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const getIcon = (platform: string) => {
    switch (platform) {
      case 'telegram': return <Send className="w-5 h-5 text-blue-500" />;
      case 'youtube': return <Youtube className="w-5 h-5 text-red-600" />;
      case 'tiktok': return <Video className="w-5 h-5 text-black" />;
      default: return <ExternalLink className="w-5 h-5" />;
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Available Tasks</h1>
          <p className="text-sm text-gray-500">Follow channels to earn</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg">
          <Coins className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-blue-700">{balance.toFixed(1)}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={fetchData}
          className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh List
        </button>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">All Caught Up!</h3>
          <p className="text-gray-500 mb-6">No more tasks available right now.</p>
          <button onClick={fetchData} className="text-blue-600 font-medium hover:underline">Check again</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {channels.map((channel) => {
            const isClicked = clickedLinks[channel.id];
            const timeLeft = timers[channel.id] || 0;
            const canVerify = isClicked && timeLeft === 0;

            return (
              <div key={channel.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center">
                   {channel.image_url ? (
                       <img src={channel.image_url} alt={channel.name} className="w-full h-full object-cover" />
                   ) : (
                       getIcon(channel.platform)
                   )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{channel.name}</h3>
                  <p className="text-xs text-gray-500 capitalize flex items-center gap-1">
                      {getIcon(channel.platform)} {channel.platform}
                  </p>
                </div>

                <div className="flex flex-col gap-2 min-w-[80px]">
                  {!isClicked ? (
                    <button
                      onClick={() => handleOpenLink(channel)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Follow
                    </button>
                  ) : (
                    <button
                      onClick={() => handleVerify(channel.id)}
                      disabled={!canVerify || processingId === channel.id}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1 ${
                        canVerify 
                          ? 'bg-green-600 text-white hover:bg-green-700 shadow-md transform hover:scale-105' 
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {processingId === channel.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : !canVerify ? (
                        <>
                          <Clock className="w-3 h-3" /> {timeLeft}s
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3" /> Done
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
