import React, { useState, useMemo } from 'react';
import { useAuction } from '../hooks/useAuction';
import { Gavel, Lock, AlertCircle, Users, AlertTriangle, Info } from 'lucide-react';

const BiddingPanel: React.FC = () => {
    const { state, userProfile, placeBid, nextBid } = useAuction();
    const { teams, highestBidder, biddingStatus, currentBid, currentPlayerId, players, status, categories, roles, maxPlayersPerTeam, basePrice: globalBasePrice } = state;
    const [isBidding, setIsBidding] = useState(false);

    if (!userProfile || !userProfile.teamId) return null;

    const userTeam = teams.find(t => String(t.id) === String(userProfile.teamId));
    if (!userTeam) return null;

    if (status !== 'IN_PROGRESS') {
        return (
            <div className="bg-secondary rounded-xl shadow-xl p-4 border border-gray-700 text-center">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">
                    {status === 'SOLD' ? 'LOT SOLD' : status === 'UNSOLD' ? 'LOT UNSOLD' : 'BIDDING CLOSED'}
                </p>
            </div>
        );
    }

    const currentPlayer = currentPlayerId ? players.find(p => String(p.id) === String(currentPlayerId)) : null;

    // --- ULTIMATE SQUAD SURVIVAL CALCULATION ---
    const { totalMandatoryReserve, playersStillNeededAfterThis, isCategoryMaxReached, categoryLimitMsg } = useMemo(() => {
        const targetSquadSize = maxPlayersPerTeam || 11;
        const currentSquadCount = userTeam.players.length;
        // How many more players do we need to buy AFTER the current one?
        const neededAfterThis = Math.max(0, targetSquadSize - (currentSquadCount + 1));

        let isCatMax = false;
        let catLimitMsg = "";
        
        // 1. Check if we can even buy this specific player (Category Max Limit)
        if (currentPlayer && currentPlayer.category) {
            const catConfig = categories.find(c => c.name === currentPlayer.category);
            if (catConfig && catConfig.maxPerTeam > 0) {
                const currentCount = userTeam.players.filter(p => p.category === currentPlayer.category).length;
                if (currentCount >= catConfig.maxPerTeam) {
                    isCatMax = true;
                    catLimitMsg = `Max ${catConfig.maxPerTeam} '${currentPlayer.category}' reached`;
                }
            }
        }

        // 2. Find the absolute floor price in the entire system
        const absoluteMinBasePrice = Math.min(
            globalBasePrice || 100,
            ...(categories.length > 0 ? categories.map(c => Number(c.basePrice) || 100) : [100]),
            ...(roles.length > 0 ? roles.map(r => Number(r.basePrice) || 100) : [100])
        );

        let reserve = 0;
        let slotsUsedByMandatory = 0;

        // 3. Calculate reserve for mandatory categories
        categories.forEach(cat => {
            const countInCat = userTeam.players.filter(p => p.category === cat.name).length;
            let neededInCat = Math.max(0, (Number(cat.minPerTeam) || 0) - countInCat);
            
            // If the current bidding player belongs to this category, they will satisfy one of these needed slots
            if (currentPlayer && currentPlayer.category === cat.name) {
                neededInCat = Math.max(0, neededInCat - 1);
            }

            reserve += (neededInCat * (Number(cat.basePrice) || absoluteMinBasePrice));
            slotsUsedByMandatory += neededInCat;
        });

        // 4. Calculate reserve for remaining "Flexible" slots to reach total squad size
        const flexibleSlots = Math.max(0, neededAfterThis - slotsUsedByMandatory);
        reserve += (flexibleSlots * absoluteMinBasePrice);

        return {
            totalMandatoryReserve: reserve,
            playersStillNeededAfterThis: neededAfterThis,
            isCategoryMaxReached: isCatMax,
            categoryLimitMsg: catLimitMsg
        };
    }, [userTeam.players, categories, roles, maxPlayersPerTeam, globalBasePrice, currentPlayer]);

    const targetSquadSize = maxPlayersPerTeam || 11;
    const currentSquadCount = userTeam.players.length;
    const biddingCapacity = userTeam.budget - totalMandatoryReserve;
    
    // Logic: A bid is blocked if the next required bid exceeds what we have left AFTER keeping money for future mandatory players.
    const isBidLimitExceeded = nextBid > biddingCapacity;
    const isSquadFull = targetSquadSize - currentSquadCount <= 0;

    const canAfford = userTeam.budget >= nextBid;
    const isLeading = highestBidder && String(highestBidder.id) === String(userTeam.id);
    const isLoadingBid = nextBid === 0;
    const isPaused = biddingStatus === 'PAUSED';
    const isActive = biddingStatus === 'ON';

    const handleBid = async () => {
        if (canAfford && !isLeading && isActive && !isCategoryMaxReached && !isSquadFull && !isBidLimitExceeded) {
            setIsBidding(true);
            try {
                await placeBid(userTeam.id, nextBid);
            } catch (e) {
                console.error(e);
                alert((e as Error).message);
            } finally {
                setIsBidding(false);
            }
        }
    };

    return (
        <div className="bg-secondary rounded-xl shadow-xl p-3 md:p-6 border border-highlight/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-highlight"></div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="w-full sm:w-auto text-center sm:text-left flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-start px-2 sm:px-0">
                    <div>
                        <p className="text-text-secondary text-[10px] md:text-sm uppercase tracking-widest font-bold">Your Purse</p>
                        <p className="text-xl md:text-3xl font-bold text-white tabular-nums leading-none mt-1">{userTeam.budget}</p>
                    </div>
                    {isPaused && (
                        <div className="sm:hidden bg-red-900/50 px-2 py-1 rounded border border-red-500/50">
                            <span className="text-[10px] text-red-200 font-bold uppercase flex items-center"><Lock className="w-3 h-3 mr-1"/> Paused</span>
                        </div>
                    )}
                    {!isSquadFull && (
                        <div className="mt-2 text-left hidden sm:block">
                            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                                Max Limit: {Math.max(0, biddingCapacity)}
                            </p>
                            <p className="text-[8px] text-gray-500 uppercase font-medium mt-0.5 flex items-center">
                                <Info className="w-2 h-2 mr-1"/> ₹{totalMandatoryReserve} reserved for {playersStillNeededAfterThis} more players
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center w-full sm:w-auto">
                    <button
                        onClick={handleBid}
                        disabled={!canAfford || isLeading || isBidding || !isActive || isLoadingBid || isCategoryMaxReached || isSquadFull || isBidLimitExceeded}
                        className={`
                            w-full sm:w-auto flex-grow md:flex-grow-0 flex items-center justify-center py-3 md:py-4 px-6 md:px-8 rounded-lg font-black text-base md:text-xl tracking-wider transition-all transform
                            ${isLeading 
                                ? 'bg-green-600 text-white cursor-default' 
                                : isSquadFull || isCategoryMaxReached || isBidLimitExceeded
                                    ? 'bg-gray-700 text-red-300 border border-red-500/30 cursor-not-allowed'
                                : (!isActive)
                                    ? 'bg-red-900/50 border border-red-700 text-red-200 cursor-not-allowed opacity-75'
                                    : (!canAfford || isLoadingBid)
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-highlight hover:bg-teal-400 text-primary hover:scale-105 shadow-[0_0_20px_rgba(56,178,172,0.4)]'
                            }
                        `}
                    >
                        {isLeading ? (
                            <>LEADING <span className="ml-2 text-sm font-normal hidden sm:inline">({currentBid})</span></>
                        ) : isSquadFull ? (
                            <><Users className="mr-2 h-4 w-4"/> SQUAD FULL</>
                        ) : isCategoryMaxReached ? (
                            <><Lock className="mr-2 h-4 w-4"/> LIMIT REACHED</>
                        ) : isBidLimitExceeded ? (
                            <><AlertTriangle className="mr-2 h-4 w-4"/> RESERVE REQUIRED</>
                        ) : !isActive ? (
                            <><Lock className="mr-2 h-4 w-4 md:h-5 md:w-5"/> PAUSED</>
                        ) : isLoadingBid ? (
                            <span className="animate-pulse">LOADING...</span>
                        ) : (
                            <><Gavel className="mr-2 h-5 w-5 md:h-6 md:w-6"/> BID {nextBid}</>
                        )}
                    </button>
                    {isBidLimitExceeded && (
                        <span className="text-[10px] text-red-400 font-bold mt-1 uppercase tracking-wide">
                            Limit: {Math.max(0, biddingCapacity)} (Reserve Reached)
                        </span>
                    )}
                </div>
            </div>
            
            {isSquadFull && <p className="text-red-400 text-xs mt-2 flex items-center justify-center sm:justify-start font-bold uppercase"><AlertCircle className="w-3 h-3 mr-1"/> Max Players ({targetSquadSize}) Reached</p>}
            {isCategoryMaxReached && !isSquadFull && <p className="text-red-400 text-xs mt-2 flex items-center justify-center sm:justify-start font-bold uppercase"><AlertCircle className="w-3 h-3 mr-1"/> {categoryLimitMsg}</p>}
            {isBidLimitExceeded && (
                <div className="bg-red-950/20 border border-red-900/30 p-2 rounded mt-3">
                    <p className="text-red-400 text-[10px] flex items-start font-bold uppercase tracking-tight">
                        <AlertCircle className="w-3 h-3 mr-1.5 shrink-0 mt-0.5"/> 
                        Bidding locked. You must reserve ₹{totalMandatoryReserve} to buy the remaining {playersStillNeededAfterThis} players to fill your required {targetSquadSize} player squad based on category minimums.
                    </p>
                </div>
            )}
            {!canAfford && isActive && !isCategoryMaxReached && !isSquadFull && !isBidLimitExceeded && <p className="text-red-400 text-xs mt-2 flex items-center justify-center sm:justify-start font-bold"><AlertCircle className="w-3 h-3 mr-1"/> Insufficient Budget</p>}
            {!isActive && <p className="hidden sm:flex text-red-300 text-xs mt-2 items-center justify-center sm:justify-start font-bold uppercase tracking-wide"><Lock className="w-3 h-3 mr-1"/> Bidding Paused by Admin</p>}
        </div>
    );
};

export default BiddingPanel;