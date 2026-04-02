
import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, ArrowLeft, Key, Hash, Info, AlertTriangle, User, Chrome, ShieldAlert, ChevronRight, RefreshCw, ShieldCheck, Zap, Headset } from 'lucide-react';
import { auth, db } from '../firebase';
import firebase from 'firebase/compat/app';
import { useAuction } from '../hooks/useAuction';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

const AuthScreen: React.FC = () => {
    const { setUserProfile } = useAuction();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'team' | 'admin'>('team');
    
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
        <div className="min-h-screen bg-primary font-sans flex items-center justify-center p-4 relative text-text-main">
            <div className="absolute inset-0 bg-primary/90 backdrop-blur-sm"></div>
            
            <div className="w-full max-w-md relative z-10 flex flex-col items-center">
                <div className="w-full">
                    <Link to="/" className="inline-flex items-center text-text-secondary hover:text-white mb-6 transition-colors font-semibold">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                    </Link>

                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-highlight mb-1">🏏 SM SPORTS</h1>
                        <p className="text-text-secondary uppercase text-[10px] font-bold opacity-60">Cricket Auction Platform</p>
                    </div>

                    <div className="bg-secondary/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-accent/30 overflow-hidden relative group">
                        
                        <div className="flex mb-8 bg-primary/50 rounded-xl p-1.5 border border-white/5">
                            <button onClick={() => { setActiveTab('team'); setError(null); }}
                                className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'team' ? 'bg-highlight text-primary shadow-xl' : 'text-text-secondary hover:text-white'}`}>Franchise Login</button>
                            <button onClick={() => { setActiveTab('admin'); setError(null); }}
                                className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'admin' ? 'bg-white text-primary shadow-xl' : 'text-text-secondary hover:text-white'}`}>Organizer Portal</button>
                        </div>

                        <h2 className="text-xl font-bold text-center text-white mb-8 uppercase tracking-tight">
                            {activeTab === 'team' ? 'Welcome Team Owner' : (showForgotPassword ? 'Reset Password' : (isAdminRegister ? 'Create Admin Account' : 'Admin Sign In'))}
                        </h2>

                        {activeTab === 'team' ? (
                            <form onSubmit={handleTeamSubmit} className="space-y-5">
                                <div className="relative">
                                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                    <input type="text" placeholder="ENTER TEAM ID" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value.toUpperCase())}
                                        className="w-full bg-primary/80 border border-gray-700/50 rounded-2xl py-4 pl-12 pr-4 text-text-main font-bold focus:ring-2 focus:ring-highlight outline-none" required />
                                </div>
                                <div className="relative">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                    <input type="password" placeholder="PASSWORD" value={teamPassword} onChange={(e) => setTeamPassword(e.target.value)}
                                        className="w-full bg-primary/80 border border-gray-700/50 rounded-2xl py-4 pl-12 pr-4 text-text-main font-bold focus:ring-2 focus:ring-highlight outline-none" required />
                                </div>
                                {error && <p className="text-red-400 text-xs font-bold text-center bg-red-400/10 py-3 rounded-xl border border-red-500/20">{error}</p>}
                                <button type="submit" disabled={isLoading} className="w-full bg-highlight hover:bg-teal-400 text-primary font-bold py-4 rounded-2xl transition-all active:scale-95 uppercase text-sm">
                                   {isLoading ? <RefreshCw className="animate-spin w-5 h-5 mx-auto"/> : 'SIGN IN TO AUCTION'}
                                </button>
                            </form>
                        ) : showForgotPassword ? (
                             <form onSubmit={handlePasswordReset} className="space-y-5">
                                <input type="email" placeholder="EMAIL ADDRESS" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required
                                    className="w-full bg-primary/80 border border-gray-700/50 rounded-2xl py-4 px-6 text-text-main font-bold focus:ring-2 focus:ring-highlight outline-none" />
                                {error && <p className="text-red-400 text-xs font-bold text-center">{error}</p>}
                                <button type="submit" disabled={isLoading} className="w-full bg-highlight hover:bg-teal-400 text-primary font-bold py-4 rounded-2xl uppercase text-xs">
                                   {isLoading ? 'Sending...' : 'Send Reset Link'}
                                </button>
                                <button type="button" onClick={() => setShowForgotPassword(false)} className="w-full text-[10px] font-bold text-text-secondary hover:text-white uppercase">Back to Login</button>
                             </form>
                        ) : (
                            <div className="space-y-6">
                                 <div className="grid grid-cols-1 gap-3">
                                    <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3.5 rounded-2xl flex items-center justify-center transition-all text-sm shadow-xl">
                                        <Chrome className="mr-3 h-5 w-5 text-red-500" /> Sign in with Google
                                    </button>
                                    
                                    <button 
                                        onClick={handleGoogleLogin} 
                                        disabled={isLoading} 
                                        className="w-full bg-slate-900 border border-highlight/50 hover:bg-black text-white font-black py-3.5 rounded-2xl flex items-center justify-center transition-all text-xs tracking-widest gap-2 shadow-[0_0_20px_rgba(56,178,172,0.2)] group"
                                    >
                                        <Zap className="h-4 w-4 text-highlight group-hover:scale-125 transition-transform" /> SUPER ADMIN ENTRANCE
                                    </button>
                                 </div>

                                <div className="relative flex py-1 items-center"><div className="flex-grow border-t border-gray-700"></div><span className="mx-4 text-gray-500 text-[10px] font-bold uppercase">Or use email</span><div className="flex-grow border-t border-gray-700"></div></div>
                                <form onSubmit={handleAdminSubmit} className="space-y-4">
                                    {isAdminRegister && <input type="text" placeholder="FULL NAME" value={adminName} onChange={(e) => setAdminName(e.target.value)} required
                                        className="w-full bg-primary/80 border border-gray-700/50 rounded-2xl py-4 px-6 text-text-main font-bold focus:ring-2 focus:ring-highlight outline-none" />}
                                    <input type="email" placeholder="EMAIL ADDRESS" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required
                                        className="w-full bg-primary/80 border border-gray-700/50 rounded-2xl py-4 px-6 text-text-main font-bold focus:ring-2 focus:ring-highlight outline-none" />
                                    <input type="password" placeholder="PASSWORD" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required
                                        className="w-full bg-primary/80 border border-gray-700/50 rounded-2xl py-4 px-6 text-text-main font-bold focus:ring-2 focus:ring-highlight outline-none" />
                                    {!isAdminRegister && <div className="text-right"><button type="button" onClick={() => setShowForgotPassword(true)} className="text-[10px] font-bold text-text-secondary hover:text-highlight">Forgot Password?</button></div>}
                                    {error && <p className="text-red-400 text-xs font-bold text-center bg-red-400/10 py-3 rounded-xl border border-red-500/20">{error}</p>}
                                    <button type="submit" disabled={isLoading} className="w-full bg-white hover:bg-gray-100 text-primary font-black py-4 rounded-2xl uppercase text-sm flex items-center justify-center gap-2">
                                        {isLoading ? <RefreshCw className="animate-spin w-5 h-5"/> : 'OPEN DASHBOARD'}
                                    </button>
                                    <div className="text-center mt-6">
                                        <button type="button" onClick={() => setIsAdminRegister(!isAdminRegister)} className="text-[10px] font-bold text-text-secondary hover:text-highlight uppercase">
                                            {isAdminRegister ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
                                        </button>
                                    </div>
                                </form>
                                <div className="pt-4 border-t border-gray-700/50 flex flex-col items-center">
                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-2">Authorized Access Only</p>
                                    <div className="flex items-center gap-1.5 text-highlight">
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
                            className="inline-flex items-center gap-2 text-text-secondary hover:text-highlight transition-all group"
                        >
                            <div className="bg-secondary p-1.5 rounded-lg border border-accent/20 group-hover:border-highlight/50 transition-colors">
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
