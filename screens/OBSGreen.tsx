
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuction } from '../hooks/useAuction';
import { useParams } from 'react-router-dom';
import { Globe, User, TrendingUp, Wallet, Trophy, Star, AlertTriangle, Users } from 'lucide-react';
import { Team, Player, AuctionStatus, ProjectorLayout } from '../types';

interface DisplayState {
    player: Player | null;
    bid: number;
    bidder: Team | null;
    status: 'WAITING' | 'LIVE' | 'SOLD' | 'UNSOLD' | 'FINISHED';
}

const Marquee = React.memo(({ content, show, layout }: { content: string[], show: boolean, layout?: ProjectorLayout }) => {
    if (!show || content.length === 0) return null;
    let bgClass = "bg-black";
    if (layout === 'IPL') bgClass = "bg-slate-900";
    if (layout === 'MODERN') bgClass = "bg-zinc-950";
    if (layout === 'STANDARD') bgClass = "bg-gray-800";
    return (
          <div className={`fixed bottom-0 left-0 w-full ${bgClass} text-white py-2 overflow-hidden whitespace-nowrap z-50 shadow-2xl border-t-4 border-highlight`}>
              <div className="flex animate-marquee w-max will-change-transform">
                  <div className="flex shrink-0 items-center">
                    {content.map((text, i) => (
                        <span key={i} className="mx-8 font-bold text-2xl tracking-wide flex items-center uppercase">
                            <span className="text-highlight mr-3 text-xl">★</span> {text}
                        </span>
                    ))}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {content.map((text, i) => (
                        <span key={`dup-${i}`} className="mx-8 font-bold text-2xl tracking-wide flex items-center uppercase">
                            <span className="text-highlight mr-3 text-xl">★</span> {text}
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
  const { auctionId } = useParams<{ auctionId: string }>();
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
          setDisplay({ player: currentPlayer, bid: currentPlayer.soldPrice || currentBid || currentPlayer.basePrice, bidder: resolvedBidder, status: derivedStatus });
      } else if (display.status !== 'WAITING' && display.status !== 'FINISHED') {
          timeoutRef.current = setTimeout(() => { setDisplay({ player: null, bid: 0, bidder: null, status: 'WAITING' }); }, 2000); 
      }
  }, [state]);

  const SystemLogoFrame = () => (
      <div className="absolute top-4 left-4 w-40 h-40 bg-white rounded-3xl border-4 border-highlight p-3 shadow-2xl flex items-center justify-center z-50 overflow-hidden">
          {state.systemLogoUrl ? (
              <img src={state.systemLogoUrl} className="max-w-full max-h-full object-contain" alt="Logo" />
          ) : (
              <Trophy className="w-full h-full text-highlight opacity-20" />
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

  if (state.adminViewOverride && state.adminViewOverride.type !== 'NONE') {
      const { type, data } = state.adminViewOverride;
      const RenderOverrideContainer = ({ children, title }: any) => (
          <div className="h-screen w-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1e293b] via-[#0f172a] to-black text-white flex flex-col p-8 relative overflow-hidden font-sans">
              <SystemLogoFrame />
              <SponsorLoop />
              <div className="mt-20 mb-6 text-center z-10"><h1 className="text-5xl lg:text-7xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-xl filter">{title}</h1><div className="h-1 w-64 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mt-4 rounded-full"></div></div>
              <div className="flex-1 overflow-hidden z-10 w-full max-w-7xl mx-auto bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl relative">{children}</div>
          </div>
      );
      if (type === 'SQUAD' && data?.teamId) {
          const team = state.teams.find(t => String(t.id) === String(data.teamId));
          if (team) return <RenderOverrideContainer title={`Squad: ${team.name}`}><div className="h-full flex flex-col"><div className="flex items-center gap-8 mb-6 pb-6 border-b border-white/10 bg-gradient-to-r from-blue-900/40 to-transparent p-6 rounded-2xl border border-blue-500/20"><div className="relative"><div className="absolute inset-0 bg-blue-500 blur-2xl opacity-30 rounded-full"></div>{team.logoUrl ? <img src={team.logoUrl} className="w-32 h-32 rounded-full bg-white p-2 object-contain relative z-10 shadow-2xl"/> : <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center text-5xl font-bold relative z-10 border-4 border-white/20">{team.name.charAt(0)}</div>}</div><div><div className="grid grid-cols-2 gap-x-12 gap-y-4 text-xl"><div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700"><p className="text-slate-400 text-sm uppercase font-bold tracking-wider mb-1">Total Players</p><span className="text-4xl font-black text-white">{team.players.length}</span></div><div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700"><p className="text-slate-400 text-sm uppercase font-bold tracking-wider mb-1">Remaining Purse</p><span className="text-4xl font-black text-green-400">{team.budget.toLocaleString()}</span></div></div></div></div><div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2 custom-scrollbar">{team.players.map((p, i) => (<div key={i} className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-xl flex items-center gap-4 border border-white/5 hover:border-blue-500/50 transition-all hover:scale-[1.02] shadow-lg"><div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-500 to-yellow-300 text-black flex items-center justify-center font-black text-sm shadow-lg">#{i+1}</div><div className="min-w-0"><p className="font-bold text-lg text-white truncate">{p.name}</p><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"><span className="text-blue-400">{p.category}</span><span className="text-gray-600">•</span><span className="text-green-400">{p.soldPrice?.toLocaleString()}</span></div></div></div>))}</div></div></RenderOverrideContainer>;
      }
      if (type === 'PURSES') {
          const sortedTeams = [...state.teams].sort((a,b) => b.budget - a.budget);
          return <RenderOverrideContainer title="Team Purse Standings"><div className="h-full overflow-y-auto p-4 custom-scrollbar"><div className="grid grid-cols-1 gap-4">{sortedTeams.map((team, i) => (<div key={team.id} className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-2xl border border-white/5 hover:border-green-500/50 transition-all hover:translate-x-2"><div className="flex items-center gap-6"><span className={`text-4xl font-black w-12 text-center ${i < 3 ? 'text-yellow-400 drop-shadow' : 'text-slate-600'}`}>#{i+1}</span>{team.logoUrl ? <img src={team.logoUrl} className="w-16 h-16 rounded-full bg-white p-1 object-contain shadow-lg"/> : <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center font-bold text-2xl">{team.name.charAt(0)}</div>}<div><h3 className="text-3xl font-black text-white">{team.name}</h3><p className="text-sm text-slate-400 font-bold uppercase tracking-wider">{team.players.length} Players Signed</p></div></div><div className="text-right bg-black/20 px-6 py-2 rounded-xl border border-white/5"><p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Available Funds</p><p className="text-5xl font-black text-green-400 tabular-nums tracking-tight">{team.budget.toLocaleString()}</p></div></div>))}</div></div></RenderOverrideContainer>;
      }
  }

  if (display.status === 'FINISHED') return <div className="h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-between p-8 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black font-sans"><div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div><SystemLogoFrame /><div className="z-10 text-center mt-6 animate-slide-up"><h1 className="text-5xl lg:text-7xl font-black text-yellow-400 tracking-widest uppercase drop-shadow-[0_0_25px_rgba(250,204,21,0.6)]">AUCTION COMPLETED</h1><div className="h-2 w-48 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mt-6 rounded-full"></div></div><div className="z-10 mb-8 text-center animate-pulse"><p className="text-xl lg:text-3xl text-gray-500 uppercase tracking-[0.6em] font-light">Thank You For Watching</p></div><Marquee show={!!(state.sponsorConfig?.showOnProjector && state.sponsors.length > 0)} content={marqueeContent} layout={state.projectorLayout} /></div>;

  if (display.status === 'WAITING' || !display.player) return <div className={`h-screen w-full flex flex-col items-center justify-center p-10 relative overflow-hidden ${state.projectorLayout === 'IPL' ? 'bg-slate-900' : 'bg-gray-100'}`}><SystemLogoFrame /><SponsorLoop /><div className={`p-12 rounded-3xl shadow-xl text-center border ${state.projectorLayout === 'IPL' ? 'bg-slate-800 border-yellow-500/30' : 'bg-white border-gray-200'}`}><h1 className={`text-5xl font-bold tracking-wider mb-4 ${state.projectorLayout === 'IPL' ? 'text-yellow-400' : 'text-gray-800'}`}>{state.status === AuctionStatus.NotStarted ? "AUCTION STARTING SOON" : "WAITING FOR AUCTIONEER"}</h1><p className={`${state.projectorLayout === 'IPL' ? 'text-slate-400' : 'text-gray-500'} text-xl animate-pulse`}>The next player will appear shortly...</p></div><Marquee show={!!(state.sponsorConfig?.showOnProjector && state.sponsors.length > 0)} content={marqueeContent} layout={state.projectorLayout} /></div>;

  const { player, bid, bidder, status } = display;
  const layout = state.projectorLayout || 'STANDARD';

  return (
      <div className="h-screen w-full relative">
          <SystemLogoFrame />
          <SponsorLoop />
          {layout === 'STANDARD' && (
              <div className="h-screen w-full bg-gray-100 flex flex-col font-sans overflow-hidden relative">
                <div className="h-24 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-8 z-50 shrink-0 relative pl-48"><h1 className="text-3xl md:text-5xl font-black text-gray-800 uppercase tracking-widest drop-shadow-sm truncate">{state.tournamentName || "AUCTION 2025"}</h1></div>
                <div className="flex-1 flex gap-4 p-4 pb-16 min-h-0 relative z-10 items-center justify-center"><div className="w-[30%] bg-white rounded-3xl shadow-2xl overflow-hidden relative border-4 border-white flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 h-[65vh]"><img src={player?.photoUrl} alt={player?.name} className="w-full h-full object-cover object-top" /><div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-lg shadow-lg border border-gray-200"><span className="font-bold text-xl text-gray-800 uppercase tracking-wide">{player?.category}</span></div></div><div className="flex-1 flex flex-col gap-4 min-h-0 h-[65vh]"><div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex justify-between items-start shrink-0"><div><div className="flex items-center gap-2 mb-2 text-gray-500 font-bold tracking-widest uppercase text-sm"><Globe className="w-4 h-4" /> {player?.nationality}</div><h1 className="text-6xl lg:text-7xl font-black text-gray-900 leading-none mb-2 truncate max-w-[50vw]">{player?.name}</h1><p className="text-2xl text-highlight font-bold flex items-center mt-2"><User className="w-6 h-6 mr-2"/> {player?.speciality || player?.category}</p></div><div className="text-right whitespace-nowrap bg-gray-50 p-4 rounded-xl border border-gray-200"><p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Base Price</p><p className="text-4xl font-bold text-gray-700 font-mono">{player?.basePrice}</p></div></div><div className="flex-1 bg-gray-900 rounded-3xl p-4 shadow-2xl relative overflow-hidden flex flex-col justify-center items-center border-4 border-gray-800">{status === 'SOLD' && <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"><div className="flex flex-col items-center"><div className="bg-green-600 text-white font-black text-7xl lg:text-8xl px-12 py-4 border-8 border-white -rotate-12 shadow-[0_0_50px_rgba(22,163,74,0.6)] animate-bounce-in tracking-widest uppercase mb-8">SOLD</div>{bidder && <div className="bg-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-up"><div className="text-right"><p className="text-xs text-gray-400 font-bold uppercase">Sold To</p><p className="text-3xl font-black text-gray-800">{bidder.name}</p></div>{bidder.logoUrl ? <img src={bidder.logoUrl} className="w-16 h-16 rounded-full border border-gray-200 object-contain" /> : <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center font-bold text-xl">{bidder.name.charAt(0)}</div>}</div>}</div></div>}{status === 'UNSOLD' && <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-red-600 text-white font-black text-8xl px-12 py-4 border-8 border-white -rotate-12 shadow-[0_0_50px_rgba(220,38,38,0.6)] animate-bounce-in tracking-widest uppercase">UNSOLD</div></div>}<p className="text-highlight font-bold text-lg lg:text-xl uppercase tracking-[0.5em] mb-4 relative z-10">Current Bid Amount</p><div className="text-[12vh] lg:text-[18vh] leading-none font-black text-white tabular-nums drop-shadow-2xl relative z-10">{bid.toLocaleString()}</div>{status === 'LIVE' && bidder && (<div className="mt-6 bg-gray-800 px-8 py-3 rounded-full flex items-center gap-6 border border-gray-700 relative z-10 shadow-lg"><div className="text-right"><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Highest Bidder</p><p className="text-2xl font-bold text-white">{bidder.name}</p></div>{bidder.logoUrl ? <img src={bidder.logoUrl} className="w-12 h-12 rounded-full bg-white p-0.5" /> : <div className="w-12 h-12 bg-gray-600 rounded-full" />}</div>)}</div></div></div>
                <div className="mt-auto flex gap-4 h-[15vh] relative z-20 bg-gray-100 shrink-0 p-4 pt-0"><div className="w-1/3 bg-white rounded-3xl shadow-lg border border-gray-200 p-4 flex flex-col justify-center relative overflow-hidden"><div className="absolute top-0 left-0 w-2 h-full bg-highlight"></div><h3 className="text-gray-400 font-bold uppercase text-xs tracking-widest mb-1 flex items-center"><TrendingUp className="w-3 h-3 mr-1"/> Recent Activity</h3><div className="text-xl lg:text-2xl font-bold text-gray-800 leading-snug truncate">{latestLog || "Auction in progress..."}</div></div><div className="flex-1 bg-gray-900 rounded-3xl shadow-lg border border-gray-800 p-4 overflow-hidden flex flex-col"><h3 className="text-gray-400 font-bold uppercase text-xs tracking-widest mb-2 flex items-center"><Wallet className="w-3 h-3 mr-1"/> Team Purses Remaining</h3><div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center gap-3 custom-scrollbar">{state.teams.map(team => (<div key={team.id} className="min-w-[140px] bg-gray-800 p-2 rounded-xl border border-gray-700 flex flex-col items-center text-center shrink-0">{team.logoUrl ? <img src={team.logoUrl} className="w-6 h-6 rounded-full mb-1 bg-white p-0.5 object-contain" /> : <div className="w-6 h-6 rounded-full bg-gray-600 mb-1 flex items-center justify-center text-white font-bold text-xs">{team.name.charAt(0)}</div>}<h4 className="text-white font-bold text-xs truncate w-full">{team.name}</h4><p className="text-green-400 font-mono font-bold text-sm">{team.budget}</p></div>))}</div></div></div>
              </div>
          )}

          {layout === 'IPL' && (
              <div className="h-screen w-full bg-slate-950 flex flex-col font-sans overflow-hidden relative text-white">
                  <div className="h-24 bg-slate-900 border-b border-yellow-500/30 flex items-center justify-between px-12 z-50 relative pl-48">
                      <h1 className="text-4xl font-black uppercase tracking-[0.2em] text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">{state.tournamentName || "IPL AUCTION"}</h1>
                      <div className="flex items-center gap-4 bg-black/40 px-6 py-2 rounded-full border border-white/10">
                          <span className="text-yellow-500 font-bold animate-pulse">● LIVE</span>
                          <span className="text-gray-400">|</span>
                          <span className="font-bold uppercase tracking-widest text-sm">{state.sport || "CRICKET"}</span>
                      </div>
                  </div>

                  <div className="flex-1 flex p-6 gap-6 min-h-0 relative z-10">
                      <div className="w-[35%] flex flex-col gap-6">
                          <div className="flex-1 bg-slate-900 rounded-2xl border-2 border-yellow-500/20 overflow-hidden relative shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                              <img src={player?.photoUrl} className="w-full h-full object-cover object-top" />
                              <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-6">
                                  <div className="bg-yellow-500 text-black px-4 py-1 rounded font-black text-lg uppercase tracking-widest inline-block mb-2">{player?.category}</div>
                                  <h2 className="text-5xl font-black uppercase tracking-tight leading-none">{player?.name}</h2>
                              </div>
                          </div>
                          <div className="bg-slate-900 p-6 rounded-2xl border border-white/10 flex justify-between items-center">
                              <div>
                                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Base Price</p>
                                  <p className="text-3xl font-black text-yellow-500">{player?.basePrice.toLocaleString()}</p>
                              </div>
                              <div className="text-right">
                                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Nationality</p>
                                  <p className="text-xl font-bold uppercase">{player?.nationality}</p>
                              </div>
                          </div>
                      </div>

                      <div className="flex-1 flex flex-col gap-6">
                          <div className="flex-1 bg-slate-900 rounded-3xl border-2 border-yellow-500/20 relative overflow-hidden flex flex-col items-center justify-center shadow-2xl">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50"></div>
                              
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
                              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center"><Wallet className="w-4 h-4 mr-2 text-yellow-500"/> Team Purses</p>
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
              <div className="h-screen w-full bg-black flex flex-col font-sans overflow-hidden relative text-white">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(20,20,20,1)_0%,_rgba(0,0,0,1)_100%)]"></div>
                  
                  <div className="h-20 flex items-center justify-between px-12 z-50 relative">
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-highlight rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(56,178,172,0.5)]">
                              <Trophy className="text-black w-6 h-6" />
                          </div>
                          <h1 className="text-3xl font-black uppercase tracking-tighter italic">{state.tournamentName || "AUCTION"}</h1>
                      </div>
                      <div className="text-highlight font-mono text-xl tracking-widest">LIVE AUCTION // 2025</div>
                  </div>

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
                                      <p className="text-xl font-bold uppercase">{player?.speciality || player?.category}</p>
                                  </div>
                                  <div>
                                      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">Base</p>
                                      <p className="text-xl font-bold font-mono">₹{player?.basePrice.toLocaleString()}</p>
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
                  <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-teal-900/20 to-transparent pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 w-1/2 h-full bg-gradient-to-r from-purple-900/10 to-transparent pointer-events-none"></div>
                  
                  {/* Header */}
                  <div className="h-28 flex items-center justify-between px-16 z-50 relative border-b border-white/5 backdrop-blur-sm">
                      <div className="flex items-center gap-8">
                          <div className="relative">
                              <div className="absolute inset-0 bg-teal-500 blur-xl opacity-20 rounded-full"></div>
                              <h1 className="text-5xl font-black uppercase tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-200 to-teal-500">ADVAYA</h1>
                          </div>
                          <div className="h-10 w-px bg-white/10"></div>
                          <h2 className="text-2xl font-bold text-white/60 uppercase tracking-[0.3em]">{state.tournamentName || "AUCTION 2025"}</h2>
                      </div>
                      <div className="flex items-center gap-6">
                          <div className="flex flex-col items-end">
                              <span className="text-teal-400 font-mono text-sm tracking-widest">AUCTION_LIVE</span>
                              <span className="text-white/40 text-xs font-bold uppercase">Session 01</span>
                          </div>
                          <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center shadow-[0_0_20px_rgba(20,184,166,0.4)]">
                              <Zap className="text-black w-6 h-6" />
                          </div>
                      </div>
                  </div>

                  <div className="flex-1 flex p-10 gap-10 min-h-0 relative z-10">
                      {/* Player Profile Card */}
                      <div className="w-[38%] flex flex-col gap-8 animate-slide-in-left">
                          <div className="flex-1 bg-gradient-to-b from-zinc-900 to-black rounded-[48px] overflow-hidden relative border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.8)]">
                              <img src={player?.photoUrl} className="w-full h-full object-cover object-top transition-transform duration-700 hover:scale-110" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                              
                              {/* Floating Category Badge */}
                              <div className="absolute top-8 left-8 bg-teal-500/90 backdrop-blur text-black px-6 py-2 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl">
                                  {player?.category}
                              </div>

                              <div className="absolute bottom-12 left-12 right-12">
                                  <p className="text-teal-400 font-bold uppercase tracking-[0.4em] text-xs mb-4">Player Profile</p>
                                  <h2 className="text-7xl font-black uppercase tracking-tight leading-[0.9] mb-8">{player?.name}</h2>
                                  
                                  <div className="grid grid-cols-2 gap-6">
                                      <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10">
                                          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">Speciality</p>
                                          <p className="text-xl font-bold text-white truncate">{player?.speciality || player?.category}</p>
                                      </div>
                                      <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10">
                                          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">Base Price</p>
                                          <p className="text-xl font-bold text-teal-400 font-mono">₹{player?.basePrice.toLocaleString()}</p>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Bidding Area */}
                      <div className="flex-1 flex flex-col gap-10">
                          <div className="flex-1 bg-gradient-to-br from-zinc-900/50 to-black rounded-[48px] border border-white/10 relative overflow-hidden flex flex-col items-center justify-center shadow-2xl">
                              {/* Animated Background Grid */}
                              <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                              
                              {status === 'SOLD' && (
                                  <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl animate-fade-in">
                                      <div className="relative mb-12">
                                          <div className="absolute inset-0 bg-teal-500 blur-[100px] opacity-30"></div>
                                          <div className="text-teal-400 font-black text-[14vw] tracking-tighter leading-none animate-bounce-in drop-shadow-[0_0_30px_rgba(20,184,166,0.5)] italic">SOLD</div>
                                      </div>
                                      {bidder && (
                                          <div className="flex flex-col items-center animate-slide-up">
                                              <div className="flex items-center gap-10 bg-white/5 p-10 rounded-[40px] border border-white/10 shadow-2xl">
                                                  <div className="relative">
                                                      <div className="absolute inset-0 bg-teal-500 blur-2xl opacity-20 rounded-full"></div>
                                                      {bidder.logoUrl ? <img src={bidder.logoUrl} className="w-28 h-28 object-contain bg-white p-2 rounded-full relative z-10" /> : <div className="w-28 h-28 bg-teal-600 rounded-full flex items-center justify-center text-4xl font-bold relative z-10">{bidder.name.charAt(0)}</div>}
                                                  </div>
                                                  <div>
                                                      <p className="text-teal-400 font-bold uppercase tracking-[0.5em] text-xs mb-2">Acquired By</p>
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
                                  <p className="text-teal-400/40 font-black text-2xl uppercase tracking-[1em] mb-8">CURRENT BID</p>
                                  <div className="text-[22vh] font-black text-white leading-none tabular-nums tracking-tighter drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]">{bid.toLocaleString()}</div>
                                  
                                  {status === 'LIVE' && bidder && (
                                      <div className="mt-12 flex flex-col items-center animate-slide-up">
                                          <div className="flex items-center gap-6 bg-teal-500 text-black px-12 py-5 rounded-full shadow-[0_20px_40px_rgba(20,184,166,0.3)] transform hover:scale-105 transition-transform">
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
                          <div className="h-32 bg-zinc-900/30 backdrop-blur-md rounded-[32px] border border-white/5 p-4 flex items-center">
                              <div className="shrink-0 px-8 border-r border-white/10 mr-6">
                                  <p className="text-teal-400 font-black text-sm uppercase tracking-widest mb-1">Purses</p>
                                  <p className="text-white/40 text-[10px] font-bold uppercase">Remaining</p>
                              </div>
                              <div className="flex-1 overflow-x-auto flex items-center gap-6 custom-scrollbar pb-2">
                                  {state.teams.map(team => (
                                      <div key={team.id} className="min-w-[200px] flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors shrink-0">
                                          {team.logoUrl ? <img src={team.logoUrl} className="w-12 h-12 object-contain bg-white p-1 rounded-xl" /> : <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-xs">{team.name.charAt(0)}</div>}
                                          <div className="min-w-0">
                                              <p className="text-white font-bold text-sm truncate">{team.name}</p>
                                              <p className="text-teal-400 font-mono font-black text-lg leading-none mt-1">{team.budget.toLocaleString()}</p>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}
          <Marquee show={!!(state.sponsorConfig?.showOnProjector && state.sponsors.length > 0)} content={marqueeContent} layout={state.projectorLayout} />
      </div>
  );
};

export default ProjectorScreen;
