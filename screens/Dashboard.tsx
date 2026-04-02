import React, { useEffect } from 'react';
import LiveAdminPanel from '../components/LiveAdminPanel';
import AuctionRoom from './AuctionRoom';
import TeamPostAuctionView from '../components/TeamPostAuctionView';
import AdminPostAuctionView from '../components/AdminPostAuctionView';
import { useAuction } from '../hooks/useAuction';
import { AuctionStatus, UserRole } from '../types';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Wallet, Users, LogOut, Trophy, Home, ShieldAlert } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { state, userProfile, logout, error, joinAuction } = useAuction();
  const navigate = useNavigate();
  const { auctionId } = useParams<{ auctionId: string }>();

  useEffect(() => { if (auctionId) joinAuction(auctionId); }, [auctionId]);

  const isSuperAdmin = userProfile?.role === UserRole.SUPER_ADMIN;
  const isAdmin = userProfile?.role === UserRole.ADMIN || isSuperAdmin;
  const isTeamOwner = userProfile?.role === UserRole.TEAM_OWNER;
  const myTeam = isTeamOwner ? state.teams.find(t => t.id === userProfile.teamId) : null;

  // If there is a critical error (like auction not found), show a clean error state
  if (error) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6">
        <div className="bg-secondary p-8 rounded-3xl border border-accent/50 shadow-2xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-text-secondary mb-8 leading-relaxed">
            {error === 'Auction not found' 
              ? 'This auction room does not exist or has been removed. Please check the link and try again.' 
              : 'We encountered an error loading the auction data. Please refresh the page.'}
          </p>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-highlight hover:bg-teal-400 text-primary font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm shadow-xl"
          >
            <Home className="w-5 h-5" /> Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary font-sans flex flex-col">
      <header className="bg-secondary shadow-md border-b border-accent sticky top-0 z-40">
        <div className="container mx-auto px-4 py-2 flex justify-between items-center">
          
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
             <div className="w-10 h-10 bg-black rounded-lg border border-highlight p-1 shadow flex items-center justify-center overflow-hidden">
                {state.systemLogoUrl ? (
                    <img src={state.systemLogoUrl} className="max-w-full max-h-full object-contain" alt="Logo" />
                ) : (
                    <Trophy className="w-full h-full text-highlight" />
                )}
             </div>
             
             <div className="flex flex-col">
                 {isTeamOwner && myTeam ? (
                     <>
                        <span className="text-lg md:text-xl font-black text-white leading-tight uppercase tracking-wide">{myTeam.name}</span>
                        <span className="text-[10px] text-highlight uppercase font-bold tracking-widest">Team Owner Dashboard</span>
                     </>
                 ) : (
                     <>
                        <span className="text-lg font-bold text-white sm:hidden">SM SPORTS</span>
                        <span className="text-xs text-text-secondary uppercase bg-accent/50 px-2 py-0.5 rounded w-fit">
                            {isSuperAdmin ? 'Root Operator' : (isAdmin ? 'Administrator' : 'Spectator View')}
                        </span>
                     </>
                 )}
             </div>
          </div>

           {isTeamOwner && myTeam && state.status !== AuctionStatus.Finished && (
               <div className="flex items-center gap-2 md:gap-6 bg-gray-800/80 px-4 py-2 rounded-lg border border-gray-600 shadow-inner ml-auto mr-2">
                   <div className="flex flex-col md:flex-row md:items-center text-sm text-text-secondary">
                       <div className="flex items-center"><Wallet className="w-4 h-4 mr-1 md:mr-2 text-green-400" /><span className="hidden md:inline mr-1 uppercase text-xs font-bold">Remaining:</span></div>
                       <b className="text-green-400 text-lg md:text-xl font-mono leading-none">{myTeam.budget}</b>
                   </div>
                   <div className="w-px h-6 bg-gray-600 hidden md:block"></div>
                   <div className="hidden md:flex items-center text-sm text-text-secondary"><Users className="w-4 h-4 mr-2 text-blue-400" /><span className="mr-1 uppercase text-xs font-bold">Squad:</span><b className="text-white text-xl font-mono leading-none">{myTeam.players.length}</b></div>
               </div>
           )}

           <div className="flex items-center space-x-4">
             {isSuperAdmin && (
                 <button 
                    onClick={() => navigate('/super-admin')}
                    className="hidden sm:flex items-center gap-2 bg-slate-900 border border-highlight/30 hover:border-highlight hover:bg-black text-highlight px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95"
                 >
                    <ShieldAlert className="w-3.5 h-3.5" /> MASTER ACCESS
                 </button>
             )}

             <div className="hidden lg:block text-right">
                <p className="text-[10px] text-text-secondary uppercase tracking-widest">Auction Status</p>
                <div className="flex items-center justify-end gap-2">
                    <span className={`h-2 w-2 rounded-full ${state.status === AuctionStatus.InProgress ? 'bg-green-500 animate-pulse-fast' : state.status === AuctionStatus.Finished ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                    <p className={`font-bold text-sm ${state.status === AuctionStatus.InProgress ? 'text-green-400' : state.status === AuctionStatus.Finished ? 'text-red-400' : 'text-yellow-400'}`}>
                        {state.status.replace('_', ' ')}
                    </p>
                </div>
             </div>
             {userProfile ? <button onClick={() => { logout(); navigate('/'); }} className="text-gray-400 hover:text-red-400 transition-colors p-2" title="Sign Out"><LogOut className="w-5 h-5" /></button> : <button onClick={() => navigate('/auth')} className="bg-highlight hover:bg-teal-400 text-primary font-bold py-2 px-4 rounded-lg text-sm transition-all">Login</button>}
           </div>
        </div>
      </header>
      
      <div className="lg:hidden bg-secondary/50 border-b border-gray-700 px-4 py-1 flex justify-between items-center text-xs">
          <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${state.status === AuctionStatus.InProgress ? 'bg-green-500 animate-pulse-fast' : 'bg-yellow-500'}`}></span><span className="text-gray-300 uppercase font-semibold">{state.status.replace('_', ' ')}</span></div>
          <div className="text-gray-400">{isAdmin ? 'Admin Mode' : (isTeamOwner ? 'Live Bidding Enabled' : 'Read Only')}</div>
      </div>

      <main className="container mx-auto p-2 md:p-6 flex-grow">
        {state.status === AuctionStatus.Finished ? (isTeamOwner && myTeam ? <TeamPostAuctionView team={myTeam} /> : <AdminPostAuctionView />) : isAdmin ? (<div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full"><div className="lg:col-span-3"><AuctionRoom /></div><div className="lg:col-span-1"><LiveAdminPanel /></div></div>) : (<div className="h-full"><AuctionRoom /></div>)}
      </main>
      <footer className="text-center py-3 border-t border-accent text-text-secondary text-xs bg-secondary">
        <p>SM SPORTS • Live Auction System • <a href={`/#/obs-overlay/${auctionId}`} target="_blank" className="text-highlight hover:underline">Open OBS Overlay</a></p>
      </footer>
    </div>
  );
};

export default Dashboard;