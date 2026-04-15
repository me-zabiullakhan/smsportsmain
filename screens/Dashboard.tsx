import React, { useEffect } from 'react';
import LiveAdminPanel from '../components/LiveAdminPanel';
import AuctionRoom from './AuctionRoom';
import TeamPostAuctionView from '../components/TeamPostAuctionView';
import AdminPostAuctionView from '../components/AdminPostAuctionView';
import { useAuction } from '../hooks/useAuction';
import { AuctionStatus, UserRole } from '../types';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Wallet, Users, LogOut, Trophy, Home, ShieldAlert } from 'lucide-react';

import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

const Dashboard: React.FC = () => {
  const { state, userProfile, logout, error, joinAuction } = useAuction();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { id: auctionId } = useParams<{ id: string }>();

  useEffect(() => { if (auctionId) joinAuction(auctionId); }, [auctionId]);

  const isDark = theme === 'dark';
  const isSuperAdmin = userProfile?.role === UserRole.SUPER_ADMIN;
  const isAdmin = userProfile?.role === UserRole.ADMIN || isSuperAdmin;
  const isTeamOwner = userProfile?.role === UserRole.TEAM_OWNER;
  const myTeam = isTeamOwner ? state.teams.find(t => t.id === userProfile.teamId) : null;

  // If there is a critical error (like auction not found), show a clean error state
  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-500 ${isDark ? 'bg-primary' : 'bg-gray-50'}`}>
        <div className={`p-8 rounded-[3rem] border shadow-2xl max-w-md w-full text-center transition-all duration-500 ${isDark ? 'bg-secondary border-accent/30 shadow-accent/5' : 'bg-white border-gray-200 shadow-xl'}`}>
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className={`text-2xl font-black mb-2 uppercase tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Something went wrong</h2>
          <p className={`mb-8 leading-relaxed font-black uppercase text-[10px] tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
            {error === 'Auction not found' 
              ? 'This auction room does not exist or has been removed. Please check the link and try again.' 
              : 'We encountered an error loading the auction data. Please refresh the page.'}
          </p>
          <button 
            onClick={() => navigate('/')}
            className={`w-full font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs shadow-xl active:scale-95 ${isDark ? 'bg-accent text-primary hover:bg-amber-400 shadow-accent/20' : 'bg-accent text-white hover:bg-amber-600 shadow-accent/20'}`}
          >
            <Home className="w-5 h-5" /> Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-500 ${isDark ? 'bg-primary text-white' : 'bg-[#f8faff] text-gray-900'}`}>
      <header className={`shadow-md border-b sticky top-0 z-40 transition-colors duration-500 ${isDark ? 'bg-secondary border-accent/20' : 'bg-white border-gray-100'}`}>
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate('/')}>
             <div className={`w-12 h-12 rounded-2xl border p-2 shadow-xl flex items-center justify-center overflow-hidden transition-all group-hover:scale-110 ${isDark ? 'bg-black border-accent/50 shadow-accent/5' : 'bg-white border-gray-200 shadow-gray-200/50'}`}>
                {state.systemLogoUrl ? (
                    <img src={state.systemLogoUrl} className="max-w-full max-h-full object-contain" alt="Logo" />
                ) : (
                    <Trophy className={`w-full h-full ${isDark ? 'text-accent' : 'text-accent'}`} />
                )}
             </div>
             
             <div className="flex flex-col">
                 {isTeamOwner && myTeam ? (
                     <>
                        <span className={`text-lg md:text-xl font-black leading-tight uppercase tracking-tighter ${isDark ? 'text-white' : 'text-gray-900'}`}>{myTeam.name}</span>
                        <span className={`text-[9px] uppercase font-black tracking-[0.4em] ${isDark ? 'text-accent' : 'text-accent'}`}>Team Owner Dashboard</span>
                     </>
                 ) : (
                     <>
                        <span className={`text-lg font-black sm:hidden uppercase tracking-tighter ${isDark ? 'text-white' : 'text-gray-900'}`}>SM SPORTS</span>
                        <span className={`text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-lg w-fit ${isDark ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-accent/10 text-accent border border-accent/20'}`}>
                            {isSuperAdmin ? 'Root Operator' : (isAdmin ? 'Administrator' : 'Spectator View')}
                        </span>
                     </>
                 )}
             </div>
          </div>

           {isTeamOwner && myTeam && state.status !== AuctionStatus.Finished && (
               <div className={`flex items-center gap-4 md:gap-8 px-6 py-2.5 rounded-2xl border shadow-inner ml-auto mr-4 transition-colors ${isDark ? 'bg-primary/50 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
                   <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                       <div className="flex items-center"><Wallet className="w-4 h-4 mr-2 text-green-500" /><span className={`hidden md:inline uppercase text-[10px] font-black tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Remaining:</span></div>
                       <b className="text-green-500 text-xl md:text-2xl font-black tracking-tighter leading-none">₹{myTeam.budget}</b>
                   </div>
                   <div className={`w-px h-8 hidden md:block ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`}></div>
                   <div className="hidden md:flex items-center gap-3">
                       <Users className="w-4 h-4 text-blue-500" />
                       <span className={`uppercase text-[10px] font-black tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Squad:</span>
                       <b className={`text-xl md:text-2xl font-black tracking-tighter leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>{myTeam.players.length}</b>
                   </div>
               </div>
           )}

           <div className="flex items-center space-x-4">
             <ThemeToggle />
             
             {isSuperAdmin && (
                 <button 
                    onClick={() => navigate('/super-admin')}
                    className={`hidden sm:flex items-center gap-2 border px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 ${isDark ? 'bg-slate-900 border-accent/30 text-accent hover:bg-black hover:border-accent' : 'bg-gray-900 border-gray-800 text-white hover:bg-black'}`}
                 >
                    <ShieldAlert className="w-3.5 h-3.5" /> MASTER ACCESS
                 </button>
             )}

             <div className="hidden lg:block text-right">
                <p className={`text-[9px] uppercase tracking-[0.3em] font-black ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Auction Status</p>
                <div className="flex items-center justify-end gap-2">
                    <span className={`h-2 w-2 rounded-full ${state.status === AuctionStatus.InProgress ? 'bg-green-500 animate-pulse' : state.status === AuctionStatus.Finished ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                    <p className={`font-black text-[11px] uppercase tracking-widest ${state.status === AuctionStatus.InProgress ? 'text-green-500' : state.status === AuctionStatus.Finished ? 'text-red-500' : 'text-yellow-500'}`}>
                        {state.status?.replace('_', ' ') || 'LOADING...'}
                    </p>
                </div>
             </div>
             {userProfile ? <button onClick={() => { logout(); navigate('/'); }} className={`transition-colors p-3 rounded-xl border ${isDark ? 'text-zinc-500 hover:text-red-400 bg-zinc-900/50 border-zinc-800' : 'text-gray-400 hover:text-red-500 bg-gray-50 border-gray-200'}`} title="Sign Out"><LogOut className="w-5 h-5" /></button> : <button onClick={() => navigate('/auth')} className="bg-accent hover:bg-amber-400 text-primary font-black py-2.5 px-6 rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-accent/20">Login</button>}
           </div>
        </div>
      </header>
      
      <div className={`lg:hidden border-b px-4 py-2 flex justify-between items-center text-[10px] font-black uppercase tracking-widest transition-colors ${isDark ? 'bg-secondary/50 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${state.status === AuctionStatus.InProgress ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span><span className={`${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{state.status?.replace('_', ' ') || 'LOADING...'}</span></div>
          <div className={`${isDark ? 'text-accent' : 'text-accent'}`}>{isAdmin ? 'Admin Mode' : (isTeamOwner ? 'Live Bidding Enabled' : 'Read Only')}</div>
      </div>

      <main className="flex-1 container mx-auto p-2 md:p-6 overflow-y-auto">
        {state.status === AuctionStatus.Finished ? (
          isTeamOwner && myTeam ? <TeamPostAuctionView team={myTeam} /> : <AdminPostAuctionView />
        ) : isAdmin ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-full pb-10">
            <div className="lg:col-span-3">
              <AuctionRoom />
            </div>
            <div className="lg:col-span-1">
              <LiveAdminPanel />
            </div>
          </div>
        ) : (
          <div className="min-h-full pb-10">
            <AuctionRoom />
          </div>
        )}
      </main>
      <footer className={`text-center py-6 border-t font-black uppercase tracking-[0.3em] text-[9px] transition-colors ${isDark ? 'bg-secondary border-accent/10 text-zinc-500' : 'bg-white border-gray-100 text-gray-400'}`}>
        <p>SM SPORTS • Live Auction System • <a href={`${window.location.origin}/#/obs-overlay/${auctionId}`} target="_blank" className="text-accent hover:underline">Open OBS Overlay</a></p>
      </footer>
    </div>
  );
};

export default Dashboard;