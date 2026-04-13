import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { AuctionSetup, Team, Player, AuctionCategory, Sponsor, PlayerRole, RegistrationConfig, FormField, RegisteredPlayer, BidIncrementSlab, CaptainCode } from '../types';
import { 
    ArrowLeft, Plus, Trash2, Edit, Save, X, Upload, Users, Layers, Trophy, 
    DollarSign, Image as ImageIcon, Briefcase, FileText, Settings, QrCode, 
    AlignLeft, CheckSquare, Square, Palette, ChevronDown, Search, CheckCircle, 
    XCircle, Clock, Calendar, Info, ListPlus, Eye, EyeOff, Copy, Link as LinkIcon, 
    Check as CheckIcon, Check, ShieldCheck, Tag, User, TrendingUp, CreditCard, Shield, 
    UserCheck, UserX, Share2, Download, FileSpreadsheet, Filter, Key, 
    ExternalLink, LayoutList, ToggleRight, ToggleLeft, RefreshCw, FileUp, 
    Star, UserPlus, Loader2, FileDown, ChevronRight, Zap, ListChecks, Type, Hash, ChevronDownCircle, Megaphone, Phone, Printer, LayoutGrid, Maximize2, AlertTriangle
} from 'lucide-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import * as XLSX from 'xlsx';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { useAuction } from '../hooks/useAuction';

import heic2any from 'heic2any';

const compressImage = async (file: File, isBanner: boolean = false): Promise<string> => {
    let processedFile: File | Blob = file;
    
    // Handle HEIC/HEIF for iOS
    if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
        try {
            const converted = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.8
            });
            processedFile = Array.isArray(converted) ? converted[0] : converted;
        } catch (e) {
            console.error("HEIC conversion failed:", e);
        }
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(processedFile);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = isBanner ? 1600 : 800;
                const MAX_HEIGHT = isBanner ? 900 : 800;
                let width = img.width;
                let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                let quality = isBanner ? 0.8 : 0.7;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                
                // Firestore limit is 1MB. Base64 adds ~33% overhead.
                // 1,048,487 bytes is the limit. 800,000 chars is a safe bet.
                while (dataUrl.length > 800000 && quality > 0.1) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }
                
                resolve(dataUrl);
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
    hideLandingPage: false,
    fee: 0,
    upiId: '',
    upiName: '',
    qrCodeUrl: '',
    terms: '1. Registration fee is non-refundable.\n2. Players must reporting 30 mins before match.',
    customFields: [],
    organizerContacts: [],
    basicFields: {
        name: { show: true, required: true },
        dob: { show: true, required: true },
        photo: { show: true, required: true },
        mobile: { show: true, required: true },
        gender: { show: true, required: true },
        role: { show: true, required: true }
    }
};

