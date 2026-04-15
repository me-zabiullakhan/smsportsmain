import React, { useState, useMemo } from 'react';
import { useAuction } from '../hooks/useAuction';
import { useTheme } from '../contexts/ThemeContext';
import { Gavel, Lock, AlertCircle, Users, AlertTriangle, Info } from 'lucide-react';
import { calculateMaxBid } from '../utils';

const BiddingPanel: React.FC = () => {
    const { state, userProfile, placeBid, nextBid } = useAuction();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { teams, highestBidder, biddingStatus, currentBid, currentPlayerId, players, status, categories, roles, maxPlayersPerTeam, basePrice: globalBasePrice, unlimitedPurse, autoReserveFunds } = state;
    const [isBidding, setIsBidding] = useState(false);

    if (!userProfile || !userProfile.teamId) return null;

    const userTeam = teams.find(t => String(t.id) === String(userProfile.teamId));
    if (!userTeam) return null;

    if (status !== 'IN_PROGRESS') {
        return (
            <div className={`rounded-[2rem] shadow-2xl p-6 border-4 text-center transition-all duration-500 ${isDark ? 'bg-secondary border-accent/20 text-zinc-500' : 'bg-white border-blue-500/20 text-gray-400'}`}>
                <p className="font-black uppercase tracking-[0.3em] text-xs md:text-sm">
                    {status === 'SOLD' ? 'LOT SOLD' : status === 'UNSOLD' ? 'LOT UNSOLD' : 'BIDDING CLOSED'}
                </p>
            </div>
        );
    }

    const currentPlayer = currentPlayerId ? players.find(p => String(p.id) === String(currentPlayerId)) : null;

    // --- SMART PURSE VALIDATION ---
    const { totalMandatoryReserve, playersStillNeededAfterThis, isCategoryMaxReached, categoryLimitMsg, maxBidAllowed } = useMemo(() => {
        let isCatMax = false;
        let catLimitMsg = "";
        
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

        const { maxBid, reservedAmount, playersNeeded } = calculateMaxBid(userTeam, state, currentPlayer);

        return {
            totalMandatoryReserve: reservedAmount,
            playersStillNeededAfterThis: playersNeeded,
            isCategoryMaxReached: isCatMax,
            categoryLimitMsg: catLimitMsg,
            maxBidAllowed: maxBid
        };
    }, [userTeam.players, categories, roles, maxPlayersPerTeam, globalBasePrice, currentPlayer, unlimitedPurse, autoReserveFunds, userTeam.budget]);

    const targetSquadSize = maxPlayersPerTeam || 11;
    const isSquadFull = targetSquadSize - userTeam.players.length <= 0;
    
    // Logic: A bid is blocked if the next required bid exceeds what we have left AFTER keeping money for future mandatory players.
    const isBidLimitExceeded = !unlimitedPurse && nextBid > maxBidAllowed;
    const canAfford = unlimitedPurse || userTeam.budget >= nextBid;
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
            } finally {
                setIsBidding(false);
            }
        }
    };

    return (
        <div className={`rounded-[2.5rem] shadow-2xl p-4 md:p-8 border-4 relative overflow-hidden transition-all duration-500 ${isDark ? 'bg-secondary border-accent/20 shadow-accent/5' : 'bg-white border-blue-500/20 shadow-blue-600/10'}`}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${isDark ? 'bg-accent' : 'bg-blue-600'}`}></div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="w-full sm:w-auto text-center sm:text-left flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-start px-2 sm:px-0">
                    <div>
                        <p className={`text-[10px] md:text-xs font-black uppercase tracking-[0.3em] mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Your Purse</p>
                        <p className={`text-2xl md:text-4xl font-black tabular-nums leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>₹{userTeam.budget}</p>
                    </div>
                    {isPaused && (
                        <div className={`sm:hidden px-3 py-1.5 rounded-xl border-2 flex items-center ${isDark ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
                            <span className="text-[9px] font-black uppercase tracking-widest flex items-center"><Lock className="w-3 h-3 mr-1.5"/> Paused</span>
                        </div>
                    )}
                    {!isSquadFull && !unlimitedPurse && (
                        <div className="mt-3 text-left hidden sm:block">
                            <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-accent/80' : 'text-blue-600/80'}`}>
                                Max Allowed Bid: ₹{Math.max(0, maxBidAllowed)}
                            </p>
                            <p className={`text-[8px] font-black uppercase tracking-tight mt-1 flex items-center ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                <Info className="w-2.5 h-2.5 mr-1.5 shrink-0"/> Includes reserved funds for remaining squad
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center w-full sm:w-auto">
                    <button
                        onClick={handleBid}
                        disabled={!canAfford || isLeading || isBidding || !isActive || isLoadingBid || isCategoryMaxReached || isSquadFull || isBidLimitExceeded}
                        className={`
                            w-full sm:w-auto flex items-center justify-center py-4 md:py-5 px-8 md:px-12 rounded-2xl font-black text-sm md:text-lg tracking-[0.2em] uppercase transition-all transform active:scale-95 shadow-2xl
                            ${isLeading 
                                ? (isDark ? 'bg-green-500 text-black shadow-green-500/20' : 'bg-green-600 text-white shadow-green-600/20')
                                : isSquadFull || isCategoryMaxReached || isBidLimitExceeded
                                    ? (isDark ? 'bg-zinc-800 text-red-400 border-2 border-red-500/20 cursor-not-allowed' : 'bg-gray-100 text-red-600 border-2 border-red-200 cursor-not-allowed')
                                : (!isActive)
                                    ? (isDark ? 'bg-red-900/20 border-2 border-red-500/30 text-red-400 cursor-not-allowed' : 'bg-red-50 border-2 border-red-200 text-red-600 cursor-not-allowed')
                                    : (!canAfford || isLoadingBid)
                                        ? (isDark ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                                        : (isDark ? 'btn-golden shadow-accent/20' : 'btn-golden shadow-blue-600/20')
                            }
                        `}
                    >
                        {isLeading ? (
                            <>LEADING <span className={`ml-3 text-xs font-black ${isDark ? 'text-black/60' : 'text-white/80'}`}>₹{currentBid}</span></>
                        ) : isSquadFull ? (
                            <><Users className="mr-2.5 h-5 w-5"/> SQUAD FULL</>
                        ) : isCategoryMaxReached ? (
                            <><Lock className="mr-2.5 h-5 w-5"/> LIMIT REACHED</>
                        ) : isBidLimitExceeded ? (
                            <><AlertTriangle className="mr-2.5 h-5 w-5"/> RESERVE REQUIRED</>
                        ) : !isActive ? (
                            <><Lock className="mr-2.5 h-5 w-5"/> PAUSED</>
                        ) : isLoadingBid ? (
                            <span className="animate-pulse">LOADING...</span>
                        ) : (
                            <><Gavel className="mr-2.5 h-6 w-6"/> BID ₹{nextBid}</>
                        )}
                    </button>
                    {isBidLimitExceeded && (
                        <span className={`text-[9px] font-black mt-2 uppercase tracking-widest ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                            Max Allowed Bid: ₹{Math.max(0, maxBidAllowed)}
                        </span>
                    )}
                </div>
            </div>
            
            {isSquadFull && <p className={`text-[9px] font-black uppercase tracking-widest mt-3 flex items-center justify-center sm:justify-start ${isDark ? 'text-red-400' : 'text-red-600'}`}><AlertCircle className="w-3 h-3 mr-2"/> Max Players ({targetSquadSize}) Reached</p>}
            {isCategoryMaxReached && !isSquadFull && <p className={`text-[9px] font-black uppercase tracking-widest mt-3 flex items-center justify-center sm:justify-start ${isDark ? 'text-red-400' : 'text-red-600'}`}><AlertCircle className="w-3 h-3 mr-2"/> {categoryLimitMsg}</p>}
            {isBidLimitExceeded && (
                <div className={`p-3 rounded-2xl mt-4 border-2 ${isDark ? 'bg-red-900/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                    <p className={`text-[9px] flex items-start font-black uppercase tracking-tight leading-relaxed ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                        <AlertCircle className="w-3.5 h-3.5 mr-2 shrink-0 mt-0.5"/> 
                        Insufficient purse to complete squad. You must reserve ₹{totalMandatoryReserve} for the remaining {playersStillNeededAfterThis} players.
                    </p>
                </div>
            )}
            {!canAfford && isActive && !isCategoryMaxReached && !isSquadFull && !isBidLimitExceeded && <p className={`text-[9px] font-black uppercase tracking-widest mt-3 flex items-center justify-center sm:justify-start ${isDark ? 'text-red-400' : 'text-red-600'}`}><AlertCircle className="w-3 h-3 mr-2"/> Insufficient Budget</p>}
            {!isActive && <p className={`hidden sm:flex text-[9px] font-black uppercase tracking-widest mt-3 items-center justify-center sm:justify-start ${isDark ? 'text-red-400' : 'text-red-600'}`}><Lock className="w-3 h-3 mr-2"/> Bidding Paused by Admin</p>}
        </div>
    );
};

export default BiddingPanel;