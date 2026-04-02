import React, { useState, useMemo, useEffect } from 'react';
import { useAuction } from '../hooks/useAuction';
import { Player } from '../types';
import { Search, Filter, X, Clock, CheckCircle, Users, Ban } from 'lucide-react';
import { db } from '../firebase';

type PlayerStatus = 'upcoming' | 'sold' | 'unsold' | 'teams';

const PlayerPool: React.FC = () => {
  const { state, activeAuctionId } = useAuction();
  const { players, teams, currentPlayerIndex, unsoldPlayers } = state;
  const [activeTab, setActiveTab] = useState<PlayerStatus>('upcoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  // Fetch Roles dynamically to populate filter
  useEffect(() => {
      if(!activeAuctionId) return;
      const unsub = db.collection('auctions').doc(activeAuctionId).collection('roles').onSnapshot(s => {
          setAvailableRoles(s.docs.map(d => d.data().name));
      });
      return () => unsub();
  }, [activeAuctionId]);

  const soldPlayerIds = useMemo(() => new Set(teams.flatMap(team => team.players.map(p => p.id))), [teams]);
  const currentPlayer = currentPlayerIndex !== null ? unsoldPlayers[currentPlayerIndex] : null;

  const filteredPlayers = useMemo(() => {
    let list: (Omit<Player, 'status'> & { status: PlayerStatus, soldTo?: string, teamLogo?: string })[] = [];

    if (activeTab === 'upcoming') {
        list = unsoldPlayers.filter(p => !soldPlayerIds.has(p.id)).map(p => ({ ...p, status: 'upcoming' as PlayerStatus }));
    } else if (activeTab === 'sold') {
        teams.forEach(team => {
            team.players.forEach(player => {
                list.push({ ...player, status: 'sold' as PlayerStatus, soldTo: team.name, teamLogo: team.logoUrl });
            });
        });
    } else if (activeTab === 'unsold') {
        list = players.filter(p => p.status === 'UNSOLD').map(p => ({ ...p, status: 'unsold' as PlayerStatus }));
    }

    if (selectedRole !== 'All' && activeTab !== 'teams') {
        list = list.filter(p => p.role === selectedRole || (!p.role && p.category === selectedRole));
    }

    if (searchTerm && activeTab !== 'teams') {
        const term = searchTerm.toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(term));
    }
    
    return list;
  }, [activeTab, players, teams, soldPlayerIds, unsoldPlayers, searchTerm, selectedRole]);

  const TabButton: React.FC<{tab: PlayerStatus, label: string, icon: React.ReactNode}> = ({tab, label, icon}) => (
      <button 
        onClick={() => setActiveTab(tab)}
        className={`flex-1 py-3 text-xs md:text-sm font-bold flex items-center justify-center gap-1 md:gap-2 transition-all duration-300 border-b-2 ${activeTab === tab ? 'border-highlight text-highlight bg-highlight/5' : 'border-transparent text-text-secondary hover:text-white hover:bg-white/5'}`}
      >
          {icon} <span className="hidden md:inline">{label}</span><span className="md:hidden">{label.slice(0,4)}</span>
      </button>
  );

  const rolesToDisplay = availableRoles.length > 0 ? ['All', ...availableRoles] : ['All', 'Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper'];

  return (
    <div className="bg-secondary rounded-xl shadow-xl h-full flex flex-col border border-gray-700 overflow-hidden">
      <div className="p-4 bg-primary/30 border-b border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><span className="w-1 h-6 bg-highlight rounded-full"></span>
            {activeTab === 'teams' ? 'Team Purses' : 'Player Pool'}
        </h2>
        
        {activeTab !== 'teams' && (
            <div className="space-y-4">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-highlight transition-colors" />
                    <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-primary border border-gray-600 rounded-lg py-2.5 pl-10 pr-10 text-text-main text-sm focus:outline-none focus:ring-1 focus:ring-highlight focus:border-highlight transition-all" />
                    {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-400 transition-colors"><X className="h-4 w-4" /></button>}
                </div>

                {/* Role Filter - Now Inline Chips instead of Dropdown */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">
                        <Filter className="w-3 h-3"/> Filter By Role
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                        {rolesToDisplay.map((role) => (
                            <button
                                key={role}
                                onClick={() => setSelectedRole(role)}
                                className={`px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase transition-all border ${selectedRole === role ? 'bg-highlight border-highlight text-primary shadow-lg shadow-highlight/20' : 'bg-primary/50 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}`}
                            >
                                {role}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>

      <div className="flex border-b border-gray-700 bg-primary/20">
        <TabButton tab="upcoming" label="Upcoming" icon={<Clock className="w-4 h-4"/>} />
        <TabButton tab="sold" label="Sold" icon={<CheckCircle className="w-4 h-4"/>} />
        <TabButton tab="unsold" label="Unsold" icon={<Ban className="w-4 h-4"/>} />
        <TabButton tab="teams" label="Teams" icon={<Users className="w-4 h-4"/>} />
      </div>

      <div className="flex-grow overflow-y-auto p-2 custom-scrollbar">
        {activeTab === 'teams' ? (
            <div className="space-y-2">
                {[...teams].sort((a,b) => b.budget - a.budget).map(team => (
                    <div key={team.id} className="p-3 rounded-lg bg-primary/40 border border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden p-1">
                                {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-contain"/> : <span className="text-black font-bold">{team.name.charAt(0)}</span>}
                            </div>
                            <div>
                                <h4 className="font-bold text-text-main text-sm">{team.name}</h4>
                                <p className="text-xs text-text-secondary">{team.players.length} Players</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="block font-mono text-green-400 font-bold">{team.budget}</span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">REMAINING</span>
                        </div>
                    </div>
                ))}
            </div>
        ) : filteredPlayers.length > 0 ? (
            <div className="space-y-2">
                {filteredPlayers.map(player => (
                    <div key={player.id} className={`p-3 rounded-lg flex items-center gap-3 transition-all border ${player.id === currentPlayer?.id && activeTab === 'upcoming' ? 'bg-highlight/10 border-highlight shadow-[0_0_10px_rgba(56,178,172,0.2)]' : 'bg-primary/40 border-transparent hover:border-gray-600 hover:bg-primary/60'}`}>
                        <img src={player.photoUrl} alt={player.name} className="w-10 h-10 rounded-full object-cover border border-gray-600"/>
                        <div className="flex-grow min-w-0">
                            <h4 className="font-bold text-text-main text-sm truncate">{player.name}</h4>
                            <div className="flex gap-2 text-xs">
                                <span className="text-highlight font-medium truncate">{player.role}</span>
                                <span className="text-gray-500">|</span>
                                <span className="text-text-secondary truncate">{player.category}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            {player.status === 'upcoming' ? (
                                <span className="inline-block px-2 py-1 bg-gray-700 rounded text-xs text-gray-300 font-mono">{player.basePrice}</span>
                            ) : player.status === 'unsold' ? (
                                <span className="inline-block px-2 py-1 bg-red-900/50 text-red-300 rounded text-[10px] font-bold uppercase border border-red-800">UNSOLD</span>
                            ) : (
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Sold To</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {player.teamLogo && <img src={player.teamLogo} alt="" className="w-4 h-4 rounded-full bg-gray-800" />}
                                        <span className="text-xs font-bold text-highlight truncate max-w-[80px]">{player.soldTo}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-text-secondary opacity-50">
                <Search className="w-8 h-8 mb-2" />
                <p className="text-sm">No players found</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default PlayerPool;