
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuction } from '../hooks/useAuction';
import { useParams } from 'react-router-dom';
import { User, Gavel, DollarSign, Trophy } from 'lucide-react';
import { getEffectiveBasePrice } from '../utils';
import { Player, Team, AuctionStatus } from '../types';

interface OverlayState {
    player: Player | null;
    bid: number;
    bidder: Team | null;
    status: 'WAITING' | 'LIVE' | 'SOLD' | 'UNSOLD' | 'FINISHED';
}

const Marquee = React.memo(({ content, show, layout }: { content: string[], show: boolean, layout?: string }) => {
    if (!show || content.length === 0) return null;
    let bgClass = "bg-gradient-to-r from-blue-950/90 via-indigo-950/90 to-blue-950/90";
    let borderClass = "border-t-2 border-cyan-500/50";
    let iconColor = "text-cyan-400";
    
    if (layout === 'ADVAYA') {
        bgClass = "bg-black/95";
        borderClass = "border-t-2 border-yellow-500/50 shadow-[0_-10px_20px_rgba(234,179,8,0.2)]";
        iconColor = "text-yellow-500";
    }
    
    return (
          <div className={`fixed bottom-0 left-0 w-full ${bgClass} backdrop-blur-md text-white py-1.5 overflow-hidden whitespace-nowrap z-50 shadow-2xl ${borderClass}`}>
              <div className="flex animate-marquee w-max will-change-transform">
                  <div className="flex shrink-0 items-center">
                    {content.map((text, i) => (
                        <span key={i} className="mx-12 font-bold text-xl tracking-wider flex items-center uppercase">
                            <span className={`${iconColor} mr-4 text-base opacity-80`}>◆</span> {text}
                        </span>
                    ))}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {content.map((text, i) => (
                        <span key={`dup-${i}`} className="mx-12 font-bold text-xl tracking-wider flex items-center uppercase">
                            <span className={`${iconColor} mr-4 text-base opacity-80`}>◆</span> {text}
                        </span>
                    ))}
                  </div>
              </div>
              <style>{`
                  @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                  .animate-marquee { animation: marquee 35s linear infinite; }
              `}</style>
          </div>
    );
});

