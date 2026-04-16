
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuction } from '../hooks/useAuction';
import { useParams } from 'react-router-dom';
import { Globe, User, TrendingUp, Wallet, Trophy, Star, AlertTriangle, Users, Zap, CheckCircle } from 'lucide-react';
import { Team, Player, AuctionStatus, ProjectorLayout } from '../types';
import { getEffectiveBasePrice } from '../utils';

interface DisplayState {
    player: Player | null;
    bid: number;
    bidder: Team | null;
    status: 'WAITING' | 'LIVE' | 'SOLD' | 'UNSOLD' | 'FINISHED';
}

const Marquee = React.memo(({ content, show, layout }: { content: string[], show: boolean, layout?: ProjectorLayout }) => {
    if (!show || content.length === 0) return null;
    let bgClass = "bg-black";
    let borderClass = "border-t-4 border-highlight";
    let iconColor = "text-highlight";

    if (layout === 'IPL') bgClass = "bg-slate-900";
    if (layout === 'MODERN') bgClass = "bg-zinc-950";
    if (layout === 'STANDARD') bgClass = "bg-gray-800";
    if (layout === 'ADVAYA') {
        bgClass = "bg-black";
        borderClass = "border-t-4 border-yellow-500 shadow-[0_-10px_30px_rgba(234,179,8,0.3)]";
        iconColor = "text-yellow-500";
    }

    return (
          <div className={`fixed bottom-0 left-0 w-full ${bgClass} text-white py-2 overflow-hidden whitespace-nowrap z-50 shadow-2xl ${borderClass}`}>
              <div className="flex animate-marquee w-max will-change-transform">
                  <div className="flex shrink-0 items-center">
                    {content.map((text, i) => (
                        <span key={i} className="mx-8 font-bold text-2xl tracking-wide flex items-center uppercase">
                            <span className={`${iconColor} mr-3 text-xl`}>★</span> {text}
                        </span>
                    ))}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {content.map((text, i) => (
                        <span key={`dup-${i}`} className="mx-8 font-bold text-2xl tracking-wide flex items-center uppercase">
                            <span className={`${iconColor} mr-3 text-xl`}>★</span> {text}
                        </span>
                    ))}
                  </div>
              </div>
              <style>{`
                  @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                  .animate-marquee { animation: marquee 40s linear infinite; }
              `}</style>
          </div>
    );
});

