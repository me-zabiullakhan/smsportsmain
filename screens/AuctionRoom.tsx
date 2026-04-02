
import React from 'react';
import { useAuction } from '../hooks/useAuction';
import { UserRole } from '../types';
import PlayerFocus from '../components/PlayerFocus';
import MyTeamPanel from '../components/MyTeamPanel';
import AuctionLog from '../components/AuctionLog';
import PlayerPool from '../components/PlayerPool';
import BiddingPanel from '../components/BiddingPanel';

const AuctionRoom: React.FC = () => {
  const { state, userProfile } = useAuction();
  // Find player by ID from full list to persist display after sale, instead of relying on unsold pool index
  const currentPlayer = state.currentPlayerId ? state.players.find(p => String(p.id) === String(state.currentPlayerId)) : null;
  
  const isTeamOwner = userProfile?.role === UserRole.TEAM_OWNER;

  return (
    <div className="h-full">
      {currentPlayer ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          
          {/* Center Column: Main Action (Live Player) - First on Mobile */}
          <div className="lg:col-span-2 lg:order-2 flex flex-col gap-6">
            <PlayerFocus player={currentPlayer} />
            {isTeamOwner && <div className="mt-auto"><BiddingPanel /></div>}
          </div>

          {/* Left Column: Team Info or Log - Second on Mobile */}
          <div className="lg:col-span-1 lg:order-1 space-y-6 flex flex-col lg:h-[calc(100vh-140px)]">
            {isTeamOwner && <div className="flex-1 min-h-[300px]"><MyTeamPanel /></div>}
            <div className="flex-1 min-h-[300px] lg:min-h-0"><AuctionLog /></div>
          </div>

          {/* Right Column: Player Pool - Last on Mobile */}
          <div className="lg:col-span-1 lg:order-3 lg:h-[calc(100vh-140px)] h-[500px]">
            <PlayerPool />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[60vh] bg-secondary/50 rounded-lg border border-dashed border-gray-600">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-highlight mb-2">Waiting for Auctioneer</h2>
                <p className="text-text-secondary animate-pulse">The next lot will appear shortly...</p>
            </div>
        </div>
      )}
    </div>
  );
};

export default AuctionRoom;
