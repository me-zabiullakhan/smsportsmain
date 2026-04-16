import React, { useState, useEffect, useMemo } from 'react';
import { useAuction } from '../hooks/useAuction';
import { AuctionStatus, Team, Player, ProjectorLayout, OBSLayout } from '../types';
import TeamStatusCard from '../components/TeamStatusCard';
// Fixed missing LayoutList import
import { Play, Check, X, ArrowLeft, Loader2, RotateCcw, AlertOctagon, DollarSign, Cast, Lock, Unlock, Monitor, ChevronDown, Shuffle, Search, User, Palette, Trophy, Gavel, Wallet, Eye, EyeOff, Clock, Zap, Undo2, RefreshCw, LayoutList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LiveAdminPanel: React.FC = () => {
  const { state, sellPlayer, passPlayer, startAuction, undoPlayerSelection, endAuction, resetAuction, resetCurrentPlayer, resetUnsoldPlayers, updateBiddingStatus, toggleSelectionMode, updateTheme, activeAuctionId, placeBid, nextBid, updateSponsorConfig, correctPlayerSale } = useAuction();
  const { teams, players, biddingStatus, playerSelectionMode, categories, maxPlayersPerTeam } = state;
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  // Move isRoundActive to component scope to ensure it's accessible by all inner functions
  const isRoundActive = state.status === AuctionStatus.InProgress && state.currentPlayerId;
  
  // Inline Sell State
  const [isSellingMode, setIsSellingMode] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [finalPrice, setFinalPrice] = useState<number>(0);

  // Manual Player Selection State
  const [manualPlayerId, setManualPlayerId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState(''); // New search state
  const [filterCategory, setFilterCategory] = useState<string>('ALL'); // New category filter state
  const [showUnsold, setShowUnsold] = useState(false); // Toggle to include unsold players

  // Undo State
  const [lastAction, setLastAction] = useState<{playerId: string, type: 'SOLD' | 'UNSOLD', name: string} | null>(null);

  // Sponsor Config Local State (debounce or immediate)
  const [sponsorLoop, setSponsorLoop] = useState(state.sponsorConfig?.loopInterval || 5);

  // Auto-fill price and leader when entering sell mode or when bid updates
  useEffect(() => {
      // 1. Determine Price
      if (state.currentBid !== null && state.currentBid > 0) {
          setFinalPrice(Number(state.currentBid));
      } else if (state.currentPlayerId) {
          // Fallback to Base Price if no bids
          const p = players.find(player => String(player.id) === String(state.currentPlayerId));
          if (p) setFinalPrice(p.basePrice);
      }

      // 2. Determine Team
      if (state.highestBidder) {
          setSelectedTeamId(String(state.highestBidder.id));
      } else if (!isSellingMode) {
          // Reset selection only if we aren't currently editing
          setSelectedTeamId('');
      }
  }, [state.currentBid, state.highestBidder, isSellingMode, state.currentPlayerId, players]);

  // Sync sponsor loop state
  useEffect(() => {
      if(state.sponsorConfig?.loopInterval) setSponsorLoop(state.sponsorConfig.loopInterval);
  }, [state.sponsorConfig]);

  // Inline Confirm States
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);

  const handleStart = async (specificId?: string) => {
      if (teams.length === 0) {
          showNotification("Cannot start auction: No teams added. Please go back to Dashboard > Edit Auction > Teams to add teams.");
          return;
      }

      const availablePlayers = players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
      if (availablePlayers.length === 0 && !showUnsold) {
          showNotification("Cannot start auction: No more players available.");
          return;
      }

      setIsProcessing(true);
      // If restarting an unsold player, specificId will be passed.
      const hasNextPlayer = await startAuction(specificId);
      
      if (!hasNextPlayer && !showUnsold) {
          // Changed to inline confirmation for endAuction
          setConfirmingAction('END_AUCTION');
      } else {
          // Clear manual selection
          setManualPlayerId('');
          setSearchTerm('');
      }
      setIsProcessing(false);
  }

  const showNotification = (msg: string) => {
      // Simple alert for critical errors, but try to avoid popups where possible
      alert(msg);
  }

  const handleResetFull = async () => {
      setConfirmingAction('RESET_FULL');
  }

  const handleResetPlayer = async () => {
      setConfirmingAction('RESET_PLAYER');
  }

  const handleCancelSelection = async () => {
      setConfirmingAction('CANCEL_ROUND');
  }

  const handleUndoLastAction = async () => {
      if (!lastAction) return;
      setConfirmingAction('UNDO_LAST');
  }

  const handleResetSingleUnsold = async (playerId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setConfirmingAction(`RESET_UNSOLD_${playerId}`);
  }
  
  const copyOBSLink = (type: 'transparent' | 'green') => {
      if (!activeAuctionId) return;
      const baseUrl = window.location.href.split('#')[0];
      const route = type === 'green' ? 'obs-green' : 'obs-overlay';
      const url = `${baseUrl}#/${route}/${activeAuctionId}`;
      navigator.clipboard.writeText(url);
      
      if (type === 'green') {
          alert("PROJECTOR VIEW URL Copied!\n\nOpen this link on the projector screen.");
      } else {
          alert("OBS OVERLAY URL Copied!\n\nPaste this into OBS Browser Source.");
      }
  };
  
  const handleSellClick = () => {
      setIsSellingMode(true);
  };

  const cancelSell = () => {
      setIsSellingMode(false);
  };

  const confirmSell = async () => {
      if (!selectedTeamId) {
          alert("Please select a team to sell to.");
          return;
      }
      if (finalPrice <= 0) {
          alert("Price must be greater than 0.");
          return;
      }

      setIsProcessing(true);
      const pid = state.currentPlayerId ? String(state.currentPlayerId) : '';
      const pName = players.find(p => String(p.id) === pid)?.name || 'Player';

      try {
          await sellPlayer(selectedTeamId, finalPrice);
          setLastAction({ playerId: pid, type: 'SOLD', name: pName });
          setIsSellingMode(false);
      } catch(e) {
          console.error(e);
          alert("Failed to sell player. Check console.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handlePass = async () => {
      setConfirmingAction('PASS_PLAYER');
  }

  const handleQuickBid = async (teamId: string | number) => {
      try {
          await placeBid(teamId, nextBid);
      } catch (e) {
          console.error(e);
          // Optional: Show toast error
      }
  };

  const updateSponsorVisibility = (target: 'OBS' | 'PROJECTOR') => {
      const current = state.sponsorConfig || { showOnOBS: false, showOnProjector: false, loopInterval: 5 };
      const newConfig = {
          ...current,
          showOnOBS: target === 'OBS' ? !current.showOnOBS : current.showOnOBS,
          showOnProjector: target === 'PROJECTOR' ? !current.showOnProjector : current.showOnProjector
      };
      updateSponsorConfig(newConfig);
  };

  const toggleHighlights = () => {
    const current = state.sponsorConfig || { showOnOBS: false, showOnProjector: false, loopInterval: 5, showHighlights: false };
    updateSponsorConfig({ ...current, showHighlights: !current.showHighlights });
  };

  const handleSponsorLoopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      setSponsorLoop(val);
  };

  const saveSponsorLoop = () => {
      const current = state.sponsorConfig || { showOnOBS: false, showOnProjector: false, loopInterval: 5 };
      updateSponsorConfig({ ...current, loopInterval: sponsorLoop });
  };

  const selectedPlayerObj = players.find(p => p.id === manualPlayerId);
  const currentPlayer = state.currentPlayerId ? state.players.find(p => String(p.id) === String(state.currentPlayerId)) : null;

  const getControlButtons = () => {
      // Removed local isRoundActive definition as it's now in component scope
      const availablePlayersCount = players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD').length;
      const isStartDisabled = isProcessing || (state.status === AuctionStatus.NotStarted && (teams.length === 0 || availablePlayersCount === 0));
      const unsoldCount = players.filter(p => p.status === 'UNSOLD').length;

      // Finish Auction Option
      if (availablePlayersCount === 0 && state.status !== AuctionStatus.NotStarted && !isRoundActive) {
          return (
             <div className="space-y-4 animate-fade-in">
                 {unsoldCount > 0 && (
                     <div className="bg-blue-900/30 border border-blue-500/50 p-4 rounded-xl text-center shadow-inner">
                        <h3 className="text-white font-bold text-lg mb-2">Unsold Players Available</h3>
                        <p className="text-gray-300 text-xs mb-4">There are {unsoldCount} unsold players. Do you want to bring them back into the bidding pool?</p>
                        
                        {confirmingAction === 'RESET_UNSOLD_ALL' ? (
                            <div className="flex gap-2">
                                <button onClick={() => setConfirmingAction(null)} className="flex-1 py-3 bg-gray-600 text-white rounded-lg text-xs font-bold uppercase">Cancel</button>
                                <button 
                                    onClick={async () => {
                                        setIsProcessing(true);
                                        await resetUnsoldPlayers();
                                        setConfirmingAction(null);
                                        setIsProcessing(false);
                                    }}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-lg text-xs font-bold uppercase"
                                >
                                    Confirm Reset
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setConfirmingAction('RESET_UNSOLD_ALL')}
                                disabled={isProcessing}
                                className="btn-golden w-full font-bold py-3 rounded-lg flex items-center justify-center"
                            >
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4"/>}
                                BRING BACK UNSOLD ({unsoldCount})
                            </button>
                        )}
                     </div>
                 )}
                 
                 <div className="bg-green-900/30 border border-green-500/50 p-6 rounded-xl text-center shadow-inner">
                    <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-3 drop-shadow-lg" />
                    <h3 className="text-white font-bold text-xl mb-2">Auction Completed!</h3>
                    <p className="text-gray-300 text-sm mb-6">All players have been auctioned. You can now finalize the event.</p>
                    
                    {confirmingAction === 'END_AUCTION' ? (
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmingAction(null)} className="flex-1 py-3 bg-gray-600 text-white rounded-lg text-xs font-bold uppercase">Cancel</button>
                            <button 
                                onClick={async () => {
                                    setIsProcessing(true);
                                    await endAuction();
                                    setConfirmingAction(null);
                                    setIsProcessing(false);
                                }}
                                className="flex-1 py-3 bg-green-600 text-white rounded-lg text-xs font-bold uppercase"
                            >
                                Finalize
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setConfirmingAction('END_AUCTION')}
                            disabled={isProcessing}
                            className="btn-golden w-full font-bold py-4 rounded-lg flex items-center justify-center tracking-wide"
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : "GENERATE SUMMARY & FINISH"}
                        </button>
                    )}
                </div>
            </div>
          );
      }

      // 1. ACTIVE ROUND CONTROLS (SOLD / UNSOLD)
      if (isRoundActive) {
          if (isSellingMode) {
              return (
                  <div className="bg-primary/20 p-3 rounded-lg border border-gray-600 animate-fade-in space-y-3">
                      <div className="flex items-center gap-2 mb-2 text-white font-bold border-b border-gray-600 pb-1">
                          <Check className="w-4 h-4 text-green-500" /> Confirm Sale
                      </div>
                      
                      {/* Inline Form */}
                      <div>
                          <label className="block text-[10px] text-text-secondary uppercase font-bold mb-1">Sold To Team</label>
                          <select 
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="w-full bg-primary border border-gray-600 rounded p-2 text-sm text-white font-bold outline-none focus:border-green-500"
                          >
                              <option value="">Select Team...</option>
                              {teams.map(t => (
                                  <option key={t.id} value={t.id}>{t.name} ({t.budget})</option>
                              ))}
                          </select>
                      </div>
                      
                      <div>
                          <label className="block text-[10px] text-text-secondary uppercase font-bold mb-1">Final Price</label>
                          <div className="relative">
                              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                              <input 
                                type="number" 
                                value={finalPrice} 
                                onChange={(e) => setFinalPrice(Number(e.target.value))}
                                className="w-full bg-primary border border-gray-600 rounded p-2 pl-8 text-sm text-white font-bold outline-none focus:border-green-500"
                              />
                          </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                          <button 
                            onClick={cancelSell}
                            className="btn-golden flex-1 py-2 rounded text-sm"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={confirmSell}
                            disabled={isProcessing}
                            className="btn-golden flex-1 py-2 rounded text-sm font-bold flex items-center justify-center"
                          >
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Confirm'}
                          </button>
                      </div>
                  </div>
              );
          }

          return (
              <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={handleSellClick}
                        disabled={isProcessing}
                        className="btn-golden flex flex-col items-center justify-center disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed font-bold py-4 px-2 rounded-lg"
                      >
                          {isProcessing ? <Loader2 className="mb-1 h-6 w-6 animate-spin"/> : <Check className="mb-1 h-6 w-6"/>}
                          {isProcessing ? 'SELLING...' : 'SOLD'}
                      </button>
                      <button 
                        onClick={handlePass}
                        disabled={isProcessing}
                        className="btn-golden flex flex-col items-center justify-center disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed font-bold py-4 px-2 rounded-lg"
                      >
                          {isProcessing ? <Loader2 className="mb-1 h-6 w-6 animate-spin"/> : <X className="mb-1 h-6 w-6"/>}
                          UNSOLD
                      </button>
                  </div>
                  {/* Inline Cancel / Change Player Button */}
                  {confirmingAction === 'CANCEL_ROUND' ? (
                      <div className="flex gap-2">
                          <button onClick={() => setConfirmingAction(null)} className="flex-1 py-2 bg-gray-600 text-white rounded-lg text-[10px] font-bold uppercase transition-all">Back</button>
                          <button 
                            onClick={async () => {
                                setIsProcessing(true);
                                await undoPlayerSelection();
                                setConfirmingAction(null);
                                setIsProcessing(false);
                            }}
                            className="flex-1 py-2 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase transition-all shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                          >
                            Confirm Cancel
                          </button>
                      </div>
                  ) : confirmingAction === 'PASS_PLAYER' ? (
                    <div className="flex gap-2 animate-bounce">
                        <button onClick={() => setConfirmingAction(null)} className="flex-1 py-2 bg-gray-600 text-white rounded-lg text-[10px] font-bold">No</button>
                        <button 
                          onClick={async () => {
                              setIsProcessing(true);
                              const pid = state.currentPlayerId ? String(state.currentPlayerId) : '';
                              const pName = players.find(p => String(p.id) === String(pid))?.name || 'Player';
                              await passPlayer();
                              setLastAction({ playerId: String(pid), type: 'UNSOLD', name: pName });
                              setConfirmingAction(null); // Added missing line to clear confirmation
                              setIsProcessing(false);
                          }}
                          className="flex-1 py-2 bg-red-600 text-white rounded-lg text-[10px] font-bold shadow-[0_0_10px_rgba(220,38,38,0.3)]"
                        >
                            Mark UNSOLD
                        </button>
                    </div>
                  ) : (
                    <button 
                        onClick={handleCancelSelection} 
                        disabled={isProcessing}
                        className="btn-golden w-full py-2 rounded-lg text-xs"
                    >
                        <Undo2 className="w-4 h-4 mr-1" /> Change Player / Cancel Round
                    </button>
                  )}
              </div>
          );
      }

      // 2. NEXT PLAYER SELECTION (Fully Inline Options)
      if (playerSelectionMode === 'MANUAL') {
           let availablePlayers = players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
           if (showUnsold) {
               const unsoldList = players.filter(p => p.status === 'UNSOLD');
               availablePlayers = [...availablePlayers, ...unsoldList];
           }
           
           availablePlayers.sort((a, b) => a.name.localeCompare(b.name));

           const filteredPlayers = availablePlayers.filter(p => {
               const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                     p.category.toLowerCase().includes(searchTerm.toLowerCase());
               const matchesCategory = filterCategory === 'ALL' || p.category === filterCategory;
               return matchesSearch && matchesCategory;
           });
 
           return (
               <div className="space-y-3 bg-primary/20 p-3 rounded-lg border border-gray-600">
                   <div>
                       <div className="flex justify-between items-center mb-1">
                           <label className="block text-[10px] text-text-secondary uppercase font-bold">Select Next Player</label>
                           <label className="flex items-center text-[10px] text-yellow-400 cursor-pointer">
                               <input type="checkbox" checked={showUnsold} onChange={(e) => setShowUnsold(e.target.checked)} className="mr-1 accent-yellow-500" />
                               Include Unsold
                           </label>
                       </div>
                       
                       {/* Search & Category Filter */}
                       <div className="flex gap-2 mb-2">
                           <div className="relative flex-1">
                               <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                               <input 
                                    type="text"
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 pl-7 text-[11px] h-8 text-white focus:border-highlight outline-none"
                                    placeholder="Search name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                               />
                           </div>
                           <div className="relative w-32">
                               <select
                                   value={filterCategory}
                                   onChange={(e) => setFilterCategory(e.target.value)}
                                   className="w-full bg-gray-800 border border-gray-700 rounded px-2 h-8 text-[10px] text-white focus:border-highlight outline-none appearance-none font-bold pr-6"
                               >
                                   <option value="ALL">ALL CAT</option>
                                   {categories.map(cat => (
                                       <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>
                                   ))}
                               </select>
                               <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                           </div>
                       </div>

                       {/* Options listed directly as per instructions */}
                       <div className="max-h-40 overflow-y-auto border border-gray-700 rounded bg-gray-900 custom-scrollbar mb-2">
                            {filteredPlayers.length > 0 ? filteredPlayers.map(p => (
                                <div 
                                    key={p.id}
                                    onClick={() => setManualPlayerId(String(p.id))}
                                    className={`p-2 text-[10px] cursor-pointer border-b border-gray-800 last:border-0 transition-colors ${manualPlayerId === String(p.id) ? 'bg-accent/20 text-accent font-bold' : 'text-gray-300'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span>{p.name} <span className="opacity-60">({p.category})</span></span>
                                            {p.status === 'UNSOLD' && (
                                                confirmingAction === `RESET_UNSOLD_${p.id}` ? (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[8px] text-white">Bring back?</span>
                                                        <button 
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                setIsProcessing(true);
                                                                try { await correctPlayerSale(String(p.id), null, 0); } catch(e){}
                                                                finally { setIsProcessing(false); setConfirmingAction(null); }
                                                            }}
                                                            className="text-green-500 hover:text-green-400 font-bold"
                                                        >
                                                            Yes
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setConfirmingAction(null); }}
                                                            className="text-red-500 hover:text-red-400 font-bold"
                                                        >
                                                            No
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-red-400 text-[8px] font-bold uppercase">Unsold</span>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setConfirmingAction(`RESET_UNSOLD_${p.id}`); }}
                                                            className="text-[8px] bg-gray-700 px-1 rounded hover:bg-gray-600"
                                                        >
                                                            Reset
                                                        </button>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        <span className="font-mono">{p.basePrice}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-4 text-center text-gray-500 text-[10px] italic">No players found</div>
                            )}
                       </div>
                   </div>

                   <button 
                     onClick={() => handleStart(manualPlayerId)} 
                     disabled={isStartDisabled || !manualPlayerId}
                     className="btn-golden w-full flex items-center justify-center font-bold py-3 px-4 rounded-lg"
                   >
                       {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Play className="mr-2 h-5 w-5"/>} 
                       {manualPlayerId && players.find(p => String(p.id) === manualPlayerId)?.status === 'UNSOLD' ? 'Re-Auction Player' : 'Start Bidding'}
                   </button>
               </div>
           );
      }

      // AUTO MODE
      return (
          <button 
            onClick={() => handleStart()} 
            disabled={isStartDisabled}
            className="btn-golden w-full flex items-center justify-center font-bold py-4 px-4 rounded-lg"
          >
              {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Shuffle className="mr-2 h-5 w-5"/>} 
              {state.status === AuctionStatus.NotStarted ? 'Start Auction (Auto Random)' : 'Next Random Player'}
          </button>
      );
  }

  // --- RENDER QUICK BID BUTTONS (Inline Grid) ---
  const renderQuickBidButtons = () => {
        if (!isRoundActive || isSellingMode) return null;

        return (
            <div className="mb-4">
                <h3 className="text-xs font-bold text-text-secondary uppercase mb-2 flex items-center">
                    <Zap className="w-3 h-3 mr-1 text-yellow-400" /> Quick Bids (Next: {nextBid})
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    {teams.map(team => {
                        let allowed = true;
                        let reason = '';
                        if (team.budget < nextBid) { allowed = false; reason = 'NO FUNDS'; }
                        else if (state.highestBidder?.id === team.id) { allowed = false; reason = 'LEADING'; }
                        else if (team.players.length >= (maxPlayersPerTeam || 25)) { allowed = false; reason = 'FULL'; }
                        else if (currentPlayer) {
                            if (currentPlayer.category) {
                                const catConfig = categories.find(c => c.name === currentPlayer.category);
                                if (catConfig && catConfig.maxPerTeam > 0) {
                                    const count = team.players.filter(p => p.category === currentPlayer.category).length;
                                    if (count >= catConfig.maxPerTeam) { allowed = false; reason = 'CAT LIMIT'; }
                                }
                            }
                            if (allowed) {
                                let reservedBudget = 0;
                                categories.forEach(cat => {
                                    if (cat.maxPerTeam > 0) {
                                        const playersInCat = team.players.filter(p => p.category === cat.name).length;
                                        let slotsToFill = Math.max(0, cat.maxPerTeam - playersInCat);
                                        if (currentPlayer.category === cat.name) {
                                            slotsToFill = Math.max(0, slotsToFill - 1);
                                        }
                                        reservedBudget += slotsToFill * cat.basePrice;
                                    }
                                });
                                const maxAllowedBid = team.budget - reservedBudget;
                                if (nextBid > maxAllowedBid) { allowed = false; reason = 'MAX BID'; }
                            }
                        }

                        return (
                            <button
                                key={team.id}
                                onClick={() => handleQuickBid(team.id)}
                                disabled={!allowed || isProcessing}
                                className={`
                                    flex items-center justify-between px-2 py-2 rounded border text-left transition-all relative group
                                    ${allowed 
                                        ? 'bg-white border-gray-300 hover:border-green-500 hover:shadow-md active:scale-95' 
                                        : 'bg-gray-200 border-transparent opacity-60 cursor-not-allowed'}
                                `}
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {team.logoUrl ? (
                                        <img src={team.logoUrl} className="w-6 h-6 rounded-full object-contain bg-gray-100 flex-shrink-0" alt="" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">
                                            {team.name.charAt(0)}
                                        </div>
                                    )}
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold text-gray-800 truncate leading-none">{team.name}</span>
                                        <span className="text-[9px] text-gray-500 font-mono leading-none mt-0.5">{team.budget}</span>
                                    </div>
                                </div>
                                
                                <div className="flex-shrink-0 ml-1">
                                    {!allowed ? (
                                        <span className="text-[8px] font-black text-red-500 uppercase bg-red-100 px-1 rounded">{reason}</span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded group-hover:bg-green-600 group-hover:text-white transition-colors">
                                            +{nextBid}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
  };

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg h-full flex flex-col border border-gray-700 relative">
      
      <div className="flex justify-between items-center mb-4 border-b border-accent pb-2">
          <div className="flex flex-col gap-2 w-full">
              <div className="flex justify-between items-center w-full">
                <h2 className="text-xl font-bold text-highlight uppercase tracking-wider">Auctioneer</h2>
                <button onClick={() => navigate('/admin')} className="text-xs text-text-secondary hover:text-white flex items-center">
                    <ArrowLeft className="w-3 h-3 mr-1"/> Dashboard
                </button>
              </div>
              
              {/* Quick Actions & Inline Status Segments */}
              <div className="flex flex-wrap gap-2 items-center bg-primary/50 rounded-lg p-2 w-full">
                  <div className="flex items-center gap-1">
                    <button 
                        onClick={(e) => { e.stopPropagation(); copyOBSLink('transparent'); }}
                        className="p-1.5 rounded hover:bg-white/10 text-highlight transition-colors"
                        title="Copy OBS Transparent Link"
                    >
                        <Cast className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); copyOBSLink('green'); }}
                        className="p-1.5 rounded hover:bg-white/10 text-green-400 transition-colors"
                        title="Copy Projector View Link"
                    >
                        <Monitor className="w-4 h-4" />
                    </button>
                    
                    {/* Bidding Status Segmented Buttons listed directly */}
                    <div className="flex bg-gray-800 rounded p-1 ml-1 overflow-hidden border border-gray-700">
                        <button 
                            onClick={() => updateBiddingStatus('ON')}
                            className={`px-3 py-1 rounded-l text-[10px] font-bold transition-all flex items-center ${biddingStatus === 'ON' ? 'btn-golden text-black shadow-lg scale-105 z-10' : 'text-gray-400 hover:text-white bg-transparent'}`}
                        >
                            <Unlock className="w-3 h-3 mr-1"/> ON
                        </button>
                        <button 
                            onClick={() => updateBiddingStatus('PAUSED')}
                            className={`px-3 py-1 rounded-r text-[10px] font-bold transition-all flex items-center ${biddingStatus !== 'ON' ? 'btn-golden text-black shadow-lg scale-105 z-10' : 'text-gray-400 hover:text-white bg-transparent'}`}
                        >
                            <Lock className="w-3 h-3 mr-1"/> OFF
                        </button>
                    </div>
                  </div>
              </div>

              {/* Display & Sponsors Toolbar (Dropdowns for layouts) */}
              <div className="flex flex-wrap gap-2 items-center bg-primary/50 rounded-lg p-2 w-full mt-1 border-t border-gray-700">
                  <div className="flex items-center gap-2 flex-grow">
                      <div className="flex-1">
                          <label className="block text-[8px] text-gray-400 uppercase font-bold mb-0.5">Projector Theme</label>
                          <div className="relative">
                            <select 
                                value={state.projectorLayout}
                                onChange={(e) => updateTheme('PROJECTOR', e.target.value as ProjectorLayout)}
                                className="w-full bg-gray-800 text-highlight text-[10px] h-8 rounded pl-2 pr-6 border border-gray-700 appearance-none outline-none font-bold"
                            >
                                {['STANDARD', 'IPL', 'MODERN', 'ADVAYA', 'FUTURISTIC', 'NEON'].map(l => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                          </div>
                      </div>
                      <div className="flex-1">
                          <label className="block text-[8px] text-gray-400 uppercase font-bold mb-0.5">OBS Theme</label>
                          <div className="relative">
                            <select 
                                value={state.obsLayout}
                                onChange={(e) => updateTheme('OBS', e.target.value as OBSLayout)}
                                className="w-full bg-gray-800 text-highlight text-[10px] h-8 rounded pl-2 pr-6 border border-gray-700 appearance-none outline-none font-bold"
                            >
                                {['STANDARD', 'ADVAYA', 'MINIMAL', 'VERTICAL'].map(l => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                          </div>
                      </div>
                  </div>

                  <div className="w-px h-8 bg-gray-600 mx-1"></div>

                  <div className="flex flex-col gap-1 items-end">
                      <span className="text-[9px] text-gray-400 font-bold uppercase">Sponsors</span>
                      <div className="flex items-center gap-1">
                          <button 
                              onClick={() => updateSponsorVisibility('PROJECTOR')}
                              className={`p-1 rounded flex items-center gap-1 text-[9px] font-bold border transition-colors ${state.sponsorConfig?.showOnProjector ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
                              title="Toggle on Projector"
                          >
                              <Monitor className="w-3 h-3"/> Proj
                          </button>
                          <button 
                              onClick={() => updateSponsorVisibility('OBS')}
                              className={`p-1 rounded flex items-center gap-1 text-[9px] font-bold border transition-colors ${state.sponsorConfig?.showOnOBS ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
                              title="Toggle on OBS"
                          >
                              <Cast className="w-3 h-3"/> OBS
                          </button>
                          <div className="relative group w-10">
                              <input 
                                  type="number" 
                                  className="w-full bg-gray-800 text-white text-[9px] p-1 rounded border border-gray-600 text-center outline-none" 
                                  value={sponsorLoop}
                                  onChange={handleSponsorLoopChange}
                                  onBlur={saveSponsorLoop}
                                  title="Loop Interval (Sec)"
                              />
                              <Clock className="w-2 h-2 absolute top-0.5 right-0.5 text-gray-500 pointer-events-none"/>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      
      {/* SELECTION MODE TOGGLE (Inline Segments) */}
      <div className="bg-primary/40 rounded-lg p-2 mb-4 flex justify-between items-center border border-gray-700">
          <span className="text-xs font-bold text-text-secondary uppercase ml-1">Selection Mode</span>
          <div className="flex bg-gray-800 rounded p-1 border border-gray-700 overflow-hidden">
              <button 
                onClick={playerSelectionMode !== 'MANUAL' ? toggleSelectionMode : undefined}
                className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${playerSelectionMode === 'MANUAL' ? 'btn-golden text-black shadow-lg scale-105 z-10' : 'text-gray-500 hover:text-white'}`}
              >
                  Manual
              </button>
              <button 
                onClick={playerSelectionMode !== 'AUTO' ? toggleSelectionMode : undefined}
                className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${playerSelectionMode === 'AUTO' ? 'btn-golden text-black shadow-lg scale-105 z-10' : 'text-gray-500 hover:text-white'}`}
              >
                  Auto
              </button>
          </div>
      </div>

      <div className="mb-6 space-y-3">
         {/* UNDO BANNER */}
         {lastAction && (
             <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-3 rounded shadow-md flex justify-between items-center animate-fade-in mb-4">
                 <div className="flex items-center text-xs">
                     <AlertOctagon className="w-4 h-4 mr-2" />
                     <span>Just marked <b>{lastAction.name}</b> as <b>{lastAction.type}</b></span>
                 </div>
                 <div className="flex gap-2">
                     {confirmingAction === 'UNDO_LAST' ? (
                         <div className="flex gap-1">
                             <button onClick={() => setConfirmingAction(null)} className="bg-gray-500 text-white text-[10px] px-2 py-1 rounded">No</button>
                             <button 
                                onClick={async () => {
                                    setIsProcessing(true);
                                    try {
                                        await correctPlayerSale(lastAction!.playerId, null, 0);
                                        setLastAction(null);
                                    } catch (e) { console.error(e); }
                                    finally { setIsProcessing(false); setConfirmingAction(null); }
                                }}
                                className="bg-red-600 text-white text-[10px] px-2 py-1 rounded"
                             >
                                 Yes, Undo
                             </button>
                         </div>
                     ) : (
                        <button 
                            onClick={handleUndoLastAction}
                            disabled={isProcessing}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center transition-colors"
                        >
                            <Undo2 className="w-3 h-3 mr-1"/> Undo
                        </button>
                     )}
                     <button onClick={() => setLastAction(null)} className="text-amber-500 hover:text-amber-800"><X className="w-4 h-4"/></button>
                 </div>
             </div>
         )}

         {confirmingAction === 'RESET_PLAYER' && (
             <div className="bg-red-900/30 border border-red-500 p-3 rounded-lg mb-4 flex justify-between items-center animate-fade-in">
                 <span className="text-white text-xs font-bold">Clear current bids?</span>
                 <div className="flex gap-2">
                    <button onClick={() => setConfirmingAction(null)} className="px-3 py-1 bg-white/10 text-white rounded text-[10px]">Cancel</button>
                    <button 
                        onClick={async () => {
                            setIsProcessing(true);
                            await resetCurrentPlayer();
                            setConfirmingAction(null);
                            setIsProcessing(false);
                        }}
                        className="px-3 py-1 bg-red-600 text-white rounded text-[10px] font-bold"
                    >
                        Confirm
                    </button>
                 </div>
             </div>
         )}

         {confirmingAction === 'RESET_FULL' && (
             <div className="bg-red-900 border border-red-500 p-4 rounded-lg mb-4 animate-fade-in">
                 <p className="text-white text-xs font-black uppercase mb-3 text-center">Full Reset: Status will be 'Not Started'. Continue?</p>
                 <div className="flex gap-2">
                    <button onClick={() => setConfirmingAction(null)} className="flex-1 py-2 bg-white/10 text-white rounded text-[10px] uppercase font-black tracking-widest">Back</button>
                    <button 
                        onClick={async () => {
                            setIsProcessing(true);
                            await resetAuction();
                            setConfirmingAction(null);
                            setIsProcessing(false);
                        }}
                        className="flex-1 py-2 bg-red-600 text-white rounded text-[10px] uppercase font-black tracking-widest shadow-lg shadow-red-900/50"
                    >
                        Reset All
                    </button>
                 </div>
             </div>
         )}

         {getControlButtons()}
         
         {renderQuickBidButtons()}

         {!isSellingMode && (
             <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-accent/30">
                 <button 
                    onClick={handleResetPlayer} 
                    disabled={isProcessing || !state.currentPlayerId}
                    className="btn-golden flex flex-col items-center justify-center text-[10px] py-3 rounded-lg transition-all disabled:opacity-30 disabled:grayscale grayscale-0"
                    title="Clears bids for current player only"
                 >
                    <RotateCcw className={`mb-1 h-5 w-5 ${isProcessing ? 'animate-spin' : ''}`}/>
                    RESET CURRENT
                 </button>
                 <button 
                    onClick={handleResetFull} 
                    disabled={isProcessing}
                    className="btn-golden flex flex-col items-center justify-center text-[10px] py-3 rounded-lg transition-all disabled:opacity-30 border border-red-500/20"
                    title="Resets auction status to Not Started"
                 >
                    <AlertOctagon className={`mb-1 h-5 w-5 ${isProcessing ? 'animate-spin' : ''}`}/>
                    RESET FULL
                 </button>
             </div>
         )}
      </div>

      <h3 className="text-sm font-bold mb-3 text-text-secondary uppercase">Teams Overview</h3>
      <div className="flex-grow overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {teams.map((team: Team) => (
          <TeamStatusCard key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
};

export default LiveAdminPanel;