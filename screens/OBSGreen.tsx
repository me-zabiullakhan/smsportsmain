
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
          <Marquee show={!!(state.sponsorConfig?.showOnProjector && state.sponsors.length > 0)} content={marqueeContent} layout={state.projectorLayout} />
      </div>
  );
};

export default ProjectorScreen;
