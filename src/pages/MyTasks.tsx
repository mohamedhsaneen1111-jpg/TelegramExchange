import React, { useEffect, useState } from 'react';
import { supabase, type Channel } from '../lib/supabase';
import { Send, Youtube, Video, Trash2, PauseCircle, PlayCircle, Loader2, Target, Users } from 'lucide-react';
import { useToast } from '../lib/toast-context';

export default function MyTasks() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchMyChannels = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('channels')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setChannels(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMyChannels();
  }, []);

  const toggleStatus = async (channel: Channel) => {
    try {
      const newStatus = !channel.active;
      const { error } = await supabase
        .from('channels')
        .update({ active: newStatus })
        .eq('id', channel.id);

      if (error) throw error;

      setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, active: newStatus } : c));
      showToast(newStatus ? 'Channel activated' : 'Channel paused', 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status', 'error');
    }
  };

  const deleteChannel = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this channel? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setChannels(prev => prev.filter(c => c.id !== id));
      showToast('Channel deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting channel:', error);
      showToast('Failed to delete channel', 'error');
    }
  };

  const getIcon = (platform: string) => {
    switch (platform) {
      case 'telegram': return <Send className="w-5 h-5 text-blue-500" />;
      case 'youtube': return <Youtube className="w-5 h-5 text-red-600" />;
      case 'tiktok': return <Video className="w-5 h-5 text-black" />;
      default: return <Users className="w-5 h-5" />;
    }
  };

  const getProgressPercentage = (current: number, target: number | null) => {
    if (!target) return 100; // If no target, show full bar or handle differently
    return Math.min((current / target) * 100, 100);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>

      {channels.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Tasks Yet</h3>
          <p className="text-gray-500 mb-6">Add a channel to start getting followers.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {channels.map((channel) => (
            <div key={channel.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center">
                    {getIcon(channel.platform)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{channel.name}</h3>
                    <p className="text-xs text-gray-500 capitalize">{channel.platform}</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold ${channel.active ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {channel.active ? 'Active' : 'Paused'}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium">
                    {channel.current_followers} / {channel.target_followers || '∞'}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${channel.active ? 'bg-blue-600' : 'bg-gray-400'}`}
                    style={{ width: `${channel.target_followers ? getProgressPercentage(channel.current_followers, channel.target_followers) : 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3 border-t border-gray-50">
                <button 
                  onClick={() => toggleStatus(channel)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                    channel.active 
                      ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' 
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  {channel.active ? <><PauseCircle className="w-4 h-4" /> Pause</> : <><PlayCircle className="w-4 h-4" /> Resume</>}
                </button>
                
                <button 
                  onClick={() => deleteChannel(channel.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
