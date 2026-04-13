
import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { AuctionContextType, AuctionState, UserProfile, Team, Player, AuctionStatus, BiddingStatus, AdminViewOverride, BidIncrementSlab, UserRole, SponsorConfig } from '../types';
import { db, auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { calculateMaxBid, getEffectiveBasePrice } from '../utils';

// Initial State
const initialState: AuctionState = {
    players: [],
    teams: [],
    unsoldPlayers: [],
    categories: [],
    roles: [],
    status: AuctionStatus.NotStarted,
    currentPlayerId: null,
    currentPlayerIndex: null,
    currentBid: null,
    highestBidder: null,
    timer: 0,
    bidIncrement: 0,
    bidSlabs: [],
    auctionLog: [],
    biddingStatus: 'PAUSED',
    playerSelectionMode: 'MANUAL',
    auctionLogoUrl: '',
    tournamentName: '',
    sponsors: [],
    sponsorConfig: { showOnOBS: false, showOnProjector: false, loopInterval: 5 },
    projectorLayout: 'STANDARD',
    obsLayout: 'STANDARD',
    adminViewOverride: null,
    maxPlayersPerTeam: 25,
    systemLogoUrl: '',
    systemTagline: 'Your streaming partner',
    isPaid: false,
    basePrice: 0
};

export const AuctionContext = createContext<AuctionContextType | null>(null);

export const AuctionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuctionState>(initialState);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [activeAuctionId, setActiveAuctionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Global Settings Listener
    useEffect(() => {
        const unsub = db.collection('appConfig').doc('globalSettings').onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                setState(prev => ({ 
                    ...prev, 
                    systemLogoUrl: data?.systemLogoUrl || '',
                    systemTagline: data?.systemTagline || 'Your streaming partner',
                    hideScoringSection: data?.hideScoringSection || false
                }));
            }
        });
        return () => unsub();
    }, []);

    // Auth & User Profile Listener
    useEffect(() => {
        let profileUnsub: () => void = () => {};

        const authUnsub = auth.onAuthStateChanged(async (user) => {
            if (user) {
                profileUnsub();
                if (user.isAnonymous) {
                    const teamSession = localStorage.getItem('sm_sports_team_session');
                    const staffSession = localStorage.getItem('sm_sports_staff_session');

                    if (teamSession) {
                        const data = JSON.parse(teamSession);
                        setUserProfile({
                            uid: user.uid,
                            email: 'team@smsports.com',
                            role: UserRole.TEAM_OWNER,
                            teamId: data.teamId
                        });
                        if (data.auctionId) joinAuction(data.auctionId);
                    } else if (staffSession) {
                        const data = JSON.parse(staffSession);
                        // FETCH STAFF PROFILE: Ensure they are treated as STAFF in the OS
                        profileUnsub = db.collection('users').doc(data.uid).onSnapshot(doc => {
                            if (doc.exists) {
                                const s = doc.data();
                                setUserProfile({
                                    uid: data.uid, // Use the actual user registry UID
                                    email: s?.email || data.email,
                                    name: s?.name || 'Support Node',
                                    role: s?.role || UserRole.SUPPORT
                                });
                            } else {
                                // Fallback for quick sessions
                                setUserProfile({
                                    uid: user.uid,
                                    email: data.email,
                                    name: 'Support Agent',
                                    role: UserRole.SUPPORT
                                });
                            }
                        });
                    } else {
                        setUserProfile({ uid: user.uid, email: 'viewer@smsports.com', role: UserRole.VIEWER });
                    }
                } else {
                    const SUPER_ADMIN_EMAIL = 'mezabiullakhan@gmail.com';
                    const isSuperAdminAccount = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

                    profileUnsub = db.collection('users').doc(user.uid).onSnapshot(doc => {
                        const userData = doc.data();
                        const profile: UserProfile = {
                            uid: user.uid,
                            email: user.email || '',
                            name: user.displayName || userData?.name || 'System Operator',
                            role: isSuperAdminAccount ? UserRole.SUPER_ADMIN : (userData?.role || UserRole.ADMIN),
                            plan: userData?.plan || { type: 'FREE', maxTeams: 2, maxAuctions: 1 }
                        };
                        setUserProfile(profile);
                    });
                }
            } else {
                profileUnsub();
                setUserProfile(null);
            }
        });
        return () => { authUnsub(); profileUnsub(); };
    }, []);

    // Auction Listener
    useEffect(() => {
        if (!activeAuctionId) return;

        const unsubscribe = db.collection('auctions').doc(activeAuctionId).onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if (data) {
                    setState(prev => ({
                        ...prev,
                        ...data,
                        bidSlabs: data.slabs || [],
                        tournamentName: data.title || prev.tournamentName,
                        auctionLogoUrl: data.logoUrl || prev.auctionLogoUrl,
                        sponsorConfig: data.sponsorConfig || prev.sponsorConfig || { showOnOBS: false, showOnProjector: false, loopInterval: 5 },
                        maxPlayersPerTeam: data.playersPerTeam || 25,
                        isPaid: data.isPaid || false
                    }));
                }
            } else {
                setError("Auction not found");
            }
        }, (err) => {
            console.error("Auction Listener Error", err);
            setError(err.message);
        });

        const unsubTeams = db.collection('auctions').doc(activeAuctionId).collection('teams').onSnapshot(snap => {
            const teams = snap.docs.map(d => {
                const data = d.data();
                return { id: d.id, ...data, players: data.players || [] } as Team;
            });
            setState(prev => ({ ...prev, teams }));
        });

        const unsubPlayers = db.collection('auctions').doc(activeAuctionId).collection('players').onSnapshot(snap => {
            const allPlayers = snap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
            setState(prev => ({ ...prev, players: allPlayers }));
        });
        
        const unsubCategories = db.collection('auctions').doc(activeAuctionId).collection('categories').onSnapshot(snap => {
             const categories = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
             setState(prev => ({ ...prev, categories }));
        });

        const unsubSponsors = db.collection('auctions').doc(activeAuctionId).collection('sponsors').onSnapshot(snap => {
             const sponsors = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
             setState(prev => ({ ...prev, sponsors }));
        });

        return () => {
            unsubscribe();
            unsubTeams();
            unsubPlayers();
            unsubCategories();
            unsubSponsors();
        };
    }, [activeAuctionId]);

    const joinAuction = (id: string) => {
        setActiveAuctionId(id);
    };

    const logout = async () => {
        await auth.signOut();
        localStorage.removeItem('sm_sports_team_session');
        localStorage.removeItem('sm_sports_staff_session');
        setUserProfile(null);
        setActiveAuctionId(null);
        setState(initialState);
    };

    const derivedUnsoldPlayers = useMemo(() => {
        return state.players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
    }, [state.players]);

    const derivedCurrentPlayerIndex = useMemo(() => {
        if (!state.currentPlayerId || derivedUnsoldPlayers.length === 0) return null;
        const idx = derivedUnsoldPlayers.findIndex(p => String(p.id) === String(state.currentPlayerId));
        return idx !== -1 ? idx : null;
    }, [state.currentPlayerId, derivedUnsoldPlayers]);

    const activeState = {
        ...state,
        unsoldPlayers: derivedUnsoldPlayers,
        currentPlayerIndex: derivedCurrentPlayerIndex
    };

    const nextBid = useMemo(() => {
        const { currentPlayerId, players, currentBid, bidIncrement, bidSlabs, categories } = state;
        const currentPlayer = players.find(p => String(p.id) === String(currentPlayerId));
        if (!currentPlayer) return 0;

        const basePrice = getEffectiveBasePrice(currentPlayer, categories);
        const currentPrice = Number(currentBid) || 0;

        // 1. Initial Bid (No bids yet)
        if (currentPrice === 0) {
            // If basePrice is 0, use bidIncrement or default to 100
            return basePrice > 0 ? basePrice : (Number(bidIncrement) || 100);
        }

        // 2. Subsequent Bids
        // Priority 1: Category Specific Slabs
        if (currentPlayer.category) {
            const cat = categories.find(c => c.name === currentPlayer.category);
            if (cat && cat.slabs && cat.slabs.length > 0) {
                 const sortedSlabs = [...cat.slabs].sort((a, b) => Number(b.from) - Number(a.from));
                 const activeSlab = sortedSlabs.find(s => currentPrice >= Number(s.from));
                 if (activeSlab) return currentPrice + Number(activeSlab.increment);
            }
        }

        // Priority 2: Global Slabs
        if (bidSlabs && bidSlabs.length > 0) {
            const sortedSlabs = [...bidSlabs].sort((a, b) => Number(b.from) - Number(a.from));
            const activeSlab = sortedSlabs.find(s => currentPrice >= Number(s.from));
            if (activeSlab) return currentPrice + Number(activeSlab.increment);
        }

        // Priority 3: Default Increment
        const increment = Number(bidIncrement) || 100;
        return currentPrice + increment;
    }, [state.currentBid, state.currentPlayerId, state.players, state.bidIncrement, state.bidSlabs, state.categories]);

    const placeBid = async (teamId: string | number, amount: number) => {
        if (!activeAuctionId) return;
        const team = state.teams.find(t => String(t.id) === String(teamId));
        if (!team) throw new Error("Team not found");
        
        const currentPlayer = state.players.find(p => String(p.id) === String(state.currentPlayerId));
        if (currentPlayer) {
            const targetSquadSize = state.maxPlayersPerTeam || 11;
            const currentSquadCount = team.players.length;
            const playersStillNeededAfterThis = targetSquadSize - (currentSquadCount + 1);

            if (targetSquadSize - currentSquadCount <= 0) {
                throw new Error("Squad Limit Reached!");
            }

            // Category Max Limit Check
            if (currentPlayer.category) {
                const cat = state.categories.find(c => c.name === currentPlayer.category);
                if (cat && cat.maxPerTeam > 0) {
                    const countInCat = team.players.filter(p => p.category === cat.name).length;
                    if (countInCat >= cat.maxPerTeam) {
                        throw new Error(`Category Limit Reached! This team already has ${cat.maxPerTeam} players from category ${cat.name}.`);
                    }
                }
            }

            if (!state.unlimitedPurse) {
                const { maxBid, reservedAmount, playersNeeded } = calculateMaxBid(team, state, currentPlayer);

                if (amount > maxBid) {
                    throw new Error(
                        `Insufficient purse to complete squad. You must reserve ₹${reservedAmount} for the remaining ${playersNeeded} players to meet minimum requirements.`
                    );
                }
            }
        }

        const log = { message: `${team.name} bid ${amount}`, timestamp: Date.now(), type: 'BID' };
        await db.collection('auctions').doc(activeAuctionId).update({
            currentBid: amount, highestBidder: team, timer: 10,
            auctionLog: firebase.firestore.FieldValue.arrayUnion(log)
        });
    };

    const sellPlayer = async (teamId?: string | number, customPrice?: number) => {
        if (!activeAuctionId || !state.currentPlayerId) return;
        const finalTeam = teamId ? state.teams.find(t => String(t.id) === String(teamId)) : state.highestBidder;
        const finalPrice = customPrice !== undefined ? customPrice : (state.currentBid || 0);
        if (!finalTeam) throw new Error("No team selected to sell to");
        const player = state.players.find(p => String(p.id) === String(state.currentPlayerId));
        if (!player) return;

        // Reserve Check for Admin Sale
        if (!state.unlimitedPurse) {
            const { maxBid, reservedAmount, playersNeeded } = calculateMaxBid(finalTeam, state, player);
            if (finalPrice > maxBid) {
                throw new Error(`Cannot sell: Team needs ₹${reservedAmount} in reserve to buy remaining ${playersNeeded} players.`);
            }
        }

        await db.runTransaction(async (transaction) => {
            const auctionRef = db.collection('auctions').doc(activeAuctionId);
            const playerRef = auctionRef.collection('players').doc(String(player.id));
            const teamRef = auctionRef.collection('teams').doc(String(finalTeam.id));
            const teamDoc = await transaction.get(teamRef);
            if (!teamDoc.exists) throw new Error("Target team document does not exist");
            const teamData = teamDoc.data() as Team;
            transaction.update(playerRef, { status: 'SOLD', soldPrice: finalPrice, soldTo: finalTeam.name });
            const updatedPlayers = [...(teamData.players || []), { ...player, status: 'SOLD', soldPrice: finalPrice, soldTo: finalTeam.name }];
            const newBudget = (teamData.budget || 0) - finalPrice;
            transaction.update(teamRef, { budget: newBudget, players: updatedPlayers });
            const log = { message: `${player.name} SOLD to ${finalTeam.name} for ${finalPrice}`, timestamp: Date.now(), type: 'SOLD' };
            transaction.update(auctionRef, { status: AuctionStatus.Sold, auctionLog: firebase.firestore.FieldValue.arrayUnion(log), currentBid: finalPrice, highestBidder: finalTeam });
        });
    };

    const passPlayer = async () => {
        if (!activeAuctionId || !state.currentPlayerId) return;
        const player = state.players.find(p => String(p.id) === String(state.currentPlayerId));
        if (!player) return;
        await db.collection('auctions').doc(activeAuctionId).collection('players').doc(String(player.id)).update({ status: 'UNSOLD' });
        const log = { message: `${player.name} UNSOLD`, timestamp: Date.now(), type: 'UNSOLD' };
        await db.collection('auctions').doc(activeAuctionId).update({ status: AuctionStatus.Unsold, auctionLog: firebase.firestore.FieldValue.arrayUnion(log) });
    };

    const startAuction = async (specificPlayerId?: string | number) => {
        if (!activeAuctionId) return false;
        let nextPlayerId = specificPlayerId;
        if (!nextPlayerId) {
            const available = state.players.filter(p => p.status !== 'SOLD' && p.status !== 'UNSOLD');
            if (available.length === 0) return false;
            const next = available[Math.floor(Math.random() * available.length)];
            nextPlayerId = next.id;
        }
        if (!nextPlayerId) return false;
        const player = state.players.find(p => String(p.id) === String(nextPlayerId));
        await db.collection('auctions').doc(activeAuctionId).update({
            currentPlayerId: nextPlayerId, currentBid: 0, highestBidder: null, status: AuctionStatus.InProgress, timer: 10,
            auctionLog: firebase.firestore.FieldValue.arrayUnion({ message: `Bidding started for ${player?.name}`, timestamp: Date.now(), type: 'SYSTEM' })
        });
        return true;
    };

    const undoPlayerSelection = async () => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ currentPlayerId: null, currentBid: 0, highestBidder: null, status: AuctionStatus.NotStarted });
    };

    const resetCurrentPlayer = async () => {
        if (!activeAuctionId || !state.currentPlayerId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ currentBid: 0, highestBidder: null, timer: 10, status: AuctionStatus.InProgress });
    };

    const endAuction = async () => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ status: AuctionStatus.Finished, currentPlayerId: null });
    };

    const resetAuction = async () => {
        if (!activeAuctionId) return;
        const auctionRef = db.collection('auctions').doc(activeAuctionId);
        const auctionSnap = await auctionRef.get();
        if (!auctionSnap.exists) return;
        const defaultPurse = auctionSnap.data()?.purseValue || 10000;
        const playersSnap = await auctionRef.collection('players').get();
        const teamsSnap = await auctionRef.collection('teams').get();
        const modifiedPlayers = playersSnap.docs.filter(d => { const data = d.data(); return data.status !== undefined || data.soldPrice !== undefined || data.soldTo !== undefined; });
        const batchSize = 300;
        const allDocs = [ ...modifiedPlayers.map(d => ({ type: 'PLAYER', ref: d.ref })), ...teamsSnap.docs.map(d => ({ type: 'TEAM', ref: d.ref })) ];
        for (let i = 0; i < allDocs.length; i += batchSize) {
            const batch = db.batch();
            const chunk = allDocs.slice(i, i + batchSize);
            chunk.forEach(item => {
                if (item.type === 'PLAYER') { batch.update(item.ref, { status: firebase.firestore.FieldValue.delete(), soldPrice: firebase.firestore.FieldValue.delete(), soldTo: firebase.firestore.FieldValue.delete() }); }
                else { batch.update(item.ref, { budget: defaultPurse, players: [] }); }
            });
            if (i === 0) { batch.update(auctionRef, { status: AuctionStatus.NotStarted, currentPlayerId: null, currentBid: 0, highestBidder: null, auctionLog: [], timer: 0 }); }
            await batch.commit();
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    };

    const resetUnsoldPlayers = async () => {
        if (!activeAuctionId) return;
        const unsold = state.players.filter(p => p.status === 'UNSOLD');
        const batchSize = 300;
        for (let i = 0; i < unsold.length; i += batchSize) {
             const batch = db.batch();
             const chunk = unsold.slice(i, i + batchSize);
             chunk.forEach(p => {
                 const ref = db.collection('auctions').doc(activeAuctionId).collection('players').doc(String(p.id));
                 batch.update(ref, { status: firebase.firestore.FieldValue.delete() });
             });
             await batch.commit();
        }
    };

    const updateBiddingStatus = async (status: BiddingStatus) => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ biddingStatus: status });
    };

    const updateSponsorConfig = async (config: SponsorConfig) => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ sponsorConfig: config });
    };

    const toggleSelectionMode = async () => {
        if (!activeAuctionId) return;
        const newMode = state.playerSelectionMode === 'MANUAL' ? 'AUTO' : 'MANUAL';
        await db.collection('auctions').doc(activeAuctionId).update({ playerSelectionMode: newMode });
    };

    const updateTheme = async (type: 'PROJECTOR' | 'OBS', layout: string) => {
        if (!activeAuctionId) return;
        const field = type === 'PROJECTOR' ? 'projectorLayout' : 'obsLayout';
        await db.collection('auctions').doc(activeAuctionId).update({ [field]: layout });
    };

    const setAdminView = async (view: AdminViewOverride | null) => {
        if (!activeAuctionId) return;
        await db.collection('auctions').doc(activeAuctionId).update({ adminViewOverride: view });
    };

    const correctPlayerSale = async (playerId: string, newTeamId: string | null, newPrice: number) => {
        if (!activeAuctionId) return;
        const auctionRef = db.collection('auctions').doc(activeAuctionId);
        await db.runTransaction(async (t) => {
            const playerRef = auctionRef.collection('players').doc(playerId);
            const playerDoc = await t.get(playerRef);
            const playerData = playerDoc.data() as Player;
            if (playerData.status === 'SOLD' && playerData.soldTo) {
                const prevTeam = state.teams.find(tm => tm.name === playerData.soldTo);
                if (prevTeam) {
                    const prevTeamRef = auctionRef.collection('teams').doc(String(prevTeam.id));
                    const prevTeamDoc = await t.get(prevTeamRef);
                    if (prevTeamDoc.exists) {
                        const ptData = prevTeamDoc.data() as Team;
                        const refund = playerData.soldPrice || 0;
                        t.update(prevTeamRef, { budget: (ptData.budget || 0) + refund, players: (ptData.players || []).filter(p => String(p.id) !== playerId) });
                    }
                }
            }
            if (newTeamId) {
                const newTeamRef = auctionRef.collection('teams').doc(newTeamId);
                const newTeamDoc = await t.get(newTeamRef);
                const newTeamData = newTeamDoc.data() as Team;
                t.update(newTeamRef, { budget: (newTeamData.budget || 0) - newPrice, players: [...(newTeamData.players || []), { ...playerData, status: 'SOLD', soldPrice: newPrice, soldTo: newTeamData.name }] });
                t.update(playerRef, { status: 'SOLD', soldPrice: newPrice, soldTo: newTeamData.name });
            } else {
                t.update(playerRef, { status: firebase.firestore.FieldValue.delete(), soldPrice: firebase.firestore.FieldValue.delete(), soldTo: firebase.firestore.FieldValue.delete() });
            }
        });
    };

    return (
        <AuctionContext.Provider value={{
            state: activeState, userProfile, setUserProfile, placeBid, sellPlayer, passPlayer, correctPlayerSale, startAuction, undoPlayerSelection, endAuction, resetAuction, resetCurrentPlayer, resetUnsoldPlayers, updateBiddingStatus, updateSponsorConfig, toggleSelectionMode, updateTheme, setAdminView, logout, error, joinAuction, activeAuctionId, nextBid
        }}>
            {children}
        </AuctionContext.Provider>
    );
};
