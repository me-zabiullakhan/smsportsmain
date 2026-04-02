import React, { useMemo } from 'react';
import { Team, UserRole } from '../types';
import { useAuction } from '../hooks/useAuction';
import { Wallet, Users, Gavel } from 'lucide-react';

interface Props {
    team: Team;
}

const TeamStatusCard: React.FC<Props> = ({ team }) => {
    const { state, placeBid, userProfile, nextBid } = useAuction();
    const { currentPlayerId, players, maxPlayersPerTeam, categories, roles, basePrice: globalBasePrice } = state;
    const isAdmin = userProfile?.role === UserRole.ADMIN || userProfile?.role === UserRole.SUPER_ADMIN;
    const isAuctionLive = state.status === 'IN_PROGRESS';
    const currentPlayer = currentPlayerId ? players.find(p => String(p.id) === String(currentPlayerId)) : null;

    // --- REFINED SQUAD SURVIVAL CALCULATION ---
    const { isLimitReached, limitReason, biddingCapacity } = useMemo(() => {
        let reached = false;
        let reason = "";

        const targetSquadSize = maxPlayersPerTeam || 11;
        const currentSquadCount = team.players.length;
        const neededAfterThis = Math.max(0, targetSquadSize - (currentSquadCount + 1));

        // 1. Check Global Squad Limit
        if (targetSquadSize - currentSquadCount <= 0) {
            return { isLimitReached: true, limitReason: "Squad Full", biddingCapacity: 0 };
        }

        // 2. Check Category Specific Max Limit
        if (currentPlayer && currentPlayer.category) {
            const catConfig = categories.find(c => c.name === currentPlayer.category);
            if (catConfig && catConfig.maxPerTeam > 0) {
                const count = team.players.filter(p => p.category === currentPlayer.category).length;
                if (count >= catConfig.maxPerTeam) {
                    return { isLimitReached: true, limitReason: "Cat. Full", biddingCapacity: 0 };
                }
            }
        }

        // 3. Find absolute system min price
        const absoluteMinBasePrice = Math.min(
            globalBasePrice || 100,
            ...(categories.length > 0 ? categories.map(c => Number(c.basePrice) || 100) : [100]),
            ...(roles.length > 0 ? roles.map(r => Number(r.basePrice) || 100) : [100])
        );

        let reserve = 0;
        let slotsUsedByMandatory = 0;

        // 4. Mandatory Reserves
        if (currentPlayer) {
            categories.forEach(cat => {
                const currentCountInCat = team.players.filter(p => p.category === cat.name).length;
                let neededInCat = Math.max(0, (Number(cat.minPerTeam) || 0) - currentCountInCat);
                
                if (currentPlayer.category === cat.name) {
                    neededInCat = Math.max(0, neededInCat - 1);
                }

                reserve += (neededInCat * (Number(cat.basePrice) || absoluteMinBasePrice));
                slotsUsedByMandatory += neededInCat;
            });

            const flexibleSlots = Math.max(0, neededAfterThis - slotsUsedByMandatory);
            reserve += (flexibleSlots * absoluteMinBasePrice);
        }

        const capacity = team.budget - reserve;

        if (nextBid > capacity) {
            reached = true;
            reason = "Reserve Hit";
        }

        return { isLimitReached: reached, limitReason: reason, biddingCapacity: capacity };
    }, [team.players, team.budget, categories, roles, maxPlayersPerTeam, globalBasePrice, currentPlayer, nextBid]);

    const canAfford = team.budget >= nextBid;
    const isHighest = state.highestBidder?.id === team.id;

    const handleAdminBid = async () => {
        if (canAfford && !isHighest && !isLimitReached && nextBid > 0) {
            try {
                await placeBid(team.id, nextBid);
            } catch (e) {
                alert((e as Error).message);
            }
        }
    };

    return (
        <div className={`bg-accent p-3 rounded-lg shadow-md transition-all duration-300 ${isHighest ? 'ring-2 ring-green-500 bg-green-900/30' : ''}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                    {team.logoUrl ? (
                        <img src={team.logoUrl} alt={team.name} className="w-8 h-8 rounded-full mr-3 bg-white p-0.5" />
                    ) : (
                        <div className="w-8 h-8 rounded-full mr-3 bg-gray-700 flex items-center justify-center font-bold text-white text-xs">
                            {team.name.charAt(0)}
                        </div>
                    )}
                    <div>
                        <h4 className="font-bold text-white text-md truncate max-w-[120px] leading-none">{team.name}</h4>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5 select-all">ID: {team.id}</p>
                    </div>
                </div>
            </div>
            
            <div className="text-sm space-y-1">
                <p className="flex items-center text-text-secondary">
                    <Wallet className="w-4 h-4 mr-2 text-green-400" /> 
                    Budget: <span className="font-semibold text-white ml-1">{team.budget}</span>
                </p>
                <p className="flex items-center text-text-secondary">
                    <Users className="w-4 h-4 mr-2 text-blue-400" />
                    Players: <span className={`font-semibold ml-1 ${maxPlayersPerTeam && (maxPlayersPerTeam - team.players.length <= 0) ? 'text-red-400' : 'text-white'}`}>{team.players.length} / {maxPlayersPerTeam || '-'}</span>
                </p>
            </div>

            {isAdmin && isAuctionLive && (
                <div className="mt-3 pt-2 border-t border-white/10">
                    <button 
                        onClick={handleAdminBid}
                        disabled={!canAfford || isHighest || isLimitReached}
                        className={`w-full py-1.5 px-3 rounded text-xs font-bold flex items-center justify-center uppercase tracking-wide transition-colors ${
                            isHighest 
                                ? 'bg-green-600 text-white cursor-default' 
                                : isLimitReached
                                    ? 'bg-red-900/50 text-red-200 border border-red-500/30 cursor-not-allowed'
                                : !canAfford 
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                    : 'bg-highlight hover:bg-teal-400 text-primary'
                        }`}
                    >
                        {isHighest ? (
                            <>Leading</>
                        ) : isLimitReached ? (
                            <span className="text-[8px] truncate">{limitReason}</span>
                        ) : !canAfford ? (
                            <>No Funds</>
                        ) : (
                            <><Gavel className="w-3 h-3 mr-1"/> Bid {nextBid}</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default TeamStatusCard;