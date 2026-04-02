
import React, { useState } from 'react';
import { useAuction } from '../hooks/useAuction';
import { Gavel, Wallet, Shirt, Users } from 'lucide-react';

const MyTeamPanel: React.FC = () => {
  const { state, placeBid, userProfile, nextBid } = useAuction();
  const { teams, highestBidder } = state;
  const [activeTab, setActiveTab] = useState<'MY_SQUAD' | 'ALL_TEAMS'>('MY_SQUAD');

  // Find the specific team belonging to this logged-in user
  const userTeam = teams.find(t => String(t.id) === String(userProfile?.teamId));
  
  if (!userTeam) return (
      <div className="bg-secondary rounded-lg p-4 text-center text-text-secondary">
          <p>Team data not found.</p>
      </div>
  );

  const canAfford = userTeam.budget >= nextBid;
  const isLeading = highestBidder && String(highestBidder.id) === String(userTeam.id);

  const handleBid = async () => {
    if (canAfford) {
        try {
             await placeBid(userTeam.id, nextBid);
        } catch (e) {
            console.error(e);
        }
    }
  };

  const sortedTeams = [...teams].sort((a,b) => b.budget - a.budget);

  return (
    <div className="bg-secondary rounded-lg shadow-lg p-4 flex flex-col h-full border border-accent/50">
      <div className="flex items-center mb-4 border-b border-accent pb-3">
        {userTeam.logoUrl ? (
            <img src={userTeam.logoUrl} alt={userTeam.name} className="w-12 h-12 rounded-full mr-4 bg-white p-1" />
        ) : (
            <div className="w-12 h-12 rounded-full mr-4 bg-gray-700 flex items-center justify-center font-bold text-white text-lg">
                {userTeam.name.charAt(0)}
            </div>
        )}
        <div>
            <h3 className="text-xl font-bold text-white">{userTeam.name}</h3>
            <p className="flex items-center text-text-secondary text-sm">
                <Wallet className="w-4 h-4 mr-2 text-green-400" /> 
                <span className="font-semibold text-white">{userTeam.budget} Remaining</span>
            </p>
        </div>
      </div>
      
      <div className="mb-4">
        <button
          onClick={handleBid}
          disabled={!canAfford || isLeading}
          className="w-full flex items-center justify-center bg-highlight hover:bg-teal-500 text-primary font-bold py-3 px-6 rounded-lg transition-colors duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed transform hover:scale-105 shadow-lg shadow-highlight/20"
        >
          <Gavel className="mr-2 h-5 w-5"/> Bid {nextBid}
        </button>
        {!canAfford && <p className="text-red-400 text-xs mt-2 text-center font-semibold">Insufficient budget.</p>}
        {isLeading && <p className="text-green-400 text-xs mt-2 text-center font-bold animate-pulse">You are the highest bidder!</p>}
      </div>

      <div className="flex bg-primary/50 rounded mb-2 p-1">
          <button onClick={() => setActiveTab('MY_SQUAD')} className={`flex-1 text-[10px] font-bold py-1.5 rounded uppercase ${activeTab === 'MY_SQUAD' ? 'bg-highlight text-primary' : 'text-text-secondary'}`}>My Squad</button>
          <button onClick={() => setActiveTab('ALL_TEAMS')} className={`flex-1 text-[10px] font-bold py-1.5 rounded uppercase ${activeTab === 'ALL_TEAMS' ? 'bg-highlight text-primary' : 'text-text-secondary'}`}>All Purses</button>
      </div>

      <div className="flex-grow flex flex-col min-h-0">
         {activeTab === 'MY_SQUAD' ? (
             <>
                <h4 className="text-md font-bold text-highlight mb-2 flex items-center border-b border-accent/30 pb-1">
                    <Shirt className="w-4 h-4 mr-2"/>
                    Players ({userTeam.players?.length || 0})
                </h4>
                <div className="space-y-2 pr-1 flex-grow overflow-y-auto custom-scrollbar">
                    {userTeam.players && userTeam.players.length > 0 ? userTeam.players.map(player => (
                        <div key={player.id} className="bg-primary/40 p-2 rounded-md text-sm border-l-2 border-highlight flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-text-main">{player.name}</p>
                                <p className="text-[10px] text-text-secondary uppercase">{player.category}</p>
                            </div>
                            {(player as any).soldPrice && (
                                <span className="text-green-400 font-mono font-bold text-xs">
                                    {(player as any).soldPrice}
                                </span>
                            )}
                        </div>
                    )) : (
                        <div className="text-text-secondary text-sm italic text-center py-4 opacity-50">
                            No players bought yet.
                        </div>
                    )}
                </div>
             </>
         ) : (
             <>
                <h4 className="text-md font-bold text-highlight mb-2 flex items-center border-b border-accent/30 pb-1">
                    <Users className="w-4 h-4 mr-2"/>
                    Leaderboard
                </h4>
                <div className="space-y-2 pr-1 flex-grow overflow-y-auto custom-scrollbar">
                    {sortedTeams.map(t => (
                        <div key={t.id} className={`p-2 rounded-md text-xs flex justify-between items-center ${t.id === userTeam.id ? 'bg-highlight/10 border border-highlight/30' : 'bg-primary/30 border border-transparent'}`}>
                            <div className="flex items-center gap-2">
                                <span className={`font-bold ${t.id === userTeam.id ? 'text-highlight' : 'text-gray-300'}`}>{t.name}</span>
                                <span className="text-[10px] text-gray-500">({t.players.length} players)</span>
                            </div>
                            <span className="text-green-400 font-mono font-bold">{t.budget}</span>
                        </div>
                    ))}
                </div>
             </>
         )}
      </div>
    </div>
  );
};

export default MyTeamPanel;
