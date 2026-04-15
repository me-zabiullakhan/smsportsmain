
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    DndContext, 
    useDraggable, 
    useDroppable, 
    DragOverlay, 
    DragEndEvent, 
    DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
    defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { 
    ArrowLeft, 
    Search, 
    Filter, 
    Download, 
    Save, 
    RotateCcw, 
    Undo, 
    Loader2, 
    ChevronDown,
    User,
    Trash2,
    Move,
    Shuffle,
    Plus,
    AlertTriangle,
    CheckCircle,
    XCircle,
    X,
    Pencil,
    Check,
    Trophy
} from 'lucide-react';
import { db } from '../firebase';
import { Player, AuctionCategory, CategoryArrangementDraft, CategoryArrangementSlot } from '../types';
import html2canvas from 'html2canvas';
import { useTheme } from '../contexts/ThemeContext';

// --- Components ---

interface DraggablePlayerProps {
    player: Player;
    disabled?: boolean;
}

const DraggablePlayer: React.FC<DraggablePlayerProps> = ({ player, disabled }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `player-${player.id}`,
        data: player,
        disabled: disabled
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            {...listeners} 
            {...attributes}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing group ${
                disabled 
                ? (isDark ? 'bg-zinc-900/50 border-zinc-800/50 opacity-40 grayscale pointer-events-none' : 'bg-gray-100 border-gray-200 opacity-40 grayscale pointer-events-none')
                : (isDark ? 'bg-zinc-900 border-zinc-800 hover:border-accent/50 hover:bg-zinc-800 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-500/50 hover:bg-gray-50 shadow-sm')
            }`}
        >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 border ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-100 border-gray-200'}`}>
                {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                    <User className={`w-5 h-5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold truncate transition-colors ${isDark ? 'text-zinc-100 group-hover:text-accent' : 'text-gray-900 group-hover:text-blue-600'}`}>{player.name}</p>
                <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{player.category} • {player.role}</p>
            </div>
        </div>
    );
};

interface DroppableSlotProps {
    id: string;
    player?: CategoryArrangementSlot;
    onAction: (action: 'REMOVE' | 'MOVE', slotId: string) => void;
    index: number;
}

const DroppableSlot: React.FC<DroppableSlotProps> = ({ id, player, onAction, index }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: id,
    });

    const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
        id: `slot-player-${id}`,
        data: player ? { ...player, fromSlot: id } : undefined,
        disabled: !player
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div 
            ref={setDropRef}
            className={`relative min-h-[5.5rem] h-auto w-full border transition-all flex items-center justify-center group ${
                isOver 
                ? (isDark ? 'bg-accent/30 border-accent shadow-[0_0_15px_rgba(245,158,11,0.3)] z-10 scale-[1.02]' : 'bg-blue-500/30 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)] z-10 scale-[1.02]')
                : (isDark ? 'bg-zinc-900/40 border-zinc-800/50' : 'bg-gray-50 border-gray-200')
            } ${player ? (isDark ? 'border-accent/40 bg-zinc-900/60' : 'border-blue-500/40 bg-white') : 'border-dashed'}`}
        >
            {/* Slot Number */}
            <div className={`absolute top-1 left-1 text-[8px] font-black uppercase tracking-widest pointer-events-none z-0 ${isDark ? 'text-zinc-800' : 'text-gray-300'}`}>
                #{index + 1}
            </div>

            {player ? (
                <div 
                    ref={setDragRef}
                    style={style}
                    {...listeners}
                    {...attributes}
                    className="w-full h-full p-2.5 flex items-center gap-2.5 relative z-10 cursor-grab active:cursor-grabbing"
                >
                    <div className={`w-9 h-9 rounded-lg border flex-shrink-0 overflow-hidden flex items-center justify-center ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-100 border-gray-200'}`}>
                        <span className={`text-[10px] font-black ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{index + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className={`text-[11px] font-black leading-tight uppercase tracking-tight whitespace-normal break-words ${isDark ? 'text-accent' : 'text-blue-600'}`}>{player.playerName}</p>
                        <p className={`text-[8px] font-bold uppercase tracking-widest truncate ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{player.category}</p>
                    </div>
                    
                    {/* Hover Actions */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-3 backdrop-blur-sm pointer-events-none group-hover:pointer-events-auto ${isDark ? 'bg-zinc-950/95' : 'bg-white/95'}`}>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction('REMOVE', id);
                            }}
                            className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all active:scale-90"
                            title="Remove Player"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-1 opacity-20 group-hover:opacity-40 transition-opacity">
                    <span className={`text-[14px] font-black ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{index + 1}</span>
                </div>
            )}
        </div>
    );
};

// --- Main Screen ---

