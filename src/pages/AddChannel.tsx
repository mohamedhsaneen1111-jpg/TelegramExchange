import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Send, Youtube, Video, Loader2, CheckCircle, AlertTriangle, Coins, Target } from 'lucide-react';
import { useToast } from '../lib/toast-context';

export default function AddChannel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [platform, setPlatform] = useState<'telegram' | 'youtube' | 'tiktok'>('telegram');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetFollowers, setTargetFollowers] = useState<string>('');
  const { showToast } = useToast();

  useEffect(() => {
    const fetchBalance = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('points').eq('id', user.id).single();
        if (data) setBalance(data.points);
      }
    };
    fetchBalance();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if user has enough points to start
      const { data: profile } = await supabase.from('profiles').select('points').eq('id', user.id).single();
      if (profile && profile.points < 3) {
        showToast('Insufficient balance! You need at least 3 points.', 'error');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('channels').insert({
        user_id: user.id,
        platform,
        name,
        url,
        image_url: imageUrl || null,
        active: true,
        target_followers: targetFollowers ? parseInt(targetFollowers) : null,
        current_followers: 0
      });

      if (error) throw error;
      
      showToast('Channel added successfully!', 'success');
      navigate('/my-tasks'); // Redirect to the new management page
    } catch (error) {
      console.error('Error adding channel:', error);
      showToast('Failed to add channel. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add New Channel</h1>
        {balance !== null && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${balance < 3 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
            <Coins className="w-4 h-4" />
            <span className="font-bold">{balance.toFixed(1)} pts</span>
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        
        {/* Warning Box */}
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-orange-700">
            <p className="font-bold mb-1">Cost & Rules:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Adding a channel is free.</li>
              <li><strong>3 Points</strong> will be deducted for every new follower.</li>
              <li>Your channel will be <strong>paused</strong> if your balance drops below 3 points.</li>
            </ul>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Select Platform</label>
            <div className="grid grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setPlatform('telegram')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  platform === 'telegram' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-200 text-gray-600'
                }`}
              >
                <Send className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">Telegram</span>
              </button>
              <button
                type="button"
                onClick={() => setPlatform('youtube')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  platform === 'youtube' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 hover:border-gray-200 text-gray-600'
                }`}
              >
                <Youtube className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">YouTube</span>
              </button>
              <button
                type="button"
                onClick={() => setPlatform('tiktok')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  platform === 'tiktok' ? 'border-black bg-gray-50 text-black' : 'border-gray-100 hover:border-gray-200 text-gray-600'
                }`}
              >
                <Video className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">TikTok</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder={`My ${platform === 'telegram' ? 'Channel' : platform === 'youtube' ? 'Channel' : 'Account'}`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link / URL</label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="https://..."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL (Optional)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Followers (Optional)</label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  min="1"
                  value={targetFollowers}
                  onChange={(e) => setTargetFollowers(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g. 100"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || (balance !== null && balance < 3)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Add Channel</>}
          </button>
          {balance !== null && balance < 3 && (
             <p className="text-center text-sm text-red-600 mt-2">You need more points to add a channel.</p>
          )}
        </form>
      </div>
    </div>
  );
}
