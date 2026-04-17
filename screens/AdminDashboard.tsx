import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { useTheme } from '../contexts/ThemeContext';
// Standardized imports
import { Plus, Search, Menu, AlertCircle, RefreshCw, Database, Trash2, Cast, Monitor, Activity, UserPlus, Link as LinkIcon, ShieldCheck, CreditCard, Scale, FileText, ChevronRight, CheckCircle, Info, Zap, Crown, Users, Gavel, Sparkles, Shield, Book, HelpCircle, UserPlus2, Layout, Youtube, MessageSquare, Star, Trophy, Tag, Check, ShieldAlert, LogOut, AlertTriangle, Clock, X, Megaphone, Infinity as InfinityIcon, CalendarDays, ChevronDown, XCircle, Sun, Moon, Settings } from 'lucide-react';
import { db } from '../firebase';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { AuctionSetup, UserPlan, UserRole, PromoCode, SystemPopup } from '../types';

const AdminDashboard: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  // Added 'state' to destructuring from useAuction to resolve potential undefined errors
  const { userProfile, logout, state } = useAuction();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [auctions, setAuctions] = useState<(AuctionSetup & { currentTeamCount?: number })[]>([]);
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'AUCTIONS' | 'PLANS' | 'LEGAL'>('AUCTIONS');
  const [isRazorpayLoaded, setIsRazorpayLoaded] = useState(false);
  const [selectedAuctionForUpgrade, setSelectedAuctionForUpgrade] = useState<string | null>(null);

  // System Popups State
  const [activePopups, setActivePopups] = useState<SystemPopup[]>([]);
  const [currentPopup, setCurrentPopup] = useState<SystemPopup | null>(null);

  // Promo Code States
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState('');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showNotification = (message: string, type: 'error' | 'success' = 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 5000);
  };

  const isSuperAdmin = userProfile?.role === UserRole.SUPER_ADMIN;

  const COMMON_FEATURES = [
      { name: 'Online player registration', icon: <UserPlus2 className="w-4 h-4" /> },
      { name: 'Excel Data entry support', icon: <FileText className="w-4 h-4" /> },
      { name: 'Public Auction Page', icon: <Layout className="w-4 h-4" /> },
      { name: 'Auto points calculation', icon: <Zap className="w-4 h-4" /> },
      { name: 'WhatsApp Player Updates', icon: <MessageSquare className="w-4 h-4" /> },
      { name: 'LED/Projector Views', icon: <Monitor className="w-4 h-4" /> },
      { name: 'YouTube Overlays', icon: <Youtube className="w-4 h-4" /> },
  ];

  // System Popups Broadcaster Logic
  useEffect(() => {
    const unsub = db.collection('systemPopups')
        .where('isActive', '==', true)
        .onSnapshot(snap => {
            const now = Date.now();
            const list = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as SystemPopup))
                .filter(p => p.expiryDate > now);
            setActivePopups(list);
        });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (activePopups.length > 0) {
        activePopups.forEach(popup => {
            const timer = setTimeout(() => {
                const shownId = localStorage.getItem(`popup_shown_${popup.id}`);
                if (!shownId) {
                    setCurrentPopup(popup);
                }
            }, popup.delaySeconds * 1000);
            return () => clearTimeout(timer);
        });
    }
  }, [activePopups]);

  const closeSystemPopup = (id: string) => {
      localStorage.setItem(`popup_shown_${id}`, 'true');
      setCurrentPopup(null);
  };

  // Detect auto-upgrade query param
  useEffect(() => {
    const upgradeId = searchParams.get('upgrade');
    if (upgradeId) {
        setSelectedAuctionForUpgrade(upgradeId);
        setActiveTab('AUCTIONS');
    }
  }, [searchParams]);

  // Load Razorpay Script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setIsRazorpayLoaded(true);
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  // Fetch Dynamic Plans or fallback to renamed defaults
  useEffect(() => {
      const unsub = db.collection('subscriptionPlans').orderBy('price', 'asc').onSnapshot(snap => {
          if (snap.empty) {
              setDbPlans([
                  { id: 'plan_1', name: 'Starter Free', price: 0, teams: 2 },
                  { id: 'plan_2', name: 'Silver Pro', price: 3000, teams: 4 },
                  { id: 'plan_3', name: 'Gold Elite', price: 4000, teams: 6 },
                  { id: 'plan_4', name: 'Diamond Master', price: 5000, teams: 10 },
                  { id: 'plan_5', name: 'Platinum Ultimate', price: 6000, teams: 15 },
              ]);
          } else {
              setDbPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
      });
      return () => unsub();
  }, []);

  const setupListener = () => {
        if (!userProfile?.uid) return () => {};
        setLoading(true);
        setError(null);
        try {
            const unsubscribe = db.collection('auctions')
                .where('createdBy', '==', userProfile.uid)
                .onSnapshot(async (snapshot) => {
                    const auctionsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuctionSetup));
                    
                    // Fetch team counts for each auction to validate plans
                    const auctionsWithCounts = await Promise.all(auctionsData.map(async (a) => {
                        const teamsSnap = await db.collection('auctions').doc(a.id).collection('teams').get();
                        return { ...a, currentTeamCount: teamsSnap.size };
                    }));

                    auctionsWithCounts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    setAuctions(auctionsWithCounts);
                    setLoading(false);
                }, (error: any) => {
                    setLoading(false);
                    setError("Failed to load auctions: " + error.message);
                });
            return unsubscribe;
        } catch (e: any) {
            setError(e.message);
            setLoading(false);
            return () => {};
        }
  };

  useEffect(() => {
    let unsubscribe: any;
    if (userProfile?.uid) { unsubscribe = setupListener(); }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [userProfile]);

  const handleValidatePromo = async () => {
      if (!promoInput) return;
      setIsValidatingPromo(true);
      setPromoError('');
      setAppliedPromo(null);
      try {
          const snap = await db.collection('promoCodes').where('code', '==', promoInput.toUpperCase()).get();
          if (snap.empty) throw new Error("Invalid Promo Code");
          const promo = { id: snap.docs[0].id, ...snap.docs[0].data() } as PromoCode;
          if (!promo.active) throw new Error("Promo Code Inactive");
          if (promo.expiryDate < Date.now()) throw new Error("Promo Code Expired");
          if (promo.currentClaims >= promo.maxClaims) throw new Error("Promo Claim Limit Reached");
          setAppliedPromo(promo);
      } catch (err: any) {
          setPromoError(err.message);
      } finally {
          setIsValidatingPromo(false);
      }
  };

  const calculateDiscountedPrice = (originalPrice: number) => {
      if (!appliedPromo) return originalPrice;
      if (appliedPromo.discountType === 'FLAT') return Math.max(0, originalPrice - appliedPromo.discountValue);
      return Math.max(0, Math.round(originalPrice * (1 - appliedPromo.discountValue / 100)));
  };

  const handleAuctionSubscription = (auctionId: string, plan: any) => {
      if (!isRazorpayLoaded) {
          showNotification("Payment system is loading...");
          return;
      }
      if (plan.price === 0) {
          showNotification("This auction is already on the Free Plan.");
          return;
      }

      const finalPrice = calculateDiscountedPrice(plan.price);
      
      // If price becomes zero due to promo, bypass Razorpay
      if (finalPrice === 0) {
          (async () => {
              await db.collection('auctions').doc(auctionId).update({
                  isPaid: true,
                  planId: plan.id,
                  totalTeams: plan.teams 
              });
              if (appliedPromo) {
                  await db.collection('promoCodes').doc(appliedPromo.id).update({
                      currentClaims: firebase.firestore.FieldValue.increment(1)
                  });
              }
              showNotification("Full Discount Applied!", "success");
              setSelectedAuctionForUpgrade(null);
          })();
          return;
      }

      const options = {
          key: "rzp_live_RmecQ0mAZzpRC5",
          amount: finalPrice * 100,
          currency: "INR",
          name: "SM SPORTS",
          description: `Upgrade Auction: ${plan.name} ${appliedPromo ? '(Promo Applied)' : ''}`,
          handler: async (response: any) => {
              await db.collection('auctions').doc(auctionId).update({
                  isPaid: true,
                  planId: plan.id,
                  totalTeams: plan.teams 
              });
              if (appliedPromo) {
                  await db.collection('promoCodes').doc(appliedPromo.id).update({
                      currentClaims: firebase.firestore.FieldValue.increment(1)
                  });
              }
              showNotification("Success! Your auction has been upgraded.", "success");
              setSelectedAuctionForUpgrade(null);
          },
          prefill: { email: userProfile?.email },
          theme: { color: "#16a34a" }
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
  };

  const copyRegLink = (auctionId: string) => {
      const baseUrl = window.location.href.split('#')[0];
      const url = `${baseUrl}#/auction/${auctionId}/register`;
      navigator.clipboard.writeText(url);
      showNotification("✅ Registration link copied!", "success");
  };

  const handleDeleteAuction = async (auctionId: string, title: string) => {
      setConfirmAction({
          title: "Delete Auction",
          message: `Are you sure you want to delete auction "${title}"? This action cannot be undone.`,
          onConfirm: async () => {
              try {
                  await db.collection('auctions').doc(auctionId).delete();
                  showNotification("Auction deleted successfully.", "success");
              } catch (e: any) { 
                  showNotification("Delete failed: " + e.message); 
              }
              setConfirmAction(null);
          }
      });
  };

  const renderAuctions = () => (
    <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
                <h2 className={`text-3xl font-black uppercase tracking-tighter ${isDark ? 'text-white' : 'text-gray-900'}`}>My Auctions</h2>
                <p className={`text-[10px] font-black uppercase tracking-[0.3em] mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Manage your tournament ecosystem</p>
            </div>
            <button 
                onClick={() => navigate('/admin/create-auction')}
                className={`btn-golden flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95`}
            >
                <Plus className="w-5 h-5" /> Start New Auction
            </button>
        </div>

        {/* Upgrade Section */}
        {auctions.length > 0 && (
            <div className={`p-8 rounded-[2.5rem] border transition-all ${isDark ? 'bg-secondary/50 border-accent/20 shadow-accent/5' : 'bg-blue-600 border-blue-500 shadow-blue-600/20 shadow-xl'}`}>
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className={`p-4 rounded-[1.5rem] shadow-2xl ${isDark ? 'bg-accent text-zinc-950' : 'bg-white text-blue-600'}`}>
                            <Crown className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className={`text-2xl font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-white'}`}>Upgrade Your Experience</h3>
                            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDark ? 'text-accent' : 'text-blue-100'}`}>Select an auction to unlock premium features</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {auctions.map(a => (
                            <button 
                                key={a.id} 
                                onClick={() => setSelectedAuctionForUpgrade(a.id)}
                                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                                    selectedAuctionForUpgrade === a.id 
                                    ? (isDark ? 'bg-accent border-accent text-zinc-950 shadow-lg shadow-accent/20' : 'bg-white border-white text-blue-600 shadow-lg shadow-white/20')
                                    : (isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700' : 'bg-blue-500 border-blue-400 text-white hover:bg-blue-400')
                                }`}
                            >
                                {a.title?.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
                
                {selectedAuctionForUpgrade && (
                    <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 animate-slide-up">
                        {dbPlans.map((plan) => {
                            const currentAuction = auctions.find(a => a.id === selectedAuctionForUpgrade);
                            const isCurrentPlan = currentAuction?.planId === plan.id;
                            const canUpgrade = !isCurrentPlan;

                            return (
                                <div key={plan.id} className={`p-6 rounded-3xl border transition-all relative group ${isDark ? 'bg-primary border-zinc-800 hover:border-accent/50' : 'bg-white/10 border-white/10 hover:bg-white/20'}`}>
                                    {isCurrentPlan && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Active Plan</div>
                                    )}
                                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-blue-100'}`}>{plan.name}</p>
                                    <div className="flex items-baseline gap-1 mb-4">
                                        <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-white'}`}>₹{plan.price}</span>
                                        <span className={`text-[10px] font-bold ${isDark ? 'text-zinc-500' : 'text-blue-200'}`}>/one-time</span>
                                    </div>
                                    <div className="space-y-2 mb-6">
                                        <div className={`flex items-center gap-2 text-[9px] font-black uppercase ${isDark ? 'text-zinc-400' : 'text-white'}`}>
                                            <Users className="w-3 h-3" /> {plan.teams} Teams Max
                                        </div>
                                        <div className={`flex items-center gap-2 text-[9px] font-black uppercase ${isDark ? 'text-zinc-400' : 'text-white'}`}>
                                            <CheckCircle className="w-3 h-3 text-green-400" /> All Features
                                        </div>
                                    </div>
                                    <button 
                                        disabled={!canUpgrade}
                                        onClick={() => handleAuctionSubscription(selectedAuctionForUpgrade!, plan)}
                                        className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                            isCurrentPlan 
                                            ? 'bg-transparent border border-white/20 text-white/40 cursor-default' 
                                            : 'btn-golden'
                                        }`}
                                    >
                                        {isCurrentPlan ? 'Current' : 'Upgrade'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {auctions.map((auction) => (
                <div key={auction.id} className={`group rounded-[2.5rem] border transition-all duration-500 overflow-hidden relative ${isDark ? 'bg-secondary/40 border-zinc-800 hover:border-accent/30' : 'bg-white border-gray-100 shadow-xl hover:shadow-2xl hover:-translate-y-1'}`}>
                    {/* Card Header */}
                    <div className={`p-8 border-b flex justify-between items-start relative overflow-hidden ${isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-gray-50 bg-gray-50/30'}`}>
                        <div className="flex items-center gap-6 relative z-10">
                            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center overflow-hidden border-2 shadow-2xl transition-transform group-hover:scale-105 ${isDark ? 'bg-primary border-zinc-800' : 'bg-white border-white'}`}>
                                {auction.logoUrl ? (
                                    <img src={auction.logoUrl} alt={auction.title} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                                ) : (
                                    <Gavel className={`w-8 h-8 ${isDark ? 'text-zinc-800' : 'text-gray-200'}`} />
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className={`text-2xl font-black uppercase tracking-tighter ${isDark ? 'text-white' : 'text-gray-900'}`}>{auction.title}</h3>
                                    <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border-2 ${
                                        auction.status === 'LIVE' ? 'bg-green-500 text-white border-green-400 animate-pulse' : 
                                        auction.status === 'COMPLETED' ? 'bg-zinc-700 text-zinc-300 border-zinc-600' : 
                                        'bg-accent text-primary border-accent shadow-[0_0_10px_rgba(250,204,21,0.3)]'
                                    }`}>
                                        {auction.status}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                        <CalendarDays className="w-3.5 h-3.5" /> {auction.date || 'TBD'}
                                    </div>
                                    <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                        <Users className="w-3.5 h-3.5" /> {auction.currentTeamCount || 0} / {auction.totalTeams} Teams
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 relative z-10">
                            <button 
                                onClick={() => navigate(`/admin/auction/${auction.id}/manage`)}
                                className={`p-4 rounded-2xl transition-all ${isDark ? 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700' : 'bg-white text-gray-400 hover:text-blue-600 shadow-sm'}`}
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => handleDeleteAuction(auction.id, auction.title)}
                                className={`p-4 rounded-2xl transition-all ${isDark ? 'bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-red-400/10' : 'bg-white text-gray-400 hover:text-red-500 shadow-sm'}`}
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-8 grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <button 
                            onClick={() => {
                                window.open(`${window.location.origin}/#/auction/${auction.id}`, '_blank');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex-col gap-2 p-5 rounded-3xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center border border-emerald-500/50"
                        >
                            <Gavel className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Auction Room</span>
                        </button>
                        <button 
                            onClick={() => navigate(`/admin/auction/${auction.id}/manage`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex-col gap-2 p-5 rounded-3xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center justify-center border border-blue-500/50"
                        >
                            <Activity className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Live Control</span>
                        </button>
                        <button 
                            onClick={() => {
                                window.open(`${window.location.origin}/#/obs-green/${auction.id}`, '_blank');
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white flex-col gap-2 p-5 rounded-3xl transition-all shadow-lg shadow-purple-600/20 active:scale-95 flex items-center justify-center border border-purple-500/50"
                        >
                            <Monitor className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Public View</span>
                        </button>
                        <button 
                            onClick={() => navigate(`/admin/auction/${auction.id}/arrangement`)}
                            className="bg-amber-500 hover:bg-amber-600 text-white flex-col gap-2 p-5 rounded-3xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center border border-amber-400/50"
                        >
                            <Layout className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Category Board</span>
                        </button>
                        <button 
                            onClick={() => navigate(`/auction/${auction.id}/register`)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white flex-col gap-2 p-5 rounded-3xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center border border-indigo-500/50 sm:col-span-1"
                        >
                            <UserPlus className="w-6 h-6" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Player Signup</span>
                        </button>
                    </div>

                    {/* Card Footer */}
                    <div className={`px-8 py-4 flex justify-between items-center ${isDark ? 'bg-zinc-900/50 border-t border-zinc-800' : 'bg-gray-50/50 border-t border-gray-50'}`}>
                        <div className="flex items-center gap-2">
                            <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-accent' : 'text-blue-500'}`} />
                            <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                                Plan: {dbPlans.find(p => p.id === auction.planId)?.name || 'Starter Free'}
                            </span>
                        </div>
                        <div className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                            ID: {auction.id}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  const renderPlans = () => (
    <div className="space-y-12 animate-fade-in">
        <div className="text-center max-w-2xl mx-auto">
            <h2 className={`text-4xl font-black uppercase tracking-tighter mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Choose Your Arsenal</h2>
            <p className={`text-xs font-black uppercase tracking-[0.3em] ${isDark ? 'text-accent' : 'text-blue-600'}`}>Scale your tournament with professional tools</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {dbPlans.map((plan) => (
                <div key={plan.id} className={`flex flex-col rounded-[2.5rem] border transition-all duration-500 relative group overflow-hidden ${isDark ? 'bg-secondary/40 border-zinc-800 hover:border-accent/50' : 'bg-white border-gray-100 shadow-xl hover:shadow-2xl hover:-translate-y-2'}`}>
                    <div className={`p-8 border-b ${isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-gray-50 bg-gray-50/30'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${isDark ? 'text-accent' : 'text-blue-600'}`}>{plan.name}</p>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-4xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-gray-900'}`}>₹{plan.price}</span>
                            <span className={`text-[10px] font-bold ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>/one-time</span>
                        </div>
                    </div>
                    
                    <div className="p-8 flex-1 space-y-4">
                        <div className={`flex items-center gap-3 p-4 rounded-2xl ${isDark ? 'bg-primary/50 text-white' : 'bg-blue-50 text-blue-700'}`}>
                            <Users className="w-5 h-5" />
                            <span className="text-xs font-black uppercase tracking-widest">{plan.teams} Teams Max</span>
                        </div>
                        <div className="space-y-3 pt-4">
                            {COMMON_FEATURES.map((feat, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={`p-1 rounded-full ${isDark ? 'bg-accent/10 text-accent' : 'bg-blue-100 text-blue-600'}`}>
                                        <Check className="w-3 h-3" />
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>{feat.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-8 pt-0">
                        <button 
                            onClick={() => {
                                setActiveTab('AUCTIONS');
                                showNotification("Select an auction from the upgrade panel above", "success");
                            }}
                            className={`btn-golden w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95`}
                        >
                            Select Plan
                        </button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  const renderLegal = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
        {[
            { title: 'Terms of Service', icon: <Scale />, desc: 'Rules and regulations for using SM Sports Platform', color: 'blue' },
            { title: 'Privacy Policy', icon: <Shield />, desc: 'How we protect and manage your tournament data', color: 'indigo' },
            { title: 'Refund Policy', icon: <CreditCard />, desc: 'Details regarding subscription and payment reversals', color: 'amber' },
            { title: 'Contact Support', icon: <HelpCircle />, desc: 'Need help? Our technical team is available 24/7', color: 'emerald' }
        ].map((item, i) => (
            <div key={i} className={`p-8 rounded-[2.5rem] border transition-all duration-500 group cursor-pointer ${isDark ? 'bg-secondary/40 border-zinc-800 hover:border-accent/30' : 'bg-white border-gray-100 shadow-xl hover:shadow-2xl'}`}>
                <div className="flex items-center gap-6">
                    <div className={`p-5 rounded-[1.5rem] shadow-2xl transition-transform group-hover:scale-110 ${
                        isDark ? 'bg-zinc-900 text-accent' : 
                        item.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                        item.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                        item.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                        'bg-emerald-50 text-emerald-600'
                    }`}>
                        {React.cloneElement(item.icon as React.ReactElement<any>, { className: 'w-8 h-8' })}
                    </div>
                    <div>
                        <h3 className={`text-2xl font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</h3>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{item.desc}</p>
                    </div>
                </div>
            </div>
        ))}
    </div>
  );

  return (
    <div className={`min-h-screen font-sans pb-20 transition-colors duration-300 ${isDark ? 'bg-black text-white' : 'bg-[#f8f9fa] text-gray-900'} selection:bg-accent/30 selection:text-accent`}>
      
      {/* System Popup Broadcaster */}
      {currentPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
              <div className={`rounded-[3rem] shadow-2xl max-w-lg w-full overflow-hidden border animate-slide-up ${isDark ? 'bg-[#151515] border-amber-500/30' : 'bg-white border-gray-200'}`}>
                  <div className={`p-8 text-white relative ${isDark ? 'bg-gradient-to-br from-amber-600 to-amber-900' : 'bg-gradient-to-br from-blue-600 to-blue-800'}`}>
                      <button onClick={() => closeSystemPopup(currentPopup.id!)} className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors"><X className="w-6 h-6"/></button>
                      <h3 className="text-2xl font-black uppercase tracking-tighter mb-1">{currentPopup.title}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-60">System Broadcaster Active</p>
                  </div>
                  <div className="p-10 space-y-8">
                      {currentPopup.showImage && currentPopup.imageUrl && (
                          <div className={`rounded-3xl overflow-hidden border shadow-lg ${isDark ? 'border-amber-500/20' : 'border-gray-100'}`}><img src={currentPopup.imageUrl} className="w-full h-auto" /></div>
                      )}
                      {currentPopup.showText && (
                          <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} font-medium leading-relaxed`}>{currentPopup.message}</p>
                      )}
                      <div className="flex gap-3">
                        <button onClick={() => closeSystemPopup(currentPopup.id!)} className={`btn-golden flex-1 font-black py-4 rounded-2xl text-xs uppercase tracking-widest active:scale-95`}>{currentPopup.okButtonText}</button>
                        <button onClick={() => closeSystemPopup(currentPopup.id!)} className={`px-8 font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all ${isDark ? 'bg-white/10 hover:bg-white/20 text-amber-500' : 'bg-gray-100 hover:bg-gray-200 text-gray-400'}`}>{currentPopup.closeButtonText}</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <nav className={`border-b sticky top-0 z-40 transition-colors duration-300 ${isDark ? 'bg-black/80 border-amber-500/20 backdrop-blur-md' : 'bg-white border-gray-200'}`}>
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl border-2 p-1.5 shadow flex items-center justify-center overflow-hidden ${isDark ? 'bg-black border-amber-500' : 'bg-black border-blue-500'}`}>
                    {state.systemLogoUrl ? <img src={state.systemLogoUrl} className="max-w-full max-h-full object-contain" alt="SM Sports" /> : <Trophy className={`w-full h-full ${isDark ? 'text-amber-500' : 'text-blue-500'}`} />}
                </div>
                <div>
                    <h1 className={`text-lg font-black tracking-tighter uppercase leading-none ${isDark ? 'advaya-text' : 'text-gray-800'}`}>Control Center</h1>
                    <p className={`text-[8px] font-bold uppercase tracking-widest mt-1 ${isDark ? 'text-amber-500/50' : 'text-gray-400'}`}>Registry Operator ID: {userProfile?.uid.slice(0, 8)}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button 
                  onClick={toggleTheme}
                  className={`p-2 rounded-xl transition-all active:scale-90 ${isDark ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <div className={`flex p-1 rounded-xl border gap-1 overflow-x-auto no-scrollbar ${isDark ? 'bg-white/5 border-amber-500/20' : 'bg-gray-100 border-gray-200'}`}>
                    <button onClick={() => setActiveTab('AUCTIONS')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'AUCTIONS' ? 'bg-accent text-black shadow-lg shadow-accent/20' : (isDark ? 'text-accent/50 hover:text-accent' : 'text-gray-400 hover:text-gray-600')}`}>Auctions</button>
                    <button onClick={() => setActiveTab('PLANS')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'PLANS' ? 'bg-accent text-black shadow-lg shadow-accent/20' : (isDark ? 'text-accent/50 hover:text-accent' : 'text-gray-400 hover:text-gray-600')}`}>Plans</button>
                    <button onClick={() => setActiveTab('LEGAL')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'LEGAL' ? 'bg-accent text-black shadow-lg shadow-accent/20' : (isDark ? 'text-accent/50 hover:text-accent' : 'text-gray-400 hover:text-gray-600')}`}>Legal</button>
                </div>
                <div className={`w-px h-6 mx-2 hidden md:block ${isDark ? 'bg-amber-500/20' : 'bg-gray-200'}`}></div>
                <button onClick={logout} className={`p-2 transition-colors ${isDark ? 'text-amber-500/50 hover:text-red-500' : 'text-gray-400 hover:text-red-500'}`}><LogOut className="w-5 h-5"/></button>
            </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-10 max-w-6xl">
          {error && (
              <div className={`border-l-4 p-6 rounded-2xl flex items-start gap-4 mb-8 shadow-sm ${isDark ? 'bg-red-900/20 border-red-500' : 'bg-red-50 border-red-500'}`}>
                  <ShieldAlert className="text-red-500 w-6 h-6 shrink-0 mt-0.5" />
                  <div>
                      <h4 className={`font-black uppercase text-xs tracking-widest mb-1 ${isDark ? 'text-red-400' : 'text-red-800'}`}>System Error Encountered</h4>
                      <p className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>
                  </div>
              </div>
          )}

          {activeTab === 'AUCTIONS' && renderAuctions()}
          {activeTab === 'PLANS' && renderPlans()}
          {activeTab === 'LEGAL' && renderLegal()}
      </main>

      <footer className="mt-auto py-10 text-center opacity-40">
          <p className={`text-[10px] font-black uppercase tracking-[0.5em] ${isDark ? 'text-amber-500/30' : 'text-gray-400'}`}>&copy; 2025 SM SPORTS CORE SYSTEM</p>
      </footer>

      {/* NOTIFICATION BANNER */}
      {notification && (
          <div className={`fixed top-4 right-4 z-[300] p-4 rounded-lg shadow-2xl border flex items-center gap-3 max-w-md animate-in fade-in slide-in-from-top-4 duration-300 ${notification.type === 'error' ? 'bg-red-900 border-red-500 text-white' : (isDark ? 'bg-amber-900/90 border-amber-500 text-amber-100' : 'bg-green-900 border-green-500 text-white')}`}>
              {notification.type === 'error' ? <XCircle className="w-5 h-5 text-red-400" /> : <CheckCircle className={`w-5 h-5 ${isDark ? 'text-amber-500' : 'text-green-400'}`} />}
              <span className="text-sm font-bold">{notification.message}</span>
              <button onClick={() => setNotification(null)} className="ml-auto hover:text-gray-300"><X className="w-4 h-4"/></button>
          </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL */}
      {confirmAction && (
          <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
              <div className={`rounded-3xl p-8 max-w-sm w-full shadow-2xl border ${isDark ? 'bg-[#151515] border-amber-500/20' : 'bg-white border-gray-100'}`}>
                  <div className={`flex items-center gap-4 mb-6 ${isDark ? 'text-amber-500' : 'text-amber-500'}`}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                          <AlertTriangle className="w-6 h-6" />
                      </div>
                      <h3 className={`text-xl font-black uppercase tracking-tighter ${isDark ? 'text-amber-100' : 'text-gray-800'}`}>{confirmAction.title}</h3>
                  </div>
                  <p className={`text-sm font-bold mb-8 leading-relaxed ${isDark ? 'text-amber-500/50' : 'text-gray-500'}`}>{confirmAction.message}</p>
                  <div className="flex gap-3">
                      <button 
                          onClick={() => setConfirmAction(null)}
                          className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-amber-500/50' : 'bg-gray-100 hover:bg-gray-200 text-gray-400'}`}
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={confirmAction.onConfirm}
                          className={`btn-golden flex-1 py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95`}
                      >
                          Confirm
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;