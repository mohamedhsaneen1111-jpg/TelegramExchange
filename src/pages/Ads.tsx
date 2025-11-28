import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Play, Loader2, Clock, X, ExternalLink, AlertCircle } from 'lucide-react';
import { useToast } from '../lib/toast-context';

const AD_LINKS = [
  "https://otieu.com/4/8179287",
  "https://otieu.com/4/8464568",
  "https://otieu.com/4/9038914",
  "https://otieu.com/4/8179107"
];

export default function Ads() {
  const [watchingIndex, setWatchingIndex] = useState<number | null>(null);
  const [activeAdUrl, setActiveAdUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [isClaiming, setIsClaiming] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (watchingIndex !== null && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (watchingIndex !== null && countdown === 0 && !isClaiming) {
      // Time's up, claim reward automatically
      handleClaimReward(watchingIndex);
    }

    return () => clearInterval(timer);
  }, [watchingIndex, countdown, isClaiming]);

  const handleWatchAd = (index: number, url: string) => {
    setWatchingIndex(index);
    setActiveAdUrl(url);
    setCountdown(30); // Set to 30 seconds as requested
    setIsClaiming(false);
  };

  const handleClaimReward = async (index: number) => {
    setIsClaiming(true);
    try {
      const { error } = await supabase.rpc('claim_ad_reward');
      if (error) throw error;
      showToast('You earned 2 points!', 'success');
    } catch (error) {
      console.error('Error claiming ad reward:', error);
      showToast('Failed to claim reward. Please try again.', 'error');
    } finally {
      // Close the ad player
      setWatchingIndex(null);
      setActiveAdUrl(null);
      setIsClaiming(false);
    }
  };

  const handleCloseAd = () => {
    if (window.confirm("If you close now, you won't get points. Are you sure?")) {
      setWatchingIndex(null);
      setActiveAdUrl(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Watch & Earn</h1>
      
      <div className="grid gap-4">
        {AD_LINKS.map((url, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
                <Play className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Sponsored Ad #{index + 1}</h3>
                <p className="text-sm text-gray-500">Watch for 30 seconds to earn rewards</p>
              </div>
            </div>

            <button
              onClick={() => handleWatchAd(index, url)}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 min-w-[100px] justify-center"
            >
              Watch <span className="bg-white/20 px-2 py-0.5 rounded text-xs">+2 pts</span>
            </button>
          </div>
        ))}
      </div>

      {/* Full Screen Ad Overlay */}
      {activeAdUrl && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Top Bar */}
          <div className="h-14 bg-gray-900 text-white flex items-center justify-between px-4 flex-shrink-0">
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full">
                 <Clock className="w-4 h-4 text-orange-400" />
                 <span className="font-mono font-bold text-orange-400">{countdown}s</span>
               </div>
               <span className="text-sm text-gray-400 hidden sm:inline">Keep watching to earn reward</span>
            </div>

            <div className="flex items-center gap-3">
                {/* Fallback link if iframe fails */}
                <a 
                  href={activeAdUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <AlertCircle className="w-3 h-3" /> Not loading?
                </a>
                <button 
                  onClick={handleCloseAd}
                  className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
            </div>
          </div>

          {/* Iframe Container */}
          <div className="flex-1 bg-white relative w-full h-full">
            {isClaiming && (
              <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                <div className="bg-white px-6 py-4 rounded-xl flex items-center gap-3 shadow-xl">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="font-medium">Claiming your points...</span>
                </div>
              </div>
            )}
            
            <iframe 
              src={activeAdUrl} 
              className="w-full h-full border-0"
              title="Ad Content"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        </div>
      )}
    </div>
  );
}
