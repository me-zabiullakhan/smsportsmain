
import React from 'react';
import { useAuction } from '../../hooks/useAuction';
import { UserRole } from '../../types';
import PlayerFocus from '../PlayerFocus';
import MyTeamPanel from '../MyTeamPanel';
import AuctionLog from '../AuctionLog';
import PlayerPool from '../PlayerPool';
import BiddingPanel from '../BiddingPanel';

const AuctionRoom: React.FC = () => {
  const { state, userProfile } = useAuction();
  const { currentPlayerIndex, unsoldPlayers } = state;

  const currentPlayer = currentPlayerIndex !== null ? unsoldPlayers[currentPlayerIndex] : null;
  const isTeamOwner = userProfile?.role === UserRole.TEAM_OWNER;

  return (
    <div className="h-full">
      {currentPlayer ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          {/* Left Column: Team Info or Log */}
          <div className="lg:col-span-1 space-y-6 flex flex-col h-[calc(100vh-140px)]">
            {isTeamOwner && <div className="flex-1"><MyTeamPanel /></div>}
            <div className="flex-1"><AuctionLog /></div>
          </div>

          {/* Center Column: Main Action */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <PlayerFocus player={currentPlayer} />
            {isTeamOwner && <div className="mt-auto"><BiddingPanel /></div>}
          </div>

          {/* Right Column: Player Pool */}
          <div className="lg:col-span-1 h-[calc(100vh-140px)]">
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