const CategoryArrangement: React.FC = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [auctionName, setAuctionName] = useState<string>('');
    const [auctionLogo, setAuctionLogo] = useState<string>('');
    const [players, setPlayers] = useState<Player[]>([]);
    const [categories, setCategories] = useState<AuctionCategory[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('');
    const [slots, setSlots] = useState<{ [key: string]: CategoryArrangementSlot }>({});
    const [allSlots, setAllSlots] = useState<{ [categoryId: string]: { [slotId: string]: CategoryArrangementSlot } }>({});
    const [customConfig, setCustomConfig] = useState<{ [categoryId: string]: { rows: number, cols: number } }>({});
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [history, setHistory] = useState<{ [key: string]: CategoryArrangementSlot }[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showAddCategoryPopup, setShowAddCategoryPopup] = useState(false);
    const [showDeleteCategoryPopup, setShowDeleteCategoryPopup] = useState(false);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [isDeletingCategory, setIsDeletingCategory] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [pendingSwap, setPendingSwap] = useState<{ slotId: string, newPlayer: Player } | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempCategoryName, setTempCategoryName] = useState('');
    const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

    const showNotification = (message: string, type: 'error' | 'success' = 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    };
    const boardRef = useRef<HTMLDivElement>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    useEffect(() => {
        if (!id) return;

        const unsubAuction = db.collection('auctions').doc(id).onSnapshot(snap => {
            if (snap.exists) {
                const data = snap.data();
                setAuctionName(data?.name || data?.title || 'Auction Board');
                setAuctionLogo(data?.logoUrl || '');
            }
        });

        const unsubCategories = db.collection('auctions').doc(id).collection('categories').onSnapshot(snap => {
            const cList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuctionCategory));
            setCategories(cList);
            if (cList.length > 0 && !activeCategory) setActiveCategory(cList[0].id || '');
        });

        const unsubPlayers = db.collection('auctions').doc(id).collection('players').onSnapshot(snap => {
            const pList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
            setPlayers(pList);
        });

        const unsubDrafts = db.collection('auctions').doc(id).collection('arrangementDrafts').onSnapshot(snap => {
            const draftsMap: { [key: string]: any } = {};
            const configMap: { [key: string]: any } = {};
            snap.docs.forEach(doc => {
                draftsMap[doc.id] = doc.data().slots || {};
                configMap[doc.id] = doc.data().config || { rows: 0, cols: 0 };
            });
            setAllSlots(draftsMap);
            setCustomConfig(configMap);
            setLoading(false);
        });

        return () => {
            unsubAuction();
            unsubCategories();
            unsubPlayers();
            unsubDrafts();
        };
    }, [id]);

    useEffect(() => {
        if (!id || !activeCategory) return;
        const currentDraft = allSlots[activeCategory] || {};
        setSlots(currentDraft);
        setHistory([]);
    }, [activeCategory, id, allSlots]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);
        if (!over) return;

        const slotId = over.id as string;
        const activeData = active.data.current as any;

        // Handle All Categories view drop (format catId:slotId)
        if (slotId.includes(':')) {
            const [catId, sId] = slotId.split(':');
            const player = activeData as Player;
            const cat = categories.find(c => c.id === catId);
            if (!cat) return;

            const targetSlot = allSlots[catId]?.[sId];
            if (targetSlot) {
                setPendingSwap({ slotId, newPlayer: player });
                return;
            }

            // Direct assignment for All Categories view
            setIsSaving(true);
            try {
                const targetCategory = categories.find(c => c.id === catId);
                const targetCategoryName = targetCategory?.name || player.category;

                const newCatSlots = { 
                    ...(allSlots[catId] || {}), 
                    [sId]: {
                        playerId: player.id,
                        playerName: player.name,
                        category: targetCategoryName
                    }
                };

                // Update player's category in Firestore to reflect the board they are dropped into
                await db.collection('auctions').doc(id!).collection('players').doc(player.id).update({
                    category: targetCategoryName
                });

                await db.collection('auctions').doc(id!).collection('arrangementDrafts').doc(catId).set({
                    auctionId: id,
                    categoryId: catId,
                    slots: newCatSlots,
                    config: customConfig[catId] || { rows: 0, cols: 0 },
                    updatedAt: Date.now()
                });
                
                // Update local allSlots
                setAllSlots(prev => ({
                    ...prev,
                    [catId]: newCatSlots
                }));
                
                showNotification(`Assigned ${player.name} to ${cat.name}`, "success");
            } catch (err) {
                console.error(err);
            } finally {
                setIsSaving(false);
            }
            return;
        }

        // If dragging from another slot
        if (activeData?.fromSlot) {
            const fromSlotId = activeData.fromSlot;
            if (fromSlotId === slotId) return;

            const newSlots = { ...slots };
            const playerInFromSlot = newSlots[fromSlotId];
            const playerInToSlot = newSlots[slotId];

            setHistory([...history, slots]);

            if (playerInToSlot) {
                // Swap
                newSlots[slotId] = playerInFromSlot;
                newSlots[fromSlotId] = playerInToSlot;
            } else {
                // Move
                newSlots[slotId] = playerInFromSlot;
                delete newSlots[fromSlotId];
            }

            setSlots(newSlots);
            setAllSlots(prev => ({ ...prev, [activeCategory]: newSlots }));
            return;
        }

        const player = activeData as Player;

        // If slot already filled, show inline swap/replace options
        if (slots[slotId]) {
            setPendingSwap({ slotId, newPlayer: player });
            return;
        }

        executeAssign(slotId, player);
    };

    const executeAssign = async (slotId: string, player: Player) => {
        // Check if player already assigned elsewhere
        const existingSlot = Object.entries(slots).find(([_, s]) => s.playerId === player.id);
        
        const newSlots = { ...slots };

        // If player already in a slot, remove from there
        if (existingSlot) {
            delete newSlots[existingSlot[0]];
        }

        setHistory([...history, slots]);
        
        const targetCategory = categories.find(c => c.id === activeCategory);
        const targetCategoryName = targetCategory?.name || player.category;

        newSlots[slotId] = {
            playerId: player.id,
            playerName: player.name,
            category: targetCategoryName
        };

        // Update player's category in Firestore to reflect the board they are dropped into
        await db.collection('auctions').doc(id!).collection('players').doc(player.id).update({
            category: targetCategoryName
        });

        setSlots(newSlots);
        setAllSlots(prev => ({ ...prev, [activeCategory]: newSlots }));
    };

    const handleSwap = async () => {
        if (!pendingSwap || !id) return;
        const { slotId, newPlayer } = pendingSwap;

        // Handle All Categories view swap
        if (slotId.includes(':')) {
            const [catId, sId] = slotId.split(':');
            const catSlots = { ...(allSlots[catId] || {}) };
            
            const targetCategory = categories.find(c => c.id === catId);
            const targetCategoryName = targetCategory?.name || newPlayer.category;

            catSlots[sId] = {
                playerId: newPlayer.id,
                playerName: newPlayer.name,
                category: targetCategoryName
            };

            setIsSaving(true);
            try {
                // Update player's category in Firestore
                await db.collection('auctions').doc(id!).collection('players').doc(newPlayer.id).update({
                    category: targetCategoryName
                });

                await db.collection('auctions').doc(id).collection('arrangementDrafts').doc(catId).update({
                    slots: catSlots,
                    updatedAt: Date.now()
                });
                
                setAllSlots(prev => ({
                    ...prev,
                    [catId]: catSlots
                }));
                
                showNotification("Players swapped successfully", "success");
            } catch (err) {
                console.error(err);
            } finally {
                setIsSaving(false);
                setPendingSwap(null);
            }
            return;
        }

        const oldPlayerSlot = slots[slotId];
        
        // Find if new player was elsewhere
        const existingSlot = Object.entries(slots).find(([_, s]) => s.playerId === newPlayer.id);
        
        const newSlots = { ...slots };
        
        setHistory([...history, slots]);

        const targetCategory = categories.find(c => c.id === activeCategory);
        const targetCategoryName = targetCategory?.name || newPlayer.category;

        if (existingSlot) {
            // Swap: Put old player where new player was
            newSlots[existingSlot[0]] = {
                playerId: oldPlayerSlot.playerId,
                playerName: oldPlayerSlot.playerName,
                category: oldPlayerSlot.category
            };
        }

        // Put new player in target slot
        newSlots[slotId] = {
            playerId: newPlayer.id,
            playerName: newPlayer.name,
            category: targetCategoryName
        };

        // Update player's category in Firestore
        await db.collection('auctions').doc(id!).collection('players').doc(newPlayer.id).update({
            category: targetCategoryName
        });

        setSlots(newSlots);
        setAllSlots(prev => ({ ...prev, [activeCategory]: newSlots }));
        setPendingSwap(null);
    };

    const handleReplace = async () => {
        if (!pendingSwap || !id) return;
        const { slotId, newPlayer } = pendingSwap;

        // Handle All Categories view replace
        if (slotId.includes(':')) {
            const [catId, sId] = slotId.split(':');
            const catSlots = { ...(allSlots[catId] || {}) };
            
            catSlots[sId] = {
                playerId: newPlayer.id,
                playerName: newPlayer.name,
                category: newPlayer.category
            };

            setIsSaving(true);
            try {
                await db.collection('auctions').doc(id).collection('arrangementDrafts').doc(catId).update({
                    slots: catSlots,
                    updatedAt: Date.now()
                });
                
                setAllSlots(prev => ({
                    ...prev,
                    [catId]: catSlots
                }));
                
                showNotification("Player replaced successfully", "success");
            } catch (err) {
                console.error(err);
            } finally {
                setIsSaving(false);
                setPendingSwap(null);
            }
            return;
        }

        executeAssign(pendingSwap.slotId, pendingSwap.newPlayer);
        setPendingSwap(null);
    };

    const handleAction = (action: 'REMOVE' | 'MOVE', slotId: string) => {
        if (action === 'REMOVE') {
            setHistory([...history, slots]);
            const newSlots = { ...slots };
            delete newSlots[slotId];
            setSlots(newSlots);
            setAllSlots(prev => ({ ...prev, [activeCategory]: newSlots }));
        }
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        setSlots(prev);
        setAllSlots(all => ({ ...all, [activeCategory]: prev }));
        setHistory(history.slice(0, -1));
    };

    const handleReset = () => {
        setConfirmAction({
            title: "Clear Assignments",
            message: "Are you sure you want to clear all assignments for this category? This cannot be undone.",
            onConfirm: () => {
                setHistory([...history, slots]);
                setSlots({});
                setAllSlots(all => ({ ...all, [activeCategory]: {} }));
                setConfirmAction(null);
                showNotification("Assignments cleared for current category.", "success");
            }
        });
    };

    const handleSave = async () => {
        if (!id || !activeCategory) return;
        setIsSaving(true);
        try {
            await db.collection('auctions').doc(id).collection('arrangementDrafts').doc(activeCategory).set({
                auctionId: id,
                categoryId: activeCategory,
                slots: slots,
                config: customConfig[activeCategory] || { rows: 0, cols: 0 },
                updatedAt: Date.now()
            });

            // Update local allSlots state
            setAllSlots(prev => ({
                ...prev,
                [activeCategory]: slots
            }));

            // Use a non-blocking notification instead of alert
            const notification = document.createElement('div');
            notification.className = 'fixed bottom-8 right-8 bg-zinc-900 border border-amber-500/50 text-amber-500 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl animate-fade-in z-[200]';
            notification.innerText = 'Draft Saved Successfully';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = async () => {
        if (!exportRef.current) return;
        setIsExporting(true);
        
        // Ensure all images are loaded
        const images = exportRef.current.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        }));

        try {
            const el = exportRef.current;
            // Temporarily make it visible for capture
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
            el.style.position = 'static';
            el.style.left = '0';

            // Small delay to ensure DOM has updated and layout is correct
            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = await html2canvas(el, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#0a0a0a',
                logging: false,
                windowWidth: 1600, // Match the element width
            });

            el.style.opacity = '0';
            el.style.pointerEvents = 'none';

            const link = document.createElement('a');
            link.download = `SM_Sports_Auction_Categories_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
        } catch (err) {
            console.error(err);
        } finally {
            setIsExporting(false);
        }
    };

    const handleAutoFill = () => {
        if (isAllCategories) {
            showNotification("Auto-fill is not available for All Categories view.", "error");
            return;
        }
        const cat = categories.find(c => c.id === activeCategory);
        if (!cat) return;

        const availablePlayers = players.filter(p => 
            p.category === cat.name && 
            !Object.values(slots).some(s => s.playerId === p.id)
        );

        if (availablePlayers.length === 0) return;

        const newSlots = { ...slots };
        const totalRequired = cat.requiredPlayers || 6;
        const rows = Math.ceil(totalRequired / 6);
        const cols = 6;

        let playerIdx = 0;
        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= cols; c++) {
                const slotId = `${cat.name.substring(0, 3).toUpperCase()}${r}_${c}`;
                if (!newSlots[slotId] && playerIdx < availablePlayers.length) {
                    const p = availablePlayers[playerIdx++];
                    newSlots[slotId] = {
                        playerId: p.id,
                        playerName: p.name,
                        category: p.category
                    };
                }
            }
        }

        setHistory([...history, slots]);
        setSlots(newSlots);
        setAllSlots(prev => ({ ...prev, [activeCategory]: newSlots }));
    };

    const filteredPlayers = players.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filterCategory === 'ALL' || p.category === filterCategory;
        return matchesSearch && matchesFilter;
    });

    const currentCategory = categories.find(c => c.id === activeCategory);
    const isAllCategories = activeCategory === 'ALL_CATEGORIES';
    const isAllrounderTable = currentCategory?.name.toLowerCase() === 'allrounder';
    
    const config = customConfig[activeCategory] || { rows: 0, cols: 0 };
    const totalRequired = currentCategory?.requiredPlayers || 6;
    
    // Transpose logic for All Categories
    const rowCount = isAllCategories 
        ? Math.max(6, ...categories.map(cat => {
            const c = customConfig[cat.id || ''] || { rows: 0, cols: 0 };
            const tr = cat.requiredPlayers || 6;
            return c.rows || Math.ceil(tr / 6) * 6; // Use actual slots if possible
          }))
        : (config.rows || (isAllrounderTable ? categories.length : Math.ceil(totalRequired / 6)));
        
    const colCount = isAllCategories ? categories.length : (config.cols || 6);
    const prefix = isAllCategories ? 'ALL' : (currentCategory?.name.substring(0, 3).toUpperCase() || 'CAT');

    const maxCols = Math.max(6, ...categories.map(cat => {
        const config = customConfig[cat.id || ''] || { rows: 0, cols: 0 };
        return config.cols || 6;
    }));

    const addRow = () => {
        setCustomConfig(prev => ({
            ...prev,
            [activeCategory]: {
                rows: rowCount + 1,
                cols: colCount
            }
        }));
    };

    const removeRow = () => {
        if (rowCount <= 1) return;
        setCustomConfig(prev => ({
            ...prev,
            [activeCategory]: {
                rows: rowCount - 1,
                cols: colCount
            }
        }));
    };

    const addCol = () => {
        if (isAllCategories) {
            setIsAddingCategory(true);
            setIsDeletingCategory(false);
            return;
        }
        if (colCount >= 10) return; // Limit columns
        setCustomConfig(prev => ({
            ...prev,
            [activeCategory]: {
                rows: rowCount,
                cols: colCount + 1
            }
        }));
    };

    const removeCol = () => {
        if (isAllCategories) {
            setIsDeletingCategory(true);
            setIsAddingCategory(false);
            return;
        }
        if (colCount <= 1) return;
        setCustomConfig(prev => ({
            ...prev,
            [activeCategory]: {
                rows: rowCount,
                cols: colCount - 1
            }
        }));
    };

    const handleAddCategory = async () => {
        if (!id || !newCategoryName.trim()) return;
        setIsSaving(true);
        try {
            const newCat = {
                name: newCategoryName.trim(),
                requiredPlayers: 6,
                createdAt: Date.now()
            };
            await db.collection('auctions').doc(id).collection('categories').add(newCat);
            setNewCategoryName('');
            setShowAddCategoryPopup(false);
            setIsAddingCategory(false);
            showNotification("Category added successfully", "success");
        } catch (err) {
            console.error(err);
            showNotification("Failed to add category", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCategory = async () => {
        if (!id || !categoryToDelete) {
            showNotification("Please select a category to delete", "error");
            return;
        }
        setConfirmAction({
            title: "Delete Category",
            message: "Are you sure? This will remove all player assignments for this category.",
            onConfirm: async () => {
                setIsSaving(true);
                try {
                    await db.collection('auctions').doc(id).collection('categories').doc(categoryToDelete).delete();
                    // Also delete draft
                    await db.collection('auctions').doc(id).collection('arrangementDrafts').doc(categoryToDelete).delete();
                    
                    setShowDeleteCategoryPopup(false);
                    setIsDeletingCategory(false);
                    setCategoryToDelete(null);
                    showNotification("Category deleted successfully", "success");
                } catch (err) {
                    console.error(err);
                    showNotification("Failed to delete category", "error");
                } finally {
                    setIsSaving(false);
                    setConfirmAction(null);
                }
            }
        });
    };

    const handleUpdateCategoryNameById = async (catId: string, newName: string) => {
        if (!id || !newName.trim()) return;
        const category = categories.find(c => c.id === catId);
        if (!category) return;
        const oldName = category.name;
        if (newName === oldName) {
            setEditingCategoryId(null);
            setIsEditingName(false);
            return;
        }

        setIsSaving(true);
        try {
            const oldPrefix = oldName.substring(0, 3).toUpperCase();
            const newPrefix = newName.substring(0, 3).toUpperCase();

            const batch = db.batch();

            // 1. Update category name in Firestore
            const catRef = db.collection('auctions').doc(id).collection('categories').doc(catId);
            batch.update(catRef, { name: newName });

            // 2. Update all players belonging to this category in the main players collection
            const playersToUpdate = players.filter(p => p.category === oldName);
            playersToUpdate.forEach(p => {
                const pRef = db.collection('auctions').doc(id).collection('players').doc(p.id);
                batch.update(pRef, { category: newName });
            });

            // 3. Update all arrangement drafts to reflect the new category name in slots
            const draftsSnap = await db.collection('auctions').doc(id).collection('arrangementDrafts').get();
            
            draftsSnap.docs.forEach(draftDoc => {
                const draftData = draftDoc.data();
                const draftSlots = draftData.slots || {};
                const draftCategory = categories.find(c => c.id === draftDoc.id);
                const isThisDraftAllRounder = draftCategory?.name.toLowerCase() === 'allrounder';
                
                let changed = false;
                const updatedDraftSlots: { [key: string]: CategoryArrangementSlot } = {};

                Object.entries(draftSlots).forEach(([slotId, slot]: [string, any]) => {
                    let newSlotId = slotId;
                    const newSlot = { ...slot };

                    if (slot.category === oldName) {
                        newSlot.category = newName;
                        changed = true;
                    }

                    if (draftDoc.id === catId && oldPrefix !== newPrefix && !isThisDraftAllRounder) {
                        if (slotId.startsWith(oldPrefix)) {
                            newSlotId = slotId.replace(oldPrefix, newPrefix);
                            changed = true;
                        }
                    }
                    
                    if (isThisDraftAllRounder) {
                        if (slotId.startsWith(oldName + "_")) {
                            newSlotId = slotId.replace(oldName + "_", newName + "_");
                            changed = true;
                        }
                    }

                    updatedDraftSlots[newSlotId] = newSlot;
                });

                if (changed) {
                    batch.update(draftDoc.ref, { slots: updatedDraftSlots });
                }
            });

            await batch.commit();

            // Update local state
            setPlayers(prev => prev.map(p => p.category === oldName ? { ...p, category: newName } : p));
            setCategories(prev => prev.map(c => c.id === catId ? { ...c, name: newName } : c));
            
            // Update allSlots local state
            const newAllSlots = { ...allSlots };
            Object.keys(newAllSlots).forEach(cid => {
                const slots = newAllSlots[cid];
                const updatedSlots: { [key: string]: CategoryArrangementSlot } = {};
                Object.entries(slots).forEach(([sid, s]) => {
                    let newSid = sid;
                    const newS = { ...s };
                    if (s.category === oldName) newS.category = newName;
                    if (cid === catId && oldPrefix !== newPrefix) {
                        if (sid.startsWith(oldPrefix)) newSid = sid.replace(oldPrefix, newPrefix);
                    }
                    updatedSlots[newSid] = newS;
                });
                newAllSlots[cid] = updatedSlots;
            });
            setAllSlots(newAllSlots);
            if (activeCategory === catId) setSlots(newAllSlots[catId]);

            setEditingCategoryId(null);
            setIsEditingName(false);
            showNotification("Category renamed successfully", "success");
        } catch (err) {
            console.error(err);
            showNotification("Failed to rename category", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateCategoryName = async () => {
        if (!activeCategory) return;
        handleUpdateCategoryNameById(activeCategory, tempCategoryName);
    };

    if (loading) return (
        <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-zinc-950' : 'bg-gray-50'}`}>
            <Loader2 className={`w-10 h-10 animate-spin ${isDark ? 'text-accent' : 'text-blue-600'}`} />
        </div>
    );

    return (
        <div className={`min-h-screen font-sans selection:bg-accent/30 selection:text-accent ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-gray-50 text-gray-900'}`}>
            {/* Header */}
            <header className={`border-b sticky top-0 z-50 backdrop-blur-xl ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white/80 border-gray-200'}`}>
                <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate(`/admin/auction/${id}/manage`)}
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700' : 'bg-white border-gray-200 text-gray-400 hover:text-gray-900 hover:bg-gray-50'}`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className={`text-xl font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Category Arrangement</h1>
                            <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-accent' : 'text-blue-600'}`}>Visual Player Board Builder</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleUndo}
                            disabled={history.length === 0}
                            className={`hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest disabled:opacity-30 transition-all ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white' : 'bg-white border-gray-200 text-gray-400 hover:text-gray-900'}`}
                        >
                            <Undo className="w-4 h-4" /> Undo
                        </button>
                        <button 
                            onClick={handleReset}
                            className={`hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all bg-accent border-accent text-zinc-950 shadow-lg shadow-accent/20`}
                        >
                            <RotateCcw className="w-4 h-4" /> Reset
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg bg-accent text-zinc-950 shadow-accent/20`}
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Draft
                        </button>
                        <button 
                            onClick={handleExport}
                            disabled={isExporting}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg bg-accent text-zinc-950 shadow-accent/20`}
                        >
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export PNG
                        </button>
                    </div>
                </div>
            </header>

            <DndContext 
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
                    {/* Left Panel: Player Pool */}
                    <aside className="w-full lg:w-80 flex-shrink-0 space-y-6">
                        <div className={`border rounded-[2rem] p-6 space-y-6 sticky top-28 ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-gray-200 shadow-xl'}`}>
                            <div className="flex items-center justify-between">
                                <h2 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Player Pool</h2>
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-400'}`}>{filteredPlayers.length}</span>
                            </div>

                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
                                    <input 
                                        type="text" 
                                        placeholder="Search Players..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold outline-none transition-all ${isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-accent/50' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500/50'}`}
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Filter Category</label>
                                    <div className="flex flex-wrap gap-2">
                                        <button 
                                            onClick={() => setFilterCategory('ALL')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                                filterCategory === 'ALL' 
                                                ? 'bg-accent text-zinc-950' 
                                                : (isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500')
                                            }`}
                                        >
                                            All
                                        </button>
                                        {categories.map(c => (
                                            <button 
                                                key={c.id}
                                                onClick={() => setFilterCategory(c.name)}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                                    filterCategory === c.name 
                                                    ? 'bg-accent text-zinc-950' 
                                                    : (isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500')
                                                }`}
                                            >
                                                {c.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="h-[calc(100vh-420px)] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                {filteredPlayers.map(player => (
                                    <DraggablePlayer 
                                        key={player.id} 
                                        player={player} 
                                        disabled={Object.values(slots).some(s => s.playerId === player.id)}
                                    />
                                ))}
                                {filteredPlayers.length === 0 && (
                                    <div className="py-12 text-center">
                                        <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>No players found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* Right Panel: Table */}
                    <main className="flex-1 space-y-8">
                        {/* Category Selection: Inline Options */}
                        <div className="space-y-3">
                            <label className={`text-[10px] font-black uppercase tracking-[0.2em] ml-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Select Category Board</label>
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    onClick={() => setActiveCategory('ALL_CATEGORIES')}
                                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                                        activeCategory === 'ALL_CATEGORIES' 
                                        ? 'bg-accent border-accent text-zinc-950 shadow-lg shadow-accent/20' 
                                        : (isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-gray-200 text-gray-500')
                                    }`}
                                >
                                    All Categories
                                </button>
                                {categories.map(cat => (
                                    <button 
                                        key={cat.id}
                                        onClick={() => setActiveCategory(cat.id || '')}
                                        className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                                            activeCategory === cat.id 
                                            ? 'bg-accent border-accent text-zinc-950 shadow-lg shadow-accent/20' 
                                            : (isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-gray-200 text-gray-500')
                                        }`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{isAllCategories ? 'All Categories' : currentCategory?.name} Board</h3>
                                <div className={`h-4 w-[1px] ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`}></div>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                    {Object.keys(slots).length} / {rowCount * colCount} Slots Available
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {isAddingCategory && isAllCategories && (
                                    <div className={`flex items-center gap-2 p-1 rounded-xl border animate-in slide-in-from-right-2 duration-300 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                                        <input 
                                            type="text"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder="New Category..."
                                            className={`bg-transparent px-3 py-1 text-[10px] font-bold outline-none w-32 ${isDark ? 'text-white' : 'text-gray-900'}`}
                                            autoFocus
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleAddCategory();
                                                if (e.key === 'Escape') setIsAddingCategory(false);
                                            }}
                                        />
                                        <button onClick={handleAddCategory} className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg"><Check className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => setIsAddingCategory(false)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                )}
                                {isDeletingCategory && isAllCategories && (
                                    <div className={`flex items-center gap-2 p-1 rounded-xl border animate-in slide-in-from-right-2 duration-300 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                                        <select 
                                            value={categoryToDelete || ''}
                                            onChange={(e) => setCategoryToDelete(e.target.value)}
                                            className={`bg-transparent px-3 py-1 text-[10px] font-bold outline-none w-32 ${isDark ? 'text-white' : 'text-gray-900'}`}
                                        >
                                            <option value="" className={isDark ? 'bg-zinc-900' : 'bg-white'}>Select...</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id} className={isDark ? 'bg-zinc-900' : 'bg-white'}>{cat.name}</option>
                                            ))}
                                        </select>
                                        <button onClick={handleDeleteCategory} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => setIsDeletingCategory(false)} className="p-1.5 text-gray-500 hover:bg-gray-500/10 rounded-lg"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                )}
                                <div className={`flex border rounded-xl overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                                    <button 
                                        onClick={addRow}
                                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r ${isDark ? 'text-zinc-400 hover:text-accent hover:bg-zinc-800 border-zinc-800' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50 border-gray-200'}`}
                                        title="Add Row"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={removeRow}
                                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${isDark ? 'text-zinc-400 hover:text-red-500 hover:bg-zinc-800' : 'text-gray-500 hover:text-red-600 hover:bg-gray-50'}`}
                                        title="Remove Row"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className={`flex border rounded-xl overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                                    <button 
                                        onClick={addCol}
                                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r ${isDark ? 'text-zinc-400 hover:text-accent hover:bg-zinc-800 border-zinc-800' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50 border-gray-200'}`}
                                        title="Add Column"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={removeCol}
                                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${isDark ? 'text-zinc-400 hover:text-red-500 hover:bg-zinc-800' : 'text-gray-500 hover:text-red-600 hover:bg-gray-50'}`}
                                        title="Remove Column"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <button 
                                    onClick={handleAutoFill}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-accent hover:border-accent/30' : 'bg-white border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-500/30'}`}
                                >
                                    <Shuffle className="w-3.5 h-3.5" /> Auto Fill
                                </button>
                            </div>
                        </div>

                        {/* The Board */}
                        <div className="relative">
                            <div 
                                ref={boardRef}
                                className={`border-4 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden ${isDark ? 'bg-zinc-950 border-accent/20' : 'bg-white border-blue-500/20'}`}
                                style={{
                                    backgroundImage: isDark 
                                        ? 'radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.08) 0%, transparent 70%)'
                                        : 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 70%)'
                                }}
                            >
                                {/* Board Branding */}
                                <div className="text-center mb-10 space-y-2">
                                    <h2 className={`text-5xl font-black uppercase tracking-tighter italic drop-shadow-[0_0_15px_rgba(245,158,11,0.3)] ${isDark ? 'text-transparent bg-clip-text bg-gradient-to-b from-accent/50 via-accent to-accent/70' : 'text-blue-600'}`}>
                                        {auctionName}
                                    </h2>
                                    <div className="flex items-center justify-center gap-4">
                                        <div className={`h-[1px] w-20 bg-gradient-to-r from-transparent via-accent/50 to-transparent`}></div>
                                        {isEditingName ? (
                                            <div className="flex items-center gap-2 animate-fade-in">
                                                <input 
                                                    type="text"
                                                    value={tempCategoryName}
                                                    onChange={(e) => setTempCategoryName(e.target.value)}
                                                    className={`border rounded-lg px-3 py-1 text-sm font-black uppercase tracking-widest outline-none focus:ring-2 ${isDark ? 'bg-zinc-900 border-accent/50 text-accent ring-accent/20' : 'bg-white border-blue-500/50 text-blue-600 ring-blue-500/20'}`}
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleUpdateCategoryName();
                                                        if (e.key === 'Escape') setIsEditingName(false);
                                                    }}
                                                />
                                                <button 
                                                    onClick={handleUpdateCategoryName}
                                                    className={`p-1.5 rounded-lg transition-all ${isDark ? 'bg-accent text-zinc-950 hover:bg-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => setIsEditingName(false)}
                                                    className={`p-1.5 rounded-lg transition-all ${isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => {
                                                    setTempCategoryName(currentCategory?.name || '');
                                                    setIsEditingName(true);
                                                }}
                                                className={`group flex items-center gap-3 px-4 py-1 rounded-full transition-all ${isDark ? 'hover:bg-accent/10' : 'hover:bg-blue-50'}`}
                                            >
                                                <p className={`text-[14px] font-black uppercase tracking-[0.5em] ${isDark ? 'text-accent' : 'text-blue-600'}`}>{isAllCategories ? 'All Categories Master Board' : currentCategory?.name}</p>
                                                <Pencil className={`w-3 h-3 transition-all ${isDark ? 'text-accent/30 group-hover:text-accent' : 'text-blue-300 group-hover:text-blue-600'}`} />
                                            </button>
                                        )}
                                        <div className={`h-[1px] w-20 bg-gradient-to-r from-transparent via-accent/50 to-transparent`}></div>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className={`overflow-x-auto rounded-3xl border-2 backdrop-blur-sm shadow-[0_0_50px_rgba(0,0,0,0.5)] ${isDark ? 'border-accent/30 bg-zinc-950/50' : 'border-blue-100 bg-white/50'}`}>
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className={`w-24 p-5 border text-[14px] font-black uppercase tracking-widest shine-effect ${isDark ? 'bg-zinc-900/90 border-accent/20' : 'bg-gray-50 border-blue-100'}`}>
                                                    <span className="golden-text">{isAllCategories ? 'SLOT #' : (isAllrounderTable ? 'CATEGORY' : '#')}</span>
                                                </th>
                                                {isAllCategories ? (
                                                    categories.map((cat) => (
                                                        <th key={cat.id} className={`p-5 border text-[14px] font-black uppercase tracking-widest shine-effect ${isDark ? 'bg-zinc-900/90 border-accent/20' : 'bg-gray-50 border-blue-100'}`}>
                                                            {editingCategoryId === cat.id ? (
                                                                <div className="flex items-center gap-2">
                                                                    <input 
                                                                        type="text"
                                                                        value={tempCategoryName}
                                                                        onChange={e => setTempCategoryName(e.target.value)}
                                                                        className="bg-transparent border-b border-accent text-accent outline-none w-24 text-center"
                                                                        autoFocus
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') {
                                                                                // We need a version of handleUpdateCategoryName that takes a category ID
                                                                                handleUpdateCategoryNameById(cat.id || '', tempCategoryName);
                                                                            }
                                                                            if (e.key === 'Escape') setEditingCategoryId(null);
                                                                        }}
                                                                    />
                                                                    <button onClick={() => handleUpdateCategoryNameById(cat.id || '', tempCategoryName)} className="text-green-500"><Check className="w-4 h-4" /></button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-center gap-2 group">
                                                                    <span className="golden-text">{cat.name}</span>
                                                                    <button 
                                                                        onClick={() => {
                                                                            setEditingCategoryId(cat.id || '');
                                                                            setTempCategoryName(cat.name);
                                                                        }}
                                                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >
                                                                        <Pencil className={`w-3 h-3 ${isDark ? 'text-accent' : 'text-blue-600'}`} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </th>
                                                    ))
                                                ) : (
                                                    Array.from({ length: colCount }).map((_, cIdx) => (
                                                        <th key={cIdx + 1} className={`p-5 border text-[14px] font-black uppercase tracking-widest shine-effect ${isDark ? 'bg-zinc-900/90 border-accent/20' : 'bg-gray-50 border-blue-100'}`}>
                                                            <span className="golden-text">{cIdx + 1}</span>
                                                        </th>
                                                    ))
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Array.from({ length: rowCount }).map((_, rIdx) => {
                                                const rowNum = rIdx + 1;
                                                const rowLabel = isAllCategories ? `${rowNum}` : (isAllrounderTable ? (categories[rIdx]?.name || `EXTRA_${rowNum}`) : `${prefix}${rowNum}`);
                                                return (
                                                    <tr key={rowLabel}>
                                                        <td className={`p-5 border text-center text-[12px] font-black uppercase tracking-widest whitespace-nowrap shine-effect ${isDark ? 'bg-zinc-900/60 border-accent/20' : 'bg-gray-50/50 border-blue-50'}`}>
                                                            <div className="flex items-center justify-center gap-2 golden-text">
                                                                {rowLabel}
                                                                {!isAllCategories && isAllrounderTable && (
                                                                    <button 
                                                                        onClick={() => {
                                                                            const cat = categories[rIdx];
                                                                            if (cat) {
                                                                                setActiveCategory(cat.id || '');
                                                                                setTempCategoryName(cat.name);
                                                                                setIsEditingName(true);
                                                                            }
                                                                        }}
                                                                        className={`p-1 rounded transition-all group ${isDark ? 'bg-accent/20' : 'bg-blue-100'}`}
                                                                    >
                                                                        <Pencil className={`w-2.5 h-2.5 transition-all ${isDark ? 'text-accent' : 'text-blue-600'}`} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {isAllCategories ? (
                                                            categories.map((cat) => {
                                                                const catPrefix = cat.name.substring(0, 3).toUpperCase();
                                                                const catConfig = customConfig[cat.id || ''] || { rows: 0, cols: 0 };
                                                                const catTotalReq = cat.requiredPlayers || 6;
                                                                const catCols = catConfig.cols || 6;
                                                                
                                                                // In All Categories view, we map slot index to actual slot ID
                                                                // Slot 1 -> CAT1_1, Slot 2 -> CAT1_2 ... Slot 7 -> CAT2_1 (if 6 cols)
                                                                const r = Math.ceil(rowNum / catCols);
                                                                const c = ((rowNum - 1) % catCols) + 1;
                                                                const slotId = `${catPrefix}${r}_${c}`;
                                                                const catSlots = allSlots[cat.id || ''] || {};
                                                                const player = catSlots[slotId];

                                                                return (
                                                                    <td key={`${cat.id}-${slotId}`} className={`p-0 border min-w-[160px] relative ${isDark ? 'border-accent/20' : 'border-blue-50'}`}>
                                                                        <DroppableSlot 
                                                                            id={`${cat.id}:${slotId}`} 
                                                                            player={player}
                                                                            onAction={handleAction}
                                                                            index={rowNum}
                                                                        />
                                                                    </td>
                                                                );
                                                            })
                                                        ) : (
                                                            Array.from({ length: colCount }).map((_, cIdx) => {
                                                                const col = cIdx + 1;
                                                                const slotId = `${rowLabel}_${col}`;
                                                                const isTarget = pendingSwap?.slotId === slotId;
                                                                const globalIndex = (rIdx * colCount) + cIdx;
                                                                return (
                                                                    <td key={slotId} className={`p-0 border min-w-[160px] relative ${isDark ? 'border-accent/20' : 'border-blue-50'}`}>
                                                                        <DroppableSlot 
                                                                            id={slotId} 
                                                                            player={slots[slotId]}
                                                                            onAction={handleAction}
                                                                            index={globalIndex}
                                                                        />
                                                                        {isTarget && (
                                                                            <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-2 animate-fade-in ${isDark ? 'bg-zinc-950/95' : 'bg-white/95'}`}>
                                                                                <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-accent' : 'text-blue-600'}`}>Slot Occupied</p>
                                                                                <div className="flex gap-2 w-full">
                                                                                    <button 
                                                                                        onClick={handleSwap}
                                                                                        className={`flex-1 text-[8px] font-black uppercase py-1.5 rounded-lg transition-colors ${isDark ? 'bg-accent text-zinc-950 hover:bg-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                                                                    >
                                                                                        Swap
                                                                                    </button>
                                                                                    <button 
                                                                                        onClick={handleReplace}
                                                                                        className={`flex-1 text-[8px] font-black uppercase py-1.5 rounded-lg transition-colors ${isDark ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                                                                                    >
                                                                                        Replace
                                                                                    </button>
                                                                                </div>
                                                                                <button 
                                                                                    onClick={() => setPendingSwap(null)}
                                                                                    className={`text-[7px] font-bold uppercase ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}`}
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer Branding */}
                                <div className="mt-12 flex items-center justify-between px-4">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-accent' : 'text-blue-600'}`}>{auctionName}</p>
                                            <p className={`text-[8px] font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Official Tournament Board</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-[10px] font-black uppercase tracking-widest italic ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Official Category Board</p>
                                        <p className={`text-[8px] font-bold uppercase tracking-widest mt-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Generated: {new Date().toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>

                {/* Drag Overlay */}
                <DragOverlay dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                        styles: {
                            active: {
                                opacity: '0.5',
                            },
                        },
                    }),
                }}>
                    {activeDragId ? (
                        <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-2xl scale-105 rotate-2 ${isDark ? 'bg-accent border-accent/50 text-zinc-950' : 'bg-blue-600 border-blue-500 text-white'}`}>
                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-zinc-950/20' : 'bg-white/20'}`}>
                                <User className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-tight truncate">
                                    {players.find(p => `player-${p.id}` === activeDragId)?.name}
                                </p>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Hidden Export Board */}
            <div 
                ref={exportRef} 
                className="fixed left-[-9999px] top-0 w-[1600px] bg-zinc-950 p-20 opacity-0 pointer-events-none z-[-1]"
                style={{
                    backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.1) 0%, transparent 80%)'
                }}
            >
                {/* Header Branding */}
                <div className="flex flex-col items-center mb-12 border-b-4 border-amber-500/30 pb-10">
                    <div className="flex items-center gap-8">
                        {auctionLogo && (
                            <img src={auctionLogo} className="w-32 h-32 rounded-3xl object-contain bg-zinc-900 border-2 border-amber-500/30 p-3 shadow-2xl shadow-amber-500/20" referrerPolicy="no-referrer" />
                        )}
                        <div className="text-center">
                            <h2 className="text-8xl font-black text-white uppercase tracking-tighter leading-[0.8] mb-4">{auctionName}</h2>
                            <p className="text-amber-500 font-black tracking-[0.6em] text-2xl uppercase opacity-80">OFFICIAL CATEGORY BOARD</p>
                        </div>
                        {auctionLogo && (
                            <img src={auctionLogo} className="w-32 h-32 rounded-3xl object-contain bg-zinc-900 border-2 border-amber-500/30 p-3 shadow-2xl shadow-amber-500/20 opacity-0" referrerPolicy="no-referrer" />
                        )}
                    </div>
                </div>

                <div className="w-full space-y-8">
                    <div className="text-center">
                            <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-500 to-amber-700 uppercase tracking-tighter italic drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                                {isAllCategories ? 'ALL CATEGORIES' : currentCategory?.name}
                            </h2>
                        </div>

                        <div className="rounded-[3rem] border-4 border-amber-500/40 bg-zinc-950 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative">
                            {/* Golden Glow Overlay */}
                            <div className="absolute inset-0 pointer-events-none border-[12px] border-amber-500/10 rounded-[3rem]"></div>
                            
                            <table className="w-full border-collapse relative z-10">
                                <thead>
                                    <tr className="bg-zinc-900/90">
                                        <th className="w-32 p-6 border border-amber-500/20 text-xl font-black text-amber-500 uppercase tracking-widest bg-gradient-to-b from-zinc-800 to-zinc-900">#</th>
                                        {isAllCategories ? (
                                            categories.map(cat => (
                                                <th key={cat.id} className="p-6 border border-amber-500/20 text-xl font-black text-amber-500 uppercase tracking-widest bg-gradient-to-b from-zinc-800 to-zinc-900">{cat.name}</th>
                                            ))
                                        ) : (
                                            Array.from({ length: colCount }).map((_, c) => (
                                                <th key={c} className="p-6 border border-amber-500/20 text-xl font-black text-amber-500 uppercase tracking-widest bg-gradient-to-b from-zinc-800 to-zinc-900">{c + 1}</th>
                                            ))
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({ length: rowCount }).map((_, rIdx) => {
                                        const rowNum = rIdx + 1;
                                        const rowLabel = isAllCategories ? `${rowNum}` : (isAllrounderTable ? (categories[rIdx]?.name || `EXTRA_${rowNum}`) : `${prefix}${rowNum}`);
                                        return (
                                            <tr key={rowLabel} className="hover:bg-amber-500/5 transition-colors">
                                                <td className="p-6 border border-amber-500/20 bg-zinc-900/40 text-center text-sm font-black text-amber-200 uppercase tracking-widest whitespace-nowrap">
                                                    {rowLabel}
                                                </td>
                                                {isAllCategories ? (
                                                    categories.map((cat) => {
                                                        const catPrefix = cat.name.substring(0, 3).toUpperCase();
                                                        const catConfig = customConfig[cat.id || ''] || { rows: 0, cols: 0 };
                                                        const catCols = catConfig.cols || 6;
                                                        const r = Math.ceil(rowNum / catCols);
                                                        const c = ((rowNum - 1) % catCols) + 1;
                                                        const slotId = `${catPrefix}${r}_${c}`;
                                                        const catSlots = allSlots[cat.id || ''] || {};
                                                        const player = catSlots[slotId];

                                                        return (
                                                            <td key={`${cat.id}-${slotId}`} className="p-4 border border-amber-500/20 min-w-[240px] relative">
                                                                {player ? (
                                                                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900/80 border border-amber-500/20 shadow-lg">
                                                                        <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
                                                                            <User className="w-7 h-7 text-zinc-600" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="text-lg font-black text-zinc-100 uppercase leading-tight whitespace-normal break-words">{player.playerName}</p>
                                                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{player.category}</p>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-16 flex items-center justify-center opacity-10">
                                                                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })
                                                ) : (
                                                    Array.from({ length: colCount }).map((_, cIdx) => {
                                                        const col = cIdx + 1;
                                                        const slotId = `${rowLabel}_${col}`;
                                                        const slot = slots[slotId];
                                                        const globalIndex = (rIdx * colCount) + cIdx;

                                                        return (
                                                            <td key={slotId} className="p-4 border border-amber-500/20 min-w-[240px] relative">
                                                                <div className="absolute top-1 left-1 text-[8px] font-black text-zinc-800 uppercase tracking-widest opacity-50">#{globalIndex + 1}</div>
                                                                {slot ? (
                                                                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900/80 border border-amber-500/20 shadow-lg">
                                                                        <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
                                                                            <User className="w-7 h-7 text-zinc-600" />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="text-lg font-black text-zinc-100 uppercase leading-tight whitespace-normal break-words">{slot.playerName}</p>
                                                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{slot.category}</p>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-16 flex items-center justify-center opacity-10">
                                                                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                {/* Footer Branding */}
                <div className="mt-20 pt-10 border-t-4 border-amber-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/40 border-4 border-white/20">
                            <Trophy className="w-14 h-14 text-zinc-950" />
                        </div>
                        <div>
                            <p className="text-5xl font-black text-white uppercase tracking-tighter leading-none mb-2">SM SPORTS</p>
                            <p className="text-lg font-black text-amber-500 uppercase tracking-[0.4em] opacity-80">OFFICIAL TOURNAMENT PARTNER</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-4xl font-black text-zinc-400 uppercase tracking-widest italic opacity-50">OFFICIAL CATEGORY BOARD</p>
                        <p className="text-lg font-black text-zinc-600 uppercase tracking-widest mt-2">
                            GENERATED: {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString()}
                        </p>
                    </div>
                </div>
            </div>


            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #27272a;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #3f3f46;
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
            `}</style>

            {/* NOTIFICATION BANNER */}
            {notification && (
                <div className={`fixed top-4 right-4 z-[300] p-4 rounded-lg shadow-2xl border flex items-center gap-3 max-w-md animate-in fade-in slide-in-from-top-4 duration-300 ${
                    notification.type === 'error' 
                    ? (isDark ? 'bg-red-900/90 border-red-500 text-white' : 'bg-red-50 border-red-200 text-red-900') 
                    : (isDark ? 'bg-green-900/90 border-green-500 text-white' : 'bg-green-50 border-green-200 text-green-900')
                }`}>
                    {notification.type === 'error' ? <XCircle className="w-5 h-5 text-red-400" /> : <CheckCircle className="w-5 h-5 text-green-400" />}
                    <span className="text-sm font-bold">{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="ml-auto hover:opacity-70"><X className="w-4 h-4"/></button>
                </div>
            )}

            {/* CUSTOM CONFIRMATION MODAL */}
            {confirmAction && (
                <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className={`rounded-3xl p-8 max-w-sm w-full shadow-2xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100'}`}>
                        <div className={`flex items-center gap-4 mb-6 ${isDark ? 'text-accent' : 'text-blue-600'}`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-accent/10' : 'bg-blue-50'}`}>
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <h3 className={`text-xl font-black uppercase tracking-tighter ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{confirmAction.title}</h3>
                        </div>
                        <p className={`text-sm font-bold mb-8 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{confirmAction.message}</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmAction(null)}
                                className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmAction.onConfirm}
                                className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg ${isDark ? 'bg-accent hover:bg-white text-zinc-950 shadow-accent/20' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'}`}
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

export default CategoryArrangement;