const ProjectorScreen: React.FC = () => {
  const { state, joinAuction } = useAuction();
  const { id: auctionId } = useParams<{ id: string }>();
  const [display, setDisplay] = useState<DisplayState>({ player: null, bid: 0, bidder: null, status: 'WAITING' });
  const [latestLog, setLatestLog] = useState<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentSponsorIndex, setCurrentSponsorIndex] = useState(0);
  const loopInterval = state.sponsorConfig?.loopInterval || 5;
  const sponsorsLength = state.sponsors.length;

  useEffect(() => {
      if (sponsorsLength <= 1) return;
      const interval = setInterval(() => { setCurrentSponsorIndex(prev => (prev + 1) % sponsorsLength); }, loopInterval * 1000);
      return () => clearInterval(interval);
  }, [sponsorsLength, loopInterval]);

  const marqueeContent = useMemo(() => {
       const tName = state.tournamentName?.toUpperCase() || "TOURNAMENT";
       const items = ["WELCOME TO AUCTION"];
       if (tName) items.push(tName);
       if (state.sponsorConfig?.showHighlights) {
           const soldPlayers = state.teams.flatMap(t => t.players).sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0));
           if (soldPlayers.length > 0) items.push(`RECORD BUY: ${soldPlayers[0].name.toUpperCase()} SOLD FOR ${soldPlayers[0].soldPrice} TO ${soldPlayers[0].soldTo?.toUpperCase()}`);
           const purseLeader = [...state.teams].sort((a,b) => b.budget - a.budget)[0];
           if (purseLeader) items.push(`HIGHEST PURSE: ${purseLeader.name.toUpperCase()} WITH ${purseLeader.budget.toLocaleString()}`);
       }
       if (state.sponsors.length > 0) {
           items.push("SPONSORS:");
           state.sponsors.forEach(s => { items.push(s.name.toUpperCase()); });
       }
       return items;
  }, [state.sponsors, state.tournamentName, state.sponsorConfig?.showHighlights, state.teams]);

  useEffect(() => {
      let bg = '#f3f4f6';
      if (state.projectorLayout === 'IPL') bg = '#0f172a';
      if (state.projectorLayout === 'MODERN') bg = '#000000';
      document.body.style.backgroundColor = bg;
      document.documentElement.style.backgroundColor = bg;
  }, [state.projectorLayout]);

  useEffect(() => { if (auctionId) joinAuction(auctionId); }, [auctionId]);

  useEffect(() => {
      const { currentPlayerId, players, currentBid, highestBidder, status, teams, auctionLog } = state;
      const currentPlayer = currentPlayerId ? players.find(p => String(p.id) === String(currentPlayerId)) : null;
      if (status === AuctionStatus.Finished) { setDisplay({ player: null, bid: 0, bidder: null, status: 'FINISHED' }); return; }
      if (auctionLog.length > 0) {
          const relevantLog = auctionLog.find(l => l.type === 'SOLD' || l.type === 'UNSOLD');
          if (relevantLog) setLatestLog(relevantLog.message);
      }
      if (currentPlayer) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          let derivedStatus: 'LIVE' | 'SOLD' | 'UNSOLD' | 'FINISHED' = 'LIVE';
          if (status === AuctionStatus.Sold || currentPlayer.status === 'SOLD') derivedStatus = 'SOLD';
          else if (status === AuctionStatus.Unsold || currentPlayer.status === 'UNSOLD') derivedStatus = 'UNSOLD';
          let resolvedBidder = highestBidder;
          if (derivedStatus === 'SOLD' && !resolvedBidder && currentPlayer.soldTo) {
             resolvedBidder = teams.find(t => t.name === currentPlayer.soldTo) || null;
          }
          const effectiveBase = getEffectiveBasePrice(currentPlayer, state.categories);
          setDisplay({ player: currentPlayer, bid: currentPlayer.soldPrice || currentBid || effectiveBase, bidder: resolvedBidder, status: derivedStatus });
      } else if (display.status !== 'WAITING' && display.status !== 'FINISHED') {
          timeoutRef.current = setTimeout(() => { setDisplay({ player: null, bid: 0, bidder: null, status: 'WAITING' }); }, 2000); 
      }
  }, [state]);

  const SystemLogoFrame = () => (
      <div className="absolute top-4 left-4 h-24 bg-white rounded-2xl border-2 border-highlight p-3 shadow-xl flex items-center gap-4 z-50 px-6">
          <div className="flex flex-col text-right">
              <span className="text-black font-black text-2xl tracking-tighter leading-none">SM SPORTS</span>
              <span className="text-highlight text-[10px] font-bold uppercase tracking-[0.2em] mt-1 italic">Auction Engine</span>
          </div>
          {state.systemLogoUrl ? (
              <img src={state.systemLogoUrl} className="h-full object-contain" alt="Logo" />
          ) : (
              <Trophy className="h-10 w-10 text-highlight opacity-40 shrink-0" />
          )}
      </div>
  );

  const SponsorLoop = () => (
      state.sponsorConfig?.showOnProjector && state.sponsors.length > 0 && (
          <div className="absolute top-4 right-4 h-[10vh] max-w-[20vw] bg-white rounded-xl shadow-lg p-2 flex items-center justify-center z-40 overflow-hidden border border-gray-200">
              <img src={state.sponsors[currentSponsorIndex]?.imageUrl} className="max-h-full max-w-full object-contain transition-opacity duration-500" alt="Sponsor" />
          </div>
      )
  );

  const TournamentLogo = () => (
      state.auctionLogoUrl && (
          <div className="absolute top-4 left-4 h-[12vh] max-w-[20vw] bg-white rounded-xl shadow-lg p-2 flex items-center justify-center z-40 border border-gray-200">
              <img src={state.auctionLogoUrl} className="max-h-full max-w-full object-contain" />
          </div>
      )
  );

  const Header = () => (
      <div className="h-32 bg-slate-950 border-b-2 border-yellow-500/50 flex items-center justify-between px-16 z-[60] shrink-0 relative overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-transparent to-transparent opacity-50"></div>
          
          {/* Left: SM Sports Logo */}
          <div className="flex items-center gap-6 w-1/4 relative z-10">
               {state.systemLogoUrl ? (
                  <div className="relative group">
                      <div className="absolute inset-0 bg-white/20 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
                      <img src={state.systemLogoUrl} className="h-20 w-auto object-contain drop-shadow-2xl relative z-10" alt="Left Logo" />
                  </div>
              ) : (
                  <div className="flex items-center gap-4 bg-gradient-to-br from-black/80 to-slate-900/80 backdrop-blur-xl px-8 py-3 rounded-2xl border border-white/10 shadow-2xl skew-x-[-12deg]">
                      <div className="transform skew-x-[12deg] flex items-center gap-3">
                          <Trophy className="w-10 h-10 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                          <div className="flex flex-col">
                              <span className="text-white text-2xl font-black italic tracking-tighter leading-none">SM SPORTS</span>
                              <span className="text-yellow-500 text-[8px] font-bold uppercase tracking-[0.3em] mt-1 text-right">Auction Engine</span>
                          </div>
                      </div>
                  </div>
              )}
          </div>
          
          {/* Middle: Auction Name */}
          <div className="flex-1 flex justify-center relative z-10 px-8">
              <div className="relative group">
                  <div className="absolute inset-[-20px] bg-yellow-500/10 blur-[40px] rounded-full group-hover:bg-yellow-500/20 transition-all duration-700"></div>
                  <div className="bg-black/60 backdrop-blur-xl px-12 py-4 rounded-[40px] border border-yellow-500/30 shadow-[0_0_50px_rgba(234,179,8,0.15)] relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>
                      <h1 className="text-4xl md:text-5xl lg:text-7xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-yellow-100 to-yellow-500 drop-shadow-[0_0_30px_rgba(234,179,8,0.6)] truncate max-w-[45vw] text-center italic">
                          {state.tournamentName || "AUCTION 2025"}
                      </h1>
                  </div>
              </div>
          </div>

          {/* Right: Sponsors pics */}
          <div className="w-1/4 flex justify-end relative z-10 h-full py-4">
              {state.sponsorConfig?.showOnProjector && state.sponsors.length > 0 ? (
                  <div className="h-full aspect-video bg-white/90 backdrop-blur rounded-2xl shadow-2xl p-2.5 flex items-center justify-center overflow-hidden border-2 border-white/20 group hover:scale-105 transition-transform duration-500">
                      <img 
                        src={state.sponsors[currentSponsorIndex]?.imageUrl} 
                        className="max-h-full max-w-full object-contain transition-opacity duration-700 hover:scale-110" 
                        alt="Sponsor" 
                        key={currentSponsorIndex}
                      />
                  </div>
              ) : (
                  <div className="h-full aspect-video bg-slate-900/50 backdrop-blur rounded-2xl border border-white/5 flex items-center justify-center">
                       <Star className="text-yellow-500/20 w-10 h-10 animate-pulse" />
                  </div>
              )}
          </div>
      </div>
  );

  if (state.adminViewOverride && state.adminViewOverride.type !== 'NONE') {
      const { type, data } = state.adminViewOverride;
      const RenderOverrideContainer = ({ children, title }: any) => (
          <div className="h-screen w-full bg-[#020617] text-white flex flex-col relative overflow-hidden font-sans">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1e293b_0%,_transparent_100%)] opacity-30"></div>
              <Header />
              <div className="flex-1 p-10 flex flex-col overflow-hidden relative z-10">
                  <div className="mb-10 text-center animate-fade-in">
                      <div className="inline-block relative">
                          <h1 className="text-6xl lg:text-8xl font-black uppercase tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-2xl">
                              {title}
                          </h1>
                          <div className="absolute -bottom-4 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-yellow-500 to-transparent rounded-full shadow-[0_0_20px_rgba(234,179,8,0.5)]"></div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-hidden bg-slate-900/40 backdrop-blur-2xl rounded-[3rem] border border-white/10 p-10 shadow-[0_20px_100px_rgba(0,0,0,0.5)] relative flex flex-col animate-slide-up">
                      {children}
                  </div>
              </div>
              <Marquee show={!!state.sponsorConfig?.showHighlights} content={marqueeContent} layout={state.projectorLayout} />
          </div>
      );
      if (type === 'SQUAD' && data?.teamId) {
          const team = state.teams.find(t => String(t.id) === String(data.teamId));
          if (team) return (
              <RenderOverrideContainer title={`Squad Overview`}>
                  <div className="h-full flex flex-col gap-10">
                      <div className="flex items-center justify-between bg-gradient-to-r from-blue-900/30 to-slate-900/30 p-10 rounded-[2.5rem] border border-blue-500/20 shadow-2xl">
                          <div className="flex items-center gap-10">
                              <div className="relative group">
                                  <div className="absolute inset-[-10px] bg-blue-500 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                                  {team.logoUrl ? (
                                      <img src={team.logoUrl} className="w-48 h-48 rounded-[2rem] bg-white p-3 object-contain relative z-10 shadow-2xl border-2 border-white/20" />
                                  ) : (
                                      <div className="w-48 h-48 rounded-[2rem] bg-blue-600 flex items-center justify-center text-8xl font-black relative z-10 border-4 border-white/20 shadow-2xl italic tracking-tighter">
                                          {team.name.charAt(0)}
                                      </div>
                                  )}
                              </div>
                              <div>
                                  <h2 className="text-7xl font-black text-white uppercase italic tracking-tighter mb-4 drop-shadow-lg">{team.name}</h2>
                                  <div className="flex gap-4">
                                      <div className="bg-slate-800/80 px-6 py-2 rounded-full border border-white/10 text-slate-400 font-black uppercase text-xs tracking-widest">Team ID: {team.teamCode || 'N/A'}</div>
                                      <div className="bg-green-500/20 px-6 py-2 rounded-full border border-green-500/30 text-green-400 font-black uppercase text-xs tracking-widest">Active Status</div>
                                  </div>
                              </div>
                          </div>
                          <div className="flex gap-8">
                              <div className="bg-black/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 text-center min-w-[200px] shadow-xl">
                                  <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] mb-2 font-mono">Total Roster</p>
                                  <span className="text-7xl font-black text-white italic tracking-tighter">{team.players.length}</span>
                              </div>
                              <div className="bg-black/40 backdrop-blur-md p-8 rounded-3xl border border-white/5 text-center min-w-[240px] shadow-xl border-t-green-500/20">
                                  <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] mb-2 font-mono">Available Purse</p>
                                  <span className="text-7xl font-black text-green-400 italic tracking-tighter">₹{team.budget.toLocaleString()}</span>
                              </div>
                          </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-2 custom-scrollbar pr-6">
                          {team.players.map((p, i) => (
                              <div key={i} className="bg-gradient-to-br from-slate-800/50 to-slate-950/50 p-6 rounded-[2rem] flex items-center gap-6 border border-white/5 hover:border-blue-500/50 transition-all hover:scale-[1.05] shadow-xl hover:shadow-blue-500/10 group">
                                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-yellow-500 to-yellow-300 text-black flex items-center justify-center font-black text-xl shadow-lg transform -rotate-6 group-hover:rotate-0 transition-transform italic">#{i+1}</div>
                                  <div className="min-w-0 flex-1">
                                      <p className="font-black text-2xl text-white truncate uppercase italic tracking-tighter">{p.name}</p>
                                      <div className="flex items-center gap-3 mt-1">
                                          <span className="text-blue-400 font-black text-xs uppercase tracking-widest">{p.role || p.speciality}</span>
                                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                                          <span className="text-green-400 font-mono font-black text-sm">₹{p.soldPrice?.toLocaleString()}</span>
                                      </div>
                                  </div>
                              </div>
                          ))}
                          {team.players.length === 0 && (
                               <div className="col-span-full h-full flex flex-col items-center justify-center text-slate-700 italic uppercase tracking-[0.5em] gap-6">
                                    <Users className="w-32 h-32 opacity-10" />
                                    <p className="text-4xl font-black">Roster Empty</p>
                               </div>
                          )}
                      </div>
                  </div>
              </RenderOverrideContainer>
          );
      }
      if (type === 'PURSES') {
          const sortedTeams = [...state.teams].sort((a,b) => b.budget - a.budget);
          return (
              <RenderOverrideContainer title="Live Purse Standings">
                  <div className="h-full overflow-y-auto p-4 custom-scrollbar pr-6">
                      <div className="grid grid-cols-1 gap-6">
                          {sortedTeams.map((team, i) => (
                              <div key={team.id} className="flex items-center justify-between bg-gradient-to-r from-slate-800/40 to-black/40 p-10 rounded-[2.5rem] border border-white/5 hover:border-green-500/50 transition-all hover:translate-x-4 shadow-2xl relative overflow-hidden group">
                                  <div className={`absolute left-0 top-0 h-full w-3 transition-colors ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-slate-300' : i === 2 ? 'bg-orange-500' : 'bg-slate-700'}`}></div>
                                  <div className="flex items-center gap-10">
                                      <span className={`text-6xl font-black w-24 text-center italic ${i === 0 ? 'text-yellow-400 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-700'}`}>
                                          #{i+1}
                                      </span>
                                      {team.logoUrl ? (
                                          <img src={team.logoUrl} className="w-28 h-28 rounded-3xl bg-white p-2 object-contain shadow-2xl border-2 border-white/10 group-hover:scale-110 transition-transform" />
                                      ) : (
                                          <div className="w-28 h-28 rounded-3xl bg-slate-800 flex items-center justify-center font-black text-5xl italic border-2 border-white/10">
                                              {team.name.charAt(0)}
                                          </div>
                                      )}
                                      <div>
                                          <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter mb-2">{team.name}</h3>
                                          <div className="flex items-center gap-4">
                                              <p className="text-sm text-slate-500 font-black uppercase tracking-[0.3em] font-mono">{team.players.length} Players Signed</p>
                                              <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                                              <p className="text-sm text-blue-500 font-bold uppercase tracking-widest">{team.teamCode}</p>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="text-right bg-white/5 px-12 py-6 rounded-[2rem] border border-white/10 shadow-inner group-hover:bg-green-500/10 transition-colors">
                                      <p className="text-xs text-slate-500 uppercase font-black tracking-[0.3em] mb-3 font-mono">Available Funds</p>
                                      <p className="text-7xl font-black text-green-400 tabular-nums italic tracking-tighter drop-shadow-[0_0_20px_rgba(74,222,128,0.3)]">
                                          ₹{team.budget.toLocaleString()}
                                      </p>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </RenderOverrideContainer>
          );
      }
      if (type === 'TOP_5') {
          const soldPlayers = state.teams.flatMap(t => t.players.map(p => ({ ...p, soldToTeam: t })))
              .sort((a, b) => (Number(b.soldPrice) || 0) - (Number(a.soldPrice) || 0))
              .slice(0, 5);
          return (
              <RenderOverrideContainer title="Top 5 Tournament Deals">
                  <div className="h-full p-4 space-y-8 pb-10">
                      {soldPlayers.map((p, i) => (
                          <div key={i} className="flex items-center justify-between bg-gradient-to-br from-slate-800/40 to-slate-950/80 p-10 rounded-[3rem] border-2 border-yellow-500/20 animate-slide-up hover:border-yellow-500/50 transition-all shadow-2xl relative overflow-hidden group" style={{ animationDelay: `${i * 150}ms` }}>
                              <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-yellow-500/5 to-transparent skew-x-[-12deg] pointer-events-none"></div>
                              <div className="flex items-center gap-12 relative z-10">
                                  <span className={`text-8xl font-black italic w-32 text-center ${i === 0 ? 'text-yellow-400 drop-shadow-[0_0_30px_rgba(234,179,8,0.7)]' : 'text-slate-600 opacity-50'}`}>
                                      #{i + 1}
                                  </span>
                                  <div className="flex items-center gap-10">
                                      <div className="relative">
                                          <div className="absolute inset-[-8px] bg-yellow-500 blur-2xl opacity-0 group-hover:opacity-30 transition-opacity"></div>
                                          <img src={p.photoUrl} className="w-40 h-40 rounded-[2.5rem] object-cover border-4 border-slate-700 shadow-2xl relative z-10 p-1" alt={p.name} />
                                      </div>
                                      <div>
                                          <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter mb-4 group-hover:text-yellow-400 transition-colors leading-none">{p.name}</h2>
                                          <div className="flex items-center gap-4">
                                              <span className="bg-blue-600/20 text-blue-400 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border border-blue-500/30 shadow-lg">{p.role || p.speciality}</span>
                                              <span className="text-slate-600 font-bold">•</span>
                                              <span className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">{p.category}</span>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              <div className="flex items-center gap-16 relative z-10">
                                  <div className="text-right">
                                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.4em] mb-4 font-mono">Acquired By</p>
                                      <div className="flex items-center gap-5 justify-end">
                                          <p className="text-4xl font-black text-white uppercase italic tracking-tighter drop-shadow-md">{p.soldToTeam.name}</p>
                                          {p.soldToTeam.logoUrl && <img src={p.soldToTeam.logoUrl} className="w-14 h-14 object-contain" />}
                                      </div>
                                  </div>
                                  <div className="bg-yellow-500 text-black px-12 py-6 rounded-[2rem] font-black text-6xl shadow-[0_15px_30px_rgba(234,179,8,0.3)] italic tracking-tighter animate-pulse border-4 border-white transform hover:rotate-3 transition-transform">
                                      ₹{p.soldPrice?.toLocaleString()}
                                  </div>
                              </div>
                          </div>
                      ))}
                      {soldPlayers.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-slate-700 italic uppercase tracking-[0.5em] gap-8">
                              <Trophy className="w-40 h-40 opacity-10 animate-bounce" />
                              <p className="text-4xl font-black">Waiting for major signings...</p>
                          </div>
                      )}
                  </div>
              </RenderOverrideContainer>
          );
      }
      if (type === 'UNSOLD') {
          const unsoldPlayers = state.players.filter(p => p.status === 'UNSOLD');
          return (
            <RenderOverrideContainer title="Unsold Player Pool">
                <div className="h-full overflow-y-auto p-4 custom-scrollbar pr-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {unsoldPlayers.map((p, i) => (
                            <div key={i} className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl hover:border-red-500/50 transition-all hover:scale-105 group">
                                <div className="h-72 relative">
                                    <img src={p.photoUrl} className="w-full h-full object-cover grayscale opacity-50 transition-all group-hover:grayscale-0 group-hover:opacity-100" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                                    <div className="absolute top-4 left-4 bg-red-600 text-white px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">UNSOLD</div>
                                </div>
                                <div className="p-6">
                                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2 truncate">{p.name}</h3>
                                    <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
                                        <div>
                                            <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Base Price</p>
                                            <p className="text-yellow-500 font-black font-mono">₹{getEffectiveBasePrice(p, state.categories).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Role</p>
                                            <p className="text-white text-xs font-bold uppercase">{p.role || p.speciality}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {unsoldPlayers.length === 0 && (
                         <div className="h-full flex flex-col items-center justify-center text-slate-700 italic uppercase tracking-[0.5em] gap-8">
                            <CheckCircle className="w-40 h-40 opacity-10" />
                            <p className="text-4xl font-black">No Unsold Players</p>
                       </div>
                    )}
                </div>
            </RenderOverrideContainer>
          );
      }
  }

  if (display.status === 'FINISHED') return <div className="h-screen w-full bg-slate-900 text-white flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black font-sans"><div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div><Header /><div className="flex-1 flex flex-col items-center justify-center p-8 z-10 animate-slide-up"><div className="text-center"><h1 className="text-5xl lg:text-9xl font-black text-yellow-400 tracking-widest uppercase drop-shadow-[0_0_45px_rgba(250,204,21,0.6)]">AUCTION COMPLETED</h1><div className="h-3 w-64 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mt-10 rounded-full"></div><p className="text-2xl lg:text-4xl text-gray-500 uppercase tracking-[0.6em] font-light mt-12 animate-pulse">Thank You For Watching</p></div></div><Marquee show={!!(state.sponsorConfig?.showOnProjector && state.sponsors.length > 0)} content={marqueeContent} layout={state.projectorLayout} /></div>;

  if (display.status === 'WAITING' || !display.player) return <div className={`h-screen w-full flex flex-col relative overflow-hidden ${state.projectorLayout === 'IPL' ? 'bg-slate-950' : 'bg-gray-100'}`}><Header /><div className="flex-1 flex flex-col items-center justify-center p-10 z-10"><div className={`p-16 rounded-[3rem] shadow-2xl text-center border-2 animate-fade-in ${state.projectorLayout === 'IPL' ? 'bg-slate-900/50 backdrop-blur-xl border-yellow-500/30' : 'bg-white border-gray-200'}`}><h1 className={`text-6xl font-black tracking-widest mb-6 ${state.projectorLayout === 'IPL' ? 'text-yellow-400' : 'text-gray-800'}`}>{state.status === AuctionStatus.NotStarted ? "AUCTION STARTING SOON" : "AWAITING SELECTION"}</h1><p className={`${state.projectorLayout === 'IPL' ? 'text-slate-400' : 'text-gray-500'} text-2xl animate-pulse font-bold tracking-widest uppercase`}>The next player will appear shortly...</p></div></div><Marquee show={!!(state.sponsorConfig?.showOnProjector && state.sponsors.length > 0)} content={marqueeContent} layout={state.projectorLayout} /></div>;

  const { player, bid, bidder, status } = display;
  const layout = state.projectorLayout || 'STANDARD';

  if (!state.status && !state.tournamentName) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white font-black uppercase tracking-widest">
              <div className="flex flex-col items-center gap-6">
                  <div className="w-20 h-20 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-2xl animate-pulse">Loading Auction Data...</p>
                  <p className="text-[10px] text-zinc-500 tracking-[0.5em]">SM SPORTS LIVE SYSTEM</p>
              </div>
          </div>
      );
  }

  return (
      <div className="h-screen w-full relative flex flex-col overflow-hidden bg-black">
          <Header />
          <div className="flex-1 relative overflow-hidden">
          {layout === 'STANDARD' && (
              <div className="h-full w-full bg-gray-100 flex flex-col font-sans overflow-hidden relative">
                <div className="flex-1 flex gap-4 p-4 min-h-0 relative z-10 items-center justify-center"><div className="w-[30%] bg-white rounded-3xl shadow-2xl overflow-hidden relative border-4 border-white flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 h-[70vh]"><img src={player?.photoUrl} alt={player?.name} className="w-full h-full object-cover object-top" /><div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-lg shadow-lg border border-gray-200"><span className="font-bold text-xl text-gray-800 uppercase tracking-wide">{player?.category}</span></div></div><div className="flex-1 flex flex-col gap-4 min-h-0 h-[70vh]"><div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex justify-between items-start shrink-0"><div><div className="flex items-center gap-2 mb-2 text-gray-500 font-bold tracking-widest uppercase text-sm"><Globe className="w-4 h-4" /> {player?.nationality}</div><h1 className="text-6xl lg:text-7xl font-black text-gray-900 leading-none mb-2 truncate max-w-[50vw]">{player?.name}</h1><div className="flex gap-4 mt-2"><p className="text-2xl text-highlight font-black flex items-center uppercase tracking-wider"><User className="w-6 h-6 mr-2"/> {player?.role || player?.speciality}</p> <div className="w-1 h-8 bg-gray-200"></div> <p className="text-2xl text-gray-600 font-bold uppercase tracking-wider">{player?.speciality || player?.category}</p></div></div><div className="text-right whitespace-nowrap bg-gray-50 p-4 rounded-xl border border-gray-200"><p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Base Price</p><p className="text-4xl font-bold text-gray-700 font-mono">₹{player ? getEffectiveBasePrice(player, state.categories).toLocaleString() : '0'}</p></div></div><div className="flex-1 bg-gray-900 rounded-3xl p-4 shadow-2xl relative overflow-hidden flex flex-col justify-center items-center border-4 border-gray-800">{status === 'SOLD' && <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"><div className="flex flex-col items-center"><div className="bg-green-600 text-white font-black text-7xl lg:text-8xl px-12 py-4 border-8 border-white -rotate-12 shadow-[0_0_50px_rgba(22,163,74,0.6)] animate-bounce-in tracking-widest uppercase mb-8">SOLD</div>{bidder && <div className="bg-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up"><div className="text-right"><p className="text-xs text-gray-400 font-bold uppercase">Sold To</p><p className="text-3xl font-black text-gray-800">{bidder.name}</p></div>{bidder.logoUrl ? <img src={bidder.logoUrl} className="w-16 h-16 rounded-full border border-gray-200 object-contain" /> : <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center font-bold text-xl">{bidder.name.charAt(0)}</div>}</div>}</div></div>}{status === 'UNSOLD' && <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-red-600 text-white font-black text-8xl px-12 py-4 border-8 border-white -rotate-12 shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-bounce-in tracking-widest uppercase">UNSOLD</div></div>}<p className="text-highlight font-bold text-lg lg:text-xl uppercase tracking-[0.5em] mb-4 relative z-10">{bidder ? 'Current Bid Amount' : 'Base Price'}</p><div className={`text-[12vh] lg:text-[16vh] leading-none font-black tabular-nums drop-shadow-2xl relative z-10 ${bidder ? 'text-white' : 'text-highlight animate-pulse'}`}>{bid.toLocaleString()}</div>{status === 'LIVE' && bidder && (<div className="mt-6 bg-gray-800 px-8 py-3 rounded-full flex items-center gap-6 border border-gray-700 relative z-10 shadow-lg"><div className="text-right"><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Highest Bidder</p><p className="text-2xl font-bold text-white">{bidder.name}</p></div>{bidder.logoUrl ? <img src={bidder.logoUrl} className="w-12 h-12 rounded-full bg-white p-0.5" /> : <div className="w-12 h-12 bg-gray-600 rounded-full" />}</div>)}</div></div></div>
                <div className="mt-auto flex gap-4 h-[20vh] relative z-20 bg-gray-100 shrink-0 p-4 pt-0">
                    <div className="w-1/3 bg-white rounded-3xl shadow-lg border border-gray-200 p-6 flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-2 h-full bg-highlight"></div>
                        <h3 className="text-gray-400 font-bold uppercase text-sm tracking-widest mb-2 flex items-center"><TrendingUp className="w-4 h-4 mr-2"/> Recent Activity</h3>
                        <div className="text-2xl lg:text-3xl font-black text-gray-800 leading-tight line-clamp-2">{latestLog || "Auction in progress..."}</div>
                    </div>
                    <div className="flex-1 bg-gray-900 rounded-3xl shadow-lg border border-gray-800 p-6 overflow-hidden flex flex-col">
                        <h3 className="text-gray-400 font-bold uppercase text-sm tracking-widest mb-3 flex items-center"><Wallet className="w-4 h-4 mr-2"/> Team Purses Remaining</h3>
                        <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center gap-4 custom-scrollbar">
                            {state.teams.map(team => (
                                <div key={team.id} className="min-w-[180px] bg-gray-800 p-4 rounded-2xl border border-gray-700 flex items-center gap-4 shrink-0 hover:border-highlight/50 transition-colors">
                                    {team.logoUrl ? <img src={team.logoUrl} className="w-10 h-10 rounded-full bg-white p-1 object-contain" /> : <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold text-lg">{team.name.charAt(0)}</div>}
                                    <div className="min-w-0">
                                        <h4 className="text-white font-black text-sm truncate">{team.name}</h4>
                                        <p className="text-green-400 font-mono font-black text-lg leading-none mt-1">₹{team.budget.toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              </div>
          )}

          {layout === 'IPL' && (
              <div className="h-full w-full bg-slate-950 flex flex-col font-sans overflow-hidden relative text-white">
                  <div className="flex-1 flex p-6 gap-6 min-h-0 relative z-10">
                      <div className="w-[35%] flex flex-col gap-6">
                          <div className="flex-1 bg-slate-900 rounded-2xl border-2 border-yellow-500/20 overflow-hidden relative shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                              <img src={player?.photoUrl} className="w-full h-full object-cover object-top" />
                              <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-6">
                                  <div className="bg-yellow-500 text-black px-4 py-1 rounded font-black text-lg uppercase tracking-widest inline-block mb-2">{player?.category}</div>
                                  <h2 className="text-5xl font-black uppercase tracking-tight leading-none mb-2">{player?.name}</h2>
                                  <p className="text-2xl font-black text-yellow-500 flex items-center gap-2"><Trophy className="w-6 h-6"/> {player?.role || player?.speciality}</p>
                              </div>
                          </div>
                          <div className="bg-slate-900 p-6 rounded-2xl border border-white/10 flex justify-between items-center">
                              <div>
                                                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Base Price</p>
                                  <p className="text-3xl font-black text-yellow-500">₹{player ? getEffectiveBasePrice(player, state.categories).toLocaleString() : '0'}</p>
                              </div>
                              <div className="text-right">
                                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Nationality</p>
                                  <p className="text-xl font-bold uppercase">{player?.nationality}</p>
                              </div>
                          </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-6">
                         <div className="flex-1 bg-slate-900 rounded-3xl border-2 border-yellow-500/20 relative overflow-hidden flex flex-col items-center justify-center shadow-2xl">
                             {/* ... same as before but without Top Bar ... */}
                             {status === 'SOLD' && (
                                  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
                                      <div className="bg-yellow-500 text-black font-black text-8xl px-16 py-6 -rotate-6 shadow-[0_0_60px_rgba(234,179,8,0.5)] animate-bounce-in mb-10">SOLD</div>
                                      {bidder && (
                                          <div className="flex flex-col items-center animate-slide-up">
                                              <p className="text-yellow-500 font-bold uppercase tracking-[0.3em] mb-4">New Team Member</p>
                                              <div className="flex items-center gap-8 bg-slate-900 p-8 rounded-3xl border border-yellow-500/30 shadow-2xl">
                                                  {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-32 h-32 object-contain bg-white p-2 rounded-full" /> : <div className="w-32 h-32 bg-yellow-600 rounded-full flex items-center justify-center text-5xl font-bold">{bidder.name.charAt(0)}</div>}
                                                  <div>
                                                      <h3 className="text-5xl font-black uppercase tracking-tight">{bidder.name}</h3>
                                                      <p className="text-2xl font-bold text-yellow-500 mt-2">₹ {bid.toLocaleString()}</p>
                                                  </div>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              )}

                              {status === 'UNSOLD' && (
                                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
                                      <div className="bg-red-600 text-white font-black text-8xl px-16 py-6 rotate-6 shadow-[0_0_60px_rgba(220,38,38,0.5)] animate-bounce-in">UNSOLD</div>
                                  </div>
                              )}

                              <p className="text-yellow-500/50 font-bold text-2xl uppercase tracking-[0.4em] mb-6">Current Bid</p>
                              <div className="text-[20vh] font-black text-white leading-none tabular-nums drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">{bid.toLocaleString()}</div>
                              
                              {status === 'LIVE' && bidder && (
                                  <div className="mt-10 flex flex-col items-center animate-slide-up">
                                      <div className="h-px w-64 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent mb-6"></div>
                                      <div className="flex items-center gap-6 bg-slate-800/50 px-10 py-4 rounded-2xl border border-yellow-500/20">
                                          {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-16 h-16 object-contain bg-white p-1 rounded-full" /> : <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center font-bold text-xl">{bidder.name.charAt(0)}</div>}
                                          <div>
                                              <p className="text-yellow-500 text-xs font-bold uppercase tracking-widest mb-1">Highest Bidder</p>
                                              <p className="text-3xl font-black uppercase">{bidder.name}</p>
                                          </div>
                                      </div>
                                  </div>
                              )}
                         </div>
                         <div className="h-[20vh] bg-slate-900 rounded-3xl border border-white/10 p-6 flex flex-col">
                              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center"><Wallet className="w-4 h-4 mr-2 text-yellow-500"/> Team Purses Remaining</p>
                              <div className="flex-1 overflow-x-auto flex items-center gap-4 custom-scrollbar pb-2">
                                  {state.teams.map(team => (
                                      <div key={team.id} className="min-w-[180px] bg-black/40 p-3 rounded-xl border border-white/5 flex items-center gap-3 shrink-0">
                                          {team.logoUrl ? <img src={team.logoUrl} className="w-10 h-10 object-contain bg-white p-1 rounded-full" /> : <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-xs">{team.name.charAt(0)}</div>}
                                          <div className="min-w-0">
                                              <p className="text-white font-bold text-xs truncate">{team.name}</p>
                                              <p className="text-yellow-500 font-mono font-bold text-sm">{team.budget.toLocaleString()}</p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {layout === 'MODERN' && (
              <div className="h-full w-full bg-black flex flex-col font-sans overflow-hidden relative text-white">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(20,20,20,1)_0%,_rgba(0,0,0,1)_100%)]"></div>
                  
                  <div className="flex-1 flex p-8 gap-8 min-h-0 relative z-10">
                      <div className="w-[40%] bg-zinc-900 rounded-[40px] overflow-hidden relative border border-white/10 shadow-2xl">
                          <img src={player?.photoUrl} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                          <div className="absolute bottom-10 left-10 right-10">
                              <div className="flex items-center gap-3 mb-4">
                                  <span className="bg-highlight text-black px-3 py-1 rounded-full font-bold text-sm uppercase tracking-widest">{player?.category}</span>
                                  <span className="text-white/40 font-mono text-sm">#{player?.id.toString().slice(-4)}</span>
                              </div>
                              <h2 className="text-7xl font-black uppercase tracking-tighter leading-none mb-4 italic">{player?.name}</h2>
                              <div className="flex gap-8 border-t border-white/10 pt-6">
                                  <div>
                                      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Role</p>
                                      <p className="text-xl font-bold uppercase">{player?.role || player?.speciality || player?.category}</p>
                                  </div>
                                                                    <div>
                                      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Base</p>
                                      <p className="text-xl font-bold font-mono">₹{player ? getEffectiveBasePrice(player, state.categories).toLocaleString() : '0'}</p>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="flex-1 flex flex-col gap-8">
                          <div className="flex-1 bg-zinc-900 rounded-[40px] border border-white/10 relative overflow-hidden flex flex-col items-center justify-center">
                              {status === 'SOLD' && (
                                  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl animate-fade-in">
                                      <div className="text-highlight font-black text-[12vw] italic tracking-tighter leading-none animate-bounce-in mb-8">SOLD</div>
                                      {bidder && (
                                          <div className="flex items-center gap-6 bg-white/5 p-6 rounded-3xl border border-white/10 animate-slide-up">
                                              {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-20 h-20 object-contain bg-white p-1 rounded-full" /> : <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center text-3xl font-bold">{bidder.name.charAt(0)}</div>}
                                              <div>
                                                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Acquired By</p>
                                                  <h3 className="text-4xl font-black uppercase italic">{bidder.name}</h3>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              )}

                              {status === 'UNSOLD' && (
                                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl animate-fade-in">
                                      <div className="text-red-500 font-black text-[12vw] italic tracking-tighter leading-none animate-bounce-in">UNSOLD</div>
                                  </div>
                              )}

                              <div className="text-white/20 font-black text-[10vw] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none uppercase italic tracking-tighter opacity-10">BIDDING</div>
                              
                              <p className="text-highlight font-mono text-xl tracking-[0.5em] mb-4 relative z-10">CURRENT_VAL</p>
                              <div className="text-[18vh] font-black text-white leading-none tabular-nums relative z-10 italic tracking-tighter drop-shadow-[0_0_40px_rgba(56,178,172,0.3)]">{bid.toLocaleString()}</div>
                              
                              {status === 'LIVE' && bidder && (
                                  <div className="mt-12 flex items-center gap-4 bg-white/5 px-8 py-4 rounded-full border border-white/10 relative z-10 animate-slide-up">
                                      <div className="w-3 h-3 bg-highlight rounded-full animate-ping"></div>
                                      <span className="text-white/60 font-bold uppercase tracking-widest text-sm">Leader:</span>
                                      <span className="text-2xl font-black uppercase italic">{bidder.name}</span>
                                  </div>
                              )}
                          </div>

                          <div className="h-32 flex gap-4">
                              <div className="flex-1 bg-zinc-900 rounded-3xl border border-white/10 p-4 flex items-center gap-6 overflow-hidden">
                                  <div className="shrink-0 bg-white/5 p-3 rounded-2xl border border-white/10"><TrendingUp className="text-highlight w-6 h-6" /></div>
                                  <div className="min-w-0">
                                      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Latest Log</p>
                                      <p className="text-xl font-bold truncate">{latestLog || "Awaiting bids..."}</p>
                                  </div>
                              </div>
                              <div className="w-1/3 bg-highlight rounded-3xl p-4 flex flex-col justify-center items-center text-black">
                                  <p className="text-black/60 text-[10px] font-bold uppercase tracking-widest mb-1">Total Teams</p>
                                  <p className="text-4xl font-black italic">{state.teams.length}</p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}
          {layout === 'ADVAYA' && (
              <div className="h-screen w-full bg-[#050505] flex flex-col font-sans overflow-hidden relative text-white">
                  {/* Background Accents */}
                  <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-yellow-900/20 to-transparent pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-1/2 h-full bg-gradient-to-r from-yellow-900/10 to-transparent pointer-events-none"></div>
                  
                  {/* Header - Customized for ADVAYA */}
                  <div className="h-28 flex items-center justify-center px-16 z-50 relative border-b border-yellow-500/10 backdrop-blur-sm">
                      <div className="text-center">
                          <div className="relative inline-block bg-black/40 px-12 py-4 rounded-[40px] border border-yellow-500/20 shadow-[0_0_50px_rgba(234,179,8,0.1)]">
                              <div className="absolute inset-0 bg-yellow-500 blur-3xl opacity-20 rounded-full"></div>
                              <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-r from-white via-yellow-200 to-yellow-500 drop-shadow-[0_0_30px_rgba(234,179,8,0.6)]">
                                  {state.tournamentName || "AUCTION 2025"}
                              </h1>
                          </div>
                      </div>

                      {/* Floating Zap Icon for flair */}
                      <div className="absolute right-16 top-1/2 -translate-y-1/2 flex items-center gap-6">
                          <div className="w-12 h-12 rounded-xl bg-yellow-500 flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.6)] animate-pulse">
                               <Zap className="text-black w-6 h-6" />
                          </div>
                      </div>
                  </div>

                  <div className="flex-1 flex p-10 gap-10 min-h-0 relative z-10">
                      {/* Player Profile Card */}
                      <div className="w-[38%] flex flex-col gap-8 animate-slide-in-left">
                          <div className="flex-1 bg-gradient-to-b from-zinc-900 to-black rounded-[48px] overflow-hidden relative border-2 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.3)]">
                              <img src={player?.photoUrl} className="w-full h-full object-cover object-top transition-transform duration-700 hover:scale-110" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                              
                              {/* Floating Category Badge */}
                              <div className="absolute top-8 left-8 bg-yellow-500/90 backdrop-blur text-black px-6 py-2 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl">
                                  {player?.category}
                              </div>

                              <div className="absolute bottom-12 left-12 right-12">
                                  <p className="text-yellow-500 font-bold uppercase tracking-[0.4em] text-xs mb-4">Player Profile</p>
                                  <h2 className="text-7xl font-black uppercase tracking-tight leading-[0.9] mb-8">{player?.name}</h2>
                                  
                                  <div className="grid grid-cols-2 gap-6">
                                      <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10">
                                          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">Speciality</p>
                                          <p className="text-xl font-bold text-white truncate">{player?.speciality || player?.category}</p>
                                      </div>
                                                                            <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10">
                                          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">Base Price</p>
                                          <p className="text-xl font-bold text-yellow-500 font-mono">₹{player ? getEffectiveBasePrice(player, state.categories).toLocaleString() : '0'}</p>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Bidding Area */}
                      <div className="flex-1 flex flex-col gap-10">
                          <div className="flex-1 bg-gradient-to-br from-zinc-900/50 to-black rounded-[48px] border-2 border-yellow-500 relative overflow-hidden flex flex-col items-center justify-center shadow-[0_0_50px_rgba(234,179,8,0.2)]">
                              {/* Animated Background Grid */}
                              <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                              
                              {status === 'SOLD' && (
                                  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl animate-fade-in">
                                      <div className="relative mb-12">
                                          <div className="absolute inset-0 bg-yellow-500 blur-[100px] opacity-30"></div>
                                          <div className="text-yellow-500 font-black text-[14vw] tracking-tighter leading-none animate-bounce-in drop-shadow-[0_0_30px_rgba(234,179,8,0.5)] italic">SOLD</div>
                                      </div>
                                      {bidder && (
                                          <div className="flex flex-col items-center animate-slide-up">
                                              <div className="flex items-center gap-10 bg-white/5 p-10 rounded-[40px] border border-yellow-500/20 shadow-2xl">
                                                  <div className="relative">
                                                      <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 rounded-full"></div>
                                                      {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-28 h-28 object-contain bg-white p-2 rounded-full relative z-10" /> : <div className="w-28 h-28 bg-yellow-600 rounded-full flex items-center justify-center text-4xl font-bold relative z-10">{bidder.name.charAt(0)}</div>}
                                                  </div>
                                                  <div>
                                                      <p className="text-yellow-500 font-bold uppercase tracking-[0.5em] text-xs mb-2">Acquired By</p>
                                                      <h3 className="text-6xl font-black uppercase tracking-tighter">{bidder.name}</h3>
                                                      <p className="text-3xl font-bold text-white/60 mt-2">₹ {bid.toLocaleString()}</p>
                                                  </div>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              )}

                              {status === 'UNSOLD' && (
                                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl animate-fade-in">
                                      <div className="text-red-500 font-black text-[14vw] tracking-tighter leading-none animate-bounce-in italic drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]">UNSOLD</div>
                                  </div>
                              )}

                                <div className="relative z-10 flex flex-col items-center">
                                    <p className="text-yellow-500/40 font-black text-2xl uppercase tracking-[1em] mb-8">{bidder ? 'CURRENT BID' : 'BASE PRICE'}</p>
                                    <div className="text-[22vh] font-black text-white leading-none tabular-nums tracking-tighter drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]">{bid.toLocaleString()}</div>
                                  
                                  {status === 'LIVE' && bidder && (
                                      <div className="mt-12 flex flex-col items-center animate-slide-up">
                                          <div className="flex items-center gap-6 bg-yellow-500 text-black px-12 py-5 rounded-full shadow-[0_20px_40px_rgba(234,179,8,0.3)] transform hover:scale-105 transition-transform">
                                              {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-14 h-14 object-contain bg-white p-1 rounded-full" /> : <div className="w-14 h-14 bg-black/20 rounded-full flex items-center justify-center font-bold text-xl">{bidder.name.charAt(0)}</div>}
                                              <div>
                                                  <p className="text-black/60 text-[10px] font-bold uppercase tracking-widest leading-none mb-1">Leading Bidder</p>
                                                  <p className="text-3xl font-black uppercase tracking-tight leading-none">{bidder.name}</p>
                                              </div>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          </div>

                          {/* Team Purses Ticker */}
                          <div className="h-32 bg-zinc-900/30 backdrop-blur-md rounded-[32px] border border-yellow-500/5 p-4 flex items-center">
                              <div className="shrink-0 px-8 border-r border-yellow-500/10 mr-6">
                                  <p className="text-yellow-500 font-black text-sm uppercase tracking-widest mb-1">Purses</p>
                                  <p className="text-white/40 text-[10px] font-bold uppercase">Remaining</p>
                              </div>
                              <div className="flex-1 overflow-x-auto flex items-center gap-6 custom-scrollbar pb-2">
                                  {state.teams.map(team => (
                                      <div key={team.id} className="min-w-[200px] flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors shrink-0">
                                          {team.logoUrl ? <img src={team.logoUrl} className="w-12 h-12 object-contain bg-white p-1 rounded-xl" /> : <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-xs">{team.name.charAt(0)}</div>}
                                          <div className="min-w-0">
                                              <p className="text-white font-bold text-sm truncate">{team.name}</p>
                                              <p className="text-yellow-500 font-mono font-black text-lg leading-none mt-1">{team.budget.toLocaleString()}</p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {layout === 'NEON' && (
              <div className="h-full w-full bg-black flex flex-col font-sans overflow-hidden relative text-white">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50 pointer-events-none" style={{ backgroundSize: '100% 2px, 3px 100%' }}></div>
                  
                  <div className="flex-1 flex p-8 gap-8 min-h-0 relative z-10">
                      <div className="w-[40%] relative">
                          <div className="absolute inset-0 bg-magenta-500 blur-[100px] opacity-20"></div>
                          <div className="h-full bg-zinc-900 rounded-[2rem] border-2 border-magenta-500/50 overflow-hidden relative shadow-[0_0_40px_rgba(255,0,255,0.2)]">
                              <img src={player?.photoUrl} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                              <div className="absolute bottom-8 left-8 right-8">
                                  <div className="bg-cyan-500 text-black px-4 py-1 rounded-sm font-black text-sm uppercase tracking-widest inline-block mb-4 shadow-[0_0_15px_rgba(6,182,212,0.8)]">
                                      {player?.category}
                                  </div>
                                  <h2 className="text-6xl font-black uppercase italic tracking-tighter leading-none text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] mb-2">{player?.name}</h2>
                                  <p className="text-2xl font-black text-cyan-400 italic tracking-widest uppercase flex items-center gap-2"><Zap className="w-6 h-6"/> {player?.role || player?.speciality}</p>
                              </div>
                          </div>
                      </div>

                      <div className="flex-1 flex flex-col gap-8">
                          <div className="flex-1 bg-black rounded-[2rem] border-2 border-cyan-500/50 relative overflow-hidden flex flex-col items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.2)]">
                              {status === 'SOLD' && (
                                  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
                                      <div className="text-magenta-500 font-black text-[12vw] italic tracking-tighter leading-none animate-bounce-in drop-shadow-[0_0_30px_rgba(255,0,255,0.8)]">SOLD</div>
                                      {bidder && (
                                          <div className="flex items-center gap-6 bg-zinc-900 p-6 rounded-2xl border-2 border-cyan-500 animate-slide-up shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                                              {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-20 h-20 object-contain bg-white p-1 rounded-full" /> : <div className="w-20 h-20 bg-cyan-600 rounded-full flex items-center justify-center text-3xl font-bold">{bidder.name.charAt(0)}</div>}
                                              <div>
                                                  <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">Acquired By</p>
                                                  <h3 className="text-4xl font-black uppercase italic text-white">{bidder.name}</h3>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              )}

                              {status === 'UNSOLD' && (
                                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
                                      <div className="text-red-500 font-black text-[12vw] italic tracking-tighter leading-none animate-bounce-in drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]">UNSOLD</div>
                                  </div>
                              )}

                              <p className="text-cyan-400 font-mono text-xl tracking-[0.8em] mb-4 opacity-50">CURRENT_BID</p>
                              <div className="text-[18vh] font-black text-white leading-none tabular-nums italic tracking-tighter drop-shadow-[0_0_40px_rgba(6,182,212,0.6)]">{bid.toLocaleString()}</div>
                              
                              {status === 'LIVE' && bidder && (
                                  <div className="mt-10 flex items-center gap-6 bg-magenta-500/10 px-10 py-4 rounded-full border-2 border-magenta-500 animate-slide-up shadow-[0_0_20px_rgba(255,0,255,0.3)]">
                                      <div className="w-4 h-4 bg-magenta-500 rounded-full animate-ping"></div>
                                      <span className="text-magenta-500 font-black uppercase tracking-widest text-xl italic">{bidder.name}</span>
                                  </div>
                              )}
                          </div>

                          <div className="h-32 bg-zinc-900 rounded-[2rem] border-2 border-yellow-400/30 p-4 flex items-center gap-6 overflow-hidden shadow-[0_0_20px_rgba(250,204,21,0.1)]">
                              <div className="shrink-0 bg-yellow-400 text-black p-3 rounded-xl font-black italic">PURSES</div>
                              <div className="flex-1 overflow-x-auto flex items-center gap-6 custom-scrollbar">
                                  {state.teams.map(team => (
                                      <div key={team.id} className="min-w-[150px] flex flex-col shrink-0">
                                          <p className="text-white/40 text-[10px] font-bold uppercase truncate">{team.name}</p>
                                          <p className="text-yellow-400 font-mono font-black text-xl">₹{team.budget.toLocaleString()}</p>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {layout === 'FUTURISTIC' && (
              <div className="h-full w-full bg-[#0a0a0f] flex flex-col font-mono overflow-hidden relative text-cyan-400">
                  {/* HUD Elements */}
                  <div className="absolute inset-0 border-[20px] border-cyan-500/5 pointer-events-none z-50"></div>
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
                  
                  <div className="flex-1 flex p-10 gap-10 min-h-0 relative z-10">
                      {/* Player Data Frame */}
                      <div className="w-[42%] flex flex-col gap-6">
                          <div className="flex-1 bg-black rounded-tl-[4rem] rounded-br-[4rem] border-2 border-cyan-500/30 overflow-hidden relative group">
                              <div className="absolute top-0 left-0 w-full h-full bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              <img src={player?.photoUrl} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                              
                              {/* Data Readout Overlay */}
                              <div className="absolute top-6 right-6 text-right">
                                  <div className="text-[8px] text-cyan-500/50 uppercase mb-1">ID_SCAN</div>
                                  <div className="text-xs font-bold text-cyan-400">PX-{player?.id.toString().slice(-6)}</div>
                              </div>

                              <div className="absolute bottom-10 left-10 right-10">
                                  <div className="h-px w-full bg-gradient-to-r from-cyan-500 to-transparent mb-4"></div>
                                  <h2 className="text-6xl font-black uppercase tracking-tighter text-white mb-2">{player?.name}</h2>
                                  <div className="flex gap-4">
                                      <div className="bg-cyan-500/10 px-4 py-1 border border-cyan-500/30 rounded-sm">
                                          <span className="text-[10px] uppercase font-bold text-cyan-400">{player?.category}</span>
                                      </div>
                                      <div className="bg-cyan-500/10 px-4 py-1 border border-cyan-500/30 rounded-sm">
                                          <span className="text-[10px] uppercase font-bold text-cyan-400">{player?.role || player?.speciality}</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-6 h-24">
                              <div className="bg-black border border-cyan-500/20 p-4 rounded-xl flex flex-col justify-center">
                                  <span className="text-[8px] text-cyan-500/50 uppercase mb-1">Base_Valuation</span>
                                  <p className="text-2xl font-black text-white">₹{player ? getEffectiveBasePrice(player, state.categories).toLocaleString() : '0'}</p>
                              </div>
                              <div className="bg-black border border-cyan-500/20 p-4 rounded-xl flex flex-col justify-center">
                                  <span className="text-[8px] text-cyan-500/50 uppercase mb-1">Origin_Node</span>
                                  <p className="text-2xl font-black text-white uppercase">{player?.nationality}</p>
                              </div>
                          </div>
                      </div>

                      {/* Bidding Core */}
                      <div className="flex-1 flex flex-col gap-6">
                          <div className="flex-1 bg-black rounded-tr-[4rem] rounded-bl-[4rem] border-2 border-cyan-500/30 relative overflow-hidden flex flex-col items-center justify-center">
                              {/* Scanline Effect */}
                              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] z-20 pointer-events-none" style={{ backgroundSize: '100% 4px' }}></div>
                              
                              {status === 'SOLD' && (
                                  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl animate-fade-in">
                                      <div className="text-cyan-400 font-black text-[10vw] tracking-widest animate-pulse mb-8 border-y-4 border-cyan-400 px-10 py-2">SOLD_CORE</div>
                                      {bidder && (
                                          <div className="flex items-center gap-8 bg-cyan-500/5 p-8 rounded-2xl border border-cyan-500/40 animate-slide-up">
                                              {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-24 h-24 object-contain bg-white p-1 rounded-sm" /> : <div className="w-24 h-24 bg-cyan-900 flex items-center justify-center text-4xl font-bold">{bidder.name.charAt(0)}</div>}
                                              <div>
                                                  <p className="text-cyan-500/50 text-[10px] font-bold uppercase tracking-widest mb-2">Target_Entity</p>
                                                  <h3 className="text-5xl font-black uppercase text-white">{bidder.name}</h3>
                                                  <p className="text-2xl font-bold text-cyan-400 mt-2">VAL: {bid.toLocaleString()}</p>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              )}

                              {status === 'UNSOLD' && (
                                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-fade-in">
                                      <div className="text-red-500 font-black text-[10vw] tracking-widest animate-pulse border-y-4 border-red-500 px-10 py-2">UNSOLD_ERR</div>
                                  </div>
                              )}

                              <div className="absolute top-10 left-10 flex items-center gap-2">
                                  <div className="w-2 h-2 bg-cyan-500 animate-ping"></div>
                                  <span className="text-[10px] uppercase tracking-widest text-cyan-500/50">Bidding.Active</span>
                              </div>

                              <div className="text-[20vh] font-black text-white leading-none tabular-nums tracking-tighter drop-shadow-[0_0_50px_rgba(6,182,212,0.4)]">{bid.toLocaleString()}</div>
                              
                              {status === 'LIVE' && bidder && (
                                  <div className="mt-12 flex flex-col items-center animate-slide-up">
                                      <div className="text-[10px] text-cyan-500/50 uppercase tracking-[0.5em] mb-4">Leading_Entity</div>
                                      <div className="bg-cyan-500/10 px-12 py-4 border border-cyan-500/50 rounded-sm relative">
                                          <div className="absolute -top-1 -left-1 w-2 h-2 bg-cyan-500"></div>
                                          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-cyan-500"></div>
                                          <span className="text-4xl font-black uppercase text-white tracking-widest">{bidder.name}</span>
                                      </div>
                                  </div>
                              )}
                          </div>

                          {/* Data Stream Ticker */}
                          <div className="h-24 bg-black border border-cyan-500/20 p-4 flex items-center gap-8 overflow-hidden">
                              <div className="shrink-0 text-cyan-500/50 text-[10px] font-bold uppercase tracking-[0.3em] rotate-180" style={{ writingMode: 'vertical-rl' }}>PURSE_DATA</div>
                              <div className="flex-1 overflow-x-auto flex items-center gap-10 custom-scrollbar">
                                  {state.teams.map(team => (
                                      <div key={team.id} className="flex flex-col shrink-0 border-l border-cyan-500/20 pl-4">
                                          <span className="text-[8px] text-cyan-500/30 uppercase mb-1">{team.name}</span>
                                          <span className="text-xl font-black text-white">₹{team.budget.toLocaleString()}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}
          </div>
          <Marquee show={!!state.sponsorConfig?.showHighlights} content={marqueeContent} layout={state.projectorLayout} />
      </div>
  );
};

export default ProjectorScreen;
