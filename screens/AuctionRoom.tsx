
import React from 'react';
import { useAuction } from '../hooks/useAuction';
import { useTheme } from '../contexts/ThemeContext';
import { UserRole } from '../types';
import PlayerFocus from '../components/PlayerFocus';
import MyTeamPanel from '../components/MyTeamPanel';
import AuctionLog from '../components/AuctionLog';
import PlayerPool from '../components/PlayerPool';
import BiddingPanel from '../components/BiddingPanel';
import { Loader2 } from 'lucide-react';

const AuctionRoom: React.FC = () => {
  const { state, userProfile } = useAuction();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Find player by ID from full list to persist display after sale, instead of relying on unsold pool index
  const currentPlayer = state.currentPlayerId ? state.players.find(p => String(p.id) === String(state.currentPlayerId)) : null;
  
  const isTeamOwner = userProfile?.role === UserRole.TEAM_OWNER;

  return (
    <div className="min-h-full transition-all duration-500">
      {currentPlayer ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
          
          {/* Center Column: Main Action (Live Player) - First on Mobile */}
          <div className="lg:col-span-2 lg:order-2 flex flex-col gap-6 md:gap-8">
            <PlayerFocus player={currentPlayer} />
            {isTeamOwner && <div className="mt-auto"><BiddingPanel /></div>}
          </div>

          {/* Left Column: Team Info or Log - Second on Mobile */}
          <div className="lg:col-span-1 lg:order-1 space-y-6 md:space-y-8 flex flex-col lg:h-[calc(100vh-140px)]">
            {isTeamOwner && <div className="flex-1 min-h-[350px]"><MyTeamPanel /></div>}
            <div className="flex-1 min-h-[300px] lg:min-h-0"><AuctionLog /></div>
          </div>

          {/* Right Column: Player Pool - Last on Mobile */}
          <div className="lg:col-span-1 lg:order-3 lg:h-[calc(100vh-140px)] h-[500px] lg:min-h-0">
            <PlayerPool />
          </div>
        </div>
      ) : (
        <div className={`flex items-center justify-center h-[60vh] rounded-[3rem] border-4 border-dashed transition-all duration-500 ${isDark ? 'bg-secondary/30 border-accent/20' : 'bg-gray-50 border-blue-500/20'}`}>
            <div className="text-center p-12">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
                    <Loader2 className={`w-10 h-10 animate-spin ${isDark ? 'text-accent' : 'text-blue-600'}`} />
                </div>
                <h2 className={`text-3xl md:text-5xl font-black uppercase tracking-tighter italic mb-4 ${isDark ? 'advaya-text' : 'text-gray-900'}`}>Waiting for Auctioneer</h2>
                <p className={`text-xs md:text-sm font-black uppercase tracking-[0.4em] animate-pulse ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>The next lot will appear shortly...</p>
            </div>
        </div>
      )}
    </div>
  );
};

export default AuctionRoom;
