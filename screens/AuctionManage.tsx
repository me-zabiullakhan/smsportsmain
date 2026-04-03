import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, Team, Player, AuctionCategory, Sponsor, PlayerRole, RegistrationConfig, FormField, RegisteredPlayer, BidIncrementSlab } from '../types';
import { 
    ArrowLeft, Plus, Trash2, Edit, Save, X, Upload, Users, Layers, Trophy, 
    DollarSign, Image as ImageIcon, Briefcase, FileText, Settings, QrCode, 
    AlignLeft, CheckSquare, Square, Palette, ChevronDown, Search, CheckCircle, 
    XCircle, Clock, Calendar, Info, ListPlus, Eye, EyeOff, Copy, Link as LinkIcon, 
    Check as CheckIcon, ShieldCheck, Tag, User, TrendingUp, CreditCard, Shield, 
    UserCheck, UserX, Share2, Download, FileSpreadsheet, Filter, Key, 
    ExternalLink, LayoutList, ToggleRight, ToggleLeft, RefreshCw, FileUp, 
    Star, UserPlus, Loader2, FileDown, ChevronRight, Zap, ListChecks, Type, Hash, ChevronDownCircle, Megaphone, Phone
} from 'lucide-react';
import firebase from 'firebase/compat/app';
import * as XLSX from 'xlsx';
import { useAuction } from '../hooks/useAuction';

const compressImage = (file: File, isBanner: boolean = false): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = isBanner ? 1920 : 800;
                const MAX_HEIGHT = isBanner ? 1080 : 800;
                let width = img.width;
                let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', isBanner ? 0.95 : 0.85));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

const DEFAULT_REG_CONFIG: RegistrationConfig = {
    isEnabled: false,
    includePayment: false,
    paymentMethod: 'MANUAL',
    isPublic: true,
    fee: 0,
    upiId: '',
    upiName: '',
    qrCodeUrl: '',
    terms: '1. Registration fee is non-refundable.\n2. Players must reporting 30 mins before match.',
    customFields: [],
    organizerContact: ''
};