const OBSOverlay: React.FC = () => {
  const { state, joinAuction } = useAuction();
  const { id: auctionId } = useParams<{ id: string }>();
  const [display, setDisplay] = useState<OverlayState>({ player: null, bid: 0, bidder: null, status: 'WAITING' });
  const [currentSponsorIndex, setCurrentSponsorIndex] = useState(0);
  const loopInterval = state.sponsorConfig?.loopInterval || 5;
  const sponsorsLength = state.sponsors.length;

  useEffect(() => {
      if (sponsorsLength <= 1) return;
      const interval = setInterval(() => { setCurrentSponsorIndex(prev => (prev + 1) % sponsorsLength); }, loopInterval * 1000);
      return () => clearInterval(interval);
  }, [sponsorsLength, loopInterval]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const marqueeContent = useMemo(() => {
    if (!state.sponsorConfig?.showHighlights) return [];
    const items: string[] = [`WELCOME TO ${state.tournamentName?.toUpperCase() || 'AUCTION'}`];
    const soldPlayers = state.teams.flatMap(t => t.players).sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0));
    if (soldPlayers.length > 0) {
        const topBuy = soldPlayers[0];
        items.push(`RECORD BUY: ${topBuy.name.toUpperCase()} SOLD FOR ${topBuy.soldPrice?.toLocaleString()} TO ${topBuy.soldTo?.toUpperCase()}`);
    }
    const soldLogs = state.auctionLog.filter(l => l.type === 'SOLD').reverse();
    if (soldLogs.length > 0) items.push(`RECENT: ${soldLogs[0].message.toUpperCase()}`);
    const purseLeader = [...state.teams].sort((a,b) => b.budget - a.budget)[0];
    if (purseLeader) items.push(`MAX BUDGET: ${purseLeader.name.toUpperCase()} HAS ${purseLeader.budget.toLocaleString()} REMAINING`);
    if (state.sponsors.length > 0) items.push(`PARTNERS: ${state.sponsors.map(s => s.name.toUpperCase()).join(" | ")}`);
    return items;
  }, [state.sponsorConfig?.showHighlights, state.teams, state.auctionLog, state.tournamentName, state.sponsors]);

  useEffect(() => {
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  useEffect(() => { if (auctionId) joinAuction(auctionId); }, [auctionId]);

  useEffect(() => {
      const { currentPlayerId, players, currentBid, highestBidder, status, teams } = state;
      const currentPlayer = currentPlayerId ? players.find(p => String(p.id) === String(currentPlayerId)) : null;
      if (status === AuctionStatus.Finished) { setDisplay({ player: null, bid: 0, bidder: null, status: 'FINISHED' }); return; }
      if (currentPlayer) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          let derivedStatus: 'LIVE' | 'SOLD' | 'UNSOLD' | 'FINISHED' = 'LIVE';
          if (status === AuctionStatus.Sold || currentPlayer.status === 'SOLD') derivedStatus = 'SOLD';
          else if (status === AuctionStatus.Unsold || currentPlayer.status === 'UNSOLD') derivedStatus = 'UNSOLD';
          let resolvedBidder = highestBidder;
          if (derivedStatus === 'SOLD' && !resolvedBidder && currentPlayer.soldTo) {
             const winningTeam = teams.find(t => t.name === currentPlayer.soldTo);
             if (winningTeam) resolvedBidder = winningTeam;
          }
          const effectiveBase = getEffectiveBasePrice(currentPlayer, state.categories);
          setDisplay({ player: currentPlayer, bid: currentPlayer.soldPrice || currentBid || effectiveBase, bidder: resolvedBidder, status: derivedStatus });
      } else if (display.status !== 'WAITING' && display.status !== 'FINISHED') {
          timeoutRef.current = setTimeout(() => { setDisplay({ player: null, bid: 0, bidder: null, status: 'WAITING' }); }, 2000); 
      }
  }, [state]);

  if (window.location.protocol === 'blob:') return <div className="min-h-screen w-full flex items-center justify-center bg-black/90 p-10"><div className="bg-red-600/20 border border-red-500 text-white p-8 rounded-xl text-center"><h1 className="text-2xl font-bold mb-2">Preview Mode Detected</h1><p>Please deploy the app to use the OBS Overlay.</p></div></div>;

  const SystemLogoFrame = () => (
      <div className="absolute top-6 left-6 h-16 bg-slate-900 rounded-xl border-2 border-yellow-500 p-2 shadow-2xl flex items-center gap-3 z-50 overflow-hidden pr-6">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
          <div className="flex flex-col relative z-10">
              <span className="text-white font-black text-lg tracking-tighter leading-none">SM SPORTS</span>
              <span className="text-yellow-500 text-[6px] font-bold uppercase tracking-[0.2em] mt-0.5 italic text-right">Auction Engine</span>
          </div>
          {state.systemLogoUrl ? (
              <img src={state.systemLogoUrl} className="h-full object-contain relative z-10" alt="Logo" />
          ) : (
              <Trophy className="h-6 w-6 text-yellow-500 opacity-40 shrink-0" />
          )}
      </div>
  );

  const TopCenterLogo = () => (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 h-44 z-50 animate-fade-in">
        {state.systemLogoUrl ? (
            <img src={state.systemLogoUrl} className="h-full object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]" alt="Center Logo" />
        ) : (
            <div className="flex items-center gap-6 bg-black/80 backdrop-blur-2xl px-12 py-5 rounded-3xl border-2 border-white/20 shadow-2xl">
                <Trophy className="w-16 h-16 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                <div className="flex flex-col">
                    <span className="text-white text-4xl font-black italic tracking-tighter leading-none">SM SPORTS</span>
                    <span className="text-yellow-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-1 text-right">Auction Engine</span>
                </div>
            </div>
        )}
    </div>
  );

  const SponsorLogo = () => (
      state.sponsorConfig?.showOnOBS && state.sponsors.length > 0 && (
          <div className="absolute top-6 right-6 w-40 h-24 bg-white/90 backdrop-blur rounded-xl shadow-lg p-2 flex items-center justify-center z-50 border-2 border-white/20 overflow-hidden">
               <img src={state.sponsors[currentSponsorIndex]?.imageUrl} className="max-w-full max-h-full object-contain transition-opacity duration-500" alt="Sponsor" />
          </div>
      )
  );

  if (state.adminViewOverride && state.adminViewOverride.type !== 'NONE') {
      const { type, data } = state.adminViewOverride;
      const OverlayCard = ({ children, title }: any) => (
          <div className="min-h-screen w-full flex flex-col items-center justify-center relative p-12 bg-black/40 backdrop-blur-[2px]">
              <TopCenterLogo />
              <SponsorLogo />
              <div className="bg-gradient-to-br from-[#0f172a]/95 via-[#020617]/95 to-black/95 backdrop-blur-2xl rounded-[2.5rem] border-2 border-cyan-500/40 shadow-[0_0_80px_rgba(6,182,212,0.25)] p-0 w-full max-w-6xl animate-slide-up overflow-hidden relative mt-20">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1e293b_0%,_transparent_100%)] opacity-20"></div>
                  <div className="bg-gradient-to-r from-blue-900/50 via-indigo-900/50 to-blue-900/50 px-10 py-6 border-b-2 border-cyan-500/30 flex items-center justify-center relative">
                      <div className="absolute left-0 top-0 h-full w-3 bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.6)]"></div>
                      <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400 uppercase tracking-[0.2em] drop-shadow-lg text-center italic">{title}</h1>
                  </div>
                  <div className="p-10 max-h-[75vh] overflow-y-auto custom-scrollbar relative z-10">{children}</div>
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
              </div>
              <Marquee show={!!state.sponsorConfig?.showHighlights} content={marqueeContent} layout={state.obsLayout} />
          </div>
      );
      if (type === 'SQUAD' && data?.teamId) {
          const team = state.teams.find(t => String(t.id) === String(data.teamId));
          if (team) return (
            <OverlayCard title={team.name}>
                <div className="flex flex-col gap-8">
                    <div className="flex items-center justify-between bg-white/5 p-6 rounded-3xl border border-white/10">
                        <div className="flex items-center gap-6">
                            {team.logoUrl ? <img src={team.logoUrl} className="w-20 h-20 rounded-2xl bg-white p-1.5 object-contain shadow-xl" /> : <div className="w-20 h-20 bg-cyan-600 rounded-2xl flex items-center justify-center text-4xl font-black text-white">{team.name.charAt(0)}</div>}
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">{team.name}</h3>
                                <p className="text-cyan-400/60 font-black text-[10px] uppercase tracking-widest mt-1">SQUAD ROSTER • {team.players.length} PLAYERS</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Available Purse</p>
                            <p className="text-4xl font-black text-green-400 tabular-nums italic tracking-tighter">₹{team.budget.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {team.players.map((p, i) => (
                            <div key={i} className="bg-slate-800/60 backdrop-blur-sm p-4 rounded-2xl flex items-center gap-4 border border-white/5 hover:border-cyan-500/50 transition-all shadow-xl group">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500 text-black flex items-center justify-center font-black text-sm italic shadow-lg group-hover:rotate-6 transition-transform">#{i+1}</div>
                                <img src={p.photoUrl} className="w-12 h-12 rounded-xl object-cover border border-white/10" alt={p.name} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-white font-black text-sm truncate uppercase tracking-tight italic">{p.name}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest">{p.role || p.speciality}</span>
                                        <span className="text-green-400 font-mono font-black text-xs">₹{p.soldPrice?.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {team.players.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                            <Trophy className="w-16 h-16 text-cyan-500" />
                            <p className="text-xl font-black uppercase tracking-[0.3em] italic">No Signings Recorded</p>
                        </div>
                    )}
                </div>
            </OverlayCard>
          );
      }
      if (type === 'TOP_5') {
          const soldPlayers = state.teams.flatMap(t => t.players.map(p => ({ ...p, soldToTeam: t })))
              .sort((a, b) => (Number(b.soldPrice) || 0) - (Number(a.soldPrice) || 0))
              .slice(0, 5);
          return (
            <OverlayCard title="Top 5 Most Expensive Players">
                <div className="space-y-4">
                    {soldPlayers.map((p, i) => (
                        <div key={i} className="flex justify-between items-center bg-gradient-to-r from-indigo-900/30 to-black/30 p-5 rounded-3xl border-l-[8px] border-cyan-500 hover:scale-[1.02] transition-all shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-cyan-500/5 to-transparent pointer-events-none"></div>
                            <div className="flex items-center gap-8 relative z-10">
                                <div className={`text-5xl font-black italic w-16 text-center ${i === 0 ? 'text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-600'}`}>#{i + 1}</div>
                                <div className="relative">
                                    <div className="absolute inset-[-4px] bg-cyan-500 blur-xl opacity-0 group-hover:opacity-20 transition-opacity"></div>
                                    <img src={p.photoUrl} className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-xl relative z-10"/>
                                </div>
                                <div>
                                    <p className="text-white font-black text-3xl leading-none mb-2 uppercase tracking-tight italic group-hover:text-cyan-400 transition-colors">{p.name}</p>
                                    <p className="text-cyan-400 text-[10px] uppercase font-black tracking-[0.2em] opacity-70">{p.role || p.speciality} • {p.category}</p>
                                </div>
                            </div>
                            <div className="text-right flex items-center gap-10 relative z-10">
                                <div className="hidden md:block">
                                    <p className="text-[8px] text-white/40 uppercase font-black mb-1 text-right">Acquired By</p>
                                    <p className="text-xl font-black text-white uppercase italic tracking-tighter truncate max-w-[150px]">{p.soldToTeam.name}</p>
                                </div>
                                <div className="bg-cyan-500 text-black px-8 py-4 rounded-2xl font-black text-4xl tabular-nums italic tracking-tighter shadow-lg transform group-hover:rotate-2 transition-transform">
                                    ₹{p.soldPrice?.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    ))}
                    {soldPlayers.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30 italic font-black uppercase tracking-widest">
                            <Gavel className="w-16 h-16 text-cyan-500" />
                            <p className="text-2xl">Awaiting Big Purchases...</p>
                        </div>
                    )}
                </div>
            </OverlayCard>
          );
      }
      if (type === 'PURSES') {
          const sortedTeams = [...state.teams].sort((a,b) => b.budget - a.budget);
          return (
            <OverlayCard title="Purse Remaining">
                <div className="grid grid-cols-2 gap-6">
                    {sortedTeams.map((team, i) => (
                        <div key={team.id} className="flex justify-between items-center bg-white/5 p-6 rounded-[1.5rem] border border-white/5 relative overflow-hidden group hover:bg-white/10 transition-all">
                            <div className={`absolute left-0 top-0 h-full w-2 transition-colors ${i === 0 ? 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]'}`}></div>
                            <div className="flex items-center gap-5 pl-4">
                                {team.logoUrl ? <img src={team.logoUrl} className="w-14 h-14 object-contain bg-white rounded-xl p-1 shadow-lg group-hover:scale-110 transition-transform"/> : <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center font-black text-xl text-white italic">{team.name.charAt(0)}</div>}
                                <div>
                                    <span className="text-white font-black text-lg uppercase tracking-tight block truncate max-w-[140px] italic">{team.name}</span>
                                    <span className="text-white/30 text-[8px] font-bold uppercase tracking-widest">{team.teamCode}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] text-zinc-500 font-black uppercase mb-1">Available</p>
                                <span className="text-green-400 font-mono font-black text-3xl tabular-nums italic tracking-tighter group-hover:text-green-300 transition-colors">₹{team.budget.toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </OverlayCard>
          );
      }
      if (type === 'UNSOLD') {
          const unsoldPlayers = state.players.filter(p => p.status === 'UNSOLD');
          return (
            <OverlayCard title="Unsold Player List">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {unsoldPlayers.map((p, i) => (
                        <div key={i} className="bg-slate-900/80 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl group hover:border-red-500/50 transition-all">
                            <div className="h-48 relative overflow-hidden">
                                <img src={p.photoUrl} className="w-full h-full object-cover grayscale transition-transform duration-500 group-hover:scale-110" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                                <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg">UNSOLD</div>
                            </div>
                            <div className="p-5">
                                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter truncate mb-3">{p.name}</h3>
                                <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
                                    <div>
                                        <p className="text-white/30 text-[7px] font-black uppercase mb-0">Base</p>
                                        <p className="text-yellow-500 font-black font-mono text-sm leading-none mt-1">₹{getEffectiveBasePrice(p, state.categories).toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white/30 text-[7px] font-black uppercase mb-0">Role</p>
                                        <p className="text-cyan-400 text-[10px] font-black uppercase leading-none mt-1 italic">{p.role || p.speciality}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {unsoldPlayers.length === 0 && (
                        <div className="col-span-full py-20 text-center opacity-30 italic font-black uppercase tracking-widest">
                            <p className="text-2xl">No Players Left Unsold</p>
                        </div>
                    )}
                </div>
            </OverlayCard>
          );
      }
  }

  if (display.status === 'FINISHED') return <div className="min-h-screen w-full flex flex-col items-center justify-center relative"><TopCenterLogo /><SponsorLogo /><div className="bg-green-900/90 text-white px-16 py-8 rounded-3xl border-4 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.5)] animate-bounce-in text-center"><h1 className="text-4xl md:text-6xl font-black tracking-widest uppercase text-green-400 mb-2">AUCTION</h1><h1 className="text-4xl md:text-6xl font-black tracking-widest uppercase text-white">COMPLETED</h1></div><Marquee show={!!state.sponsorConfig?.showHighlights} content={marqueeContent} layout={state.obsLayout} /></div>;

  if (display.status === 'WAITING' || !display.player) return <div className="min-h-screen w-full flex flex-col items-center justify-end pb-20 relative"><TopCenterLogo /><SponsorLogo /><div className="bg-slate-900/90 text-white px-12 py-4 rounded-full border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-pulse mb-10"><h1 className="text-2xl font-bold tracking-[0.5em] uppercase text-cyan-400">{state.status === AuctionStatus.NotStarted ? "AUCTION STARTING SOON" : "WAITING FOR AUCTION"}</h1></div><Marquee show={!!state.sponsorConfig?.showHighlights} content={marqueeContent} layout={state.obsLayout} /></div>;

  const { player, bid, bidder, status } = display;
  const layout = state.obsLayout || 'STANDARD';

  if (!state.status && !state.tournamentName) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-transparent text-white font-black uppercase tracking-widest">
              <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-black/50 backdrop-blur-md border border-white/10">
                  <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm animate-pulse">Initializing Overlay...</p>
              </div>
          </div>
      );
  }

  return (
    <>
        <TopCenterLogo />
        <SponsorLogo />
        {layout === 'STANDARD' && (
            <div className="min-h-screen w-full relative font-sans overflow-hidden">
                {status === 'SOLD' && bidder && (
                    <div className="min-h-screen w-full relative font-sans p-10 flex items-center justify-end animate-slide-in-right">
                         <div className="w-[420px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 relative mr-10 mt-20">
                              <div className="bg-indigo-900 p-4 text-center border-b border-white/10"><h2 className="text-2xl font-black text-white uppercase tracking-wider leading-none">{player.name}</h2><p className="text-indigo-300 text-xs font-bold uppercase tracking-[0.2em] mt-1">{player.category}</p></div>
                              <div className="h-[360px] w-full bg-gray-800 relative overflow-hidden"><img src={player.photoUrl} className="w-full h-full object-cover object-top" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div></div>
                              <div className="bg-green-600 h-24 flex items-center px-6 relative overflow-visible"><div className="flex flex-col z-10"><div className="flex items-center gap-2 mb-0"><span className="text-green-900/80 font-black text-lg italic uppercase bg-white/20 px-2 rounded leading-none">SOLD</span><span className="text-green-100 text-[10px] font-bold uppercase tracking-widest">To {bidder.name}</span></div><p className="text-6xl font-black text-white drop-shadow-md tracking-tighter leading-none mt-1">{bid.toLocaleString()}</p></div><div className="absolute -top-8 right-6 w-32 h-32 bg-white rounded-full p-2 shadow-2xl border-4 border-green-600 flex items-center justify-center overflow-hidden z-20">{bidder.logoUrl ? <img src={bidder.logoUrl} className="w-full h-full object-contain p-1" /> : <div className="w-full h-full flex items-center justify-center font-bold text-3xl text-gray-400">{bidder.name.charAt(0)}</div>}</div></div>
                         </div>
                    </div>
                )}
                {status !== 'SOLD' && (
                    <div className="absolute bottom-16 w-full px-2 md:px-6 flex items-end justify-between gap-4 animate-slide-up">
                        <div className="flex-1 flex flex-col items-end mr-2 min-w-0"><div className="w-full bg-gradient-to-r from-blue-900 via-indigo-900 to-indigo-800 text-white py-4 px-6 rounded-l-lg border-l-8 border-cyan-400 shadow-2xl transform skew-x-[-12deg] origin-bottom-right flex items-center justify-end"><div className="transform skew-x-[12deg] text-right truncate w-full"><h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight truncate drop-shadow-md leading-tight">{player?.name}</h1></div></div><div className="flex gap-2 mt-[-4px] mr-8 transform skew-x-[-12deg] z-10"><div className="bg-cyan-500 text-black py-1.5 px-6 rounded-b shadow-lg border-b-2 border-white"><div className="transform skew-x-[12deg] text-center font-extrabold text-sm uppercase tracking-widest">{player?.category}</div></div><div className="bg-white text-blue-900 py-1.5 px-6 rounded-b shadow-lg border-b-2 border-cyan-500"><div className="transform skew-x-[12deg] text-center font-extrabold text-sm uppercase tracking-widest">{player?.role || player?.speciality || player?.category}</div></div></div></div>
                        <div className="shrink-0 flex flex-col items-center relative z-20 -mb-4 mx-2"><div className="w-56 h-56 rounded-full border-[6px] border-white bg-slate-200 shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden relative z-10 bg-gradient-to-b from-gray-100 to-gray-300"><img src={player?.photoUrl} alt={player?.name} className="w-full h-full object-cover object-top" />{status === 'UNSOLD' && <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"><span className="font-black text-3xl uppercase -rotate-12 border-4 px-3 py-1 tracking-wider shadow-xl text-red-500 border-red-500">UNSOLD</span></div>}</div><div className="relative z-30 -mt-12"><div className="flex items-stretch shadow-2xl rounded-full overflow-hidden border-4 border-white min-w-[280px] transform hover:scale-105 transition-transform"><div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-center border-r border-gray-700"><span className="text-xs font-bold uppercase tracking-widest text-cyan-400">{bidder ? 'Current Bid' : 'Base Price'}</span></div><div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-2 flex items-center justify-center flex-grow"><span className={`text-5xl font-black text-white leading-none tabular-nums drop-shadow-sm ${!bidder ? 'animate-pulse text-cyan-200' : ''}`}>{bid.toLocaleString()}</span></div></div></div></div>
                        <div className="flex-1 flex flex-col items-start ml-2 relative min-w-0"><div className="w-full bg-gradient-to-l from-blue-900 via-indigo-900 to-indigo-800 text-white py-4 px-6 rounded-r-lg border-r-8 border-cyan-400 shadow-2xl transform skew-x-[12deg] origin-bottom-left flex items-center relative h-[88px] z-20"><div className="transform skew-x-[-12deg] w-full pl-4 pr-32"><h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight truncate drop-shadow-md leading-tight text-left">{bidder ? bidder.name : "NO BIDS YET"}</h2></div></div><div className="bg-white text-indigo-900 py-1.5 px-8 rounded-b-lg shadow-lg mt-[-4px] ml-8 transform skew-x-[12deg] border-b-2 border-cyan-500 z-10 min-w-[220px]"><div className="transform skew-x-[-12deg] flex items-center gap-3"><span className="font-bold text-sm uppercase text-gray-500">Balance:</span><span className="font-extrabold text-2xl">{bidder ? bidder.budget.toLocaleString() : "-"}</span></div></div><div className="absolute bottom-6 right-8 z-30"><div className="w-28 h-28 bg-white rounded-full shadow-2xl border-4 border-cyan-400 p-2 flex items-center justify-center transform hover:scale-105 transition-transform overflow-hidden">{bidder?.logoUrl ? <img src={bidder.logoUrl} className="w-full h-full object-contain" /> : <span className="text-4xl font-bold text-gray-300">?</span>}</div></div></div>
                    </div>
                )}
            </div>
        )}
        {layout === 'MINIMAL' && <div className="min-h-screen w-full relative"><div className="absolute bottom-12 left-0 right-0 flex justify-center"><div className="bg-gradient-to-r from-indigo-900 to-blue-900 backdrop-blur-md rounded-full px-6 py-2 flex items-center gap-6 border-2 border-cyan-500 shadow-xl"><div className="flex items-center gap-3"><img src={player?.photoUrl} className="w-12 h-12 rounded-full border-2 border-white object-cover" /><div><h1 className="text-white font-bold text-lg leading-none">{player?.name}</h1><span className="text-xs text-cyan-400 uppercase font-bold">{player?.category}</span></div></div><div className="w-px h-8 bg-white/20"></div><div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-400" /><span className="text-3xl font-black text-white tabular-nums">{bid.toLocaleString()}</span></div>{bidder && (<><div className="w-px h-8 bg-white/20"></div><div className="flex items-center gap-2">{bidder.logoUrl && <img src={bidder.logoUrl} className="w-8 h-8 object-contain bg-white rounded-full p-0.5" />}<span className="text-white font-bold">{bidder.name}</span></div></>)}{status !== 'LIVE' && (<div className={`px-3 py-1 rounded-full font-bold text-xs ${status === 'SOLD' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{status}</div>)}</div></div></div>}
        {layout === 'VERTICAL' && <div className="min-h-screen w-full relative"><div className="absolute top-0 right-0 h-full w-[300px] bg-gradient-to-b from-indigo-900 to-slate-900 border-l-4 border-cyan-500 flex flex-col p-6 shadow-2xl"><div className="bg-white/10 rounded-full p-2 mb-4 flex justify-center mx-auto w-36 h-36 border-4 border-cyan-500 relative"><img src={player?.photoUrl} className="w-full h-full rounded-full object-cover" /></div><h1 className="text-white text-2xl font-black text-center mb-1 leading-tight">{player?.name}</h1><p className="text-cyan-400 text-center text-sm font-bold uppercase mb-6 tracking-widest">{player?.role || player?.speciality || player?.category}</p><div className="bg-white/10 p-4 rounded-xl text-center mb-6 border border-white/20"><p className="text-gray-300 text-xs uppercase mb-1 font-bold">Current Bid</p><p className="text-4xl font-black text-white">{bid.toLocaleString()}</p></div>{bidder ? (<div className="bg-indigo-800 p-4 rounded-xl border border-indigo-600"><p className="text-xs text-gray-300 uppercase mb-2 font-bold">Highest Bidder</p><div className="flex items-center gap-3">{bidder.logoUrl ? <img src={bidder.logoUrl} className="w-10 h-10 rounded-full bg-white p-0.5"/> : <div className="w-10 h-10 bg-gray-600 rounded-full"/>}<p className="font-bold text-white leading-tight">{bidder.name}</p></div></div>) : (<div className="text-center text-gray-500 italic mt-4">Waiting for bids...</div>)}<div className="mt-auto">{status === 'SOLD' && <div className="bg-green-600 text-white text-center py-2 font-black text-xl rounded uppercase animate-pulse shadow-lg">SOLD</div>}{status === 'UNSOLD' && <div className="bg-red-600 text-white text-center py-2 font-black text-xl rounded uppercase shadow-lg">UNSOLD</div>}</div></div></div>}
        
        {layout === 'ADVAYA' && (
            <div className="min-h-screen w-full relative font-sans overflow-hidden">
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 animate-slide-up">
                    {/* Player Info - Thinner version */}
                    <div className="flex-1 bg-black/95 backdrop-blur-xl rounded-xl border border-yellow-500/50 p-1.5 px-3 flex items-center gap-3 shadow-2xl relative overflow-hidden h-16">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-yellow-500/30 shrink-0">
                            <img src={player?.photoUrl} className="w-full h-full object-cover object-top" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-black uppercase tracking-tight text-white truncate leading-none">{player?.name}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="bg-yellow-500 text-black px-1 py-0 rounded-[2px] text-[7px] font-black uppercase tracking-[0.1em] leading-none">
                                    {player?.category}
                                </span>
                                <span className="text-yellow-500/80 font-bold uppercase tracking-widest text-[7px] leading-none">{player?.role || player?.speciality || player?.category}</span>
                            </div>
                        </div>
                    </div>

                    {/* Bidding Info - Thinner version */}
                    <div className="w-[320px] flex flex-col gap-1">
                        <div className="bg-yellow-500 rounded-xl p-1.5 px-4 flex items-center justify-between shadow-xl relative overflow-hidden border border-yellow-400 h-14">
                            <div className="relative z-10">
                                <p className="text-black/70 text-[7px] font-black uppercase tracking-widest mb-0">{bidder ? 'Current Bid' : 'Base Price'}</p>
                                <p className={`text-3xl font-black text-black tabular-nums leading-none tracking-tighter italic ${!bidder ? 'animate-pulse' : ''}`}>{bid.toLocaleString()}</p>
                            </div>
                            <div className="text-right relative z-10">
                                {status === 'SOLD' ? (
                                    <span className="bg-black text-yellow-500 px-2 py-0.5 rounded-lg font-black text-sm italic uppercase tracking-widest animate-pulse">SOLD</span>
                                ) : status === 'UNSOLD' ? (
                                    <span className="bg-red-600 text-white px-2 py-0.5 rounded-lg font-black text-sm italic uppercase tracking-widest">UNSOLD</span>
                                ) : (
                                    <div className="flex flex-col items-end">
                                        <span className="text-black/50 text-[7px] font-bold uppercase tracking-widest leading-none">Min</span>
                                        <span className="text-black font-bold text-base font-mono leading-none">₹{player ? getEffectiveBasePrice(player, state.categories).toLocaleString() : '0'}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {bidder && (
                            <div className="bg-black/90 backdrop-blur-md rounded-lg p-1 px-3 flex items-center justify-between border border-yellow-500/30 shadow-lg h-8">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
                                    <span className="text-white text-[10px] font-black uppercase italic tracking-tight truncate max-w-[120px]">{bidder.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-yellow-500 font-mono font-bold text-[10px]">{bidder.budget.toLocaleString()}</span>
                                    {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-5 h-5 object-contain bg-white p-0.5 rounded-full" /> : <div className="w-5 h-5 bg-zinc-800 rounded-full flex items-center justify-center font-bold text-[7px] text-white">{bidder.name.charAt(0)}</div>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
        <Marquee show={!!state.sponsorConfig?.showHighlights} content={marqueeContent} layout={state.obsLayout} />
    </>
  );
};

export default OBSOverlay;