const AuctionManage: React.FC = () => {
    const { userProfile } = useAuction();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'SETTINGS' | 'TEAMS' | 'PLAYERS' | 'REQUESTS' | 'CATEGORIES' | 'ROLES' | 'SPONSORS' | 'REGISTRATION' | 'WAITLIST' | 'CAPTAIN_CODES'>('SETTINGS');
    const [loading, setLoading] = useState(true);
    const [auction, setAuction] = useState<AuctionSetup | null>(null);

    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [categories, setCategories] = useState<AuctionCategory[]>([]);
    const [roles, setRoles] = useState<PlayerRole[]>([]);
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [registrations, setRegistrations] = useState<RegisteredPlayer[]>([]);
    const [waitlist, setWaitlist] = useState<any[]>([]);
    const [captainCodes, setCaptainCodes] = useState<CaptainCode[]>([]);
    
    const [regConfig, setRegConfig] = useState<RegistrationConfig>(DEFAULT_REG_CONFIG);

    const [settingsForm, setSettingsForm] = useState({
        title: '', fullTournamentName: '', season: '', date: '', matchesDate: '', sport: '', purseValue: 0, basePrice: 0, bidIncrement: 0, playersPerTeam: 0, totalTeams: 0, logoUrl: '', dateTBD: false, venue: '', eventVenue: '',
        unlimitedPurse: false, autoReserveFunds: false
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
    const [expandedRegId, setExpandedRegId] = useState<string | null>(null);
    const [allAuctions, setAllAuctions] = useState<any[]>([]);
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

    const showNotification = (message: string, type: 'error' | 'success' = 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    };

    useEffect(() => {
        if (!userProfile?.uid) return;
        const unsub = db.collection('auctions')
            .where('createdBy', '==', userProfile.uid)
            .onSnapshot(snap => {
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setAllAuctions(data);
            });
        return () => unsub();
    }, [userProfile]);
    
    // PDF Export States
    const [pdfTheme, setPdfTheme] = useState<'NORMAL' | 'ADVAYA'>('NORMAL');
    const [selectedFields, setSelectedFields] = useState<string[]>(['playerNumber', 'fullName', 'mobile', 'dob', 'gender', 'playerType', 'profilePic']);
    const [playersPerPage, setPlayersPerPage] = useState<1 | 2 | 4 | 6 | 9 | 'LIST'>(1);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [pdfProgress, setPdfProgress] = useState(0);
    const [systemBranding, setSystemBranding] = useState({ logo: '', tagline: 'Your streaming partner' });

    const autoAssignPlayerNumbers = async () => {
        if (!auction?.id) return;
        setIsGeneratingPDF(true);
        try {
            const sortedRegs = [...registrations].sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0));
            const batch = db.batch();
            sortedRegs.forEach((reg, index) => {
                const docRef = db.collection('auctions').doc(auction.id).collection('registrations').doc(reg.id);
                batch.update(docRef, { playerNumber: index + 1 });
            });
            await batch.commit();
            showNotification("Player numbers assigned successfully!", "success");
        } catch (e: any) {
            showNotification("Error assigning numbers: " + e.message);
        }
        setIsGeneratingPDF(false);
    };

    // Captain Code State
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [editCode, setEditCode] = useState<Partial<CaptainCode>>({
        code: '', assignedTo: '', teamName: '', usageLimit: 1, isActive: true, teamCodes: [], teamMaxPlayers: 11, teamUsedCount: 0
    });

    // Image Overlay State
    const [overlayImage, setOverlayImage] = useState<{ 
        url: string, 
        title: string, 
        type: 'PLAYER' | 'REGISTRATION', 
        id: string, 
        field: string 
    } | null>(null);
    const overlayInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!id) return;
        const unsubAuction = db.collection('auctions').doc(id).onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data() as AuctionSetup;
                setAuction(data);
                if (data.registrationConfig) setRegConfig({ ...DEFAULT_REG_CONFIG, ...data.registrationConfig });
                setSettingsForm({
                    title: data.title || '', 
                    fullTournamentName: data.fullTournamentName || '',
                    season: data.season || '',
                    date: data.date === 'TBD' ? '' : (data.date || ''), 
                    matchesDate: data.matchesDate || '',
                    sport: data.sport || '', 
                    venue: data.venue || '',
                    eventVenue: data.eventVenue || '',
                    purseValue: data.purseValue || 0,
                    basePrice: data.basePrice || 0, 
                    bidIncrement: data.bidIncrement || 0, 
                    playersPerTeam: data.playersPerTeam || 0, 
                    totalTeams: data.totalTeams || 0,
                    logoUrl: data.logoUrl || '',
                    dateTBD: data.date === 'TBD' || !!data.dateTBD,
                    unlimitedPurse: !!data.unlimitedPurse,
                    autoReserveFunds: !!data.autoReserveFunds
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
        const unsubCodes = db.collection('auctions').doc(id).collection('captainCodes').onSnapshot(s => setCaptainCodes(s.docs.map(d => ({id: d.id, ...d.data()}) as CaptainCode)));

        const unsubBranding = db.collection('appConfig').doc('globalSettings').onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                setSystemBranding({
                    logo: data?.systemLogoUrl || '',
                    tagline: data?.systemTagline || 'Your streaming partner'
                });
            }
        });

        return () => {
            unsubAuction(); unsubTeams(); unsubPlayers(); unsubCats(); unsubRoles(); unsubSponsors(); unsubRegs(); unsubWaitlist(); unsubCodes(); unsubBranding();
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
            showNotification("Settings Saved Successfully!", "success");
        } catch (e: any) { showNotification("Save failed: " + e.message); }
    };

    const handleSaveRegistration = async () => {
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).update({ registrationConfig: regConfig });
            showNotification("Registration Settings Saved!", "success");
        } catch (e: any) { showNotification("Failed: " + e.message); }
    };

    const handleRevertToPending = async (regId: string) => {
        if (!id) return;
        try {
            await db.collection('auctions').doc(id).collection('registrations').doc(regId).update({ status: 'PENDING' });
        } catch (e: any) { showNotification("Revert failed: " + e.message); }
    };

    const handleApproveAndAdd = async (reg: RegisteredPlayer) => {
        if (!id) return;
        try {
            // 1. Update registration status
            await db.collection('auctions').doc(id).collection('registrations').doc(reg.id).update({ status: 'APPROVED' });
            
            // Check if already in pool (by name)
            const existing = players.find(p => p.name === reg.fullName);
            if (existing) {
                showNotification(`${reg.fullName} is already in the player pool.`);
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
            showNotification(`${reg.fullName} approved and added to player pool!`, "success");
        } catch (e: any) { showNotification("Approval failed: " + e.message); }
    };

    const handleUpdateRegistration = async (updatedReg: RegisteredPlayer) => {
        if (!id) return;
        try {
            const { id: regId, ...data } = updatedReg;
            await db.collection('auctions').doc(id).collection('registrations').doc(regId).update(data);
            setSelectedReg(updatedReg);
            setIsEditingReg(false);
            showNotification("Registration details updated!", "success");
        } catch (e: any) { showNotification("Update failed: " + e.message); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'MODAL' | 'LOGO' | 'QR' | 'REG_LOGO' | 'REG_BANNER' | 'OVERLAY') => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0], type === 'REG_BANNER');
            
            if (type === 'OVERLAY' && overlayImage) {
                try {
                    if (overlayImage.type === 'PLAYER') {
                        await db.collection('auctions').doc(id).collection('players').doc(overlayImage.id).update({ [overlayImage.field]: base64 });
                    } else {
                        await db.collection('auctions').doc(id).collection('registrations').doc(overlayImage.id).update({ [overlayImage.field]: base64 });
                        if (selectedReg && selectedReg.id === overlayImage.id) {
                            setSelectedReg({ ...selectedReg, [overlayImage.field]: base64 });
                        }
                    }
                    setOverlayImage({ ...overlayImage, url: base64 });
                    showNotification("Image updated successfully!", "success");
                } catch (err: any) {
                    showNotification("Update failed: " + err.message);
                }
                return;
            }

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
        let col = modalType.toLowerCase() + 's';
        if (modalType === 'CATEGORY') col = 'categories';
        const itemData = { ...editItem, logoUrl: previewImage || editItem.logoUrl || '', photoUrl: previewImage || editItem.photoUrl || '', imageUrl: previewImage || editItem.imageUrl || '' };
        
        try {
            if (editItem.id) {
                await db.collection('auctions').doc(id).collection(col).doc(editItem.id).update(itemData);
            } else {
                await db.collection('auctions').doc(id).collection(col).add({ ...itemData, createdAt: Date.now() });
            }
            closeModal();
        } catch (err: any) { showNotification("Save failed: " + err.message); }
    };

    const closeModal = () => {
        setShowModal(false);
        setEditItem(null);
        setPreviewImage('');
    };

    const handleDelete = async (type: string, itemId: string) => {
        setConfirmAction({
            title: "Purge Record",
            message: "Are you sure you want to purge this record?",
            onConfirm: async () => {
                await db.collection('auctions').doc(id!).collection(type.toLowerCase() + 's').doc(itemId).delete();
                setConfirmAction(null);
            }
        });
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
            showNotification(`Imported ${data.length} records!`, "success");
        };
        reader.readAsBinaryString(file);
    };

    const generatePDF = async () => {
        if (registrations.length === 0) {
            showNotification("No registrations to export.");
            return;
        }
        setIsGeneratingPDF(true);
        setPdfProgress(0);

        const doc = new jsPDF('p', 'mm', 'a4');
        const pdfContainer = document.createElement('div');
        pdfContainer.style.position = 'fixed';
        pdfContainer.style.left = '-9999px';
        pdfContainer.style.top = '0';
        pdfContainer.style.width = '210mm'; // A4 width
        document.body.appendChild(pdfContainer);

        try {
            const actualPlayersPerPage = playersPerPage === 'LIST' ? 15 : playersPerPage;
            const totalPages = Math.ceil(registrations.length / actualPlayersPerPage);
            
            for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
                setPdfProgress(Math.round(((pageIndex + 1) / totalPages) * 100));
                
                const startIdx = pageIndex * actualPlayersPerPage;
                const pageRegs = registrations.slice(startIdx, startIdx + actualPlayersPerPage);

                // Determine grid columns based on playersPerPage
                let gridCols = 1;
                let gridRows = '1fr';
                let cardHeight = '100%';
                
                if (playersPerPage === 1) { gridCols = 1; gridRows = '1fr'; cardHeight = '100%'; }
                else if (playersPerPage === 2) { gridCols = 1; gridRows = 'repeat(2, 1fr)'; cardHeight = '100%'; }
                else if (playersPerPage === 4) { gridCols = 2; gridRows = 'repeat(2, 1fr)'; cardHeight = '100%'; }
                else if (playersPerPage === 6) { gridCols = 2; gridRows = 'repeat(3, 1fr)'; cardHeight = '100%'; }
                else if (playersPerPage === 9) { gridCols = 3; gridRows = 'repeat(3, 1fr)'; cardHeight = '100%'; }
                else if (playersPerPage === 'LIST') { gridCols = 1; gridRows = 'none'; cardHeight = 'auto'; }

                // Render page content
                pdfContainer.innerHTML = `
                    <div id="pdf-page" style="
                        width: 210mm; 
                        height: 297mm; 
                        padding: 8mm 10mm; 
                        background: ${pdfTheme === 'ADVAYA' ? '#0a0a0a' : '#ffffff'};
                        color: ${pdfTheme === 'ADVAYA' ? '#fbbf24' : '#1f2937'};
                        font-family: sans-serif;
                        box-sizing: border-box;
                        position: relative;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    ">
                        ${pdfTheme === 'ADVAYA' ? `
                            <div style="position: absolute; top: 0; right: 0; width: 100mm; height: 100mm; background: radial-gradient(circle at top right, rgba(251,191,36,0.05) 0%, transparent 70%); pointer-events: none;"></div>
                            <div style="position: absolute; bottom: 0; left: 0; width: 100mm; height: 100mm; background: radial-gradient(circle at bottom left, rgba(251,191,36,0.05) 0%, transparent 70%); pointer-events: none;"></div>
                        ` : ''}

                        <!-- Header -->
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid ${pdfTheme === 'ADVAYA' ? '#fbbf24' : '#3b82f6'}; padding: 0 0 3mm 0; margin-bottom: 4mm; position: relative; z-index: 10; height: 25mm; flex-shrink: 0; box-sizing: border-box;">
                            <div style="display: flex; align-items: center; gap: 5mm;">
                                ${systemBranding.logo ? `<img src="${systemBranding.logo}" referrerpolicy="no-referrer" style="height: 18mm; width: 18mm; object-fit: contain; border-radius: 2mm;" />` : ''}
                                <div style="display: flex; flex-direction: column; justify-content: center;">
                                    <h1 style="margin: 0; font-size: 22pt; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; color: ${pdfTheme === 'ADVAYA' ? '#fbbf24' : '#1f2937'}; line-height: 1;">SM SPORTS</h1>
                                    <p style="margin: 1mm 0 0 0; font-size: 10pt; font-weight: 700; opacity: 0.9; text-transform: uppercase; letter-spacing: 1.5px;">${systemBranding.tagline}</p>
                                </div>
                            </div>
                            <div style="text-align: right; display: flex; align-items: center; gap: 5mm;">
                                <div style="display: flex; flex-direction: column; justify-content: center;">
                                    <h2 style="margin: 0; font-size: 15pt; font-weight: 900; text-transform: uppercase; color: ${pdfTheme === 'ADVAYA' ? '#fbbf24' : '#1f2937'}; line-height: 1;">${auction?.title || 'Tournament'}</h2>
                                    <p style="margin: 1mm 0 0 0; font-size: 9pt; font-weight: 700; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px;">Official Player List</p>
                                </div>
                                ${auction?.logoUrl ? `<img src="${auction.logoUrl}" referrerpolicy="no-referrer" style="height: 18mm; width: 18mm; object-fit: contain;" />` : ''}
                            </div>
                        </div>

                        <!-- Players Grid -->
                        <div style="
                            flex: 1;
                            display: ${playersPerPage === 'LIST' ? 'flex' : 'grid'};
                            ${playersPerPage === 'LIST' ? 'flex-direction: column;' : ''}
                            grid-template-columns: repeat(${gridCols}, 1fr);
                            grid-template-rows: ${gridRows};
                            gap: 2mm;
                            align-content: start;
                            min-height: 0;
                            box-sizing: border-box;
                        ">
                            ${pageRegs.map((reg, idx) => {
                                const playerNum = startIdx + idx + 1;
                                const isDense = (typeof playersPerPage === 'number' && playersPerPage > 4) || playersPerPage === 'LIST';
                                const isSingle = playersPerPage === 1;
                                const isList = playersPerPage === 'LIST';

                                if (isList) {
                                    return `
                                    <div style="
                                        background: ${pdfTheme === 'ADVAYA' ? 'rgba(251,191,36,0.03)' : '#f9fafb'};
                                        border: 1px solid ${pdfTheme === 'ADVAYA' ? 'rgba(251,191,36,0.1)' : '#f1f5f9'};
                                        border-radius: 2mm;
                                        padding: 2mm 4mm;
                                        display: flex;
                                        align-items: center;
                                        gap: 4mm;
                                    ">
                                        <div style="font-size: 10pt; font-weight: 900; width: 10mm; color: ${pdfTheme === 'ADVAYA' ? '#fbbf24' : '#3b82f6'};">#${reg.playerNumber || playerNum}</div>
                                        ${selectedFields.includes('profilePic') ? `
                                            <div style="width: 10mm; height: 10mm; border-radius: 1mm; overflow: hidden; flex-shrink: 0;">
                                                <img src="${reg.profilePic}" referrerpolicy="no-referrer" style="width: 100%; height: 100%; object-fit: cover;" />
                                            </div>
                                        ` : ''}
                                        <div style="flex: 1; min-width: 0;">
                                            <h3 style="margin: 0; font-size: 10pt; font-weight: 900; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${reg.fullName}</h3>
                                            <p style="margin: 0; font-size: 7pt; font-weight: 700; opacity: 0.6;">${reg.playerType} • ${reg.mobile}</p>
                                        </div>
                                        <div style="display: flex; gap: 4mm;">
                                            ${regConfig.customFields.slice(0, 2).map(field => `
                                                <div style="text-align: right;">
                                                    <p style="margin: 0; font-size: 5pt; font-weight: 900; opacity: 0.5; text-transform: uppercase;">${field.label}</p>
                                                    <p style="margin: 0; font-size: 8pt; font-weight: 700;">${reg[field.id] || '-'}</p>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                    `;
                                }

                                return `
                                <div style="
                                    background: ${pdfTheme === 'ADVAYA' ? 'rgba(251,191,36,0.03)' : '#f9fafb'};
                                    border: 2px solid ${pdfTheme === 'ADVAYA' ? 'rgba(251,191,36,0.15)' : '#e2e8f0'};
                                    border-radius: ${isSingle ? '10mm' : '3mm'};
                                    padding: ${isSingle ? '12mm' : isDense ? '2mm' : '5mm'};
                                    display: flex;
                                    flex-direction: column;
                                    gap: ${isSingle ? '10mm' : isDense ? '1.5mm' : '3mm'};
                                    position: relative;
                                    overflow: hidden;
                                    height: ${cardHeight};
                                    box-sizing: border-box;
                                    ${isSingle ? 'justify-content: center;' : ''}
                                ">
                                    ${selectedFields.includes('playerNumber') ? `
                                        <div style="position: absolute; top: 0; right: 0; padding: ${isSingle ? '4mm 12mm' : '1mm 3mm'}; background: ${pdfTheme === 'ADVAYA' ? '#fbbf24' : '#3b82f6'}; color: ${pdfTheme === 'ADVAYA' ? '#000000' : '#ffffff'}; font-size: ${isSingle ? '24pt' : isDense ? '8pt' : '11pt'}; font-weight: 900; border-bottom-left-radius: 3mm; z-index: 5;">
                                            #${reg.playerNumber || playerNum}
                                        </div>
                                    ` : ''}
                                    <div style="display: flex; gap: ${isSingle ? '12mm' : '3mm'}; align-items: ${isSingle ? 'center' : 'start'};">
                                        ${selectedFields.includes('profilePic') ? `
                                            <div style="width: ${isSingle ? '70mm' : isDense ? '18mm' : '30mm'}; height: ${isSingle ? '85mm' : isDense ? '22mm' : '38mm'}; border-radius: ${isSingle ? '8mm' : '2mm'}; overflow: hidden; border: ${isSingle ? '6px' : '2px'} solid ${pdfTheme === 'ADVAYA' ? '#fbbf2444' : '#cbd5e1'}; flex-shrink: 0;">
                                                <img src="${reg.profilePic}" referrerpolicy="no-referrer" style="width: 100%; height: 100%; object-fit: cover;" />
                                            </div>
                                        ` : ''}
                                        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: ${isSingle ? '6mm' : '1mm'};">
                                            ${selectedFields.includes('fullName') ? `<h3 style="margin: 0; font-size: ${isSingle ? '36pt' : isDense ? '10pt' : '15pt'}; font-weight: 900; text-transform: uppercase; line-height: 1.1; color: ${pdfTheme === 'ADVAYA' ? '#fbbf24' : '#0f172a'}; word-break: break-all; margin-bottom: 0.5mm;">${reg.fullName}</h3>` : ''}
                                            <div style="display: inline-block; width: fit-content; padding: ${isSingle ? '3mm 8mm' : '0.5mm 2mm'}; background: ${pdfTheme === 'ADVAYA' ? '#fbbf24' : '#3b82f6'}; color: ${pdfTheme === 'ADVAYA' ? '#000000' : '#ffffff'}; border-radius: ${isSingle ? '4mm' : '1mm'}; font-size: ${isSingle ? '18pt' : isDense ? '6pt' : '8pt'}; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; flex-shrink: 0;">
                                                ${reg.playerType}
                                            </div>
                                            
                                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${isSingle ? '10mm' : '2mm'}; margin-top: ${isSingle ? '10mm' : isDense ? '1mm' : '3mm'};">
                                                ${selectedFields.includes('mobile') ? `<div><p style="margin: 0; font-size: ${isSingle ? '12pt' : '4pt'}; font-weight: 900; opacity: 0.6; text-transform: uppercase;">Mobile</p><p style="margin: 0; font-size: ${isSingle ? '20pt' : isDense ? '7pt' : '10pt'}; font-weight: 700; color: ${pdfTheme === 'ADVAYA' ? '#ffffff' : '#334155'};">${reg.mobile}</p></div>` : ''}
                                                ${selectedFields.includes('dob') ? `<div><p style="margin: 0; font-size: ${isSingle ? '12pt' : '4pt'}; font-weight: 900; opacity: 0.6; text-transform: uppercase;">DOB</p><p style="margin: 0; font-size: ${isSingle ? '20pt' : isDense ? '7pt' : '10pt'}; font-weight: 700; color: ${pdfTheme === 'ADVAYA' ? '#ffffff' : '#334155'};">${reg.dob}</p></div>` : ''}
                                                ${selectedFields.includes('gender') ? `<div><p style="margin: 0; font-size: ${isSingle ? '12pt' : '4pt'}; font-weight: 900; opacity: 0.6; text-transform: uppercase;">Gender</p><p style="margin: 0; font-size: ${isSingle ? '20pt' : isDense ? '7pt' : '10pt'}; font-weight: 700; color: ${pdfTheme === 'ADVAYA' ? '#ffffff' : '#334155'};">${reg.gender}</p></div>` : ''}
                                                <div><p style="margin: 0; font-size: ${isSingle ? '12pt' : '4pt'}; font-weight: 900; opacity: 0.6; text-transform: uppercase;">Status</p><p style="margin: 0; font-size: ${isSingle ? '20pt' : isDense ? '7pt' : '10pt'}; font-weight: 900; color: ${reg.status === 'APPROVED' ? '#10b981' : '#f59e0b'};">${reg.status}</p></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style="display: grid; grid-template-columns: ${isSingle ? '1fr 1fr 1fr' : '1fr 1fr'}; gap: ${isSingle ? '6mm' : '1.5mm'}; margin-top: auto;">
                                        ${regConfig.customFields.filter(f => selectedFields.includes(f.id)).map(field => `
                                            <div style="background: ${pdfTheme === 'ADVAYA' ? 'rgba(251,191,36,0.06)' : '#ffffff'}; padding: ${isSingle ? '6mm' : '1.5mm'}; border-radius: ${isSingle ? '5mm' : '1.5mm'}; border: 1px solid ${pdfTheme === 'ADVAYA' ? 'rgba(251,191,36,0.1)' : '#e2e8f0'}; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                                                <p style="margin: 0; font-size: ${isSingle ? '10pt' : '4.5pt'}; font-weight: 900; opacity: 0.7; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${field.label}</p>
                                                <p style="margin: 0; font-size: ${isSingle ? '16pt' : isDense ? '7pt' : '9pt'}; font-weight: 700; word-break: break-all; line-height: 1.1; color: ${pdfTheme === 'ADVAYA' ? '#ffffff' : '#1e293b'};">${reg[field.id] || '-'}</p>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>

                        <!-- Footer -->
                        <div style="margin-top: 4mm; padding-top: 3mm; border-top: 1px solid ${pdfTheme === 'ADVAYA' ? 'rgba(251,191,36,0.1)' : '#f1f5f9'}; display: flex; justify-content: space-between; align-items: center; opacity: 0.6; position: relative; z-index: 10;">
                            <div>
                                <p style="font-size: 8pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Generated by SM Sports Registry</p>
                                <p style="font-size: 7pt; font-weight: 700; margin-top: 0.5mm;">Official Tournament Document • ${new Date().toLocaleDateString()}</p>
                            </div>
                            <div style="text-align: right;">
                                <p style="font-size: 9pt; font-weight: 900; color: ${pdfTheme === 'ADVAYA' ? '#fbbf24' : '#3b82f6'};">PAGE ${pageIndex + 1} OF ${totalPages}</p>
                            </div>
                        </div>
                    </div>
                `;

                const canvas = await html2canvas(pdfContainer.querySelector('#pdf-page') as HTMLElement, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: pdfTheme === 'ADVAYA' ? '#0a0a0a' : '#ffffff'
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                if (pageIndex > 0) doc.addPage();
                doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
            }

            doc.save(`${auction?.title || 'Tournament'}_Registry.pdf`);
        } catch (error) {
            console.error("PDF Generation Error:", error);
            showNotification("Failed to generate PDF. Check console for details.");
        } finally {
            document.body.removeChild(pdfContainer);
            setIsGeneratingPDF(false);
        }
    };

    const exportPlayersToCSV = () => {
        if (players.length === 0) {
            showNotification("No players to export.");
            return;
        }
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
        if (registrations.length === 0) {
            showNotification("No registrations to export.");
            return;
        }
        
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

    const handleSaveCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        try {
            const codeData = {
                ...editCode,
                code: editCode.code?.toUpperCase(),
                teamCodes: editCode.teamCodes?.map(tc => ({ ...tc, code: tc.code.toUpperCase() })),
                updatedAt: Date.now()
            };
            if (editCode.id) {
                await db.collection('auctions').doc(id).collection('captainCodes').doc(editCode.id).update(codeData);
            } else {
                await db.collection('auctions').doc(id).collection('captainCodes').add({
                    ...codeData,
                    currentUsage: 0,
                    teamUsedCount: 0,
                    createdAt: Date.now()
                });
            }
            setShowCodeModal(false);
            setEditCode({ code: '', assignedTo: '', teamName: '', usageLimit: 1, isActive: true, teamCodes: [], teamMaxPlayers: 11, teamUsedCount: 0 });
        } catch (err: any) { showNotification("Save failed: " + err.message); }
    };

    const handleDeleteCode = async (codeId: string) => {
        setConfirmAction({
            title: "Delete Code",
            message: "Delete this captain code?",
            onConfirm: async () => {
                await db.collection('auctions').doc(id!).collection('captainCodes').doc(codeId).delete();
                setConfirmAction(null);
            }
        });
    };

    const handleResetCodeUsage = async (codeId: string) => {
        setConfirmAction({
            title: "Reset Usage",
            message: "Reset usage for this code?",
            onConfirm: async () => {
                const code = captainCodes.find(c => c.id === codeId);
                const resetTeamCodes = code?.teamCodes?.map(tc => ({ ...tc, isUsed: false, usedBy: undefined })) || [];
                await db.collection('auctions').doc(id!).collection('captainCodes').doc(codeId).update({ 
                    currentUsage: 0, 
                    teamUsedCount: 0,
                    teamCodes: resetTeamCodes
                });
                setConfirmAction(null);
            }
        });
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]"><Loader2 className="animate-spin text-blue-600"/></div>;

    return (
        <div className="min-h-screen bg-[#f8f9fa] font-sans pb-20 text-gray-900 selection:bg-blue-100 selection:text-blue-900">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-gray-800 transition-colors p-2 hover:bg-gray-50 rounded-lg"><ArrowLeft className="w-5 h-5"/></button>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-[300px] md:max-w-md py-1">
                            {allAuctions.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => navigate(`/manage/${a.id}`)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                                        id === a.id 
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' 
                                        : 'bg-white border-gray-200 text-gray-400 hover:border-blue-200'
                                    }`}
                                >
                                    {a.title?.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200 overflow-x-auto no-scrollbar">
                        {['SETTINGS', 'TEAMS', 'PLAYERS', 'REQUESTS', 'CATEGORIES', 'ROLES', 'SPONSORS', 'REGISTRATION', 'WAITLIST', 'CAPTAIN_CODES'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab as any)}
                                className={`px-4 py-2 text-[10px] font-black uppercase transition-all rounded-lg whitespace-nowrap ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                                {tab === 'REGISTRATION' ? 'REG CONFIG' : tab === 'REQUESTS' ? `Requests (${registrations.length})` : tab === 'WAITLIST' ? `Waitlist (${waitlist.length})` : tab === 'CAPTAIN_CODES' ? 'CAPTAIN CODES' : tab}
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
                                                <img src={settingsForm.logoUrl} className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
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
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Event Name (Short)</label>
                                            <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.title} onChange={e => setSettingsForm({...settingsForm, title: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Tournament Name (Optional)</label>
                                            <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.fullTournamentName || ''} onChange={e => setSettingsForm({...settingsForm, fullTournamentName: e.target.value})} placeholder="e.g. Bangalore Bigbash League" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Season Number</label>
                                            <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.season || ''} onChange={e => setSettingsForm({...settingsForm, season: e.target.value})} placeholder="e.g. 4" />
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
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Tournament Venue</label>
                                            <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.venue || ''} onChange={e => setSettingsForm({...settingsForm, venue: e.target.value})} placeholder="e.g. Chinnaswamy Stadium" />
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
                                            <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.eventVenue || ''} onChange={e => setSettingsForm({...settingsForm, eventVenue: e.target.value})} placeholder="Stadium, City" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Purse Budget (₹)</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.purseValue} onChange={e => setSettingsForm({...settingsForm, purseValue: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Standard Min Bid (₹)</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={settingsForm.bidIncrement} onChange={e => setSettingsForm({...settingsForm, bidIncrement: Number(e.target.value)})} />
                                        </div>
                                        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest">Unlimited Purse</p>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Disable all budget restrictions</p>
                                                </div>
                                                <button 
                                                    onClick={() => setSettingsForm({...settingsForm, unlimitedPurse: !settingsForm.unlimitedPurse})}
                                                    className={`w-12 h-6 rounded-full transition-all relative ${settingsForm.unlimitedPurse ? 'bg-blue-600' : 'bg-gray-200'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settingsForm.unlimitedPurse ? 'left-7' : 'left-1'}`} />
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest">Auto Reserve Funds</p>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Reserve funds for remaining squad</p>
                                                </div>
                                                <button 
                                                    onClick={() => setSettingsForm({...settingsForm, autoReserveFunds: !settingsForm.autoReserveFunds})}
                                                    className={`w-12 h-6 rounded-full transition-all relative ${settingsForm.autoReserveFunds ? 'bg-blue-600' : 'bg-gray-200'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settingsForm.autoReserveFunds ? 'left-7' : 'left-1'}`} />
                                                </button>
                                            </div>
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
                                            {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-contain" referrerPolicy="no-referrer" /> : <Users className="text-gray-300 w-6 h-6"/>}
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
                                                        <div 
                                                            className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden shadow-sm cursor-pointer hover:border-blue-400 transition-all"
                                                            onClick={() => p.photoUrl && setOverlayImage({ url: p.photoUrl, title: p.name, type: 'PLAYER', id: String(p.id), field: 'photoUrl' })}
                                                        >
                                                            {p.photoUrl ? <img src={p.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User className="w-5 h-5 m-2.5 text-gray-300"/>}
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
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Registration Open</label>
                                    <button onClick={() => setRegConfig({...regConfig, isEnabled: !regConfig.isEnabled})} className={`transition-all active:scale-90 ${regConfig.isEnabled ? 'text-blue-600' : 'text-gray-300'}`}>{regConfig.isEnabled ? <ToggleRight className="w-10 h-10"/> : <ToggleLeft className="w-10 h-10"/>}</button>
                                </div>
                            </div>

                            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-8">
                                    {/* Visibility & Access */}
                                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm space-y-6">
                                        <h3 className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.25em] mb-2 flex items-center gap-2">
                                            <Eye className="w-4 h-4"/> Visibility & Access
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                <div>
                                                    <span className="text-[11px] font-black text-gray-700 block uppercase tracking-wide">Show on SM Sports Website</span>
                                                    <span className="text-[9px] text-gray-400 font-bold uppercase mt-1 block">Make this tournament visible in the public directory</span>
                                                </div>
                                                <button onClick={() => setRegConfig({...regConfig, isPublic: !regConfig.isPublic})} className={`transition-all active:scale-90 ${regConfig.isPublic ? 'text-indigo-600' : 'text-gray-300'}`}>
                                                    {regConfig.isPublic ? <ToggleRight className="w-8 h-8"/> : <ToggleLeft className="w-8 h-8"/>}
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                <div>
                                                    <span className="text-[11px] font-black text-gray-700 block uppercase tracking-wide">Hide Landing Page</span>
                                                    <span className="text-[9px] text-gray-400 font-bold uppercase mt-1 block">Skip "Join the Battle" and show form directly</span>
                                                </div>
                                                <button onClick={() => setRegConfig({...regConfig, hideLandingPage: !regConfig.hideLandingPage})} className={`transition-all active:scale-90 ${regConfig.hideLandingPage ? 'text-indigo-600' : 'text-gray-300'}`}>
                                                    {regConfig.hideLandingPage ? <ToggleRight className="w-8 h-8"/> : <ToggleLeft className="w-8 h-8"/>}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Default Fields Display */}
                                    <div className="bg-gray-50 p-6 rounded-[1.5rem] border border-gray-100">
                                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
                                            <ListChecks className="w-4 h-4"/> Standard Form Fields
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
                                                                <img src={regConfig.qrCodeUrl} className="h-full w-full object-contain p-4" referrerPolicy="no-referrer" />
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
                                    {/* Basic Fields Management */}
                                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm">
                                        <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                                            <User className="w-4 h-4"/> Basic Form Fields
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[
                                                { id: 'name', label: 'Player Name' },
                                                { id: 'dob', label: 'Date of Birth' },
                                                { id: 'photo', label: 'Player Photo' },
                                                { id: 'mobile', label: 'Mobile Number' },
                                                { id: 'gender', label: 'Gender' },
                                                { id: 'role', label: 'Player Role' }
                                            ].map(field => (
                                                <div key={field.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs font-black uppercase text-gray-800">{field.label}</p>
                                                        <div className="flex items-center gap-4 mt-2">
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="w-3 h-3 rounded text-blue-600"
                                                                    checked={regConfig.basicFields?.[field.id as keyof typeof regConfig.basicFields]?.show ?? true}
                                                                    onChange={e => {
                                                                        const basicFields = { ...regConfig.basicFields };
                                                                        // @ts-ignore
                                                                        basicFields[field.id] = { ...basicFields[field.id], show: e.target.checked };
                                                                        setRegConfig({ ...regConfig, basicFields: basicFields as any });
                                                                    }}
                                                                />
                                                                <span className="text-[9px] font-bold uppercase text-gray-500">Show</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 cursor-pointer">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="w-3 h-3 rounded text-blue-600"
                                                                    checked={regConfig.basicFields?.[field.id as keyof typeof regConfig.basicFields]?.required ?? true}
                                                                    onChange={e => {
                                                                        const basicFields = { ...regConfig.basicFields };
                                                                        // @ts-ignore
                                                                        basicFields[field.id] = { ...basicFields[field.id], required: e.target.checked };
                                                                        setRegConfig({ ...regConfig, basicFields: basicFields as any });
                                                                    }}
                                                                />
                                                                <span className="text-[9px] font-bold uppercase text-gray-500">Required</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

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
                                            <CheckCircle className="w-4 h-4"/> Success Message
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
                                                <label className="block text-[10px] font-black text-gray-500 uppercase">Enable Waitlist</label>
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
                                            <Phone className="w-4 h-4"/> Organizer Contacts
                                        </h3>
                                        <div className="space-y-4">
                                            {(regConfig.organizerContacts || []).map((contact, idx) => (
                                                <div key={idx} className="flex gap-4 items-end bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                    <div className="flex-1">
                                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Name</label>
                                                        <input 
                                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold"
                                                            value={contact.name}
                                                            onChange={e => {
                                                                const newContacts = [...(regConfig.organizerContacts || [])];
                                                                newContacts[idx].name = e.target.value;
                                                                setRegConfig({...regConfig, organizerContacts: newContacts});
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-[9px] font-black text-gray-400 uppercase mb-1">Phone</label>
                                                        <input 
                                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold"
                                                            value={contact.phone}
                                                            onChange={e => {
                                                                const newContacts = [...(regConfig.organizerContacts || [])];
                                                                newContacts[idx].phone = e.target.value;
                                                                setRegConfig({...regConfig, organizerContacts: newContacts});
                                                            }}
                                                        />
                                                    </div>
                                                    <button 
                                                        onClick={() => {
                                                            const newContacts = (regConfig.organizerContacts || []).filter((_, i) => i !== idx);
                                                            setRegConfig({...regConfig, organizerContacts: newContacts});
                                                        }}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button 
                                                onClick={() => {
                                                    const newContacts = [...(regConfig.organizerContacts || []), { name: '', phone: '' }];
                                                    setRegConfig({...regConfig, organizerContacts: newContacts});
                                                }}
                                                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-[10px] font-black text-gray-400 uppercase hover:border-blue-400 hover:text-blue-500 transition-all"
                                            >
                                                <Plus className="w-3 h-3 inline mr-1" /> Add Contact
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[11px] font-black text-amber-500 uppercase tracking-[0.25em] flex items-center gap-2">
                                                <Megaphone className="w-4 h-4"/> Welcome Popup
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
                                                    { id: 'DEFAULT', label: 'Standard (Clean)' },
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
                                                        <img src={regConfig.logoUrl} className="h-full w-full object-contain p-2" referrerPolicy="no-referrer" />
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
                                                        <img src={regConfig.bannerUrl} className="h-full w-full object-contain p-2" referrerPolicy="no-referrer" />
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
                                            <span className="text-[10px] font-black uppercase tracking-widest">Quick Tip</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-wide">
                                            Standard form fields are mandatory. Use custom fields for tournament-specific data like T-Shirt size or Father's Name.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 bg-gray-50 border-t border-gray-100 flex justify-center">
                                <button onClick={handleSaveRegistration} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-5 px-16 rounded-[1.5rem] shadow-2xl shadow-blue-600/30 text-sm uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 group">
                                    <Save className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Save Settings
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'REQUESTS' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Export Hub Section */}
                        <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm space-y-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Export Hub</h2>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Download your registration data</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={exportRegistrationsToCSV} 
                                        className="bg-gray-50 border border-gray-100 text-gray-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-gray-100 transition-all active:scale-95"
                                    >
                                        <Download className="w-4 h-4"/> Export CSV
                                    </button>
                                    <button 
                                        onClick={generatePDF}
                                        disabled={isGeneratingPDF}
                                        className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50"
                                    >
                                        {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileDown className="w-4 h-4"/>}
                                        {isGeneratingPDF ? `Generating ${pdfProgress}%` : 'Generate PDF Registry'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6 border-t border-gray-50">
                                {/* Theme Selection */}
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Palette className="w-3 h-3 text-blue-500"/> Document Theme
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'NORMAL', label: 'Standard White', desc: 'Clean & Professional' },
                                            { id: 'ADVAYA', label: 'Premium Dark', desc: 'Gold & Black Warrior' }
                                        ].map(theme => (
                                            <button 
                                                key={theme.id}
                                                onClick={() => setPdfTheme(theme.id as any)}
                                                className={`p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden group ${pdfTheme === theme.id ? 'border-blue-600 bg-blue-50/50 shadow-lg shadow-blue-600/10' : 'border-gray-100 bg-gray-50/50 hover:border-blue-200'}`}
                                            >
                                                <div className="relative z-10">
                                                    <p className={`text-[10px] font-black uppercase tracking-widest ${pdfTheme === theme.id ? 'text-blue-600' : 'text-gray-700'}`}>{theme.label}</p>
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{theme.desc}</p>
                                                </div>
                                                {pdfTheme === theme.id && (
                                                    <div className="absolute top-2 right-2">
                                                        <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                                                            <CheckCircle className="w-2.5 h-2.5 text-white" />
                                                        </div>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Players Per Page */}
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <LayoutList className="w-3 h-3 text-blue-500"/> Players Per Page
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[1, 2, 4, 6, 9, 'LIST'].map(num => (
                                            <button 
                                                key={num}
                                                onClick={() => setPlayersPerPage(num as any)}
                                                className={`py-3 rounded-xl border-2 text-center transition-all ${playersPerPage === num ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-blue-200'}`}
                                            >
                                                <p className="text-[10px] font-black uppercase tracking-widest">
                                                    {num === 'LIST' ? 'List' : num}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Field Selection */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <Hash className="w-3 h-3 text-blue-500"/> Player Numbering
                                        </label>
                                        <button 
                                            onClick={autoAssignPlayerNumbers}
                                            className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                                        >
                                            Auto-Assign Numbers
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { id: 'playerNumber', label: 'Player #' },
                                            { id: 'fullName', label: 'Full Name' },
                                            { id: 'mobile', label: 'Mobile' },
                                            { id: 'dob', label: 'DOB' },
                                            { id: 'gender', label: 'Gender' },
                                            { id: 'playerType', label: 'Role' },
                                            { id: 'profilePic', label: 'Photo' },
                                            ...regConfig.customFields.map(f => ({ id: f.id, label: f.label }))
                                        ].map(field => (
                                            <button 
                                                key={field.id}
                                                onClick={() => {
                                                    if (selectedFields.includes(field.id)) {
                                                        setSelectedFields(selectedFields.filter(f => f !== field.id));
                                                    } else {
                                                        setSelectedFields([...selectedFields, field.id]);
                                                    }
                                                }}
                                                className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${selectedFields.includes(field.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/10' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-blue-200'}`}
                                            >
                                                {field.label}
                                                {selectedFields.includes(field.id) ? <Check className="w-2 h-2"/> : <Plus className="w-2 h-2 opacity-30"/>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mb-4 px-2">
                             <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Registration Queue ({registrations.length})</h2>
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
                                            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border-2 border-gray-50 flex items-center justify-center bg-gray-50 cursor-pointer group/pic relative"
                                                 onClick={() => setOverlayImage({ url: reg.profilePic, title: reg.fullName, type: 'REGISTRATION', id: reg.id, field: 'profilePic' })}
                                            >
                                                {reg.profilePic ? (
                                                    <img src={reg.profilePic} className="w-full h-full object-cover" alt={reg.fullName} referrerPolicy="no-referrer" />
                                                ) : (
                                                    <User className="w-8 h-8 text-gray-300" />
                                                )}
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/pic:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Maximize2 className="w-4 h-4 text-white" />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <p className="text-lg font-black text-gray-800 uppercase leading-none">{reg.fullName}</p>
                                                    {reg.isCaptain && (
                                                        <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border border-amber-200 flex items-center gap-1">
                                                            <ShieldCheck className="w-3 h-3" /> Captain 🧑‍✈️
                                                        </span>
                                                    )}
                                                    {reg.teamCode && (
                                                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-1">
                                                            <Users className="w-3 h-3" /> Team Player 🏏
                                                        </span>
                                                    )}
                                                </div>
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
                                                title="View Info"
                                            >
                                                <Info className="w-4 h-4"/>
                                            </button>
                                            <button 
                                                onClick={() => setExpandedRegId(expandedRegId === reg.id ? null : reg.id)}
                                                className={`p-2.5 rounded-xl transition-all ${expandedRegId === reg.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-100 hover:bg-blue-50 text-gray-400 hover:text-blue-600'}`}
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

                                        {expandedRegId === reg.id && (
                                            <div className="mt-6 pt-6 border-t border-gray-100 animate-fade-in">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                                    <div>
                                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Mobile</p>
                                                        <p className="text-xs font-bold text-gray-700">{reg.mobile}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">DOB</p>
                                                        <p className="text-xs font-bold text-gray-700">{reg.dob}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Gender</p>
                                                        <p className="text-xs font-bold text-gray-700">{reg.gender}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Role</p>
                                                        <p className="text-xs font-bold text-gray-700">{reg.playerType}</p>
                                                    </div>
                                                    {regConfig.customFields.map(f => (
                                                        <div key={f.id}>
                                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">{f.label}</p>
                                                            <p className="text-xs font-bold text-gray-700">{reg[f.id] || 'N/A'}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                {reg.paymentScreenshot && (
                                                    <div className="mt-6">
                                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-3">Payment Proof Document</p>
                                                        <div className="relative group/img inline-block cursor-pointer"
                                                             onClick={() => setOverlayImage({ url: reg.paymentScreenshot, title: reg.fullName, type: 'REGISTRATION', id: reg.id, field: 'paymentScreenshot' })}
                                                        >
                                                            <img src={reg.paymentScreenshot} className="max-w-md rounded-2xl border-4 border-white shadow-xl" referrerPolicy="no-referrer" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                                                <Eye className="text-white w-8 h-8" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
                            <div className="flex gap-2">
                                {activeTab === 'CATEGORIES' && (
                                    <button onClick={() => navigate(`/admin/auction/${id}/arrangement`)} className="bg-amber-500 text-zinc-950 px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all">
                                        <LayoutGrid className="w-4 h-4"/> Category Room
                                    </button>
                                )}
                                <button onClick={() => {
                                    setModalType(activeTab === 'CATEGORIES' ? 'CATEGORY' : activeTab === 'ROLES' ? 'ROLE' : 'SPONSOR');
                                    setEditItem({});
                                    setShowModal(true);
                                }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg"><Plus className="w-4 h-4"/> Add New</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {(activeTab === 'CATEGORIES' ? categories : activeTab === 'ROLES' ? roles : sponsors).map((item: any) => (
                                <div key={item.id} className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm flex flex-col group">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100 overflow-hidden">
                                                {item.imageUrl || item.photoUrl || item.logoUrl ? (
                                                    <img src={item.imageUrl || item.photoUrl || item.logoUrl} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                                ) : (
                                                    <Layers className="text-gray-300 w-6 h-6"/>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-black text-gray-800 uppercase text-sm">{item.name}</p>
                                                {activeTab === 'CATEGORIES' && (
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                                    ₹{item.basePrice} • {item.minPerTeam}-{item.maxPerTeam} Per Team • {item.requiredPlayers || 0} Required
                                                </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => {
                                                setModalType(activeTab === 'CATEGORIES' ? 'CATEGORY' : activeTab === 'ROLES' ? 'ROLE' : 'SPONSOR');
                                                setEditItem(item);
                                                setPreviewImage(item.imageUrl || item.photoUrl || item.logoUrl || '');
                                                setShowModal(true);
                                            }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit className="w-4 h-4"/></button>
                                            <button onClick={() => handleDelete(activeTab === 'CATEGORIES' ? 'CATEGORIE' : activeTab.slice(0, -1), item.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </div>

                                    {activeTab === 'CATEGORIES' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-1">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assigned Warriors</span>
                                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black uppercase">{players.filter(p => p.category === item.name).length}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
                                                {players.filter(p => p.category === item.name).map(p => (
                                                    <div key={p.id} className="flex items-center gap-2 bg-gray-50 pl-1 pr-2 py-1 rounded-full border border-gray-100">
                                                        <div className="w-5 h-5 rounded-full bg-gray-200 overflow-hidden border border-white">
                                                            {p.photoUrl ? <img src={p.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User className="w-3 h-3 text-gray-400 m-auto" />}
                                                        </div>
                                                        <span className="text-[9px] font-bold text-gray-600 truncate max-w-[80px]">{p.name}</span>
                                                        <button onClick={async () => {
                                                            setConfirmAction({
                                                                title: "Remove Player",
                                                                message: `Remove ${p.name} from ${item.name}?`,
                                                                onConfirm: async () => {
                                                                    await db.collection('auctions').doc(id!).collection('players').doc(p.id.toString()).update({ category: 'Standard' });
                                                                    setConfirmAction(null);
                                                                }
                                                            });
                                                        }} className="text-gray-300 hover:text-red-500 transition-colors">
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {players.filter(p => p.category === item.name).length === 0 && (
                                                    <p className="text-[9px] font-bold text-gray-300 uppercase italic py-2">No warriors assigned</p>
                                                )}
                                            </div>
                                            <div className="pt-4 border-t border-gray-50">
                                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">+ Assign Warrior</label>
                                                <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto p-1 bg-gray-50 rounded-lg border border-gray-100 custom-scrollbar">
                                                    {players.filter(p => p.category !== item.name).map(p => (
                                                        <button
                                                            key={p.id}
                                                            onClick={async () => {
                                                                await db.collection('auctions').doc(id!).collection('players').doc(p.id.toString()).update({ category: item.name });
                                                            }}
                                                            className="text-[8px] font-black uppercase py-1.5 px-2 bg-white border border-gray-100 rounded-md hover:border-blue-400 hover:text-blue-600 transition-all text-left truncate"
                                                        >
                                                            {p.name}
                                                        </button>
                                                    ))}
                                                    {players.filter(p => p.category !== item.name).length === 0 && (
                                                        <p className="col-span-2 text-[8px] font-bold text-gray-300 uppercase italic text-center py-2">All warriors assigned</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {activeTab === 'CAPTAIN_CODES' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Captain Code Management ({captainCodes.length})</h2>
                            <button onClick={() => { setEditCode({ code: '', assignedTo: '', teamName: '', usageLimit: 1, isActive: true }); setShowCodeModal(true); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
                                <Plus className="w-4 h-4"/> Create Code
                            </button>
                        </div>
                        <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Code</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Team Codes</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Assigned To</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Team Name</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Usage</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Team Usage</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Status</th>
                                            <th className="px-6 py-4 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {captainCodes.map(code => (
                                            <tr key={code.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <span className="font-mono font-black text-blue-600 text-sm">{code.code}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                                                        {code.teamCodes && code.teamCodes.length > 0 ? (
                                                            code.teamCodes.slice(0, 3).map((tc, i) => (
                                                                <span key={i} className={`px-2 py-0.5 rounded text-[8px] font-mono font-black border ${tc.isUsed ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                                    {tc.code}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-gray-400 text-[10px]">-</span>
                                                        )}
                                                        {code.teamCodes && code.teamCodes.length > 3 && (
                                                            <span className="text-[8px] font-black text-gray-400">+{code.teamCodes.length - 3} more</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-black text-gray-800 text-sm uppercase">{code.assignedTo}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{code.teamName || '-'}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-black text-gray-700 uppercase">{code.currentUsage} / {code.usageLimit}</span>
                                                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full transition-all ${code.currentUsage >= code.usageLimit ? 'bg-red-500' : 'bg-green-500'}`} 
                                                                style={{ width: `${Math.min(100, (code.currentUsage / code.usageLimit) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-black text-gray-700 uppercase">{code.teamUsedCount || 0} / {code.teamMaxPlayers || 11}</span>
                                                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full transition-all ${(code.teamUsedCount || 0) >= (code.teamMaxPlayers || 11) ? 'bg-red-500' : 'bg-amber-500'}`} 
                                                                style={{ width: `${Math.min(100, ((code.teamUsedCount || 0) / (code.teamMaxPlayers || 11)) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                                        !code.isActive ? 'bg-gray-100 text-gray-400 border-gray-200' :
                                                        code.currentUsage >= code.usageLimit ? 'bg-red-50 text-red-500 border-red-100' :
                                                        'bg-green-50 text-green-600 border-green-100'
                                                    }`}>
                                                        {!code.isActive ? 'INACTIVE' : code.currentUsage >= code.usageLimit ? 'USED' : 'ACTIVE'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleResetCodeUsage(code.id!)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg" title="Reset Usage"><RefreshCw className="w-4 h-4"/></button>
                                                        <button onClick={() => { setEditCode(code); setShowCodeModal(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                                                        <button onClick={() => handleDeleteCode(code.id!)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {captainCodes.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center">
                                                    <div className="max-w-xs mx-auto">
                                                        <Key className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                                        <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No Captain Codes Established</p>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Create custom codes to authorize team captains</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
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
                                                                setConfirmAction({
                                                                    title: "Remove from Waitlist",
                                                                    message: "Remove from waitlist?",
                                                                    onConfirm: async () => {
                                                                        await db.collection('auctions').doc(id).collection('waitlist').doc(player.id).delete();
                                                                        setConfirmAction(null);
                                                                    }
                                                                });
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
            {showCodeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-white/20 animate-scale-in">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-600/20">
                                    <Key className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">{editCode.id ? 'Edit Code' : 'New Captain Code'}</h3>
                            </div>
                            <button onClick={() => setShowCodeModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSaveCode} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Captain Code</label>
                                        <input required type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-black text-blue-600 focus:bg-white focus:border-blue-400 outline-none transition-all uppercase font-mono" value={editCode.code} onChange={e => setEditCode({...editCode, code: e.target.value.toUpperCase()})} placeholder="e.g. CAPTAIN01" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Team Player Codes</label>
                                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-gray-50 rounded-xl border border-gray-100">
                                            {editCode.teamCodes?.map((tc, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <input 
                                                        type="text" 
                                                        className={`flex-1 bg-white border rounded-lg px-3 py-1.5 text-xs font-mono font-black uppercase ${tc.isUsed ? 'text-gray-400 border-gray-100' : 'text-amber-600 border-gray-200'}`}
                                                        value={tc.code}
                                                        disabled={tc.isUsed}
                                                        onChange={e => {
                                                            const newCodes = [...(editCode.teamCodes || [])];
                                                            newCodes[idx].code = e.target.value.toUpperCase();
                                                            setEditCode({...editCode, teamCodes: newCodes});
                                                        }}
                                                        placeholder="CODE"
                                                    />
                                                    {!tc.isUsed && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                const newCodes = editCode.teamCodes?.filter((_, i) => i !== idx);
                                                                setEditCode({...editCode, teamCodes: newCodes});
                                                            }}
                                                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button 
                                                type="button"
                                                onClick={() => setEditCode({...editCode, teamCodes: [...(editCode.teamCodes || []), { code: '', isUsed: false }]})}
                                                className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-[10px] font-black text-gray-400 uppercase hover:border-amber-400 hover:text-amber-500 transition-all"
                                            >
                                                + Add Code
                                            </button>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const prefix = editCode.teamName?.substring(0, 3).toUpperCase() || 'T1';
                                                const count = editCode.teamMaxPlayers || 11;
                                                const generated = Array.from({ length: count }, (_, i) => ({
                                                    code: `${prefix}P${(i + 1).toString().padStart(2, '0')}`,
                                                    isUsed: false
                                                }));
                                                setEditCode({...editCode, teamCodes: generated});
                                            }}
                                            className="mt-2 text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                                        >
                                            <RefreshCw className="w-3 h-3" /> Auto-Generate {editCode.teamMaxPlayers || 11} Codes
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Assigned Captain Name</label>
                                    <input required type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editCode.assignedTo} onChange={e => setEditCode({...editCode, assignedTo: e.target.value})} placeholder="Enter captain's name" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Team Name (Optional)</label>
                                    <input type="text" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editCode.teamName} onChange={e => setEditCode({...editCode, teamName: e.target.value})} placeholder="Enter team name" />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Usage Limit</label>
                                        <input required type="number" min="1" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editCode.usageLimit} onChange={e => setEditCode({...editCode, usageLimit: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Team Max</label>
                                        <input required type="number" min="1" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editCode.teamMaxPlayers} onChange={e => setEditCode({...editCode, teamMaxPlayers: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Status</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button 
                                                type="button" 
                                                onClick={() => setEditCode({...editCode, isActive: true})} 
                                                className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border-2 ${editCode.isActive ? 'bg-green-50 border-green-500 text-green-600 shadow-lg shadow-green-500/10' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'}`}
                                            >
                                                Active
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => setEditCode({...editCode, isActive: false})} 
                                                className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border-2 ${!editCode.isActive ? 'bg-red-50 border-red-500 text-red-600 shadow-lg shadow-red-500/10' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'}`}
                                            >
                                                Inactive
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs tracking-widest active:scale-95">Create Code</button>
                        </form>
                    </div>
                </div>
            )}
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
                                            <img src={previewImage} className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
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

                            {modalType === 'CATEGORY' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Base Price (₹)</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2.5 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.basePrice || 0} onChange={e => setEditItem({...editItem, basePrice: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Bid Increment (₹)</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2.5 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.bidIncrement || 0} onChange={e => setEditItem({...editItem, bidIncrement: Number(e.target.value)})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Min Per Team</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2.5 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.minPerTeam || 0} onChange={e => setEditItem({...editItem, minPerTeam: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Max Per Team</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2.5 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.maxPerTeam || 0} onChange={e => setEditItem({...editItem, maxPerTeam: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Required Players</label>
                                            <input type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2.5 font-bold text-gray-700 focus:bg-white focus:border-blue-400 outline-none transition-all" value={editItem?.requiredPlayers || 0} onChange={e => setEditItem({...editItem, requiredPlayers: Number(e.target.value)})} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Bid Increment Slabs</label>
                                        <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar p-2 bg-gray-50 rounded-xl border border-gray-100">
                                            {(editItem?.slabs || []).map((slab: any, idx: number) => (
                                                <div key={idx} className="flex gap-2 items-center">
                                                    <input type="number" placeholder="From" className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-bold" value={slab.from} onChange={e => {
                                                        const newSlabs = [...(editItem.slabs || [])];
                                                        newSlabs[idx].from = Number(e.target.value);
                                                        setEditItem({...editItem, slabs: newSlabs});
                                                    }} />
                                                    <input type="number" placeholder="Incr" className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-bold" value={slab.increment} onChange={e => {
                                                        const newSlabs = [...(editItem.slabs || [])];
                                                        newSlabs[idx].increment = Number(e.target.value);
                                                        setEditItem({...editItem, slabs: newSlabs});
                                                    }} />
                                                    <button type="button" onClick={() => {
                                                        const newSlabs = (editItem.slabs || []).filter((_: any, i: number) => i !== idx);
                                                        setEditItem({...editItem, slabs: newSlabs});
                                                    }} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3"/></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => {
                                                const newSlabs = [...(editItem.slabs || []), { from: 0, increment: 0 }];
                                                setEditItem({...editItem, slabs: newSlabs});
                                            }} className="w-full py-1 border border-dashed border-gray-300 rounded-lg text-[9px] font-black text-gray-400 uppercase hover:border-blue-400 hover:text-blue-500 transition-all">+ Add Slab</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {modalType === 'PLAYER' && (
                                <div className="space-y-4">
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Category</label>
                                            <div className="flex flex-wrap gap-2">
                                                {['Standard', ...categories.map(c => c.name)].map(cat => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => setEditItem({...editItem, category: cat})}
                                                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${editItem?.category === cat || (!editItem?.category && cat === 'Standard') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-blue-200'}`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Role</label>
                                            <div className="flex flex-wrap gap-2">
                                                {roles.map(role => (
                                                    <button
                                                        key={role.id}
                                                        type="button"
                                                        onClick={() => setEditItem({...editItem, role: role.name})}
                                                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${editItem?.role === role.name || (!editItem?.role && role.name === 'All Rounder') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-blue-200'}`}
                                                    >
                                                        {role.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs tracking-widest active:scale-95">Save Code</button>
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
                                    <div className="aspect-square rounded-[2.5rem] overflow-hidden border-4 border-gray-50 shadow-xl cursor-pointer group bg-gray-50 flex items-center justify-center"
                                         onClick={() => setOverlayImage({ url: selectedReg.profilePic, title: selectedReg.fullName, type: 'REGISTRATION', id: selectedReg.id, field: 'profilePic' })}
                                    >
                                        {selectedReg.profilePic ? (
                                            <img src={selectedReg.profilePic} className="w-full h-full object-cover" alt="Profile" referrerPolicy="no-referrer" />
                                        ) : (
                                            <User className="w-20 h-20 text-gray-300" />
                                        )}
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                            <Eye className="w-10 h-10 text-white drop-shadow-lg" />
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setOverlayImage({ url: selectedReg.profilePic, title: selectedReg.fullName, type: 'REGISTRATION', id: selectedReg.id, field: 'profilePic' })}
                                        className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur shadow-lg rounded-xl text-gray-600 hover:text-blue-600 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Eye className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Basic Information</p>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Full Name</label>
                                                <div className="flex items-center gap-3">
                                                    {isEditingReg ? (
                                                        <input 
                                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold"
                                                            value={selectedReg.fullName}
                                                            onChange={e => setSelectedReg({...selectedReg, fullName: e.target.value})}
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <p className="text-sm font-black text-gray-800 uppercase">{selectedReg.fullName}</p>
                                                            {selectedReg.isCaptain && (
                                                                <span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-200 flex items-center gap-1">
                                                                    <ShieldCheck className="w-3 h-3" /> Captain
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
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
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Player Type</label>
                                                    {isEditingReg ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {roles.map(r => (
                                                                <button
                                                                    key={r.id}
                                                                    type="button"
                                                                    onClick={() => setSelectedReg({...selectedReg, playerType: r.name})}
                                                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedReg.playerType === r.name ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-blue-200'}`}
                                                                >
                                                                    {r.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm font-black text-gray-800 uppercase">{selectedReg.playerType}</p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Gender</label>
                                                    {isEditingReg ? (
                                                        <div className="flex gap-2">
                                                            {['Male', 'Female', 'Other'].map(g => (
                                                                <button
                                                                    key={g}
                                                                    type="button"
                                                                    onClick={() => setSelectedReg({...selectedReg, gender: g})}
                                                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedReg.gender === g ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-blue-200'}`}
                                                                >
                                                                    {g}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm font-black text-gray-800 uppercase">{selectedReg.gender}</p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Category</label>
                                                    {isEditingReg ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {['Standard', ...categories.map(c => c.name)].map(cat => (
                                                                <button
                                                                    key={cat}
                                                                    type="button"
                                                                    onClick={() => setSelectedReg({...selectedReg, category: cat})}
                                                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedReg.category === cat || (!selectedReg.category && cat === 'Standard') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-blue-200'}`}
                                                                >
                                                                    {cat}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm font-black text-gray-800 uppercase">{selectedReg.category || 'Standard'}</p>
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
                                        <div 
                                            className="relative group aspect-video rounded-2xl overflow-hidden border-2 border-gray-200 shadow-sm cursor-pointer"
                                            onClick={() => setOverlayImage({ url: selectedReg.paymentScreenshot, title: selectedReg.fullName, type: 'REGISTRATION', id: selectedReg.id, field: 'paymentScreenshot' })}
                                        >
                                            <img src={selectedReg.paymentScreenshot} className="w-full h-full object-cover" alt="Payment" referrerPolicy="no-referrer" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                <Eye className="w-8 h-8 text-white" />
                                            </div>
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
                                        {(regConfig.customFields || []).length === 0 && (
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
            {/* Image Overlay Popup */}
            {overlayImage && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-4 md:p-12 animate-fade-in">
                    {/* Controls Header */}
                    <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
                        <div className="flex flex-col">
                            <h3 className="text-white font-black uppercase tracking-widest text-sm">{overlayImage.title}</h3>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Full Screen Preview</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = overlayImage.url;
                                    link.download = `${overlayImage.title.replace(/\s+/g, '_')}_${overlayImage.field}.jpg`;
                                    link.click();
                                }}
                                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                            >
                                <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download</span>
                            </button>
                            <button 
                                onClick={() => overlayInputRef.current?.click()}
                                className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20"
                            >
                                <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">Update</span>
                            </button>
                            <button 
                                onClick={() => setOverlayImage(null)}
                                className="p-3 bg-white/10 hover:bg-red-600 text-white rounded-xl transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Image Container */}
                    <div className="w-full h-full flex items-center justify-center overflow-hidden">
                        {overlayImage.url ? (
                            <img 
                                src={overlayImage.url} 
                                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                                alt="Preview"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-white/20">
                                <UserX className="w-24 h-24" />
                                <p className="font-black uppercase tracking-widest">No Image Available</p>
                            </div>
                        )}
                    </div>

                    <input 
                        type="file" 
                        ref={overlayInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => handleFileUpload(e, 'OVERLAY')}
                    />
                </div>
            )}
            {/* PDF Generation Overlay */}
            {isGeneratingPDF && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] p-12 max-w-md w-full text-center space-y-8 shadow-2xl">
                        <div className="relative inline-block">
                            <div className="w-32 h-32 rounded-full border-4 border-gray-100 flex items-center justify-center">
                                <FileDown className="w-12 h-12 text-blue-600 animate-bounce" />
                            </div>
                            <svg className="absolute inset-0 w-32 h-32 -rotate-90">
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="60"
                                    fill="none"
                                    stroke="#3b82f6"
                                    strokeWidth="8"
                                    strokeDasharray={2 * Math.PI * 60}
                                    strokeDashoffset={2 * Math.PI * 60 * (1 - pdfProgress / 100)}
                                    className="transition-all duration-300"
                                />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Forging PDF Registry</h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Processing {registrations.length} Warriors...</p>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">
                                <span>Progress</span>
                                <span>{pdfProgress}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-blue-600 transition-all duration-300"
                                    style={{ width: `${pdfProgress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* NOTIFICATION BANNER */}
            {notification && (
                <div className={`fixed top-4 right-4 z-[300] p-4 rounded-lg shadow-2xl border flex items-center gap-3 max-w-md animate-in fade-in slide-in-from-top-4 duration-300 ${notification.type === 'error' ? 'bg-red-900 border-red-500 text-white' : 'bg-green-900 border-green-500 text-white'}`}>
                    {notification.type === 'error' ? <XCircle className="w-5 h-5 text-red-400" /> : <CheckCircle className="w-5 h-5 text-green-400" />}
                    <span className="text-sm font-bold">{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="ml-auto hover:text-gray-300"><X className="w-4 h-4"/></button>
                </div>
            )}

            {/* CUSTOM CONFIRMATION MODAL */}
            {confirmAction && (
                <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100">
                        <div className="flex items-center gap-4 mb-6 text-amber-500">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-black uppercase tracking-tighter text-gray-800">{confirmAction.title}</h3>
                        </div>
                        <p className="text-gray-500 text-sm font-bold mb-8 leading-relaxed">{confirmAction.message}</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmAction(null)}
                                className="flex-1 py-4 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-400 text-xs font-black uppercase tracking-widest transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmAction.onConfirm}
                                className="flex-1 py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-200"
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

export default AuctionManage;