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

  const handleStart = async (specificId?: string) => {
      if (teams.length === 0) {
          alert("Cannot start auction: No teams added. Please go back to Dashboard > Edit Auction > Teams to add teams.");
          return;
      }

      const availablePlayers = players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
      if (availablePlayers.length === 0 && !showUnsold) {
          alert("Cannot start auction: No more players available.");
          return;
      }

      setIsProcessing(true);
      // If restarting an unsold player, specificId will be passed.
      const hasNextPlayer = await startAuction(specificId);
      
      if (!hasNextPlayer && !showUnsold) {
          if (window.confirm("No more players available in the pool.\n\nDo you want to MARK AUCTION AS COMPLETED?")) {
              await endAuction();
          }
      } else {
          // Clear manual selection
          setManualPlayerId('');
          setSearchTerm('');
      }
      setIsProcessing(false);
  }

  const handleResetFull = async () => {
      if(!window.confirm("WARNING: This will reset the auction status to 'Not Started'. It will NOT remove sold players from teams. Proceed?")) return;
      setIsProcessing(true);
      await resetAuction();
      setIsProcessing(false);
  }

  const handleResetPlayer = async () => {
      if(!window.confirm("This will clear the current bid and timer for this player. Proceed?")) return;
      setIsProcessing(true);
      await resetCurrentPlayer();
      setIsProcessing(false);
  }

  const handleCancelSelection = async () => {
      if(!window.confirm("Change Player? This will cancel the current round and allow you to select a different player.")) return;
      setIsProcessing(true);
      await undoPlayerSelection();
      setIsProcessing(false);
  }

  const handleUndoLastAction = async () => {
      if (!lastAction) return;
      if (!window.confirm(`Undo ${lastAction.type} status for ${lastAction.name}? This will return them to the pool.`)) return;
      
      setIsProcessing(true);
      try {
          await correctPlayerSale(lastAction.playerId, null, 0); // null team, 0 price = reset to pool
          setLastAction(null);
      } catch (e) {
          console.error(e);
          alert("Failed to undo action.");
      } finally {
          setIsProcessing(false);
      }
  }

  const handleResetSingleUnsold = async (playerId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm("Bring this player back to pool (remove UNSOLD status)?")) return;
      
      setIsProcessing(true);
      try {
          await correctPlayerSale(playerId, null, 0);
          // If this player was selected in manual dropdown, they will now appear as normal available player
      } catch (e) {
          alert("Failed to reset player.");
      } finally {
          setIsProcessing(false);
      }
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
      if (window.confirm("Confirm UNSOLD?")) {
          setIsProcessing(true);
          const pid = state.currentPlayerId ? String(state.currentPlayerId) : '';
          const pName = players.find(p => String(p.id) === String(pid))?.name || 'Player';

          await passPlayer();
          setLastAction({ playerId: String(pid), type: 'UNSOLD', name: pName });
          setIsProcessing(false);
      }
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
                        <button 
                            onClick={async () => {
                                if(window.confirm(`Bring back ${unsoldCount} unsold players to the pool?`)) {
                                    setIsProcessing(true);
                                    await resetUnsoldPlayers();
                                    setIsProcessing(false);
                                }
                            }}
                            disabled={isProcessing}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg transition-all active:scale-95 flex items-center justify-center"
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4"/>}
                            BRING BACK UNSOLD ({unsoldCount})
                        </button>
                     </div>
                 )}
                 
                 <div className="bg-green-900/30 border border-green-500/50 p-6 rounded-xl text-center shadow-inner">
                    <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-3 drop-shadow-lg" />
                    <h3 className="text-white font-bold text-xl mb-2">Auction Completed!</h3>
                    <p className="text-gray-300 text-sm mb-6">All players have been auctioned. You can now finalize the event.</p>
                    <button 
                        onClick={async () => {
                            if(window.confirm("Are you sure you want to finish the auction? This will enable the summary view for all users.")) {
                                setIsProcessing(true);
                                await endAuction();
                                setIsProcessing(false);
                            }
                        }}
                        disabled={isProcessing}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg shadow-lg shadow-green-900/20 transition-all active:scale-95 flex items-center justify-center tracking-wide"
                    >
                        {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : "GENERATE SUMMARY & FINISH"}
                    </button>
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
                          <div className="grid grid-cols-2 gap-1 overflow-y-auto max-h-32 p-1 bg-black/20 rounded">
                              {teams.map(t => (
                                  <button 
                                    key={t.id}
                                    type="button"
                                    onClick={() => setSelectedTeamId(String(t.id))}
                                    className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-all truncate ${selectedTeamId === String(t.id) ? 'bg-green-600 text-white border-green-400' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}
                                  >
                                      {t.name} ({t.budget})
                                  </button>
                              ))}
                          </div>
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
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded text-sm font-bold transition-colors"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={confirmSell}
                            disabled={isProcessing}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded text-sm font-bold shadow-lg flex items-center justify-center transition-colors"
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
                        className="flex flex-col items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-4 px-2 rounded-lg transition-all shadow-md active:scale-95"
                      >
                          {isProcessing ? <Loader2 className="mb-1 h-6 w-6 animate-spin"/> : <Check className="mb-1 h-6 w-6"/>}
                          {isProcessing ? 'SELLING...' : 'SOLD'}
                      </button>
                      <button 
                        onClick={handlePass}
                        disabled={isProcessing}
                        className="flex flex-col items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-4 px-2 rounded-lg transition-all shadow-md active:scale-95"
                      >
                          {isProcessing ? <Loader2 className="mb-1 h-6 w-6 animate-spin"/> : <X className="mb-1 h-6 w-6"/>}
                          UNSOLD
                      </button>
                  </div>
                  {/* Inline Cancel / Change Player Button */}
                  <button 
                    onClick={handleCancelSelection} 
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg text-xs transition-colors shadow-sm active:scale-95"
                  >
                      <Undo2 className="w-4 h-4 mr-1" /> Change Player / Cancel Round
                  </button>
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

           const filteredPlayers = availablePlayers.filter(p => 
               p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
               p.category.toLowerCase().includes(searchTerm.toLowerCase())
           );

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
                       
                       {/* Inline Search Input */}
                       <div className="relative mb-2">
                           <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                           <input 
                                type="text"
                                className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 pl-7 text-xs text-white focus:border-highlight outline-none"
                                placeholder="Search player name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                           />
                       </div>

                       {/* Options listed directly as per instructions */}
                       <div className="max-h-40 overflow-y-auto border border-gray-700 rounded bg-gray-900 custom-scrollbar mb-2">
                            {filteredPlayers.length > 0 ? filteredPlayers.map(p => (
                                <div 
                                    key={p.id}
                                    onClick={() => setManualPlayerId(String(p.id))}
                                    className={`p-2 text-[10px] cursor-pointer border-b border-gray-800 last:border-0 hover:bg-highlight/10 transition-colors ${manualPlayerId === String(p.id) ? 'bg-highlight/20 text-highlight font-bold' : 'text-gray-300'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span>{p.name} <span className="opacity-60">({p.category})</span></span>
                                        <span className="font-mono">{p.basePrice}</span>
                                    </div>
                                    {p.status === 'UNSOLD' && <span className="text-red-400 text-[8px] font-bold uppercase">Unsold</span>}
                                </div>
                            )) : (
                                <div className="p-4 text-center text-gray-500 text-[10px] italic">No players found</div>
                            )}
                       </div>
                   </div>

                   <button 
                     onClick={() => handleStart(manualPlayerId)} 
                     disabled={isStartDisabled || !manualPlayerId}
                     className={`w-full flex items-center justify-center font-bold py-3 px-4 rounded-lg transition-colors duration-300 shadow-lg shadow-highlight/20 active:scale-95
                         ${isStartDisabled || !manualPlayerId
                             ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                             : 'bg-highlight hover:bg-teal-500 text-primary'}`
                     }
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
            className={`w-full flex items-center justify-center font-bold py-4 px-4 rounded-lg transition-colors duration-300 shadow-lg shadow-highlight/20 active:scale-95
                ${isStartDisabled 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-highlight hover:bg-teal-500 text-primary'}`
            }
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
                    <div className="flex bg-gray-800 rounded p-1 ml-1">
                        <button 
                            onClick={() => updateBiddingStatus('ON')}
                            className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center ${biddingStatus === 'ON' ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Unlock className="w-3 h-3 mr-1"/> ON
                        </button>
                        <button 
                            onClick={() => updateBiddingStatus('PAUSED')}
                            className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center ${biddingStatus !== 'ON' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Lock className="w-3 h-3 mr-1"/> OFF
                        </button>
                    </div>
                  </div>
              </div>

              {/* Display & Sponsors Toolbar (Fully Inline Buttons) */}
              <div className="flex flex-wrap gap-2 items-center bg-primary/50 rounded-lg p-2 w-full mt-1 border-t border-gray-700">
                  <div className="flex items-center gap-2 flex-grow">
                      <div className="flex-1">
                          <label className="block text-[8px] text-gray-400 uppercase font-bold mb-0.5">Projector</label>
                          <div className="flex bg-gray-800 rounded p-0.5">
                              {['STANDARD', 'IPL', 'MODERN'].map(l => (
                                  <button 
                                    key={l}
                                    onClick={() => updateTheme('PROJECTOR', l)}
                                    className={`flex-1 px-1 py-0.5 rounded text-[7px] font-black transition-all ${state.projectorLayout === l ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                  >
                                      {l.slice(0, 4)}
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div className="flex-1">
                          <label className="block text-[8px] text-gray-400 uppercase font-bold mb-0.5">OBS</label>
                          <div className="flex bg-gray-800 rounded p-0.5">
                              {['STANDARD', 'MINIMAL', 'VERTICAL'].map(l => (
                                  <button 
                                    key={l}
                                    onClick={() => updateTheme('OBS', l)}
                                    className={`flex-1 px-1 py-0.5 rounded text-[7px] font-black transition-all ${state.obsLayout === l ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                  >
                                      {l.slice(0, 4)}
                                  </button>
                              ))}
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
          <div className="flex bg-gray-800 rounded p-1">
              <button 
                onClick={playerSelectionMode !== 'MANUAL' ? toggleSelectionMode : undefined}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${playerSelectionMode === 'MANUAL' ? 'bg-highlight text-primary shadow' : 'text-gray-400 hover:text-white'}`}
              >
                  Manual
              </button>
              <button 
                onClick={playerSelectionMode !== 'AUTO' ? toggleSelectionMode : undefined}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${playerSelectionMode === 'AUTO' ? 'bg-highlight text-primary shadow' : 'text-gray-400 hover:text-white'}`}
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
                     <button 
                        onClick={handleUndoLastAction}
                        disabled={isProcessing}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center transition-colors"
                     >
                         <Undo2 className="w-3 h-3 mr-1"/> Undo
                     </button>
                     <button onClick={() => setLastAction(null)} className="text-amber-500 hover:text-amber-800"><X className="w-4 h-4"/></button>
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
                    className="flex flex-col items-center justify-center bg-yellow-600 hover:bg-yellow-700 text-xs text-white py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Clears bids for current player only"
                 >
                    <RotateCcw className={`mb-1 h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`}/>
                    Reset Current
                 </button>
                 <button 
                    onClick={handleResetFull} 
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center bg-red-900/80 hover:bg-red-900 text-xs text-red-200 border border-red-800 py-2 rounded transition-colors disabled:opacity-50"
                    title="Resets auction status to Not Started"
                 >
                    <AlertOctagon className={`mb-1 h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`}/>
                    Reset Full
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