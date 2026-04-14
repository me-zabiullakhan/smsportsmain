
import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, ArrowLeft, Key, Hash, Info, AlertTriangle, User, Chrome, ShieldAlert, ChevronRight, RefreshCw, ShieldCheck, Zap, Headset } from 'lucide-react';
import { auth, db } from '../firebase';
import firebase from 'firebase/compat/app';
import { useAuction } from '../hooks/useAuction';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

const AuthScreen: React.FC = () => {
    const { setUserProfile } = useAuction();
    const { theme } = useTheme();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'team' | 'admin'>('team');
    
    const isDark = theme === 'dark';
    
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isAdminRegister, setIsAdminRegister] = useState(false);

    useEffect(() => {
        const tab = searchParams.get('tab');
        const mode = searchParams.get('mode');
        if (tab === 'admin') { setActiveTab('admin'); if (mode === 'register') setIsAdminRegister(true); }
        else if (tab === 'team') { setActiveTab('team'); }
    }, [searchParams]);

    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetMessage, setResetMessage] = useState<string | null>(null);

    const [selectedTeamId, setSelectedTeamId] = useState<string>("");
    const [teamPassword, setTeamPassword] = useState('');

    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setError(null); setIsLoading(true);
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
        } catch (err: any) { setError(err.message); setIsLoading(false); }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetEmail) { setError("Please enter your email."); return; }
        setError(null); setIsLoading(true);
        try {
            await auth.sendPasswordResetEmail(resetEmail);
            setResetMessage("Reset link sent! Check your email.");
            setIsLoading(false);
        } catch (err: any) { setError(err.message); setIsLoading(false); }
    };

    const handleAdminSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null); setIsLoading(true);
        try {
            if (isAdminRegister) {
                const userCredential = await auth.createUserWithEmailAndPassword(adminEmail, adminPassword);
                if (userCredential.user) await userCredential.user.updateProfile({ displayName: adminName });
            } else { await auth.signInWithEmailAndPassword(adminEmail, adminPassword); }
        } catch (err: any) { setError(err.message); setIsLoading(false); }
    };

    const handleTeamSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null); setIsLoading(true);
        try {
            const auctionsSnapshot = await db.collection('auctions').get();
            let matchedTeam: any = null;
            let auctionId: string = "";
            for (const doc of auctionsSnapshot.docs) {
                const teamQuery = await doc.ref.collection('teams').where('id', '==', selectedTeamId).limit(1).get();
                if (!teamQuery.empty) { matchedTeam = teamQuery.docs[0].data(); auctionId = doc.id; break; }
            }
            if (!matchedTeam) throw new Error("Team ID not found.");
            if (matchedTeam.password && matchedTeam.password !== teamPassword) throw new Error("Incorrect Password.");

            localStorage.setItem('sm_sports_team_session', JSON.stringify({ role: 'TEAM_OWNER', teamId: selectedTeamId, auctionId }));
            await auth.signInAnonymously();
            navigate(`/auction/${auctionId}`);
        } catch (err: any) { setError(err.message); setIsLoading(false); }
    }

    return (
        <div className={`min-h-screen font-sans flex items-center justify-center p-4 relative transition-colors duration-500 ${isDark ? 'bg-primary text-white' : 'bg-gray-50 text-gray-900'}`}>
            <div className={`absolute inset-0 transition-opacity duration-500 ${isDark ? 'bg-primary/90 backdrop-blur-sm' : 'bg-white/50'}`}></div>
            
            <div className="w-full max-w-md relative z-10 flex flex-col items-center">
                <div className="w-full">
                    <div className="flex justify-between items-center mb-6">
                        <Link to="/" className={`inline-flex items-center transition-colors font-black uppercase text-[10px] tracking-widest ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                        </Link>
                        <ThemeToggle />
                    </div>

                    <div className="text-center mb-8">
                        <h1 className={`text-4xl font-black mb-1 uppercase tracking-tighter ${isDark ? 'advaya-text' : 'text-gray-900'}`}>🏏 SM SPORTS</h1>
                        <p className={`uppercase text-[10px] font-black tracking-[0.4em] opacity-60 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Cricket Auction Platform</p>
                    </div>

                    <div className={`backdrop-blur-md p-8 rounded-[3rem] shadow-2xl border transition-all duration-500 overflow-hidden relative group ${isDark ? 'bg-secondary/80 border-accent/30 shadow-accent/5' : 'bg-white border-gray-200 shadow-xl'}`}>
                        
                        <div className={`flex mb-8 rounded-2xl p-1.5 border transition-colors ${isDark ? 'bg-primary/50 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                            <button onClick={() => { setActiveTab('team'); setError(null); }}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'team' ? (isDark ? 'bg-accent text-primary shadow-xl' : 'bg-accent text-white shadow-xl') : (isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-500 hover:text-gray-900')}`}>Franchise Login</button>
                            <button onClick={() => { setActiveTab('admin'); setError(null); }}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'admin' ? (isDark ? 'bg-white text-primary shadow-xl' : 'bg-gray-900 text-white shadow-xl') : (isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-500 hover:text-gray-900')}`}>Organizer Portal</button>
                        </div>

                        <h2 className={`text-xl font-black text-center mb-8 uppercase tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {activeTab === 'team' ? 'Welcome Team Owner' : (showForgotPassword ? 'Reset Password' : (isAdminRegister ? 'Create Admin Account' : 'Admin Sign In'))}
                        </h2>

                        {activeTab === 'team' ? (
                            <form onSubmit={handleTeamSubmit} className="space-y-5">
                                <div className="relative">
                                    <Hash className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                                    <input type="text" placeholder="ENTER TEAM ID" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value.toUpperCase())}
                                        className={`w-full border rounded-2xl py-4 pl-12 pr-4 font-black text-xs tracking-widest outline-none transition-all ${isDark ? 'bg-primary/80 border-zinc-800 text-white focus:border-accent' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-accent'}`} required />
                                </div>
                                <div className="relative">
                                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                                    <input type="password" placeholder="PASSWORD" value={teamPassword} onChange={(e) => setResetEmail(e.target.value)}
                                        className={`w-full border rounded-2xl py-4 pl-12 pr-4 font-black text-xs tracking-widest outline-none transition-all ${isDark ? 'bg-primary/80 border-zinc-800 text-white focus:border-accent' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-accent'}`} required />
                                </div>
                                {error && <p className="text-red-400 text-[10px] font-black uppercase tracking-widest text-center bg-red-400/10 py-3 rounded-xl border border-red-500/20">{error}</p>}
                                <button type="submit" disabled={isLoading} className={`w-full font-black py-5 rounded-2xl transition-all active:scale-95 uppercase text-xs tracking-[0.2em] shadow-xl border-2 ${isDark ? 'bg-accent text-primary hover:bg-amber-400 border-accent/50 shadow-accent/40 shadow-[0_0_25px_rgba(251,191,36,0.3)]' : 'bg-accent text-white hover:bg-amber-600 border-accent shadow-accent/40 shadow-[0_0_25px_rgba(251,191,36,0.3)]'}`}>
                                   {isLoading ? <RefreshCw className="animate-spin w-5 h-5 mx-auto"/> : 'SIGN IN TO AUCTION'}
                                </button>
                            </form>
                        ) : showForgotPassword ? (
                             <form onSubmit={handlePasswordReset} className="space-y-5">
                                <input type="email" placeholder="EMAIL ADDRESS" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required
                                    className={`w-full border rounded-2xl py-4 px-6 font-black text-xs tracking-widest outline-none transition-all ${isDark ? 'bg-primary/80 border-zinc-800 text-white focus:border-accent' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-accent'}`} />
                                {error && <p className="text-red-400 text-[10px] font-black uppercase tracking-widest text-center">{error}</p>}
                                <button type="submit" disabled={isLoading} className={`w-full font-black py-5 rounded-2xl transition-all active:scale-95 uppercase text-xs tracking-[0.2em] shadow-xl ${isDark ? 'bg-accent text-primary hover:bg-amber-400 shadow-accent/20' : 'bg-accent text-white hover:bg-amber-600 shadow-accent/20'}`}>
                                   {isLoading ? 'Sending...' : 'Send Reset Link'}
                                </button>
                                <button type="button" onClick={() => setShowForgotPassword(false)} className={`w-full text-[10px] font-black uppercase tracking-widest transition-colors ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Back to Login</button>
                             </form>
                        ) : (
                            <div className="space-y-6">
                                 <div className="grid grid-cols-1 gap-3">
                                    <button onClick={handleGoogleLogin} disabled={isLoading} className={`w-full font-black py-4 rounded-2xl flex items-center justify-center transition-all text-xs tracking-widest shadow-xl ${isDark ? 'bg-white text-primary hover:bg-gray-200' : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'}`}>
                                        <Chrome className="mr-3 h-5 w-5 text-red-500" /> Sign in with Google
                                    </button>
                                    
                                    <button 
                                        onClick={handleGoogleLogin} 
                                        disabled={isLoading} 
                                        className={`w-full font-black py-4 rounded-2xl flex items-center justify-center transition-all text-[10px] tracking-[0.2em] gap-2 shadow-xl group ${isDark ? 'bg-slate-900 border border-accent/50 text-accent hover:bg-black' : 'bg-gray-900 text-white hover:bg-black'}`}
                                    >
                                        <Zap className="h-4 w-4 text-accent group-hover:scale-125 transition-transform" /> SUPER ADMIN ENTRANCE
                                    </button>
                                 </div>

                                <div className="relative flex py-1 items-center"><div className={`flex-grow border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}></div><span className="mx-4 text-gray-500 text-[10px] font-black uppercase tracking-widest">Or use email</span><div className={`flex-grow border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}></div></div>
                                <form onSubmit={handleAdminSubmit} className="space-y-4">
                                    {isAdminRegister && <input type="text" placeholder="FULL NAME" value={adminName} onChange={(e) => setAdminName(e.target.value)} required
                                        className={`w-full border rounded-2xl py-4 px-6 font-black text-xs tracking-widest outline-none transition-all ${isDark ? 'bg-primary/80 border-zinc-800 text-white focus:border-accent' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-accent'}`} />}
                                    <input type="email" placeholder="EMAIL ADDRESS" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required
                                        className={`w-full border rounded-2xl py-4 px-6 font-black text-xs tracking-widest outline-none transition-all ${isDark ? 'bg-primary/80 border-zinc-800 text-white focus:border-accent' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-accent'}`} />
                                    <input type="password" placeholder="PASSWORD" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required
                                        className={`w-full border rounded-2xl py-4 px-6 font-black text-xs tracking-widest outline-none transition-all ${isDark ? 'bg-primary/80 border-zinc-800 text-white focus:border-accent' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-accent'}`} />
                                    {!isAdminRegister && <div className="text-right"><button type="button" onClick={() => setShowForgotPassword(true)} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isDark ? 'text-zinc-500 hover:text-accent' : 'text-gray-500 hover:text-accent'}`}>Forgot Password?</button></div>}
                                    {error && <p className="text-red-400 text-[10px] font-black uppercase tracking-widest text-center bg-red-400/10 py-3 rounded-xl border border-red-500/20">{error}</p>}
                                    <button type="submit" disabled={isLoading} className={`w-full font-black py-5 rounded-2xl transition-all active:scale-95 uppercase text-xs tracking-[0.2em] shadow-xl border-2 ${isDark ? 'bg-accent text-primary hover:bg-amber-400 border-accent/50 shadow-accent/40 shadow-[0_0_25px_rgba(251,191,36,0.3)]' : 'bg-accent text-white hover:bg-amber-600 border-accent shadow-accent/40 shadow-[0_0_25px_rgba(251,191,36,0.3)]'}`}>
                                        {isLoading ? <RefreshCw className="animate-spin w-5 h-5"/> : 'OPEN DASHBOARD'}
                                    </button>
                                    <div className="text-center mt-6">
                                        <button type="button" onClick={() => setIsAdminRegister(!isAdminRegister)} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isDark ? 'text-zinc-500 hover:text-accent' : 'text-gray-500 hover:text-accent'}`}>
                                            {isAdminRegister ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
                                        </button>
                                    </div>
                                </form>
                                <div className={`pt-4 border-t flex flex-col items-center ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] mb-2">Authorized Access Only</p>
                                    <div className="flex items-center gap-1.5 text-accent">
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">Root Operator Portal active</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* STAFF ENTRANCE LINK */}
                    <div className="mt-8 text-center">
                        <Link 
                            to="/staff-login" 
                            className={`inline-flex items-center gap-2 transition-all group ${isDark ? 'text-zinc-500 hover:text-accent' : 'text-gray-500 hover:text-accent'}`}
                        >
                            <div className={`p-2 rounded-xl border transition-colors ${isDark ? 'bg-secondary border-accent/20 group-hover:border-accent' : 'bg-white border-gray-200 group-hover:border-accent'}`}>
                                <Headset className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest">Authorized Staff Entrance</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;