const AuctionManage: React.FC = () => {
    const { userProfile } = useAuction();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'SETTINGS' | 'TEAMS' | 'PLAYERS' | 'REQUESTS' | 'CATEGORIES' | 'ROLES' | 'SPONSORS' | 'REGISTRATION' | 'WAITLIST'>('SETTINGS');
    const [loading, setLoading] = useState(true);
    const [auction, setAuction] = useState<AuctionSetup | null>(null);

    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [categories, setCategories] = useState<AuctionCategory[]>([]);
    const [roles, setRoles] = useState<PlayerRole[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [registrations, setRegistrations] = useState<RegisteredPlayer[]>([]);
    const [waitlist, setWaitlist] = useState<any[]>([]);
    
    const [regConfig, setRegConfig] = useState<RegistrationConfig>(DEFAULT_REG_CONFIG);

    const [settingsForm, setSettingsForm] = useState({
        title: '', date: '', matchesDate: '', sport: '', purseValue: 0, basePrice: 0, bidIncrement: 0, playersPerTeam: 0, totalTeams: 0, logoUrl: '', dateTBD: false
    });
    const [slabs, setSlabs] = useState<BidIncrementSlab[]>([]);
    const [newSlab, setNewSlab] = useState({ from: '', increment: '' });

    // CRUD Modals
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<'TEAM' | 'PLAYER' | 'CATEGORY' | 'ROLE' | 'SPONSOR' | 'CSV'>('TEAM');
    const [editItem, setEditItem] = useState<any>(null);
    const [previewImage, setPreviewImage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const qrInputRef = useRef<HTMLInputElement>(null);
    const regLogoInputRef = useRef<HTMLInputElement>(null);
    const regBannerInputRef = useRef<HTMLInputElement>(null);

    // Custom Field State
    const [newField, setNewField] = useState<Partial<FormField>>({ label: '', type: 'text', required: true, options: [] });
    const [optionInput, setOptionInput] = useState('');

    // Registration Details Modal
    const [showRegModal, setShowRegModal] = useState(false);
    const [selectedReg, setSelectedReg] = useState<RegisteredPlayer | null>(null);
    const [isEditingReg, setIsEditingReg] = useState(false);

    useEffect(() => {
        if (!id) return;
        const unsubAuction = db.collection('auctions').doc(id).onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data() as AuctionSetup;
                setAuction(data);
                if (data.registrationConfig) setRegConfig({ ...DEFAULT_REG_CONFIG, ...data.registrationConfig });
                setSettingsForm({
                    title: data.title || '', 
                    date: data.date === 'TBD' ? '' : (data.date || ''), 
                    matchesDate: data.matchesDate || '',
                    sport: data.sport || '', 
                    purseValue: data.purseValue || 0,
                    basePrice: data.basePrice || 0, 
                    bidIncrement: data.bidIncrement || 0, 
                    playersPerTeam: data.playersPerTeam || 0, 
                    totalTeams: data.totalTeams || 0,
                    logoUrl: data.logoUrl || '',
                    dateTBD: data.date === 'TBD' || !!data.dateTBD
                });
                if (data.slabs) setSlabs(data.slabs);
            }
            setLoading(false);
        });

        const unsubTeams = db.collection('auctions').doc(id).collection('teams').onSnapshot(s => setTeams(s.docs.map(d => ({id: d.id, ...d.data()}) as Team)));
        const unsubPlayers = db.collection('auctions').doc(id).collection('players').onSnapshot(s => setPlayers(s.docs.map(d => ({id: d.id, ...d.data()}) as Player)));
        const unsubCats = db.collection('auctions').doc(id).collection('categories').onSnapshot(s => setCategories(s.docs.map(d => ({id: d.id, ...d.data()}) as AuctionCategory)));
        const unsubRoles = db.collection('auctions').doc(id).collection('roles').onSnapshot(s => setRoles(s.docs.map(d => ({id: d.id, ...d.data()}) as PlayerRole)));
        const unsubSponsors = db.collection('auctions').doc(id).collection('sponsors').onSnapshot(s => setSponsors(s.docs.map(d => ({id: d.id, ...d.data()}) as Sponsor)));
        const unsubRegs = db.collection('auctions').doc(id).collection('registrations').onSnapshot(s => setRegistrations(s.docs.map(d => ({id: d.id, ...d.data()}) as RegisteredPlayer)));
        const unsubWaitlist = db.collection('auctions').doc(id).collection('waitlist').onSnapshot(s => setWaitlist(s.docs.map(d => ({id: d.id, ...d.data()}))));

        return () => {
            unsubAuction(); unsubTeams(); unsubPlayers(); unsubCats(); unsubRoles(); unsubSponsors(); unsubRegs(); unsubWaitlist();
        };
    }, [id]);

    const handleSaveSettings = async () => {
        if (!id) return;
        try {
            const updateData = {
                ...settingsForm,
                date: settingsForm.dateTBD ? 'TBD' : settingsForm.date,
                slabs
            };
            await db.collection('auctions').doc(id).update(updateData);
            alert("Auction Identity Protocols Synced!");
        } catch (e: any) { alert("Save failed: " + e.message); }
    };

    const handleSaveRegistration = async () => {
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).update({ registrationConfig: regConfig });
            alert("Registration Protocol Deployed!");
        } catch (e: any) { alert("Failed: " + e.message); }
    };

    const handleRevertToPending = async (regId: string) => {
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).collection('registrations').doc(regId).update({ status: 'PENDING' });
        } catch (e: any) { alert("Revert failed: " + e.message); }
    };

    const handleApproveAndAdd = async (reg: RegisteredPlayer) => {
        if (!id) return;
        try {
            // 1. Update registration status
            await db.collection('auctions').doc(id).collection('registrations').doc(reg.id).update({ status: 'APPROVED' });
            
            // Check if already in pool (by name)
            const existing = players.find(p => p.name === reg.fullName);
            if (existing) {
                alert(`${reg.fullName} is already in the player pool.`);
                return;
            }

            // 2. Add to players collection
            const newPlayer: Partial<Player> = {
                name: reg.fullName,
                photoUrl: reg.profilePic,
                category: 'Standard', // Default category
                role: reg.playerType,
                basePrice: auction?.basePrice || 0,
                nationality: 'India',
                speciality: reg.playerType,
                stats: { matches: 0, runs: 0, wickets: 0 }
            };
            
            await db.collection('auctions').doc(id).collection('players').add(newPlayer);
            alert(`${reg.fullName} approved and added to player pool!`);
        } catch (e: any) { alert("Approval failed: " + e.message); }
    };

    const handleUpdateRegistration = async (updatedReg: RegisteredPlayer) => {
        if (!id) return;
        try {
            const { id: regId, ...data } = updatedReg;
            await db.collection('auctions').doc(id).collection('registrations').doc(regId).update(data);
            setSelectedReg(updatedReg);
            setIsEditingReg(false);
            alert("Registration details updated!");
        } catch (e: any) { alert("Update failed: " + e.message); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'MODAL' | 'LOGO' | 'QR' | 'REG_LOGO' | 'REG_BANNER') => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0], type === 'REG_BANNER');
            if (type === 'MODAL') setPreviewImage(base64);
            if (type === 'LOGO') setSettingsForm({ ...settingsForm, logoUrl: base64 });
            if (type === 'QR') setRegConfig({ ...regConfig, qrCodeUrl: base64 });
            if (type === 'REG_LOGO') setRegConfig({ ...regConfig, logoUrl: base64 });
            if (type === 'REG_BANNER') setRegConfig({ ...regConfig, bannerUrl: base64 });
        }
    };

    const handleCrudSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const col = modalType.toLowerCase() + 's';
        const itemData = { ...editItem, logoUrl: previewImage || editItem.logoUrl || '', photoUrl: previewImage || editItem.photoUrl || '', imageUrl: previewImage || editItem.imageUrl || '' };
        
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection(col).doc(editItem.id).update(itemData);
            } else {
                await db.collection('auctions').doc(id).collection(col).add({ ...itemData, createdAt: Date.now() });
            }
            closeModal();
        } catch (err: any) { alert("Save failed: " + err.message); }
    };

    const closeModal = () => {
        setShowModal(false);
        setEditItem(null);
        setPreviewImage('');
    };

    const handleDelete = async (type: string, itemId: string) => {
        if (window.confirm("Purge this record?")) {
            await db.collection('auctions').doc(id!).collection(type.toLowerCase() + 's').doc(itemId).delete();
        }
    };

    const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>, type: 'TEAM' | 'PLAYER') => {
        const file = e.target.files?.[0];
        if (!file || !id) return;
        
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data: any[] = XLSX.utils.sheet_to_json(ws);
            
            const batch = db.batch();
            const col = type.toLowerCase() + 's';
            
            data.forEach(row => {
                const ref = db.collection('auctions').doc(id).collection(col).doc();
                if (type === 'TEAM') {
                    batch.set(ref, { id: ref.id, name: row.Name || row.name, owner: row.Owner || '', budget: Number(row.Budget) || settingsForm.purseValue, players: [], logoUrl: '' });
                } else {
                    batch.set(ref, { id: ref.id, name: row.Name || row.name, category: row.Category || 'Standard', role: row.Role || 'All Rounder', basePrice: Number(row.BasePrice) || settingsForm.basePrice, nationality: 'India', photoUrl: '', stats: { matches: 0, runs: 0, wickets: 0 } });
                }
            });
            
            await batch.commit();
            alert(`Imported ${data.length} records!`);
        };
        reader.readAsBinaryString(file);
    };

    const exportPlayersToCSV = () => {
        if (players.length === 0) return alert("No players to export.");
        const headers = ["ID", "Name", "Category", "Role", "Base Price", "Nationality", "Status", "Sold To", "Sold Price"];
        const rows = players.map(p => [
            p.id, p.name, p.category, p.role, p.basePrice, p.nationality, p.status || 'POOL', p.soldTo || '-', p.soldPrice || 0
        ]);

        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `PLAYERS_${auction?.title?.replace(/\s+/g, '_')}.csv`);
        link.click();
    };

    const exportRegistrationsToCSV = () => {
        if (registrations.length === 0) return alert("No registrations to export.");
        
        // Dynamic headers based on custom fields
        const customFieldLabels = regConfig.customFields.map(f => f.label);
        const headers = ["Full Name", "Mobile", "DOB", "Gender", "Player Type", ...customFieldLabels, "Status", "Submitted At"];
        
        const rows = registrations.map(reg => {
            const baseData = [
                `"${reg.fullName}"`,
                `"${reg.mobile}"`,
                `"${reg.dob}"`,
                `"${reg.gender}"`,
                `"${reg.playerType}"`
            ];
            
            // Append custom fields data
            const customData = regConfig.customFields.map(field => {
                const val = reg[field.id] || '-';
                return `"${val}"`;
            });

            return [...baseData, ...customData, `"${reg.status}"`, `"${new Date(reg.submittedAt).toLocaleString()}"`].join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `REGISTRATIONS_${auction?.title?.replace(/\s+/g, '_')}.csv`);
        link.click();
    };

    const addSlab = () => {
        if (!newSlab.from || !newSlab.increment) return;
        setSlabs([...slabs, { from: Number(newSlab.from), increment: Number(newSlab.increment) }]);
        setNewSlab({ from: '', increment: '' });
    };

    const removeSlab = (index: number) => {
        setSlabs(slabs.filter((_, i) => i !== index));
    };

    const addCustomField = () => {
        if (!newField.label) return;
        const field: FormField = {
            id: 'custom_' + Date.now(),
            label: newField.label,
            type: newField.type as any,
            required: !!newField.required,
            options: newField.options || []
        };
        setRegConfig({ ...regConfig, customFields: [...(regConfig.customFields || []), field] });
        setNewField({ label: '', type: 'text', required: true, options: [] });
    };

    const removeCustomField = (fid: string) => {
        setRegConfig({ ...regConfig, customFields: regConfig.customFields.filter(f => f.id !== fid) });
    };

    const addOptionToField = () => {
        if (!optionInput.trim()) return;
        setNewField({ ...newField, options: [...(newField.options || []), optionInput.trim()] });
        setOptionInput('');
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]"><Loader2 className="animate-spin text-blue-600"/></div>;

    return (
        <div className="min-h-screen bg-[#f8f9fa] font-sans pb-20 text-gray-900 selection:bg-blue-100 selection:text-blue-900">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-gray-800 transition-colors p-2 hover:bg-gray-50 rounded-lg"><ArrowLeft className="w-5 h-5"/></button>
                        <h1 className="text-sm font-black uppercase tracking-widest text-gray-700 truncate max-w-[200px]">{auction?.title}</h1>
                    </div>
                    <div className="flex gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200 overflow-x-auto no-scrollbar">
                        {['SETTINGS', 'TEAMS', 'PLAYERS', 'REQUESTS', 'CATEGORIES', 'ROLES', 'SPONSORS', 'REGISTRATION', 'WAITLIST'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab as any)}
                                className={`px-4 py-2 text-[10px] font-black uppercase transition-all rounded-lg whitespace-nowrap ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                                {tab === 'REGISTRATION' ? 'REG CONFIG' : tab === 'REQUESTS' ? `Requests (${registrations.length})` : tab === 'WAITLIST' ? `Waitlist (${waitlist.length})` : tab}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-6xl">
                {activeTab === 'SETTINGS' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-transparent flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-600/20 text-white"><Settings className="w-6 h-6"/></div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Auction Identity</h2>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure core tournament logic</p>
                                    </div>
                                </div>
                                <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-8 rounded-xl shadow-lg text-[11px] uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95">
                                    <Save className="w-4 h-4"/> Sync Identity
                                </button>
                            </div>

                            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="md:col-span-1 space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Tournament Logo</label>
                                        <div onClick={() => logoInputRef.current?.click()} className="w-full aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-blue-400 transition-all overflow-hidden relative group">
                                            {settingsForm.logoUrl ? (
                                                <img src={settingsForm.logoUrl} className="w-full h-full object-contain p-4" />
                                            ) : (
                                                <div className="text-center">
                                                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                                    <p className="text-[9px] font-black text-gray-400 uppercase">Select Source</p>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <Upload className="text-white w-6 h-6" />
                                            </div>
                                            <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'LOGO')} />
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2 space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Event Name</label>
                                            <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.title} onChange={e => setSettingsForm({...settingsForm, title: e.target.value})} />
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-2 ml-1">
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Event Date</label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                                                        checked={settingsForm.dateTBD}
                                                        onChange={e => setSettingsForm({...settingsForm, dateTBD: e.target.checked})}
                                                    />
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase group-hover:text-blue-500 transition-colors">Date not decided yet</span>
                                                </label>
                                            </div>
                                            <input 
                                                type="date" 
                                                className={`w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all ${settingsForm.dateTBD ? 'opacity-50 grayscale cursor-not-allowed' : ''}`} 
                                                value={settingsForm.date} 
                                                onChange={e => setSettingsForm({...settingsForm, date: e.target.value})} 
                                                disabled={settingsForm.dateTBD}
                                                required={!settingsForm.dateTBD}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Tournament Matches Date</label>
                                            <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.matchesDate} onChange={e => setSettingsForm({...settingsForm, matchesDate: e.target.value})} placeholder="e.g. 10th - 15th April" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Total Teams</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.totalTeams} onChange={e => setSettingsForm({...settingsForm, totalTeams: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Squad Size (Max)</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.playersPerTeam} onChange={e => setSettingsForm({...settingsForm, playersPerTeam: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Event Venue</label>
                                            <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.venue || ''} onChange={e => setSettingsForm({...settingsForm, venue: e.target.value})} placeholder="Stadium, City" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Purse Budget (₹)</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.purseValue} onChange={e => setSettingsForm({...settingsForm, purseValue: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Standard Min Bid (₹)</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.bidIncrement} onChange={e => setSettingsForm({...settingsForm, bidIncrement: Number(e.target.value)})} />
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Global Bidding Slabs</label>
                                            <div className="flex gap-2">
                                                <input placeholder="From ₹" type="number" className="w-24 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none" value={newSlab.from} onChange={e => setNewSlab({...newSlab, from: e.target.value})} />
                                                <input placeholder="+ ₹" type="number" className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none" value={newSlab.increment} onChange={e => setNewSlab({...newSlab, increment: e.target.value})} />
                                                <button onClick={addSlab} className="bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 transition-colors"><Plus className="w-4 h-4"/></button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {slabs.map((slab, i) => (
                                                <div key={i} className="bg-white px-4 py-2.5 rounded-xl border border-gray-200 flex justify-between items-center shadow-sm">
                                                    <span className="text-[10px] font-black text-gray-600 uppercase">Above {slab.from} : +{slab.increment}</span>
                                                    <button onClick={() => removeSlab(i)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                                                </div>
                                            ))}
                                            {slabs.length === 0 && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest italic py-2">No custom slabs established</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'TEAMS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Franchise Registry ({teams.length})</h2>
                            <div className="flex gap-2">
                                <label className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-gray-50 transition-all flex items-center gap-2">
                                    <FileUp className="w-4 h-4"/> Import XLSX
                                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleExcelImport(e, 'TEAM')}/>
                                </label>
                                <button onClick={() => { setModalType('TEAM'); setEditItem({ name: '', owner: '', budget: settingsForm.purseValue }); setShowModal(true); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-600/20"><Plus className="w-4 h-4"/> Add Team</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {teams.map(team => (
                                <div key={team.id} className="bg-white p-5 rounded-[1.5rem] border border-gray-200 shadow-sm flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 p-1">
                                            {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-contain" /> : <Users className="text-gray-300 w-6 h-6"/>}
                                        </div>
                                        <div>
                                            <p className="font-black text-gray-800 uppercase text-sm leading-none">{team.name}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">₹{team.budget}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setModalType('TEAM'); setEditItem(team); setPreviewImage(team.logoUrl); setShowModal(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete('TEAM', String(team.id))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'PLAYERS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Player Pool ({players.length})</h2>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={exportPlayersToCSV} className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm">
                                    <Download className="w-4 h-4"/> Export CSV
                                </button>
                                <label className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm">
                                    <FileUp className="w-4 h-4"/> Import XLSX
                                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleExcelImport(e, 'PLAYER')}/>
                                </label>
                                <button onClick={() => { setModalType('PLAYER'); setEditItem({ name: '', category: 'Standard', role: 'All Rounder', basePrice: settingsForm.basePrice, nationality: 'India' }); setShowModal(true); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
                                    <Plus className="w-4 h-4"/> Add Player
                                </button>
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Identity</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Set/Category</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Role</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Value (₹)</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {players.map(p => (
                                            <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden shadow-sm">
                                                            {p.photoUrl ? <img src={p.photoUrl} className="w-full h-full object-cover" /> : <User className="w-5 h-5 m-2.5 text-gray-300"/>}
                                                        </div>
                                                        <div>
                                                            <span className="font-black text-gray-800 text-sm uppercase leading-none">{p.name}</span>
                                                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">{p.nationality}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-gray-200">{p.category}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{p.role}</span>
                                                </td>
                                                <td className="px-6 py-4 font-mono font-black text-gray-700 text-sm">₹{p.basePrice}</td>
                                                <td className="px-6 py-4">
                                                    {p.status === 'SOLD' ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-green-600 font-black text-[9px] uppercase tracking-[0.2em]">SOLD</span>
                                                            <span className="text-[8px] text-gray-400 font-bold uppercase truncate max-w-[80px]">{p.soldTo} (₹{p.soldPrice})</span>
                                                        </div>
                                                    ) : p.status === 'UNSOLD' ? (
                                                        <span className="text-red-500 font-black text-[9px] uppercase tracking-[0.2em]">UNSOLD</span>
                                                    ) : (
                                                        <span className="text-gray-300 font-black text-[9px] uppercase tracking-[0.2em]">POOL</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setModalType('PLAYER'); setEditItem(p); setPreviewImage(p.photoUrl); setShowModal(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit className="w-4 h-4"/></button>
                                                        <button onClick={() => handleDelete('PLAYER', String(p.id))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'REGISTRATION' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-blue-50/50 to-transparent">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-600/20"><UserCheck className="w-6 h-6 text-white"/></div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Registration Terminal</h2>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure player signup protocols</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl px-6 py-3 shadow-sm">
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Public Status</label>
                                    <button onClick={() => setRegConfig({...regConfig, isEnabled: !regConfig.isEnabled})} className={`transition-all active:scale-90 ${regConfig.isEnabled ? 'text-blue-600' : 'text-gray-300'}`}>{regConfig.isEnabled ? <ToggleRight className="w-10 h-10"/> : <ToggleLeft className="w-10 h-10"/>}</button>
                                </div>
                            </div>

                            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-8">
                                    {/* Default Fields Display */}
                                    <div className="bg-gray-50 p-6 rounded-[1.5rem] border border-gray-100">
                                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
                                            <ListChecks className="w-4 h-4"/> Standard Protocol Fields
                                        </h3>
                                        <div className="space-y-2">
                                            {['Full Legal Name', 'Mobile Primary', 'Date of Birth', 'Skill Identity (Role)', 'Profile Asset (Photo)', 'Proof of Payment (Conditional)'].map(f => (
                                                <div key={f} className="flex items-center gap-2 text-[10px] font-bold text-gray-600 uppercase">
                                                    <CheckCircle className="w-3 h-3 text-green-500" /> {f}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                                            <CreditCard className="w-4 h-4"/> Payment Configuration
                                        </h3>
                                        <div className="flex items-center justify-between p-6 bg-gray-50 border-2 rounded-[1.5rem] group cursor-pointer hover:border-blue-400 transition-all shadow-inner" onClick={() => setRegConfig({...regConfig, includePayment: !regConfig.includePayment})}>
                                            <div>
                                                <span className="text-sm font-black text-gray-700 block uppercase tracking-wide">Collect Registration Fee</span>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase mt-1 block">Require proof of payment to sign up</span>
                                            </div>
                                            {regConfig.includePayment ? <CheckCircle className="w-8 h-8 text-blue-600"/> : <div className="w-8 h-8 border-2 border-gray-200 rounded-full"/>}
                                        </div>
                                    </div>
                                    
                                    {regConfig.includePayment && (
                                        <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-[2rem] space-y-6 animate-slide-up">
                                            <div>
                                                <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">Select Gateway Logic</label>
                                                <div className="flex gap-3">
                                                    <button 
                                                        onClick={() => setRegConfig({...regConfig, paymentMethod: 'MANUAL'})}
                                                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-2 ${regConfig.paymentMethod === 'MANUAL' ? 'bg-white border-blue-400 text-blue-600 shadow-lg' : 'bg-transparent border-gray-200 text-gray-400 opacity-60'}`}
                                                    >
                                                        <QrCode className="w-4 h-4"/> Manual (UPI)
                                                    </button>
                                                    <button 
                                                        onClick={() => setRegConfig({...regConfig, paymentMethod: 'RAZORPAY'})}
                                                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-2 ${regConfig.paymentMethod === 'RAZORPAY' ? 'bg-white border-blue-400 text-blue-600 shadow-lg' : 'bg-transparent border-gray-200 text-gray-400 opacity-60'}`}
                                                    >
                                                        <Zap className="w-4 h-4"/> Razorpay
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 ml-1">Fee Amount (₹)</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black">₹</span>
                                                    <input type="number" className="w-full bg-white border-2 border-gray-100 rounded-xl px-8 py-3 text-sm font-black text-gray-700 focus:border-blue-400 outline-none" value={regConfig.fee} onChange={e => setRegConfig({...regConfig, fee: Number(e.target.value)})} />
                                                </div>
                                            </div>

                                            {regConfig.paymentMethod === 'RAZORPAY' && (
                                                <div className="bg-indigo-600 p-6 rounded-2xl shadow-xl animate-fade-in">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <Key className="w-5 h-5 text-indigo-200" />
                                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Razorpay Key ID</span>
                                                    </div>
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder:text-white/40 outline-none focus:bg-white/20 transition-all" 
                                                        value={regConfig.razorpayKey || ''} 
                                                        onChange={e => setRegConfig({...regConfig, razorpayKey: e.target.value})} 
                                                        placeholder="rzp_live_xxxxxxxxxxxx" 
                                                    />
                                                    <p className="text-[8px] text-indigo-200 font-bold uppercase mt-3 tracking-widest leading-relaxed text-center">Fetch this from your Razorpay Dashboard &gt; Settings &gt; API Keys</p>
                                                </div>
                                            )}

                                            {regConfig.paymentMethod === 'MANUAL' && (
                                                <div className="space-y-6 animate-fade-in">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">UPI ID</label>
                                                            <input className="w-full border rounded-xl p-2.5 text-xs font-bold" value={regConfig.upiId} onChange={e => setRegConfig({...regConfig, upiId: e.target.value})} placeholder="someone@upi" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Account Name</label>
                                                            <input className="w-full border rounded-xl p-2.5 text-xs font-bold" value={regConfig.upiName} onChange={e => setRegConfig({...regConfig, upiName: e.target.value})} placeholder="Official Name" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-3">UPI QR Code Deployment</label>
                                                        <div onClick={() => qrInputRef.current?.click()} className="w-full h-48 bg-white border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-all overflow-hidden relative group">
                                                            {regConfig.qrCodeUrl ? (
                                                                <img src={regConfig.qrCodeUrl} className="h-full w-full object-contain p-4" />
                                                            ) : (
                                                                <div className="text-center">
                                                                    <QrCode className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Push QR Source</p>
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <Upload className="text-white w-6 h-6" />
                                                            </div>
                                                            <input ref={qrInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'QR')} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-8">
                                    {/* Custom Fields Management */}
                                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm">
                                        <h3 className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                                            <ListPlus className="w-4 h-4"/> Custom Form Fields
                                        </h3>
                                        <div className="space-y-4 mb-8">
                                            {(regConfig.customFields || []).map((field, idx) => (
                                                <div key={field.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-white p-2 rounded-lg text-indigo-600 shadow-sm">
                                                            {field.type === 'text' ? <Type className="w-4 h-4"/> : field.type === 'number' ? <Hash className="w-4 h-4"/> : <ChevronDownCircle className="w-4 h-4"/>}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black uppercase text-gray-800">{field.label}</p>
                                                            <p className="text-[8px] font-bold text-gray-400 uppercase">{field.type} • {field.required ? 'Required' : 'Optional'}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => removeCustomField(field.id)} className="text-red-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                                                </div>
                                            ))}
                                            {(!regConfig.customFields || regConfig.customFields.length === 0) && (
                                                <p className="text-[10px] text-gray-400 italic text-center py-4">No custom fields defined</p>
                                            )}
                                        </div>

                                        <div className="p-5 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-100 space-y-4">
                                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest text-center">Establish New Field Node</p>
                                            <input 
                                                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-xs font-bold outline-none" 
                                                placeholder="Label (e.g. Father's Name)" 
                                                value={newField.label}
                                                onChange={e => setNewField({...newField, label: e.target.value})}
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[
                                                        { id: 'text', label: 'Text Input', icon: <Type className="w-4 h-4"/> },
                                                        { id: 'number', label: 'Number Input', icon: <Hash className="w-4 h-4"/> },
                                                        { id: 'select', label: 'Dropdown', icon: <ChevronDownCircle className="w-4 h-4"/> }
                                                    ].map(t => (
                                                        <button 
                                                            key={t.id}
                                                            type="button"
                                                            onClick={() => setNewField({...newField, type: t.id as any})}
                                                            className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase border transition-all flex flex-col items-center gap-1 ${newField.type === t.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                                                        >
                                                            {t.icon}
                                                            {t.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button 
                                                    onClick={() => setNewField({...newField, required: !newField.required})}
                                                    className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase border transition-all ${newField.required ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-400'}`}
                                                >
                                                    {newField.required ? 'Required' : 'Optional'}
                                                </button>
                                            </div>

                                            {newField.type === 'select' && (
                                                <div className="space-y-2">
                                                    <div className="flex gap-2">
                                                        <input className="flex-1 border rounded-lg px-3 py-2 text-[10px] font-bold" placeholder="Add Option" value={optionInput} onChange={e => setOptionInput(e.target.value)} />
                                                        <button onClick={addOptionToField} className="bg-indigo-600 text-white px-3 rounded-lg"><Plus className="w-4 h-4"/></button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {newField.options?.map((o, i) => (
                                                            <span key={i} className="bg-white px-2 py-1 rounded text-[8px] font-black text-indigo-600 border border-indigo-100 flex items-center gap-1">{o} <X className="w-2 h-2 cursor-pointer" onClick={() => setNewField({...newField, options: newField.options?.filter((_, idx) => idx !== i)})} /></span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <button 
                                                onClick={addCustomField}
                                                disabled={!newField.label}
                                                className="w-full bg-white hover:bg-indigo-600 hover:text-white text-indigo-600 border border-indigo-200 font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                                            >
                                                <Plus className="w-3 h-3 inline mr-1" /> Add Field Node
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                                            <AlignLeft className="w-4 h-4"/> Terms & Legal Identity
                                        </h3>
                                        <textarea 
                                            className="w-full border-2 border-gray-100 rounded-[1.5rem] p-6 text-xs font-bold text-gray-600 h-48 focus:border-blue-400 outline-none transition-all shadow-inner bg-gray-50/50"
                                            placeholder="Enter your tournament terms and conditions..."
                                            value={regConfig.terms}
                                            onChange={e => setRegConfig({...regConfig, terms: e.target.value})}
                                        />
                                    </div>

                                    <div>
                                        <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                                            <Phone className="w-4 h-4"/> Organizer Contact Info
                                        </h3>
                                        <input 
                                            className="w-full border-2 border-gray-100 rounded-xl px-6 py-4 text-xs font-bold text-gray-600 focus:border-blue-400 outline-none transition-all shadow-inner bg-gray-50/50"
                                            placeholder="Enter contact number or email for queries..."
                                            value={regConfig.organizerContact || ''}
                                            onChange={e => setRegConfig({...regConfig, organizerContact: e.target.value})}
                                        />
                                    </div>

                                    <div>
                                        <h3 className="text-[11px] font-black text-red-500 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4"/> Rules & Regulations
                                        </h3>
                                        <textarea 
                                            className="w-full border-2 border-gray-100 rounded-[1.5rem] p-6 text-xs font-bold text-gray-600 h-48 focus:border-red-400 outline-none transition-all shadow-inner bg-gray-50/50"
                                            placeholder="Enter detailed rules and regulations for players..."
                                            value={regConfig.rules || ''}
                                            onChange={e => setRegConfig({...regConfig, rules: e.target.value})}
                                        />
                                    </div>

                                    <div>
                                        <h3 className="text-[11px] font-black text-green-500 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4"/> Success Protocol Message
                                        </h3>
                                        <textarea 
                                            className="w-full border-2 border-gray-100 rounded-[1.5rem] p-6 text-xs font-bold text-gray-600 h-24 focus:border-green-400 outline-none transition-all shadow-inner bg-gray-50/50"
                                            placeholder="Custom message to show after successful registration (optional)..."
                                            value={regConfig.customSuccessMessage || ''}
                                            onChange={e => setRegConfig({...regConfig, customSuccessMessage: e.target.value})}
                                        />
                                        <p className="text-[9px] font-bold text-gray-400 uppercase mt-2 ml-2 tracking-widest">This message appears in the popup after a player submits the form.</p>
                                    </div>

                                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm space-y-6">
                                        <h3 className="text-[11px] font-black text-orange-500 uppercase tracking-[0.25em] mb-2 flex items-center gap-2">
                                            <Users className="w-4 h-4"/> Capacity & Limits
                                        </h3>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Maximum Player Registrations</label>
                                            <input 
                                                type="number"
                                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-xs font-bold text-gray-700 focus:border-orange-400 outline-none transition-all"
                                                placeholder="e.g. 100 (0 for unlimited)"
                                                value={regConfig.maxRegistrations || ''}
                                                onChange={e => setRegConfig({...regConfig, maxRegistrations: parseInt(e.target.value) || 0})}
                                            />
                                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-2 ml-2 tracking-widest">Registration will auto-close once this limit of APPROVED players is reached.</p>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Closed Form Message</label>
                                            <textarea 
                                                className="w-full border-2 border-gray-100 rounded-xl p-4 text-xs font-bold text-gray-600 h-24 focus:border-orange-400 outline-none transition-all bg-gray-50/50"
                                                placeholder="Message to show when registration is closed or limit reached..."
                                                value={regConfig.closedMessage || ''}
                                                onChange={e => setRegConfig({...regConfig, closedMessage: e.target.value})}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase">Enable Waitlist Protocol</label>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Collect names/numbers after slots are full.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer"
                                                    checked={regConfig.enableWaitlist || false}
                                                    onChange={e => setRegConfig({...regConfig, enableWaitlist: e.target.checked})}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                            </label>
                                        </div>
                                        {regConfig.enableWaitlist && (
                                            <div className="pt-4 border-t border-gray-50 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Waitlist Section Message</label>
                                                <textarea 
                                                    className="w-full border-2 border-gray-100 rounded-xl p-4 text-xs font-bold text-gray-600 h-20 focus:border-orange-400 outline-none transition-all bg-gray-50/50"
                                                    placeholder="Custom message to show in the waitlist section..."
                                                    value={regConfig.waitlistMessage || ''}
                                                    onChange={e => setRegConfig({...regConfig, waitlistMessage: e.target.value})}
                                                />
                                                <p className="text-[9px] font-bold text-gray-400 uppercase mt-2 ml-2 tracking-widest">This message appears above the waitlist form when registration is closed.</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm space-y-6">
                                        <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.25em] mb-2 flex items-center gap-2">
                                            <UserCheck className="w-4 h-4"/> Contact Information
                                        </h3>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Organizer Contact Number</label>
                                            <input 
                                                type="text"
                                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-xs font-bold text-gray-700 focus:border-blue-400 outline-none transition-all"
                                                placeholder="e.g. +91 98765 43210"
                                                value={regConfig.organizerContact || ''}
                                                onChange={e => setRegConfig({...regConfig, organizerContact: e.target.value})}
                                            />
                                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-2 ml-2 tracking-widest">This number will be displayed on the registration form for player inquiries.</p>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[11px] font-black text-amber-500 uppercase tracking-[0.25em] flex items-center gap-2">
                                                <Megaphone className="w-4 h-4"/> Welcome Popup Protocol
                                            </h3>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer"
                                                    checked={regConfig.welcomePopup?.isEnabled || false}
                                                    onChange={e => setRegConfig({
                                                        ...regConfig, 
                                                        welcomePopup: {
                                                            ...(regConfig.welcomePopup || { message: '', autoCloseTimer: 5, isEnabled: false }),
                                                            isEnabled: e.target.checked
                                                        }
                                                    })}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                            </label>
                                        </div>

                                        {regConfig.welcomePopup?.isEnabled && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Welcome Message</label>
                                                    <textarea 
                                                        className="w-full border-2 border-gray-100 rounded-xl p-4 text-xs font-bold text-gray-600 h-24 focus:border-amber-400 outline-none transition-all bg-gray-50/50"
                                                        placeholder="Enter welcome message for players..."
                                                        value={regConfig.welcomePopup?.message || ''}
                                                        onChange={e => setRegConfig({
                                                            ...regConfig,
                                                            welcomePopup: {
                                                                ...(regConfig.welcomePopup || { isEnabled: true, autoCloseTimer: 5, message: '' }),
                                                                message: e.target.value
                                                            }
                                                        })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Auto-Close Timer (Seconds)</label>
                                                    <input 
                                                        type="number"
                                                        min="1"
                                                        max="60"
                                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-xs font-bold text-gray-700 focus:border-amber-400 outline-none transition-all"
                                                        value={regConfig.welcomePopup?.autoCloseTimer || 5}
                                                        onChange={e => setRegConfig({
                                                            ...regConfig,
                                                            welcomePopup: {
                                                                ...(regConfig.welcomePopup || { isEnabled: true, message: '', autoCloseTimer: 5 }),
                                                                autoCloseTimer: parseInt(e.target.value) || 5
                                                            }
                                                        })}
                                                    />
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-2 ml-2 tracking-widest">Popup will automatically close after this time.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm space-y-6">
                                        <h3 className="text-[11px] font-black text-purple-500 uppercase tracking-[0.25em] mb-2 flex items-center gap-2">
                                            <Palette className="w-4 h-4"/> Visual Identity & Theme
                                        </h3>
                                        
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Form Theme Style</label>
                                            <div className="flex gap-3">
                                                {[
                                                    { id: 'DEFAULT', label: 'Standard Protocol (Clean)' },
                                                    { id: 'ADVAYA', label: 'ADVAYA (Kingdom Battle)' }
                                                ].map(t => (
                                                    <button 
                                                        key={t.id}
                                                        type="button"
                                                        onClick={() => setRegConfig({...regConfig, theme: t.id as any})}
                                                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${regConfig.theme === t.id ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                                                    >
                                                        {t.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Auction Logo</label>
                                                <div onClick={() => regLogoInputRef.current?.click()} className="w-full aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-purple-50 transition-all overflow-hidden relative group">
                                                    {regConfig.logoUrl ? (
                                                        <img src={regConfig.logoUrl} className="h-full w-full object-contain p-2" />
                                                    ) : (
                                                        <div className="text-center">
                                                            <ImageIcon className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                                                            <p className="text-[8px] font-black text-gray-400 uppercase">Logo</p>
                                                        </div>
                                                    )}
                                                    <input ref={regLogoInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'REG_LOGO')} />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Form Banner</label>
                                                <div onClick={() => regBannerInputRef.current?.click()} className="w-full aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-purple-50 transition-all overflow-hidden relative group">
                                                    {regConfig.bannerUrl ? (
                                                        <img src={regConfig.bannerUrl} className="h-full w-full object-contain p-2" />
                                                    ) : (
                                                        <div className="text-center">
                                                            <ImageIcon className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                                                            <p className="text-[8px] font-black text-gray-400 uppercase">Banner</p>
                                                        </div>
                                                    )}
                                                    <input ref={regBannerInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'REG_BANNER')} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Info className="w-5 h-5 text-blue-400"/>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Protocol Tip</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-wide">
                                            Standard protocol fields are mandatory. Use custom fields for tournament-specific data like T-Shirt size or Father's Name.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 bg-gray-50 border-t border-gray-100 flex justify-center">
                                <button onClick={handleSaveRegistration} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-5 px-16 rounded-[1.5rem] shadow-2xl shadow-blue-600/30 text-sm uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 group">
                                    <Save className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Deploy Registry Protocol
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'REQUESTS' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-4 px-2">
                             <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Registration Queue ({registrations.length})</h2>
                             <button onClick={exportRegistrationsToCSV} className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm">
                                <Download className="w-4 h-4"/> Export Registration Data
                             </button>
                        </div>
                        {registrations.length === 0 ? (
                            <div className="p-32 text-center text-gray-400 bg-white rounded-[3rem] border-2 border-dashed border-gray-200 flex flex-col items-center">
                                <UserX className="w-12 h-12 mb-4 opacity-20"/>
                                <p className="font-black uppercase tracking-[0.2em] text-xs">Queue is empty</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {registrations.map(reg => (
                                    <div key={reg.id} className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border-2 border-gray-50">
                                                <img src={reg.profilePic} className="w-full h-full object-cover"/>
                                            </div>
                                            <div>
                                                <p className="text-lg font-black text-gray-800 uppercase leading-none mb-1">{reg.fullName}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{reg.playerType} • {reg.mobile}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border-2 ${reg.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : reg.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>{reg.status}</div>
                                            <button 
                                                onClick={() => {
                                                    setSelectedReg(reg);
                                                    setShowRegModal(true);
                                                }}
                                                className="p-2.5 bg-gray-100 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-xl transition-all"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4"/>
                                            </button>
                                            <button onClick={() => handleDelete('REGISTRATION', reg.id)} className="p-2.5 bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-all"><Trash2 className="w-4 h-4"/></button>
                                            
                                            {reg.status === 'PENDING' ? (
                                                <button 
                                                    onClick={() => handleApproveAndAdd(reg)} 
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-xl text-[10px] uppercase tracking-widest shadow-lg"
                                                >
                                                    Approve & Add
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => handleRevertToPending(reg.id)} 
                                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-black px-6 py-2.5 rounded-xl text-[10px] uppercase tracking-widest border border-gray-200"
                                                >
                                                    Revert
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {(activeTab === 'CATEGORIES' || activeTab === 'ROLES' || activeTab === 'SPONSORS') && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Manage {activeTab}</h2>
                            <button onClick={() => {
                                setModalType(activeTab === 'CATEGORIES' ? 'CATEGORY' : activeTab === 'ROLES' ? 'ROLE' : 'SPONSOR');
                                setEditItem({});
                                setShowModal(true);
                            }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg"><Plus className="w-4 h-4"/> Add New</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(activeTab === 'CATEGORIES' ? categories : activeTab === 'ROLES' ? roles : sponsors).map((item: any) => (
                                <div key={item.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100 overflow-hidden">
                                            {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-contain" /> : <Layers className="text-gray-300 w-5 h-5"/>}
                                        </div>
                                        <p className="font-black text-gray-800 uppercase text-xs">{item.name}</p>
                                    </div>
                                    <button onClick={() => handleDelete(activeTab.slice(0, -1), item.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {activeTab === 'WAITLIST' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                            <div>
                                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Waitlist Registry</h2>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Players interested after slots filled</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-amber-50 px-4 py-2 rounded-xl border border-amber-100">
                                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Total Waitlist</p>
                                    <p className="text-xl font-black text-amber-700">{waitlist.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Player Name</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mobile Number</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Joined At</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {waitlist.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center">
                                                    <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No warriors on waitlist yet</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            waitlist.map((player) => (
                                                <tr key={player.id} className="hover:bg-gray-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <p className="font-black text-gray-800 uppercase text-xs">{player.fullName}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <Phone className="w-3 h-3 text-gray-400" />
                                                            <p className="font-bold text-gray-600 text-xs">{player.mobile}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-bold text-gray-400">
                                                        {new Date(player.createdAt).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            onClick={async () => {
                                                                if (window.confirm("Remove from waitlist?")) {
                                                                    await db.collection('auctions').doc(id).collection('waitlist').doc(player.id).delete();
                                                                }
                                                            }}
                                                            className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* MODALS */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden border border-gray-200 animate-slide-up">
                        <div className="bg-blue-600 p-6 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                            <h3 className="text-lg font-black uppercase tracking-tight relative z-10">{editItem?.id ? 'Modify' : 'Initialize'} {modalType}</h3>
                            <button onClick={closeModal} className="relative z-10 hover:rotate-90 transition-transform"><X className="w-6 h-6"/></button>
                        </div>
                        <form onSubmit={handleCrudSave} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Identity Name</label>
                                <input required className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.name || ''} onChange={e => setEditItem({...editItem, name: e.target.value})} />
                            </div>
                            
                            {(modalType === 'TEAM' || modalType === 'PLAYER' || modalType === 'SPONSOR') && (
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Visual Asset</label>
                                    <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-blue-400 transition-all overflow-hidden relative group">
                                        {previewImage ? (
                                            <img src={previewImage} className="w-full h-full object-contain p-4" />
                                        ) : (
                                            <div className="text-center">
                                                <Upload className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                                                <p className="text-[9px] font-black text-gray-400 uppercase">Select Source</p>
                                            </div>
                                        )}
                                        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'MODAL')} />
                                    </div>
                                </div>
                            )}

                            {modalType === 'TEAM' && (
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Assigned Purse (₹)</label>
                                    <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.budget} onChange={e => setEditItem({...editItem, budget: Number(e.target.value)})} />
                                </div>
                            )}

                            {modalType === 'PLAYER' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Base Price (₹)</label>
                                        <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2.5 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.basePrice} onChange={e => setEditItem({...editItem, basePrice: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Nationality</label>
                                        <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2.5 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.nationality} onChange={e => setEditItem({...editItem, nationality: e.target.value})} />
                                    </div>
                                </div>
                            )}

                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs tracking-widest active:scale-95">Save Registry Protocol</button>
                        </form>
                    </div>
                </div>
            )}
            {showRegModal && selectedReg && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-[3rem] w-full max-w-4xl overflow-hidden shadow-2xl border border-white/20 animate-fade-in my-8">
                        {/* Header */}
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-600/20">
                                    <User className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Registration Details</h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Review and manage player enrollment</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowRegModal(false);
                                    setIsEditingReg(false);
                                }} 
                                className="p-4 hover:bg-gray-100 rounded-2xl transition-all text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {/* Left Column: Profile & Basic Info */}
                            <div className="space-y-6">
                                <div className="relative group">
                                    <div className="aspect-square rounded-[2.5rem] overflow-hidden border-4 border-gray-50 shadow-xl">
                                        <img src={selectedReg.profilePic} className="w-full h-full object-cover" alt="Profile" />
                                    </div>
                                    <button 
                                        onClick={() => window.open(selectedReg.profilePic, '_blank')}
                                        className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur shadow-lg rounded-xl text-gray-600 hover:text-blue-600 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <ExternalLink className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Basic Information</p>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Full Name</label>
                                                {isEditingReg ? (
                                                    <input 
                                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold"
                                                        value={selectedReg.fullName}
                                                        onChange={e => setSelectedReg({...selectedReg, fullName: e.target.value})}
                                                    />
                                                ) : (
                                                    <p className="text-sm font-black text-gray-800 uppercase">{selectedReg.fullName}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Mobile Number</label>
                                                {isEditingReg ? (
                                                    <input 
                                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold"
                                                        value={selectedReg.mobile}
                                                        onChange={e => setSelectedReg({...selectedReg, mobile: e.target.value})}
                                                    />
                                                ) : (
                                                    <p className="text-sm font-black text-gray-800">{selectedReg.mobile}</p>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Player Type</label>
                                                    {isEditingReg ? (
                                                        <select 
                                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold"
                                                            value={selectedReg.playerType}
                                                            onChange={e => setSelectedReg({...selectedReg, playerType: e.target.value})}
                                                        >
                                                            {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                                        </select>
                                                    ) : (
                                                        <p className="text-sm font-black text-gray-800 uppercase">{selectedReg.playerType}</p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Gender</label>
                                                    {isEditingReg ? (
                                                        <select 
                                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold"
                                                            value={selectedReg.gender}
                                                            onChange={e => setSelectedReg({...selectedReg, gender: e.target.value})}
                                                        >
                                                            <option value="Male">Male</option>
                                                            <option value="Female">Female</option>
                                                            <option value="Other">Other</option>
                                                        </select>
                                                    ) : (
                                                        <p className="text-sm font-black text-gray-800 uppercase">{selectedReg.gender}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Payment & Custom Fields */}
                            <div className="space-y-6">
                                {selectedReg.paymentScreenshot && (
                                    <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Payment Verification</p>
                                        <div className="relative group aspect-video rounded-2xl overflow-hidden border-2 border-gray-200 shadow-sm">
                                            <img src={selectedReg.paymentScreenshot} className="w-full h-full object-cover" alt="Payment" />
                                            <button 
                                                onClick={() => window.open(selectedReg.paymentScreenshot, '_blank')}
                                                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Eye className="w-8 h-8 text-white" />
                                            </button>
                                        </div>
                                        {selectedReg.razorpayPaymentId && (
                                            <p className="mt-2 text-[10px] font-black text-blue-600 uppercase tracking-widest">ID: {selectedReg.razorpayPaymentId}</p>
                                        )}
                                    </div>
                                )}

                                <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Attributes & Custom Fields</p>
                                    <div className="space-y-4">
                                        {regConfig.customFields.map(field => (
                                            <div key={field.id}>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">{field.label}</label>
                                                {isEditingReg ? (
                                                    <input 
                                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold"
                                                        value={selectedReg[field.id] || ''}
                                                        onChange={e => setSelectedReg({...selectedReg, [field.id]: e.target.value})}
                                                    />
                                                ) : (
                                                    <p className="text-sm font-black text-gray-800 uppercase">{selectedReg[field.id] || 'N/A'}</p>
                                                )}
                                            </div>
                                        ))}
                                        {regConfig.customFields.length === 0 && (
                                            <p className="text-[10px] font-bold text-gray-400 uppercase italic">No custom fields defined</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-8 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-4 justify-between items-center">
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => {
                                        const data = JSON.stringify(selectedReg, null, 2);
                                        const blob = new Blob([data], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `registration_${selectedReg.fullName.replace(/\s+/g, '_')}.json`;
                                        a.click();
                                    }}
                                    className="px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-gray-50 transition-all"
                                >
                                    <Download className="w-4 h-4" /> Download Info
                                </button>
                            </div>
                            
                            <div className="flex gap-3">
                                {isEditingReg ? (
                                    <>
                                        <button 
                                            onClick={() => setIsEditingReg(false)}
                                            className="px-8 py-3 bg-gray-200 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateRegistration(selectedReg)}
                                            className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20"
                                        >
                                            Save Changes
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button 
                                            onClick={() => setIsEditingReg(true)}
                                            className="px-8 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-gray-50 transition-all"
                                        >
                                            <Edit className="w-4 h-4" /> Edit Fields
                                        </button>
                                        {selectedReg.status === 'PENDING' ? (
                                            <button 
                                                onClick={() => {
                                                    handleApproveAndAdd(selectedReg);
                                                    setShowRegModal(false);
                                                }}
                                                className="px-8 py-3 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-600/20"
                                            >
                                                Approve & Add to Pool
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => {
                                                    handleRevertToPending(selectedReg.id);
                                                    setShowRegModal(false);
                                                }}
                                                className="px-8 py-3 bg-yellow-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-yellow-600/20"
                                            >
                                                Revert to Pending
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuctionManage;