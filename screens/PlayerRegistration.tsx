import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { AuctionSetup, RegistrationConfig, FormField, PlayerRole } from '../types';
import { Upload, Calendar, CheckCircle, AlertTriangle, ArrowUpCircle, FileText, Home, ArrowLeft, Loader2, CreditCard, QrCode, ShieldCheck, AlignLeft, Sword, Shield, Trophy as TrophyIcon, Zap, Megaphone, Users, XCircle, Phone, MapPin, Clock, Trophy, Share2, ChevronRight, ChevronLeft, User, Info, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import heic2any from 'heic2any';

const compressImage = async (file: File): Promise<string> => {
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
                let width = img.width;
                let height = img.height;
                
                // Target smaller dimensions to stay under 1MB
                const MAX_DIM = 800;
                if (width > height) {
                    if (width > MAX_DIM) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    }
                } else {
                    if (height > MAX_DIM) {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                // Start with 0.7 quality and reduce if needed
                let quality = 0.7;
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

const WarriorInput = ({ label, value, onChange, type = "text", required = false, placeholder = "", options = [] }: any) => (
    <div className="relative group">
        {type === 'textarea' ? (
            <textarea 
                required={required}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows={4}
                className="w-full bg-black/40 border-2 border-amber-900/30 rounded-2xl px-6 py-4 pt-10 font-bold text-amber-100 outline-none transition-all focus:border-amber-500 focus:shadow-[0_0_15px_rgba(251,191,36,0.2)] peer min-h-[120px] resize-none"
            />
        ) : type === 'select' ? (
            <div className="pt-10 pb-2">
                <div className="flex flex-wrap gap-2">
                    {options.map((opt: string) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => onChange({ target: { value: opt } })}
                            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                                value === opt 
                                ? 'bg-amber-600 border-amber-600 text-black shadow-lg shadow-amber-600/20' 
                                : 'bg-black/40 border-amber-900/30 text-amber-500/50 hover:border-amber-500/50'
                            }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        ) : (
            <input 
                type={type}
                required={required}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full bg-black/40 border-2 border-amber-900/30 rounded-2xl px-6 py-4 pt-10 font-bold text-amber-100 outline-none transition-all focus:border-amber-500 focus:shadow-[0_0_15px_rgba(251,191,36,0.2)] peer"
            />
        )}
        <label className="absolute left-6 top-2 text-[10px] font-black uppercase tracking-widest text-amber-500/50 transition-all peer-focus:text-amber-500 pointer-events-none select-none max-w-[calc(100%-3rem)] truncate">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
    </div>
);

const WarriorCard = ({ children, title, icon: Icon, className = "" }: any) => (
    <div className={`bg-black/60 border-2 border-amber-900/20 rounded-[2.5rem] p-8 relative overflow-hidden group ${className}`}>
        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Icon className="w-24 h-24" />
        </div>
        <h3 className="text-[11px] font-black text-amber-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
            <Icon className="w-4 h-4" /> {title}
        </h3>
        <div className="relative z-10 space-y-6">
            {children}
        </div>
    </div>
);

const PlayerRegistration: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [auction, setAuction] = useState<AuctionSetup | null>(null);
    const [config, setConfig] = useState<RegistrationConfig | null>(null);
    const [roles, setRoles] = useState<PlayerRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isRazorpayLoaded, setIsRazorpayLoaded] = useState(false);
    const [showBattleEntrance, setShowBattleEntrance] = useState(false);
    const [battleStarted, setBattleStarted] = useState(false);
    const [showWelcomePopup, setShowWelcomePopup] = useState(false);
    const [welcomeTimer, setWelcomeTimer] = useState(0);
    const [showPoster, setShowPoster] = useState(false);
    const [agreedToRules, setAgreedToRules] = useState(false);
    const [approvedCount, setApprovedCount] = useState(0);
    const [isClosed, setIsClosed] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [playerID, setPlayerID] = useState('');
    const [waitlistSuccess, setWaitlistSuccess] = useState(false);

    useEffect(() => {
        if (!id) return;
        const unsubscribe = db.collection('auctions').doc(id).collection('registrations')
            .where('status', '==', 'APPROVED')
            .onSnapshot(snapshot => {
                setApprovedCount(snapshot.size);
            });
        return () => unsubscribe();
    }, [id]);

    const totalSlots = config?.maxRegistrations || 36;
    const isFull = approvedCount >= totalSlots;

    // Captain Registration State
    const [isCaptain, setIsCaptain] = useState<boolean | null>(null);
    const [hasTeamCode, setHasTeamCode] = useState<boolean | null>(null);
    const [captainCode, setCaptainCode] = useState('');
    const [teamCode, setTeamCode] = useState('');
    const [codeStatus, setCodeStatus] = useState<{ type: 'success' | 'error' | 'loading' | null, message: string }>({ type: null, message: '' });
    const [teamCodeStatus, setTeamCodeStatus] = useState<{ type: 'success' | 'error' | 'loading' | null, message: string }>({ type: null, message: '' });
    const [validatedCode, setValidatedCode] = useState<any>(null);
    const [validatedTeamCode, setValidatedTeamCode] = useState<any>(null);

    const [formData, setFormData] = useState<any>({
        fullName: '', playerType: '', gender: '', mobile: '', dob: '', battleOath: false
    });
    const [profilePic, setProfilePic] = useState<string>('');
    const [paymentScreenshot, setPaymentScreenshot] = useState<string>('');
    const profileInputRef = useRef<HTMLInputElement>(null);
    const paymentInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => setIsRazorpayLoaded(true);
        document.body.appendChild(script);
        return () => { if (document.body.contains(script)) document.body.removeChild(script); };
    }, []);

    useEffect(() => {
        if (config?.welcomePopup?.isEnabled && !loading && !error) {
            setShowWelcomePopup(true);
            setWelcomeTimer(config.welcomePopup.autoCloseTimer);
        }
    }, [config, loading, error]);

    useEffect(() => {
        let timer: any;
        if (showWelcomePopup && welcomeTimer > 0) {
            timer = setTimeout(() => {
                setWelcomeTimer(prev => prev - 1);
            }, 1000);
        } else if (showWelcomePopup && welcomeTimer === 0) {
            setShowWelcomePopup(false);
        }
        return () => clearTimeout(timer);
    }, [showWelcomePopup, welcomeTimer]);

    useEffect(() => {
        const fetchAuction = async () => {
            if (!id) return;
            try {
                const docSnap = await db.collection('auctions').doc(id).get();
                if (docSnap.exists) {
                    const data = docSnap.data() as AuctionSetup;
                    setAuction(data);
                    const regConfig = data.registrationConfig;
                    if (regConfig?.isEnabled) {
                        setConfig(regConfig);
                        if (regConfig.theme === 'ADVAYA') {
                            setShowBattleEntrance(true);
                            if (regConfig.hideLandingPage) {
                                setBattleStarted(true);
                            }
                            if (regConfig.bannerUrl) {
                                setShowPoster(true);
                            }
                        }
                        // Initialize dynamic fields
                        const dynamicDefaults: any = {};
                        (regConfig.customFields || []).forEach(f => {
                            dynamicDefaults[f.id] = '';
                        });
                        setFormData((prev: any) => ({ ...prev, ...dynamicDefaults }));

                        // Fetch approved count
                        const regSnap = await db.collection('auctions').doc(id).collection('registrations')
                            .where('status', '==', 'APPROVED')
                            .get();
                        setApprovedCount(regSnap.size);

                        if (regConfig.maxRegistrations > 0 && regSnap.size >= regConfig.maxRegistrations) {
                            setIsClosed(true);
                        }
                    }
                    else {
                        setIsClosed(true);
                        if (regConfig) setConfig(regConfig);
                    }
                } else setError("Auction not found.");
            } catch (e) { setError("Failed to load form."); }
            finally { setLoading(false); }
        };
        fetchAuction();

        // Real-time roles fetching
        const unsubRoles = db.collection('auctions').doc(id).collection('roles').onSnapshot(snap => {
            setRoles(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerRole)));
        }, err => {
            console.error("Error fetching roles:", err);
        });

        return () => unsubRoles();
    }, [id]);

    const validateCaptainCode = async (code: string) => {
        if (!code || !id) return;
        setCodeStatus({ type: 'loading', message: 'Verifying Code...' });
        try {
            const snap = await db.collection('auctions').doc(id).collection('captainCodes')
                .where('code', '==', code.toUpperCase())
                .get();
            
            if (snap.empty) {
                setCodeStatus({ type: 'error', message: 'Invalid Captain Code' });
                setValidatedCode(null);
                return;
            }

            const codeData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
            
            if (!codeData.isActive) {
                setCodeStatus({ type: 'error', message: 'This code is inactive' });
                setValidatedCode(null);
            } else if (codeData.currentUsage >= codeData.usageLimit) {
                setCodeStatus({ type: 'error', message: 'This code has already been used' });
                setValidatedCode(null);
            } else {
                setCodeStatus({ type: 'success', message: 'Captain verified successfully!' });
                setValidatedCode(codeData);
                // Auto-fill name if assigned
                if (codeData.assignedTo) {
                    setFormData(prev => ({ ...prev, fullName: codeData.assignedTo }));
                }
            }
        } catch (err) {
            setCodeStatus({ type: 'error', message: 'Verification failed' });
        }
    };

    const validateTeamCode = async (code: string) => {
        if (!code || !id) return;
        setTeamCodeStatus({ type: 'loading', message: 'Verifying Team Code...' });
        try {
            // Since we have unique codes per player, we need to find the captain code that contains this specific player code
            const snap = await db.collection('auctions').doc(id).collection('captainCodes').get();
            
            let foundCodeData: any = null;
            let specificPlayerCode: any = null;

            snap.docs.forEach(doc => {
                const data = doc.data() as any;
                const playerCode = data.teamCodes?.find((tc: any) => tc.code === code.toUpperCase());
                if (playerCode) {
                    foundCodeData = { id: doc.id, ...data };
                    specificPlayerCode = playerCode;
                }
            });
            
            if (!foundCodeData) {
                setTeamCodeStatus({ type: 'error', message: 'Invalid Team Code' });
                setValidatedTeamCode(null);
                return;
            }

            if (!foundCodeData.isActive) {
                setTeamCodeStatus({ type: 'error', message: 'This team code is no longer active' });
                setValidatedTeamCode(null);
            } else if (specificPlayerCode.isUsed) {
                setTeamCodeStatus({ type: 'error', message: 'This specific player code has already been used' });
                setValidatedTeamCode(null);
            } else {
                setTeamCodeStatus({ type: 'success', message: 'Team code applied successfully!' });
                // We store the specific code as well so we know which one to mark as used
                setValidatedTeamCode({ ...foundCodeData, usedSpecificCode: code.toUpperCase() });
                // Auto-fill team name if applicable
                if (foundCodeData.teamName) {
                    setFormData(prev => ({ ...prev, teamName: foundCodeData.teamName }));
                }
            }
        } catch (err) {
            setTeamCodeStatus({ type: 'error', message: 'Verification failed' });
        }
    };

    const handleFirestoreError = (error: any, operation: string, path: string) => {
        const errInfo = {
            error: error.message || String(error),
            operation,
            path,
            authInfo: {
                userId: auth.currentUser?.uid,
                email: auth.currentUser?.email,
                emailVerified: auth.currentUser?.emailVerified,
                isAnonymous: auth.currentUser?.isAnonymous
            }
        };
        console.error(`Firestore Error [${operation}]:`, JSON.stringify(errInfo));
        alert(`Error: ${error.message || "Missing or insufficient permissions."}`);
    };

    const submitToFirebase = async (razorpayId?: string) => {
        if (!id) return;
        setSubmitting(true);
        try {
            const generatedID = `WAR-${Math.floor(1000 + Math.random() * 9000)}`;
            setPlayerID(generatedID);
            const submissionData = {
                ...formData, profilePic,
                playerID: generatedID,
                isCaptain: !!isCaptain,
                captainCode: isCaptain ? captainCode.toUpperCase() : '',
                teamCode: hasTeamCode ? teamCode.toUpperCase() : '',
                registeredViaCode: (isCaptain && !!validatedCode) || (hasTeamCode && !!validatedTeamCode),
                paymentScreenshot: config?.paymentMethod === 'MANUAL' ? paymentScreenshot : '',
                razorpayPaymentId: razorpayId || '',
                submittedAt: Date.now(), status: 'PENDING'
            };
            
            const regRef = db.collection('auctions').doc(id).collection('registrations');
            await regRef.add(submissionData);
            
            // 5. Update Code Usage if applicable
            if (isCaptain && validatedCode) {
                try {
                    console.log("Attempting to update captain code usage for:", validatedCode.id);
                    const codeRef = db.collection('auctions').doc(id).collection('captainCodes').doc(validatedCode.id);
                    
                    await db.runTransaction(async (transaction) => {
                        const codeDoc = await transaction.get(codeRef);
                        if (!codeDoc.exists) {
                            throw new Error("Captain code document not found during update");
                        }
                        const currentVal = codeDoc.data()?.currentUsage || 0;
                        transaction.update(codeRef, { 
                            currentUsage: currentVal + 1 
                        });
                    });
                    console.log("Captain code usage updated successfully via transaction");
                } catch (codeErr) {
                    console.error("Error updating captain code usage:", codeErr);
                }
            }

            if (hasTeamCode && validatedTeamCode) {
                try {
                    console.log("Attempting to update team code usage for:", validatedTeamCode.id);
                    const codeRef = db.collection('auctions').doc(id).collection('captainCodes').doc(validatedTeamCode.id);
                    
                    await db.runTransaction(async (transaction) => {
                        const codeDoc = await transaction.get(codeRef);
                        if (!codeDoc.exists) {
                            throw new Error("Team code document not found during update");
                        }
                        
                        const data = codeDoc.data();
                        const currentTeamCodes = data?.teamCodes || [];
                        const updatedTeamCodes = currentTeamCodes.map((tc: any) => 
                            tc.code === teamCode ? { ...tc, isUsed: true, usedBy: submissionData.fullName } : tc
                        );
                        const currentTeamUsed = data?.teamUsedCount || 0;
                        
                        transaction.update(codeRef, {
                            teamUsedCount: currentTeamUsed + 1,
                            teamCodes: updatedTeamCodes
                        });
                    });
                    console.log("Team code usage updated successfully via transaction");
                } catch (teamErr) {
                    console.error("Error updating team code usage:", teamErr);
                }
            }

            setSuccess(true);
        } catch (e: any) { 
            handleFirestoreError(e, 'CREATE_REGISTRATION', `auctions/${id}/registrations`);
        }
        finally { setSubmitting(false); }
    };

    const handleRazorpayModal = () => {
        if (!isRazorpayLoaded) { alert("Payment system not ready."); setSubmitting(false); return; }
        const options = {
            key: config?.razorpayKey || "rzp_test_YOUR_KEY", 
            amount: (config?.fee || 0) * 100, 
            currency: "INR",
            name: auction?.title || "Auction Registration",
            handler: (res: any) => submitToFirebase(res.razorpay_payment_id),
            prefill: { name: formData.fullName, contact: formData.mobile },
            theme: { color: "#16a34a" },
            modal: { ondismiss: () => setSubmitting(false) }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Check Slot Availability
        if (isFull && !isCaptain && !hasTeamCode) {
            return alert("Registrations are currently full. Only Captains or Team Members with codes can register.");
        }

        // 2. Code Validation
        if (isCaptain && (!validatedCode || validatedCode.code !== captainCode.toUpperCase())) {
            return alert("Please verify your captain code again.");
        }

        if (hasTeamCode && (!validatedTeamCode || validatedTeamCode.usedSpecificCode !== teamCode.toUpperCase())) {
            return alert("Please verify your team code again.");
        }
        if (hasTeamCode && !validatedTeamCode) {
            return alert("Please verify a valid team code first.");
        }

        // 3. Comprehensive Field Validation
        const missingFields: string[] = [];
        
        // Basic Fields (Config Driven)
        const basicFields = config?.basicFields || {
            name: { show: true, required: true },
            dob: { show: true, required: true },
            photo: { show: true, required: true },
            mobile: { show: true, required: true },
            gender: { show: true, required: true },
            role: { show: true, required: true }
        };

        if (basicFields.name?.required !== false && !formData.fullName?.trim()) missingFields.push("Full Name");
        if (basicFields.mobile?.required !== false && !formData.mobile?.trim()) missingFields.push("Mobile Number");
        if (basicFields.dob?.required !== false && !formData.dob) missingFields.push("Date of Birth");
        if (basicFields.gender?.required !== false && !formData.gender) missingFields.push("Gender");
        if (basicFields.role?.required !== false && !formData.playerType) missingFields.push("Player Role");
        if (basicFields.photo?.required !== false && !profilePic) missingFields.push("Player Photo");

        // Custom Fields
        (config?.customFields || []).forEach(field => {
            if (field.required && !formData[field.id]) {
                missingFields.push(field.label);
            }
        });

        // Payment
        if (config?.fee > 0) {
            if (config.paymentMethod === 'MANUAL' && !paymentScreenshot) {
                missingFields.push("Payment Proof/Screenshot");
            }
        }

        // Battle Oath
        if (!formData.battleOath) {
            missingFields.push("Battle Oath Acceptance");
        }

        if (missingFields.length > 0) {
            return alert(`The following required fields are missing:\n\n• ${missingFields.join('\n• ')}`);
        }

        setSubmitting(true);
        
        // Handle Razorpay if enabled
        if (config?.fee > 0 && config.paymentMethod === 'RAZORPAY') {
            handleRazorpayModal();
            return;
        }

        await submitToFirebase();
    };

    const isAdvaya = config?.theme === 'ADVAYA';

    const handleWaitlistSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await db.collection('auctions').doc(id!).collection('waitlist').add({
                fullName: formData.fullName,
                mobile: formData.mobile,
                createdAt: new Date().toISOString()
            });
            setWaitlistSuccess(true);
        } catch (err) {
            console.error(err);
            alert("Failed to join waitlist. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin w-10 h-10 text-amber-500"/></div>;
    if (error) return <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900"><div className="bg-white p-8 rounded-[2rem] shadow-2xl text-center max-w-md border-4 border-red-500/20"><h2 className="text-2xl font-black mb-2 text-red-600 uppercase tracking-tighter">Access Denied</h2><p className="font-bold text-gray-500 uppercase text-xs tracking-widest">{error}</p></div></div>;

    if (isClosed) {
        return (
            <div className={`min-h-screen flex items-center justify-center p-4 ${isAdvaya ? 'bg-[#0a0a0a]' : 'bg-slate-900'}`}>
                <div className={`${isAdvaya ? 'bg-[#151515] border-amber-500/30 text-amber-50' : 'bg-white text-gray-800'} p-10 rounded-[2.5rem] shadow-2xl text-center max-w-md border-4 animate-fade-in`}>
                    <div className={`w-20 h-20 ${isAdvaya ? 'bg-amber-500/10' : 'bg-orange-50'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                        <XCircle className={`w-10 h-10 ${isAdvaya ? 'text-amber-500' : 'text-orange-500'}`} />
                    </div>
                    <h2 className="text-2xl font-black mb-4 uppercase tracking-tighter">Registration Closed</h2>
                    <p className="font-bold text-gray-500 uppercase text-xs tracking-widest leading-relaxed mb-8">
                        {config?.closedMessage || "The registration limit has been reached or the form has been closed by the organizer."}
                    </p>

                    <div className="mb-8 p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl text-left">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4">Do you have a code provided by captain?</p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => { setIsClosed(false); setHasTeamCode(true); }}
                                className="flex-1 py-3 bg-amber-500 text-black font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-amber-400 transition-all"
                            >
                                Yes, I have code
                            </button>
                            <button 
                                onClick={() => { setIsClosed(false); setIsCaptain(true); }}
                                className="flex-1 py-3 border-2 border-amber-500/30 text-amber-500 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-amber-500/10 transition-all"
                            >
                                I am Captain
                            </button>
                        </div>
                    </div>

                    {config?.enableWaitlist ? (
                        <form onSubmit={handleWaitlistSubmit} className="space-y-4 text-left">
                            <div className="text-center mb-4">
                                <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">Join Waitlist</p>
                                {config?.waitlistMessage && (
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
                                        {config.waitlistMessage}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Full Name</label>
                                <input 
                                    required
                                    className={`w-full px-5 py-4 rounded-2xl text-xs font-bold outline-none border-2 transition-all ${isAdvaya ? 'bg-black border-amber-900/30 text-amber-100 focus:border-amber-500' : 'bg-gray-50 border-gray-100 focus:border-blue-500'}`}
                                    value={formData.fullName}
                                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                                    placeholder="Enter your name"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Mobile Number</label>
                                <input 
                                    required
                                    type="tel"
                                    className={`w-full px-5 py-4 rounded-2xl text-xs font-bold outline-none border-2 transition-all ${isAdvaya ? 'bg-black border-amber-900/30 text-amber-100 focus:border-amber-500' : 'bg-gray-50 border-gray-100 focus:border-blue-500'}`}
                                    value={formData.mobile}
                                    onChange={e => setFormData({...formData, mobile: e.target.value})}
                                    placeholder="Enter mobile number"
                                />
                            </div>
                            <button 
                                disabled={submitting}
                                type="submit"
                                className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 ${isAdvaya ? 'bg-amber-600 hover:bg-amber-500 text-black' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                            >
                                {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <><Users className="w-5 h-5" /> Join Waitlist</>}
                            </button>
                            <button type="button" onClick={() => navigate('/')} className="w-full py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-gray-400 transition-colors">Back to Portal</button>
                        </form>
                    ) : (
                        <button onClick={() => navigate('/')} className={`w-full font-black py-4 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all ${isAdvaya ? 'bg-amber-600 text-black' : 'bg-slate-900 text-white'}`}>Back to Portal</button>
                    )}
                </div>
            </div>
        );
    }

    if (waitlistSuccess) {
        return (
            <div className={`min-h-screen flex items-center justify-center p-4 ${isAdvaya ? 'bg-[#0a0a0a]' : 'bg-slate-900'}`}>
                <div className={`${isAdvaya ? 'bg-[#151515] border-amber-500/30 text-amber-50' : 'bg-white text-gray-800'} p-10 rounded-[2.5rem] shadow-2xl text-center max-w-md border-4 animate-fade-in`}>
                    <div className={`w-20 h-20 ${isAdvaya ? 'bg-amber-500/10' : 'bg-green-50'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                        <CheckCircle className={`w-10 h-10 ${isAdvaya ? 'text-amber-500' : 'text-green-500'}`} />
                    </div>
                    <h2 className="text-2xl font-black mb-4 uppercase tracking-tighter">Waitlist Joined!</h2>
                    <p className="font-bold text-gray-500 uppercase text-xs tracking-widest leading-relaxed mb-8">
                        You've been added to the waitlist. We'll contact you if a slot becomes available.
                    </p>
                    <button onClick={() => navigate('/')} className={`w-full font-black py-5 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all ${isAdvaya ? 'bg-amber-600 text-black' : 'bg-blue-600 text-white'}`}>OK</button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className={`min-h-screen flex items-center justify-center p-4 ${isAdvaya ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`max-w-md w-full rounded-[3rem] p-10 text-center relative overflow-hidden border-2 shadow-2xl ${isAdvaya ? 'bg-[#151515] border-amber-500/30 text-amber-50' : 'bg-white border-blue-100 text-gray-900'}`}
                >
                    {isAdvaya && <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.15)_0%,transparent_70%)] pointer-events-none" />}
                    
                    <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border-2 ${isAdvaya ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-50 border-green-100'}`}>
                        <CheckCircle className={`w-12 h-12 ${isAdvaya ? 'text-amber-500' : 'text-green-500'}`} />
                    </div>
                    
                    <h2 className="text-3xl font-black uppercase tracking-tight mb-2">
                        {isAdvaya ? 'Battle Enrolled!' : 'Registration Successful!'}
                    </h2>
                    <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-8 ${isAdvaya ? 'text-amber-500/50' : 'text-gray-400'}`}>
                        {isAdvaya ? 'Warrior Registry Confirmed' : 'Your spot is reserved'}
                    </p>
                    
                    <div className="flex flex-wrap justify-center gap-2 mb-8">
                        {isCaptain && (
                            <div className="px-4 py-2 rounded-xl bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-500/20">
                                <ShieldCheck className="w-4 h-4" /> Captain 🧑‍✈️
                            </div>
                        )}
                        {hasTeamCode && (
                            <div className="px-4 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-600/20">
                                <Users className="w-4 h-4" /> Team Player 🏏
                            </div>
                        )}
                    </div>

                    <div className={`p-8 rounded-[2rem] mb-8 border-2 ${isAdvaya ? 'bg-black/40 border-amber-500/10' : 'bg-gray-50 border-gray-100'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                            {isAdvaya ? 'Registry Status' : 'Registration Status'}
                        </p>
                        <p className={`text-2xl font-black uppercase tracking-tight leading-tight ${isAdvaya ? 'text-amber-500' : 'text-blue-600'}`}>
                            {config?.customSuccessMessage || (isAdvaya ? 'BATTLE ENROLLED' : 'SUCCESSFUL')}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {isAdvaya ? 'Your Warrior ID' : 'Your Player ID'}: <span className={isAdvaya ? 'text-amber-200' : 'text-gray-900'}>{playerID || 'WAR-7782'}</span>
                        </p>
                        
                        {(config?.organizerContacts || []).length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Organizer Contacts</p>
                                {(config?.organizerContacts || []).map((contact, idx) => (
                                    <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${isAdvaya ? 'bg-amber-500/5 border-amber-500/10 text-amber-500/70' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">{contact.name}</span>
                                        </div>
                                        <span className="text-[10px] font-black tracking-widest">{contact.phone}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-4 pt-4">
                            <button 
                                onClick={() => {
                                    const text = `I just registered for ${auction?.title}! My Player ID is ${playerID}. Check it out here: ${window.location.href}`;
                                    if (navigator.share) {
                                        navigator.share({ title: auction?.title, text, url: window.location.href });
                                    } else {
                                        navigator.clipboard.writeText(text);
                                        alert("Registration details copied to clipboard!");
                                    }
                                }}
                                className={`p-4 rounded-2xl transition-all active:scale-90 ${isAdvaya ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}
                            >
                                <Share2 className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => navigate('/')}
                                className={`flex-1 py-5 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 ${isAdvaya ? 'bg-amber-600 hover:bg-amber-500 text-black' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    const steps = [
        { id: 'details', label: 'Tournament Details' },
        { id: 'personal', label: 'Personal Info' },
        { id: 'role', label: 'Role Selection' },
        { id: 'custom', label: 'Attributes' },
        { id: 'payment', label: 'Payment' },
        { id: 'rules', label: 'Rules' }
    ];

    const nextStep = () => {
        if (currentStep < steps.length - 1) setCurrentStep(prev => prev + 1);
    };

    const prevStep = () => {
        if (currentStep > 0) setCurrentStep(prev => prev - 1);
    };

    const WarriorDetailCard = ({ icon: Icon, title, value, description }: any) => (
        <motion.div 
            whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(251,191,36,0.2)" }}
            className="bg-black/60 border-2 border-amber-900/20 rounded-[2rem] p-6 text-center relative overflow-hidden group"
        >
            {/* Neon Border Effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,#f59e0b_360deg)] opacity-60 blur-[8px]"
                />
                <div className="absolute inset-[2px] bg-black/80 rounded-[inherit] z-0" />
            </div>

            <div className="relative z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                    <Icon className="w-6 h-6 text-amber-500" />
                </div>
                <h4 className="text-[10px] font-black text-amber-500/50 uppercase tracking-widest mb-1">{title}</h4>
                <p className="text-lg font-black text-amber-100 uppercase tracking-tight mb-2">{value}</p>
                {description && <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{description}</p>}
            </div>
        </motion.div>
    );

    if (isAdvaya) {
        if (!battleStarted && !config?.hideLandingPage) {
            return (
                <div className="min-h-screen bg-[#0a0a0a] text-amber-50 font-sans overflow-hidden relative particle-bg">
                    {/* Glowing Borders */}
                    <div className="fixed inset-0 border-[12px] border-amber-500/10 pointer-events-none z-50" />
                    <div className="fixed inset-0 border-[1px] border-amber-500/20 pointer-events-none z-50 m-2" />
                    
                    {/* Particle Background Simulation */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {[...Array(30)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ 
                                    opacity: [0, 0.4, 0],
                                    scale: [0, 1.5, 0],
                                    x: [Math.random() * 100 + "%", Math.random() * 100 + "%"],
                                    y: [Math.random() * 100 + "%", Math.random() * 100 + "%"]
                                }}
                                transition={{ 
                                    duration: Math.random() * 8 + 5, 
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                                className="absolute w-1 h-1 bg-amber-400 rounded-full blur-[1px]"
                            />
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        {showPoster ? (
                            <motion.div 
                                key="poster"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6"
                            >
                                <div className="relative z-20 max-w-2xl w-full bg-black border-4 border-amber-500/30 rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(251,191,36,0.2)]">
                                    <div className="w-full overflow-y-auto max-h-[90vh] custom-scrollbar">
                                        <img src={config?.bannerUrl} className="w-full h-auto block" />
                                        <div className="p-8 bg-black/95 border-t border-amber-500/20 text-center">
                                            <button 
                                                onClick={() => setShowPoster(false)}
                                                className="bg-amber-600 hover:bg-amber-500 text-black font-black px-12 py-5 rounded-full text-lg uppercase tracking-widest transition-all shadow-2xl flex items-center gap-4 mx-auto active:scale-95"
                                            >
                                                NEXT
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="hero"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="relative z-10 min-h-screen flex flex-col items-center justify-start text-center p-6 pt-12"
                            >
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.08)_0%,transparent_70%)]" />
                                
                                {/* 1. Logo Placement */}
                                {config?.logoUrl && (
                                    <motion.div 
                                        initial={{ y: -50, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ duration: 1 }}
                                        className="relative mb-4 z-20"
                                    >
                                        <div className="absolute inset-0 bg-amber-500 rounded-full blur-[60px] opacity-20 animate-pulse"></div>
                                        <img 
                                            src={config.logoUrl} 
                                            className="w-32 h-32 md:w-48 md:h-48 mx-auto object-contain drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]" 
                                            referrerPolicy="no-referrer"
                                        />
                                    </motion.div>
                                )}

                                {/* 2. Tagline Below Logo */}
                                <motion.p 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="golden-text font-cinzel font-black text-sm md:text-2xl uppercase tracking-[0.6em] mb-12 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                                >
                                    THE STAGE OF CRICKET DREAMS
                                </motion.p>
                                                      {/* 3. Main Banner Section */}
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.8, duration: 1 }}
                                    className="cinematic-frame border-beam-container max-w-4xl w-full p-1 md:p-2 mb-12 group shadow-[0_0_60px_rgba(251,191,36,0.3)] border-amber-500/30"
                                >
                                    <div className="bg-black/95 rounded-[2.8rem] p-4 md:p-8 relative overflow-hidden">
                                        {/* Stadium Lights Effect */}
                                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.15)_0%,transparent_60%)]" />
                                        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.15)_0%,transparent_60%)]" />
                                        
                                        <div className="relative z-10 space-y-6">
                                            <div className="space-y-2">
                                                <h2 className="text-4xl md:text-8xl font-cinzel font-black golden-text tracking-widest drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
                                                    {auction?.title || "BBL 2026"}
                                                </h2>
                                                {auction?.fullTournamentName && (
                                                    <p className="text-sm md:text-2xl font-cinzel font-bold golden-text tracking-[0.3em] opacity-80">
                                                        {auction.fullTournamentName}
                                                    </p>
                                                )}
                                            </div>
                                            
                                            <div className="flex flex-col items-center pt-4">
                                                <p className="text-xs md:text-xl font-cinzel font-black golden-text uppercase tracking-[0.5em] mb-4 opacity-70">
                                                    GET READY FOR
                                                </p>
                                                <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-8">
                                                    <span className="text-4xl md:text-8xl font-cinzel font-black golden-text tracking-tighter">
                                                        SEASON
                                                    </span>
                                                    <motion.span 
                                                        animate={{ 
                                                            y: [0, -10, 0],
                                                            rotate: [0, 2, -2, 0],
                                                            scale: [1, 1.02, 1]
                                                        }}
                                                        transition={{ 
                                                            duration: 3, 
                                                            repeat: Infinity, 
                                                            ease: "easeInOut" 
                                                        }}
                                                        className="text-8xl md:text-[12rem] font-cinzel font-black golden-text leading-none drop-shadow-[0_10px_50px_rgba(251,191,36,0.9)] shine-effect inline-block"
                                                    >
                                                        {auction?.season || "4"}
                                                    </motion.span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* 4. Welcome Section */}
                                <motion.div
                                    initial={{ y: 30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 1.2 }}
                                    className="space-y-6 mb-12"
                                >
                                    <h1 className="text-6xl md:text-[10rem] font-cinzel font-black golden-text uppercase tracking-tight drop-shadow-[0_10px_30px_rgba(251,191,36,0.5)]">
                                        Welcome
                                    </h1>
                                    
                                    <div className="flex items-center justify-center gap-4 md:gap-8">
                                        <div className="h-[2px] flex-1 max-w-[150px] bg-gradient-to-r from-transparent via-amber-500/50 to-amber-500" />
                                        <p className="text-[10px] md:text-2xl font-cinzel font-black golden-text uppercase tracking-[0.4em] whitespace-nowrap drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                                            JOIN THE BATTLE, CREATE YOUR LEGACY
                                        </p>
                                        <div className="h-[2px] flex-1 max-w-[150px] bg-gradient-to-l from-transparent via-amber-500/50 to-amber-500" />
                                    </div>
                                </motion.div>
                                 {/* Enter Button */}
                                <motion.button
                                    whileHover={{ scale: 1.05, boxShadow: "0 0 100px rgba(251,191,36,1)" }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setBattleStarted(true)}
                                    className="relative group overflow-hidden bg-amber-400 hover:bg-amber-300 text-black font-cinzel font-black px-8 py-4 md:px-20 md:py-6 rounded-full text-lg md:text-2xl uppercase tracking-[0.2em] transition-all shadow-[0_0_60px_rgba(251,191,36,0.8)] flex items-center justify-center gap-4 md:gap-10 mx-auto w-full max-w-[340px] md:max-w-none md:w-auto border-4 border-amber-200/50"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    <Sword className="w-8 h-8 md:w-10 md:h-10" /> 
                                    JOIN THE BATTLE
                                </motion.button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-[#0a0a0a] text-amber-50 font-sans py-12 px-4 relative overflow-x-hidden">
                {/* Background Effects */}
                <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.05)_0%,transparent_50%)] pointer-events-none" />
                <div className="fixed inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.05)_0%,transparent_50%)] pointer-events-none" />
                
                <div className="max-w-4xl mx-auto relative z-10">
                    {/* Header & Progress */}
                    <div className="text-center mb-12">
                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="flex items-center justify-center gap-4 mb-6"
                        >
                            <button 
                                onClick={() => navigate('/')}
                                className="p-3 rounded-2xl bg-white/5 border border-white/10 text-amber-500 hover:bg-white/10 transition-all active:scale-90"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                            <h2 className="text-2xl font-black text-amber-500 uppercase tracking-tighter">{auction?.title}</h2>
                            <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-amber-500/20 to-transparent" />
                            <div className="px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Users className="w-3 h-3" /> {approvedCount} {config?.maxRegistrations ? `of ${config.maxRegistrations}` : ''} ENROLLED
                            </div>
                        </motion.div>

                        {/* Slot System UI */}
                        {config?.maxRegistrations && (
                            <div className="max-w-2xl mx-auto mb-10 space-y-4">
                                <div className="flex justify-between items-end mb-2">
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-amber-500/50 uppercase tracking-[0.2em]">Registration Progress</p>
                                        <h4 className="text-xl font-black text-amber-100 uppercase tracking-tight">Slots Filled: {approvedCount}/{config.maxRegistrations}</h4>
                                    </div>
                                    <div className="text-right">
                                        {approvedCount >= config.maxRegistrations ? (
                                            (isCaptain || hasTeamCode) ? (
                                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">Priority Access Active</span>
                                            ) : (
                                                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">Registrations Closed</span>
                                            )
                                        ) : approvedCount > 30 ? (
                                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest animate-pulse">Only a few spots left!</span>
                                        ) : approvedCount > 25 ? (
                                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest animate-pulse">Hurry! Slots are filling fast.</span>
                                        ) : (
                                            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Secure your spot now</span>
                                        )}
                                    </div>
                                </div>
                                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, (approvedCount / config.maxRegistrations) * 100)}%` }}
                                        className={`h-full rounded-full shadow-[0_0_15px_rgba(251,191,36,0.3)] ${
                                            approvedCount >= config.maxRegistrations ? 'bg-red-500' :
                                            approvedCount > 30 ? 'bg-orange-500' :
                                            'bg-gradient-to-r from-amber-600 to-amber-400'
                                        }`}
                                    />
                                </div>
                                {approvedCount >= config.maxRegistrations && !isCaptain && !hasTeamCode && (
                                    <div className="p-6 bg-red-500/10 border-2 border-red-500/20 rounded-[2rem] text-center">
                                        <p className="text-sm font-black text-red-500 uppercase tracking-widest">Registrations Closed. All slots are filled.</p>
                                        <p className="text-[10px] font-bold text-red-400/60 uppercase tracking-widest mt-1">Join the waitlist below to be notified of openings.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Progress Tracker */}
                        <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto mb-8 overflow-x-auto no-scrollbar pb-2">
                            {steps.map((step, idx) => (
                                <button 
                                    key={step.id} 
                                    onClick={() => setCurrentStep(idx)}
                                    className="flex-1 flex flex-col items-center gap-2 min-w-[80px] group transition-all"
                                >
                                    <div className={`h-1 w-full rounded-full transition-all duration-500 ${idx <= currentStep ? 'bg-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-white/10 group-hover:bg-white/20'}`} />
                                    <span className={`text-[8px] font-black uppercase tracking-widest transition-colors whitespace-nowrap ${idx === currentStep ? 'text-amber-500' : 'text-white/20 group-hover:text-white/40'}`}>
                                        {step.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step Content */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className={`min-h-[400px] ${(isFull && !isCaptain && !hasTeamCode) ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            {currentStep === 0 && (
                                <div className="space-y-8">
                                    <div className="text-center space-y-4 mb-12">
                                        <h3 className="text-3xl font-black text-amber-100 uppercase tracking-tight">Battle Intel</h3>
                                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Review the tournament details before joining the arena</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                                        <WarriorDetailCard icon={Calendar} title="Auction Date" value={auction?.date || 'TBD'} description="Player bidding day" />
                                        <WarriorDetailCard icon={Clock} title="Matches Date" value={auction?.matchesDate || 'TBD'} description="Tournament schedule" />
                                        <WarriorDetailCard icon={Users} title="Total Teams" value={auction?.totalTeams || '0'} description="Competing squads" />
                                        <WarriorDetailCard icon={MapPin} title="Tournament Venue" value={auction?.venue || 'TBD'} description="Battle ground location" />
                                        <WarriorDetailCard 
                                            icon={Phone} 
                                            title="Organizer" 
                                            value={(config?.organizerContacts || []).length > 0 ? (config?.organizerContacts || [])[0].name : 'TBD'} 
                                            description={(config?.organizerContacts || []).length > 0 ? (config?.organizerContacts || [])[0].phone : 'Contact for queries'} 
                                        />
                                    </div>
                                    <div className="bg-black/40 border-2 border-amber-500/10 rounded-[2.5rem] p-8 mt-12">
                                        <h4 className="text-amber-500 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                            <Info className="w-4 h-4" /> Commander's Briefing
                                        </h4>
                                        <p className="text-sm font-bold text-slate-400 leading-relaxed uppercase tracking-wide">
                                            {config?.welcomePopup?.message || "Welcome to the ultimate cricket showdown. Ensure all your details are accurate as they will be used for the official player draft and auction process."}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {currentStep === 1 && (
                                <div className="max-w-xl mx-auto space-y-8">
                                    <div className="text-center mb-12">
                                        <h3 className="text-3xl font-black text-amber-100 uppercase tracking-tight">Warrior Identity</h3>
                                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Establish your presence in the registry</p>
                                    </div>
                                    <div className="space-y-6">
                                        {/* Captain Option */}
                                        <div className="bg-amber-500/5 border-2 border-amber-500/10 rounded-3xl p-6 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Captain Registration</p>
                                                    <h4 className="text-sm font-black text-amber-100 uppercase tracking-tight">Are you registering as Captain?</h4>
                                                </div>
                                                <div className="flex gap-2">
                                                    {[true, false].map(val => (
                                                        <button 
                                                            key={val ? 'yes' : 'no'}
                                                            type="button"
                                                            onClick={() => {
                                                                setIsCaptain(val);
                                                                if (!val) {
                                                                    setCaptainCode('');
                                                                    setCodeStatus({ type: null, message: '' });
                                                                    setValidatedCode(null);
                                                                }
                                                            }}
                                                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isCaptain === val ? 'bg-amber-600 text-black shadow-lg shadow-amber-600/20' : 'bg-black/40 text-amber-500/50 border border-amber-900/20'}`}
                                                        >
                                                            {val ? 'YES' : 'NO'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {isCaptain && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    className="pt-4 border-t border-amber-500/10 space-y-4"
                                                >
                                                    <div className="relative">
                                                        <input 
                                                            type="text"
                                                            value={captainCode}
                                                            onChange={e => setCaptainCode(e.target.value.toUpperCase())}
                                                            placeholder="ENTER CAPTAIN CODE (e.g. ARSLT1)"
                                                            className="w-full bg-black/60 border-2 border-amber-900/30 rounded-2xl px-6 py-4 font-black text-amber-100 outline-none focus:border-amber-500 uppercase font-mono"
                                                        />
                                                        <button 
                                                            type="button"
                                                            onClick={() => validateCaptainCode(captainCode)}
                                                            className="absolute right-2 top-2 bottom-2 bg-amber-600 hover:bg-amber-500 text-black px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                                        >
                                                            VERIFY
                                                        </button>
                                                    </div>
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Get the captain code from the tournament organizer</p>
                                                    
                                                    {codeStatus.type && (
                                                        <motion.div 
                                                            initial={{ opacity: 0, y: -10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            className={`p-4 rounded-2xl border flex items-center gap-3 ${
                                                                codeStatus.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                                                                codeStatus.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                                                'bg-blue-500/10 border-blue-500/20 text-blue-500'
                                                            }`}
                                                        >
                                                            {codeStatus.type === 'success' ? <ShieldCheck className="w-4 h-4" /> : codeStatus.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                                                            <span className="text-[10px] font-black uppercase tracking-widest">{codeStatus.message}</span>
                                                        </motion.div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </div>

                                        {/* Team Code Option */}
                                        {!isCaptain && (
                                            <div className="bg-amber-500/5 border-2 border-amber-500/10 rounded-3xl p-6 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Team Registration</p>
                                                        <h4 className="text-sm font-black text-amber-100 uppercase tracking-tight">Do you have a Captain's Team Code?</h4>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {[true, false].map(val => (
                                                            <button 
                                                                key={val ? 'yes' : 'no'}
                                                                type="button"
                                                                onClick={() => {
                                                                    setHasTeamCode(val);
                                                                    if (!val) {
                                                                        setTeamCode('');
                                                                        setTeamCodeStatus({ type: null, message: '' });
                                                                        setValidatedTeamCode(null);
                                                                    }
                                                                }}
                                                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${hasTeamCode === val ? 'bg-amber-600 text-black shadow-lg shadow-amber-600/20' : 'bg-black/40 text-amber-500/50 border border-amber-900/20'}`}
                                                            >
                                                                {val ? 'YES' : 'NO'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {hasTeamCode && (
                                                    <motion.div 
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        className="pt-4 border-t border-amber-500/10 space-y-4"
                                                    >
                                                        <div className="relative">
                                                            <input 
                                                                type="text"
                                                                value={teamCode}
                                                                onChange={e => setTeamCode(e.target.value.toUpperCase())}
                                                                placeholder="ENTER TEAM CODE (e.g. ARSPLAYERS)"
                                                                className="w-full bg-black/60 border-2 border-amber-900/30 rounded-2xl px-6 py-4 font-black text-amber-100 outline-none focus:border-amber-500 uppercase font-mono"
                                                            />
                                                            <button 
                                                                type="button"
                                                                onClick={() => validateTeamCode(teamCode)}
                                                                className="absolute right-2 top-2 bottom-2 bg-amber-600 hover:bg-amber-500 text-black px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                                            >
                                                                VERIFY
                                                            </button>
                                                        </div>
                                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Get the team code from your team captain</p>
                                                        
                                                        {teamCodeStatus.type && (
                                                            <motion.div 
                                                                initial={{ opacity: 0, y: -10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                className={`p-4 rounded-2xl border flex items-center gap-3 ${
                                                                    teamCodeStatus.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                                                                    teamCodeStatus.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                                                    'bg-blue-500/10 border-blue-500/20 text-blue-500'
                                                                }`}
                                                            >
                                                                {teamCodeStatus.type === 'success' ? <ShieldCheck className="w-4 h-4" /> : teamCodeStatus.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                                                                <span className="text-[10px] font-black uppercase tracking-widest">{teamCodeStatus.message}</span>
                                                            </motion.div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </div>
                                        )}

                                        {(!config?.basicFields || config?.basicFields?.name?.show !== false) && (
                                            <WarriorInput 
                                                label="Warrior Name" 
                                                value={formData.fullName} 
                                                onChange={(e: any) => setFormData({...formData, fullName: e.target.value})} 
                                                placeholder="ENTER FULL NAME" 
                                                required={!config?.basicFields || config?.basicFields?.name?.required !== false} 
                                            />
                                        )}
                                        {(!config?.basicFields || config?.basicFields?.mobile?.show !== false) && (
                                            <WarriorInput 
                                                label="Mobile Primary" 
                                                type="tel" 
                                                value={formData.mobile} 
                                                onChange={(e: any) => setFormData({...formData, mobile: e.target.value})} 
                                                placeholder="10 DIGIT NUMBER" 
                                                required={!config?.basicFields || config?.basicFields?.mobile?.required !== false} 
                                            />
                                        )}
                                        {(!config?.basicFields || config?.basicFields?.dob?.show !== false) && (
                                            <WarriorInput 
                                                label="Date of Birth" 
                                                type="date" 
                                                value={formData.dob} 
                                                onChange={(e: any) => setFormData({...formData, dob: e.target.value})} 
                                                required={!config?.basicFields || config?.basicFields?.dob?.required !== false} 
                                            />
                                        )}
                                        
                                        {(!config?.basicFields || config.basicFields.gender?.show !== false) && (
                                            <WarriorInput 
                                                label="Gender Identity" 
                                                type="select"
                                                value={formData.gender} 
                                                onChange={(e: any) => setFormData({...formData, gender: e.target.value})} 
                                                options={['Male', 'Female', 'Other']}
                                                required={config?.basicFields?.gender?.required !== false} 
                                                placeholder="SELECT GENDER"
                                            />
                                        )}

                                        {(!config?.basicFields || config.basicFields.photo?.show !== false) && (
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-amber-500/50 ml-1">
                                                    Warrior Portrait {(config?.basicFields?.photo?.required !== false) && <span className="text-red-500">*</span>}
                                                </label>
                                                <div 
                                                    onClick={() => profileInputRef.current?.click()}
                                                    className={`w-full h-48 rounded-[2.5rem] bg-black/40 border-2 border-dashed border-amber-900/30 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 transition-all overflow-hidden relative group`}
                                                >
                                                    {profilePic ? (
                                                        <div className="w-full h-full bg-white">
                                                            <img src={profilePic} className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="text-center">
                                                            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                                                                 <Upload className="w-8 h-8 text-amber-500" />
                                                            </div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/50">Upload Portrait</p>
                                                        </div>
                                                    )}
                                                    <input ref={profileInputRef} type="file" className="hidden" accept="image/*" onChange={async e => { if (e.target.files?.[0]) setProfilePic(await compressImage(e.target.files[0])); }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="space-y-8">
                                    <div className="text-center mb-12">
                                        <h3 className="text-3xl font-black text-amber-100 uppercase tracking-tight">Combat Role</h3>
                                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Select your primary skill on the field</p>
                                    </div>
                                    {(!config?.basicFields || config.basicFields.role?.show !== false) ? (
                                        <div className="max-w-xl mx-auto">
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {roles.map(r => (
                                                    <button 
                                                        key={r.id}
                                                        type="button"
                                                        onClick={() => setFormData({...formData, playerType: r.name})}
                                                        className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center justify-center gap-3 group ${formData.playerType === r.name ? 'bg-amber-600 border-amber-600 text-black shadow-2xl shadow-amber-600/30' : 'bg-black/40 border-amber-900/30 text-amber-500/50 hover:border-amber-500/50'}`}
                                                    >
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${formData.playerType === r.name ? 'bg-black/20 text-black' : 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20'}`}>
                                                            {r.name.toLowerCase().includes('bat') ? <Sword className="w-6 h-6" /> : r.name.toLowerCase().includes('bowl') ? <Zap className="w-6 h-6" /> : r.name.toLowerCase().includes('wicket') ? <ShieldCheck className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-center">{r.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-12 text-center border-2 border-dashed border-amber-900/20 rounded-[3rem]">
                                            <p className="text-amber-500/50 font-black uppercase tracking-widest">Combat role selection is hidden</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className="max-w-xl mx-auto space-y-8">
                                    <div className="text-center mb-12">
                                        <h3 className="text-3xl font-black text-amber-100 uppercase tracking-tight">Warrior Attributes</h3>
                                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Define your specific combat capabilities</p>
                                    </div>
                                    <div className="space-y-8">
                                        {(config?.customFields || []).map((field, idx) => (
                                            <motion.div 
                                                key={field.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                            >
                                                <WarriorInput 
                                                    label={field.label} 
                                                    type={field.type}
                                                    value={formData[field.id]} 
                                                    onChange={(e: any) => setFormData({...formData, [field.id]: e.target.value})} 
                                                    required={field.required}
                                                    placeholder={`ENTER ${field.label.toUpperCase()}`}
                                                    options={field.options || []}
                                                />
                                            </motion.div>
                                        ))}
                                        {(config?.customFields || []).length === 0 && (
                                            <div className="p-12 text-center border-2 border-dashed border-amber-900/20 rounded-[3rem]">
                                                <p className="text-amber-500/50 font-black uppercase tracking-widest">No additional attributes required</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {currentStep === 4 && (
                                <div className="max-w-2xl mx-auto space-y-8">
                                    <div className="text-center mb-12">
                                        <h3 className="text-3xl font-black text-amber-100 uppercase tracking-tight">Tribute Verification</h3>
                                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Secure your spot in the arena with registration fee</p>
                                    </div>
                                    
                                    {config?.includePayment ? (
                                        <div className="space-y-8">
                                            <div className="bg-black/60 border-2 border-amber-500/20 rounded-[3rem] p-10 text-center relative overflow-hidden">
                                                {isAdvaya && (
                                                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]">
                                                        <motion.div
                                                            animate={{ rotate: 360 }}
                                                            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                                                            className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,#f59e0b_360deg)] opacity-60 blur-[10px]"
                                                        />
                                                        <div className="absolute inset-[2px] bg-black/80 rounded-[inherit] z-0" />
                                                    </div>
                                                )}
                                                <div className="relative z-10">
                                                    <div className="absolute top-0 right-0 p-6">
                                                        <div className="px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                                                            FEE: ₹{config.fee}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="space-y-6 mb-10">
                                                        <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] flex items-center justify-center mx-auto border border-amber-500/20">
                                                            <QrCode className="w-10 h-10 text-amber-500" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h4 className="text-xl font-black text-amber-100 uppercase tracking-tight">Scan to Pay via UPI</h4>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Receiver: <span className="text-amber-500">{config.upiName}</span> • UPI ID: <span className="text-amber-500">{config.upiId}</span></p>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white p-6 rounded-[2.5rem] shadow-[0_0_50px_rgba(251,191,36,0.3)] border-8 border-amber-500 inline-block mb-10">
                                                        <img src={config.qrCodeUrl} className="w-64 h-64 object-contain" />
                                                    </div>

                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-amber-500/50">Upload Payment Proof</label>
                                                        <div 
                                                            onClick={() => paymentInputRef.current?.click()}
                                                            className={`w-full max-w-sm mx-auto h-32 rounded-[2rem] bg-black/40 border-2 border-dashed border-amber-900/30 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 transition-all overflow-hidden group`}
                                                        >
                                                            {paymentScreenshot ? (
                                                                <div className="flex items-center gap-3 text-amber-500">
                                                                    <CheckCircle className="w-8 h-8" />
                                                                    <span className="text-xs font-black uppercase tracking-widest">Screenshot Verified</span>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center">
                                                                    <Upload className="w-8 h-8 mx-auto mb-2 text-amber-900 group-hover:text-amber-500 transition-colors" />
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-900 group-hover:text-amber-500 transition-colors">Upload Screenshot</p>
                                                                </div>
                                                            )}
                                                            <input ref={paymentInputRef} type="file" className="hidden" accept="image/*" onChange={async e => { if (e.target.files?.[0]) setPaymentScreenshot(await compressImage(e.target.files[0])); }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-20 text-center border-2 border-dashed border-amber-900/20 rounded-[3rem]">
                                            <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
                                                <CreditCard className="w-10 h-10 text-amber-500" />
                                            </div>
                                            <h4 className="text-xl font-black text-amber-100 uppercase tracking-tight mb-2">No Tribute Required</h4>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Registration for this battle is free of charge</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {currentStep === 5 && (
                                <div className="max-w-xl mx-auto space-y-8">
                                    <div className="text-center mb-12">
                                        <h3 className="text-3xl font-black text-amber-100 uppercase tracking-tight">Battle Oath</h3>
                                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Finalize your commitment to the tournament protocols</p>
                                    </div>
                                    
                                    <div className="space-y-6">
                                        <div className="bg-black/60 border-2 border-amber-900/20 rounded-[2.5rem] p-8 max-h-[300px] overflow-y-auto custom-scrollbar relative overflow-hidden">
                                            {isAdvaya && (
                                                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]">
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                                        className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,#f59e0b_360deg)] opacity-60 blur-[10px]"
                                                    />
                                                    <div className="absolute inset-[2px] bg-black/80 rounded-[inherit] z-0" />
                                                </div>
                                            )}
                                            <div className="relative z-10">
                                                <h4 className="text-amber-500 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                                    <ShieldCheck className="w-4 h-4" /> Rules & Regulations
                                                </h4>
                                                <div className="text-xs font-bold text-slate-400 leading-relaxed uppercase tracking-wide whitespace-pre-wrap">
                                                    {config?.rules || "1. Respect the spirit of the game.\n2. Arrive at the venue 30 minutes before the match.\n3. Follow all umpire decisions.\n4. Maintain sportsmanship at all times."}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-black/60 border-2 border-amber-900/20 rounded-[2.5rem] p-8">
                                            <h4 className="text-amber-500 font-black uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                                                <Phone className="w-4 h-4" /> Organizer Contact
                                            </h4>
                                            <div className="space-y-2">
                                                {(config?.organizerContacts || []).map((contact, idx) => (
                                                    <div key={idx} className="flex items-center justify-between">
                                                        <p className="text-sm font-black text-amber-100 uppercase tracking-tight">{contact.name}</p>
                                                        <p className="text-sm font-black text-amber-500/70 tracking-widest">{contact.phone}</p>
                                                    </div>
                                                ))}
                                                {(config?.organizerContacts || []).length === 0 && (
                                                    <p className="text-sm font-black text-amber-100 uppercase tracking-tight">N/A</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-black/60 border-2 border-amber-900/20 rounded-[2.5rem] p-8">
                                            <label className="flex items-start gap-4 cursor-pointer group">
                                                <div className="mt-1">
                                                    <input 
                                                        type="checkbox" 
                                                        className="sr-only peer" 
                                                        checked={formData.battleOath}
                                                        onChange={() => setFormData({...formData, battleOath: !formData.battleOath})}
                                                    />
                                                    <div className="w-6 h-6 border-2 border-amber-900/50 rounded-lg flex items-center justify-center transition-all peer-checked:bg-amber-600 peer-checked:border-amber-600 group-hover:border-amber-500">
                                                        <CheckCircle className={`w-4 h-4 text-black transition-opacity ${formData.battleOath ? 'opacity-100' : 'opacity-0'}`} />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-black text-amber-100 uppercase tracking-tight">I accept the Battle Oath</p>
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">I verify all provided intel is accurate and I will uphold the tournament integrity.</p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="mt-12 flex items-center justify-between gap-6">
                        {currentStep > 0 ? (
                            <button 
                                onClick={prevStep}
                                className="px-10 py-5 rounded-full border-2 border-amber-900/30 text-amber-500 font-black uppercase tracking-widest hover:bg-amber-500/10 transition-all active:scale-95 flex items-center gap-3"
                            >
                                <ChevronLeft className="w-5 h-5" /> BACK
                            </button>
                        ) : <div />}

                        {currentStep < steps.length - 1 ? (
                            <button 
                                onClick={nextStep}
                                className="px-12 py-5 rounded-full bg-amber-600 hover:bg-amber-500 text-black font-black uppercase tracking-widest transition-all shadow-[0_10px_30px_-10px_rgba(251,191,36,0.5)] active:scale-95 flex items-center gap-3"
                            >
                                NEXT <ChevronRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <button 
                                disabled={!formData.battleOath || submitting}
                                onClick={handleSubmit}
                                className={`px-16 py-6 rounded-full font-black uppercase tracking-widest transition-all shadow-[0_10px_40px_-10px_rgba(251,191,36,0.5)] active:scale-95 flex items-center gap-4 ${!formData.battleOath || submitting ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' : 'bg-amber-600 hover:bg-amber-500 text-black'}`}
                            >
                                {submitting ? <Loader2 className="animate-spin w-6 h-6" /> : <><Sword className="w-6 h-6" /> JOIN THE BATTLE</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen font-sans py-10 px-4 transition-colors duration-1000 ${isAdvaya ? 'bg-[#0a0a0a] text-amber-50' : 'bg-gray-50 text-gray-900'}`}>
            {/* Back Button */}
            <div className="max-w-2xl mx-auto mb-6 flex items-center justify-between relative z-[110]">
                <button 
                    onClick={() => navigate('/')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                        isAdvaya 
                        ? 'bg-amber-600/10 border border-amber-600/30 text-amber-500 hover:bg-amber-600/20' 
                        : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 shadow-sm'
                    }`}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </button>
            </div>

            <AnimatePresence>
                {isAdvaya && showBattleEntrance && !battleStarted && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 overflow-hidden"
                    >
                        {/* Background Effects */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.15)_0%,transparent_70%)]" />
                        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                        
                        {showPoster ? (
                            <motion.div 
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 1.1, opacity: 0 }}
                                className="relative z-20 max-w-2xl w-full bg-black border-4 border-amber-500/30 rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(251,191,36,0.2)]"
                            >
                                <div className="w-full overflow-y-auto max-h-[90vh] custom-scrollbar">
                                    <img src={config?.bannerUrl} className="w-full h-auto block" />
                                    <div className="p-8 bg-black/95 border-t border-amber-500/20 text-center">
                                        <button 
                                            onClick={() => setShowPoster(false)}
                                            className="bg-amber-600 hover:bg-amber-500 text-black font-black px-12 py-5 rounded-full text-lg uppercase tracking-widest transition-all shadow-2xl flex items-center gap-4 mx-auto active:scale-95"
                                        >
                                            NEXT
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0, y: 50 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="relative z-10 text-center"
                            >
                                {config?.logoUrl && (
                                    <motion.img 
                                        initial={{ y: -20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.5, duration: 0.8 }}
                                        src={config.logoUrl} 
                                        className="w-40 h-40 mx-auto mb-8 object-contain drop-shadow-[0_0_25px_rgba(251,191,36,0.5)]" 
                                    />
                                )}
                                
                                <motion.h2 
                                    initial={{ letterSpacing: "0.5em", opacity: 0 }}
                                    animate={{ letterSpacing: "0.1em", opacity: 1 }}
                                    transition={{ delay: 1, duration: 1.2 }}
                                    className="text-4xl md:text-6xl font-black text-amber-500 uppercase mb-4 drop-shadow-lg"
                                >
                                    {auction?.title || 'ADVAYA'}
                                </motion.h2>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 1.5, duration: 0.8 }}
                                    className="flex flex-col items-center gap-2 mb-8"
                                >
                                    <div className="flex items-center gap-3 text-amber-200/60 font-black uppercase tracking-[0.2em] text-sm">
                                        <Calendar className="w-4 h-4" /> Auction Date: {auction?.date || 'TBD'}
                                    </div>
                                    <div className="flex items-center gap-3 text-amber-200/60 font-black uppercase tracking-[0.2em] text-sm">
                                        <Home className="w-4 h-4" /> Ground: {auction?.venue || 'TBD'}
                                    </div>
                                </motion.div>
                                
                                <motion.p 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 2.2, duration: 0.8 }}
                                    className="text-xl md:text-2xl font-bold text-white uppercase tracking-[0.3em] mb-12 italic"
                                >
                                    Are you ready to join the battle?
                                </motion.p>
                                
                                <motion.button
                                    whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(251,191,36,0.4)" }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setBattleStarted(true)}
                                    className="bg-amber-600 hover:bg-amber-500 text-black font-black px-12 py-5 rounded-full text-xl uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(251,191,36,0.2)] flex items-center gap-4 mx-auto"
                                >
                                    <Sword className="w-6 h-6" /> ENTER THE ARENA
                                </motion.button>
                            </motion.div>
                        )}

                        {/* Animated Particles/Lines */}
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-30 animate-pulse" />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showWelcomePopup && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className={`max-w-md w-full p-8 rounded-[2rem] shadow-2xl border-2 ${
                                isAdvaya 
                                ? 'bg-[#151515] border-amber-500/30 text-amber-50' 
                                : 'bg-white border-blue-100 text-gray-900'
                            }`}
                        >
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
                                isAdvaya ? 'bg-amber-500/10' : 'bg-blue-50'
                            }`}>
                                <Megaphone className={`w-8 h-8 ${isAdvaya ? 'text-amber-500' : 'text-blue-600'}`} />
                            </div>
                            
                            <h2 className={`text-xl font-black text-center uppercase tracking-tight mb-4 ${
                                isAdvaya ? 'text-amber-500' : 'text-blue-600'
                            }`}>
                                Welcome Message
                            </h2>
                            
                            <p className={`text-sm font-bold text-center leading-relaxed mb-8 ${
                                isAdvaya ? 'text-slate-400' : 'text-gray-500'
                            }`}>
                                {config?.welcomePopup?.message || `Welcome to ${auction?.title}! Please fill out the form to register.`}
                            </p>
                            
                            <button 
                                onClick={() => setShowWelcomePopup(false)}
                                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 ${
                                    isAdvaya 
                                    ? 'bg-amber-600 hover:bg-amber-500 text-black' 
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                            >
                                OK ({welcomeTimer}s)
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`max-w-2xl mx-auto shadow-2xl rounded-[2.5rem] overflow-hidden border animate-fade-in relative ${isAdvaya ? 'bg-[#151515] border-amber-900/30' : 'bg-white border-gray-200'}`}>
                {/* Main Card Neon Border */}
                {isAdvaya && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit] z-0">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,#f59e0b_360deg)] opacity-60 blur-[15px]"
                        />
                    </div>
                )}
                <div className="relative z-10">
                    <div className={`${isAdvaya ? 'bg-gradient-to-b from-amber-900/40 to-transparent' : 'bg-blue-600'} p-10 text-center relative overflow-hidden`}>
                    {isAdvaya ? (
                        <>
                            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]" />
                            <motion.div 
                                initial={{ y: -50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="relative z-10"
                            >
                                {config?.bannerUrl && (
                                    <img src={config.bannerUrl} className="w-full h-32 object-cover rounded-2xl mb-6 border border-amber-500/20 shadow-2xl" />
                                )}
                                <div className="flex items-center justify-center gap-4 mb-4">
                                    <Sword className="w-8 h-8 text-amber-500" />
                                    <h1 className="text-4xl font-black uppercase tracking-tighter text-amber-500 drop-shadow-md">{auction?.title}</h1>
                                    <Shield className="w-8 h-8 text-amber-500" />
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <p className="text-[10px] font-black tracking-[0.5em] text-amber-200/60 uppercase">Warrior Registration</p>
                                    {config?.maxRegistrations > 0 && (
                                        <div className="mt-4 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                            <Users className="inline w-3 h-3 mr-2" /> {approvedCount} {config.maxRegistrations ? `/ ${config.maxRegistrations} WARRIORS ENROLLED` : 'WARRIORS ENROLLED'}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </>
                    ) : (
                        <>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter relative z-10">{auction?.title}</h1>
                            <p className="text-[10px] font-bold tracking-[0.4em] mt-2 opacity-60 relative z-10 uppercase">Registry Enrollment Terminal</p>
                            {config?.maxRegistrations > 0 && (
                                <div className="mt-6 inline-flex items-center px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase tracking-widest relative z-10">
                                    <Users className="inline w-3 h-3 mr-2" /> {approvedCount} {config.maxRegistrations ? `/ ${config.maxRegistrations} REGISTERED` : 'REGISTERED'}
                                </div>
                            )}
                        </>
                    )}
                </div>
                
                <form onSubmit={handleSubmit} className="p-10 space-y-8">
                    <div className="space-y-6">
                        {/* DEFAULT FIELDS */}
                        {(!config?.basicFields || config.basicFields.name?.show !== false) && (
                            <motion.div
                                initial={isAdvaya ? { x: -20, opacity: 0 } : {}}
                                animate={isAdvaya ? { x: 0, opacity: 1 } : {}}
                                transition={{ delay: 0.1 }}
                            >
                                <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ml-1 ${isAdvaya ? 'text-amber-500/70' : 'text-gray-400'}`}>
                                    {isAdvaya ? 'Warrior Name' : 'Your Full Name'} {(!config?.basicFields || config.basicFields.name?.required !== false) && <span className="text-red-500">*</span>}
                                </label>
                                <input required={!config?.basicFields || config.basicFields.name?.required !== false} className={`w-full rounded-2xl px-6 py-4 font-bold outline-none transition-all ${isAdvaya ? 'bg-black/40 border-2 border-amber-900/30 text-amber-100 focus:border-amber-500' : 'bg-gray-50 border-2 border-gray-100 text-gray-700 focus:bg-white focus:border-blue-400'}`} value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder={isAdvaya ? "ENTER WARRIOR NAME" : "Enter your full name"} />
                            </motion.div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {(!config?.basicFields || config.basicFields.mobile?.show !== false) && (
                                <motion.div
                                    initial={isAdvaya ? { x: -20, opacity: 0 } : {}}
                                    animate={isAdvaya ? { x: 0, opacity: 1 } : {}}
                                    transition={{ delay: 0.2 }}
                                >
                                    <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ml-1 ${isAdvaya ? 'text-amber-500/70' : 'text-gray-400'}`}>
                                        {isAdvaya ? 'Mobile Primary' : 'Mobile Number'} {(!config?.basicFields || config.basicFields.mobile?.required !== false) && <span className="text-red-500">*</span>}
                                    </label>
                                    <input required={!config?.basicFields || config.basicFields.mobile?.required !== false} type="tel" className={`w-full rounded-2xl px-6 py-4 font-bold outline-none transition-all ${isAdvaya ? 'bg-black/40 border-2 border-amber-900/30 text-amber-100 focus:border-amber-500' : 'bg-gray-50 border-2 border-gray-100 text-gray-700 focus:bg-white focus:border-blue-400'}`} value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} placeholder="Enter 10 digit mobile number" />
                                </motion.div>
                            )}
                            {(!config?.basicFields || config.basicFields.dob?.show !== false) && (
                                <motion.div
                                    initial={isAdvaya ? { x: 20, opacity: 0 } : {}}
                                    animate={isAdvaya ? { x: 0, opacity: 1 } : {}}
                                    transition={{ delay: 0.2 }}
                                >
                                    <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ml-1 ${isAdvaya ? 'text-amber-500/70' : 'text-gray-400'}`}>
                                        Date of Birth {(!config?.basicFields || config.basicFields.dob?.required !== false) && <span className="text-red-500">*</span>}
                                    </label>
                                    <input required={!config?.basicFields || config.basicFields.dob?.required !== false} type="date" className={`w-full rounded-2xl px-6 py-4 font-bold outline-none transition-all ${isAdvaya ? 'bg-black/40 border-2 border-amber-900/30 text-amber-100 focus:border-amber-500' : 'bg-gray-50 border-2 border-gray-100 text-gray-700 focus:bg-white focus:border-blue-400'}`} value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                                </motion.div>
                            )}
                        </div>

                        {(!config?.basicFields || config.basicFields.gender?.show !== false) && (
                            <motion.div
                                initial={isAdvaya ? { y: 20, opacity: 0 } : {}}
                                animate={isAdvaya ? { y: 0, opacity: 1 } : {}}
                                transition={{ delay: 0.3 }}
                            >
                                <label className={`block text-[10px] font-black uppercase tracking-widest mb-3 ml-1 ${isAdvaya ? 'text-amber-500/70' : 'text-gray-400'}`}>
                                    Gender {(!config?.basicFields || config.basicFields.gender?.required !== false) && <span className="text-red-500">*</span>}
                                </label>
                                <div className="flex flex-wrap gap-2.5">
                                    {['Male', 'Female', 'Other'].map(g => (
                                        <button 
                                            key={g} 
                                            type="button" 
                                            onClick={() => setFormData({...formData, gender: g})} 
                                            className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 ${formData.gender === g ? (isAdvaya ? 'bg-amber-600 border-amber-600 text-black shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'bg-blue-600 border-blue-600 text-white shadow-lg') : (isAdvaya ? 'bg-black/40 border-amber-900/30 text-amber-500/50 hover:border-amber-500/50' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200')}`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {(!config?.basicFields || config.basicFields.role?.show !== false) && (
                            <motion.div
                                initial={isAdvaya ? { y: 20, opacity: 0 } : {}}
                                animate={isAdvaya ? { y: 0, opacity: 1 } : {}}
                                transition={{ delay: 0.35 }}
                            >
                                <label className={`block text-[10px] font-black uppercase tracking-widest mb-3 ml-1 ${isAdvaya ? 'text-amber-500/70' : 'text-gray-400'}`}>
                                    Select Your Role {(!config?.basicFields || config.basicFields.role?.required !== false) && <span className="text-red-500">*</span>}
                                </label>
                                <div className="flex flex-wrap gap-2.5">
                                    {roles.length > 0 ? (
                                        roles.map(r => (
                                            <button key={r.id} type="button" onClick={() => setFormData({...formData, playerType: r.name})} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 ${formData.playerType === r.name ? (isAdvaya ? 'bg-amber-600 border-amber-600 text-black shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'bg-blue-600 border-blue-600 text-white shadow-lg') : (isAdvaya ? 'bg-black/40 border-amber-900/30 text-amber-500/50 hover:border-amber-500/50' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200')}`}>
                                                {r.name}
                                            </button>
                                        ))
                                    ) : (
                                        <div className={`text-[10px] font-bold uppercase tracking-widest p-4 border border-dashed rounded-xl w-full text-center ${isAdvaya ? 'border-amber-900/30 text-amber-500/40' : 'border-gray-200 text-gray-400'}`}>
                                            No roles defined for this auction. Please add roles in the auction settings.
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* CUSTOM FIELDS DYNAMIC RENDERING */}
                        {(config?.customFields || []).length > 0 && (
                            <div className={`pt-4 border-t space-y-6 ${isAdvaya ? 'border-amber-900/30' : 'border-gray-100'}`}>
                                <h3 className={`text-[11px] font-black uppercase tracking-[0.25em] flex items-center gap-2 ${isAdvaya ? 'text-amber-500' : 'text-indigo-500'}`}>
                                    {isAdvaya ? <Zap className="w-4 h-4"/> : <AlignLeft className="w-4 h-4"/>} {isAdvaya ? 'WARRIOR ATTRIBUTES' : 'Other Information'}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {(config?.customFields || []).map((field, idx) => (
                                        <motion.div 
                                            key={field.id} 
                                            initial={isAdvaya ? { opacity: 0, y: 10 } : {}}
                                            animate={isAdvaya ? { opacity: 1, y: 0 } : {}}
                                            transition={{ delay: 0.4 + (idx * 0.05) }}
                                            className={field.type === 'textarea' ? 'md:col-span-2' : ''}
                                        >
                                            <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ml-1 ${isAdvaya ? 'text-amber-500/70' : 'text-gray-400'}`}>
                                                {field.label} {field.required && <span className="text-red-500">*</span>}
                                            </label>
                                            
                                            {field.type === 'select' ? (
                                                <div className="flex flex-wrap gap-2.5">
                                                    {field.options?.map(opt => (
                                                        <button 
                                                            key={opt} 
                                                            type="button" 
                                                            onClick={() => setFormData({...formData, [field.id]: opt})} 
                                                            className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all active:scale-95 ${formData[field.id] === opt ? (isAdvaya ? 'bg-amber-600 border-amber-600 text-black shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'bg-blue-600 border-blue-600 text-white shadow-lg') : (isAdvaya ? 'bg-black/40 border-amber-900/30 text-amber-500/50 hover:border-amber-500/50' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200')}`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : field.type === 'textarea' ? (
                                                <textarea 
                                                    required={field.required}
                                                    className={`w-full rounded-2xl px-6 py-4 font-bold outline-none transition-all min-h-[100px] ${isAdvaya ? 'bg-black/40 border-2 border-amber-900/30 text-amber-100 focus:border-amber-500' : 'bg-gray-50 border-2 border-gray-100 text-gray-700 focus:bg-white focus:border-blue-400'}`}
                                                    value={formData[field.id]}
                                                    onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                                                />
                                            ) : (
                                                <input 
                                                    required={field.required}
                                                    type={field.type}
                                                    className={`w-full rounded-2xl px-6 py-4 font-bold outline-none transition-all ${isAdvaya ? 'bg-black/40 border-2 border-amber-900/30 text-amber-100 focus:border-amber-500' : 'bg-gray-50 border-2 border-gray-100 text-gray-700 focus:bg-white focus:border-blue-400'}`}
                                                    value={formData[field.id]}
                                                    onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                                                />
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                            {(!config?.basicFields || config.basicFields.photo?.show !== false) && (
                                <motion.div
                                    initial={isAdvaya ? { opacity: 0, scale: 0.9 } : {}}
                                    animate={isAdvaya ? { opacity: 1, scale: 1 } : {}}
                                    transition={{ delay: 0.5 }}
                                >
                                    <label className={`block text-[10px] font-black uppercase tracking-widest mb-3 ml-1 ${isAdvaya ? 'text-amber-500/70' : 'text-gray-400'}`}>
                                        {isAdvaya ? 'WARRIOR PORTRAIT' : 'Upload Photo'} {(!config?.basicFields || config.basicFields.photo?.required !== false) && <span className="text-red-500">*</span>}
                                    </label>
                                    <div onClick={() => profileInputRef.current?.click()} className={`w-full h-48 rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group border-2 border-dashed ${isAdvaya ? 'bg-black/40 border-amber-900/30 hover:border-amber-500' : 'bg-gray-50 border-gray-200 hover:bg-white hover:border-blue-400'}`}>
                                        {isAdvaya && (
                                            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit] z-0">
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                                                    className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,#f59e0b_360deg)] opacity-60 blur-[8px]"
                                                />
                                                <div className="absolute inset-[2px] bg-black/80 rounded-[inherit] z-0" />
                                            </div>
                                        )}
                                        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                                            {profilePic ? (
                                                <img src={profilePic} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-center">
                                                    <Upload className={`w-8 h-8 mx-auto mb-2 ${isAdvaya ? 'text-amber-900' : 'text-gray-300'}`} />
                                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isAdvaya ? 'text-amber-900' : 'text-gray-400'}`}>{isAdvaya ? 'Select Image' : 'Select Photo'}</p>
                                                </div>
                                            )}
                                        </div>
                                        <input ref={profileInputRef} type="file" className="hidden" accept="image/*" onChange={async e => { if (e.target.files?.[0]) setProfilePic(await compressImage(e.target.files[0])); }} />
                                    </div>
                                </motion.div>
                            )}
                            
                            {config?.includePayment && config.paymentMethod === 'MANUAL' && (
                                <motion.div
                                    initial={isAdvaya ? { opacity: 0, scale: 0.9 } : {}}
                                    animate={isAdvaya ? { opacity: 1, scale: 1 } : {}}
                                    transition={{ delay: 0.6 }}
                                    className="md:col-span-2"
                                >
                                    <label className={`block text-[10px] font-black uppercase tracking-widest mb-4 ml-1 text-center ${isAdvaya ? 'text-amber-500/70' : 'text-gray-400'}`}>{isAdvaya ? 'Verify Payment' : 'Payment Confirmation'} (₹{config.fee})</label>
                                    <div className={`p-8 rounded-[2.5rem] border-2 flex flex-col items-center gap-8 ${isAdvaya ? 'bg-black/40 border-amber-500/20' : 'bg-blue-50 border-blue-100'}`}>
                                        <div className="text-center space-y-2">
                                            <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${isAdvaya ? 'text-amber-500' : 'text-blue-600'}`}>{isAdvaya ? 'Scan to Pay via UPI' : 'Scan to Pay'}</p>
                                            <div className="space-y-1">
                                                <p className={`text-[10px] font-bold uppercase tracking-widest ${isAdvaya ? 'text-slate-400' : 'text-gray-500'}`}>{isAdvaya ? 'Receiver' : 'Pay to'}: <span className={isAdvaya ? 'text-amber-200' : 'text-gray-900'}>{config.upiName}</span></p>
                                                <p className={`text-[10px] font-bold uppercase tracking-widest ${isAdvaya ? 'text-slate-400' : 'text-gray-500'}`}>UPI ID: <span className={isAdvaya ? 'text-amber-200' : 'text-gray-900'}>{config.upiId}</span></p>
                                            </div>
                                        </div>
                                        
                                        <div className={`p-6 bg-white rounded-[2.5rem] shadow-2xl border-4 ${isAdvaya ? 'border-amber-500' : 'border-blue-600'}`}>
                                            <img src={config.qrCodeUrl} className="w-64 h-64 object-contain" />
                                        </div>

                                        <div className="flex items-center gap-4 w-full max-w-xs">
                                            <div className={`h-[1px] flex-1 ${isAdvaya ? 'bg-amber-500/20' : 'bg-blue-200'}`} />
                                            <span className={`text-[8px] font-black uppercase tracking-widest ${isAdvaya ? 'text-amber-500/50' : 'text-blue-400'}`}>{isAdvaya ? 'Then' : 'Next Step'}</span>
                                            <div className={`h-[1px] flex-1 ${isAdvaya ? 'bg-amber-500/20' : 'bg-blue-200'}`} />
                                        </div>

                                        <div onClick={() => paymentInputRef.current?.click()} className={`w-full max-w-sm h-24 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative border-2 border-dashed group ${isAdvaya ? 'bg-black/40 border-amber-900/30 hover:border-amber-500' : 'bg-white border-blue-200 hover:bg-blue-50 hover:border-blue-400'}`}>
                                            {isAdvaya && (
                                                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit] z-0">
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                                                        className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,#f59e0b_360deg)] opacity-60 blur-[8px]"
                                                    />
                                                    <div className="absolute inset-[2px] bg-black/80 rounded-[inherit] z-0" />
                                                </div>
                                            )}
                                            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                                                {paymentScreenshot ? (
                                                    <div className="flex items-center gap-3 text-green-500">
                                                        <CheckCircle className="w-6 h-6" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">{isAdvaya ? 'Screenshot Attached' : 'Photo Uploaded'}</span>
                                                    </div>
                                                ) : (
                                                    <div className="text-center">
                                                        <Upload className={`w-6 h-6 mx-auto mb-2 ${isAdvaya ? 'text-amber-900 group-hover:text-amber-500' : 'text-gray-300 group-hover:text-blue-500'} transition-colors`} />
                                                        <p className={`text-[10px] font-black uppercase tracking-widest ${isAdvaya ? 'text-amber-900 group-hover:text-amber-500' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`}>{isAdvaya ? 'Upload Payment Proof' : 'Upload Payment Screenshot'}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <input ref={paymentInputRef} type="file" className="hidden" accept="image/*" onChange={async e => { if (e.target.files?.[0]) setPaymentScreenshot(await compressImage(e.target.files[0])); }} />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* RULES & TERMS SECTION */}
                    <div className="space-y-6">
                        {(config?.organizerContacts || []).length > 0 && (
                            <motion.div 
                                initial={isAdvaya ? { opacity: 0 } : {}}
                                animate={isAdvaya ? { opacity: 1 } : {}}
                                className={`p-8 rounded-[2.5rem] border-2 ${isAdvaya ? 'bg-black/40 border-blue-500/20 text-blue-100/70' : 'bg-blue-50 border-blue-100 text-blue-900/70'}`}
                            >
                                <h4 className={`text-xs font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-3 ${isAdvaya ? 'text-blue-500' : 'text-blue-600'}`}>
                                    <Phone className="w-5 h-5" /> {isAdvaya ? 'Organizer Contact' : 'Contact Person'}
                                </h4>
                                <div className="space-y-3">
                                    {(config?.organizerContacts || []).map((contact, idx) => (
                                        <div key={idx} className="flex items-center justify-between">
                                            <div className="text-sm font-black tracking-widest uppercase">
                                                {contact.name}
                                            </div>
                                            <a href={`tel:${contact.phone}`} className="text-blue-500 hover:text-blue-400 font-bold text-xs">
                                                {contact.phone}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[9px] font-bold mt-4 opacity-60 uppercase tracking-widest">Contact for any registration related queries</p>
                            </motion.div>
                        )}

                        {/* Battle Oath for Single Page Form */}
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-8 rounded-[2.5rem] border-2 ${isAdvaya ? 'bg-amber-900/10 border-amber-500/20' : 'bg-amber-50 border-amber-100'}`}
                        >
                            <div className="flex items-start gap-4">
                                <div className="pt-1">
                                    <input 
                                        type="checkbox" 
                                        id="battle-oath-checkbox"
                                        checked={formData.battleOath}
                                        onChange={() => setFormData({...formData, battleOath: !formData.battleOath})}
                                        className={`w-6 h-6 rounded-lg cursor-pointer accent-amber-600`}
                                    />
                                </div>
                                <label htmlFor="battle-oath-checkbox" className="cursor-pointer">
                                    <h4 className={`text-sm font-black uppercase tracking-widest mb-2 ${isAdvaya ? 'text-amber-500' : 'text-amber-700'}`}>
                                        {isAdvaya ? 'BATTLE OATH ACCEPTANCE' : 'I Accept the Terms & Conditions'}
                                    </h4>
                                    <p className={`text-[10px] font-bold leading-relaxed uppercase tracking-widest ${isAdvaya ? 'text-amber-200/60' : 'text-amber-800/60'}`}>
                                        I hereby declare that all information provided is accurate. I agree to abide by the tournament rules, maintain sportsmanship, and respect the organizer's decisions.
                                    </p>
                                </label>
                            </div>
                        </motion.div>
                    </div>

                    <button disabled={!formData.battleOath || submitting} type="submit" className={`w-full font-black py-5 rounded-[1.5rem] shadow-2xl transition-all flex items-center justify-center gap-4 group active:scale-95 uppercase text-sm tracking-widest ${isAdvaya ? 'bg-amber-600 hover:bg-amber-500 text-black shadow-amber-900/20' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20'} ${!formData.battleOath ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {submitting ? <Loader2 className="animate-spin" /> : (config?.includePayment && config.paymentMethod === 'RAZORPAY' ? <><CreditCard className="w-6 h-6"/> {isAdvaya ? 'Authorize' : 'Pay'} ₹{config.fee}</> : (isAdvaya ? <><Sword className="w-5 h-5" /> JOIN THE BATTLE</> : 'Register Now'))}
                    </button>
                    
                    <p className={`text-[9px] font-bold text-center uppercase tracking-widest leading-relaxed ${isAdvaya ? 'text-amber-900' : 'text-gray-400'}`}>
                        By submitting, you agree to the tournament protocols <br/> and verify all information is legally accurate.
                    </p>
                </form>
            </div>
        </div>
    </div>
);
};

export default PlayerRegistration;