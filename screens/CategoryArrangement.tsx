
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
    Plus
} from 'lucide-react';
import { db } from '../firebase';
import { Player, AuctionCategory, CategoryArrangementDraft, CategoryArrangementSlot } from '../types';
import html2canvas from 'html2canvas';

// --- Components ---

interface DraggablePlayerProps {
    player: Player;
    disabled?: boolean;
}

const DraggablePlayer: React.FC<DraggablePlayerProps> = ({ player, disabled }) => {
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
                ? 'bg-zinc-900/50 border-zinc-800/50 opacity-40 grayscale pointer-events-none' 
                : 'bg-zinc-900 border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-800 shadow-sm'
            }`}
        >
            <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                    <User className="w-5 h-5 text-zinc-500" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-zinc-100 truncate group-hover:text-amber-400 transition-colors">{player.name}</p>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{player.category} • {player.role}</p>
            </div>
        </div>
    );
};

interface DroppableSlotProps {
    id: string;
    player?: CategoryArrangementSlot;
    onAction: (action: 'REMOVE' | 'MOVE', slotId: string) => void;
    isOver?: boolean;
    index: number;
}

const DroppableSlot: React.FC<DroppableSlotProps> = ({ id, player, onAction, isOver, index }) => {
    const { setNodeRef: setDropRef } = useDroppable({
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
            className={`relative h-16 w-full border transition-all flex items-center justify-center group overflow-hidden ${
                isOver ? 'bg-amber-500/30 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] z-10 scale-[1.02]' : 'bg-zinc-900/40 border-zinc-800/50'
            } ${player ? 'border-amber-500/40 bg-zinc-900/60' : 'border-dashed'}`}
        >
            {/* Slot Number */}
            <div className="absolute top-1 left-1 text-[8px] font-black text-zinc-700 uppercase tracking-widest pointer-events-none z-0">
                #{index}
            </div>

            {player ? (
                <div 
                    ref={setDragRef}
                    style={style}
                    {...listeners}
                    {...attributes}
                    className="w-full h-full p-1.5 flex items-center gap-2 relative z-10 cursor-grab active:cursor-grabbing"
                >
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        <User className="w-4 h-4 text-zinc-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-amber-100 leading-tight uppercase tracking-tight truncate">{player.playerName}</p>
                        <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest truncate">{player.category}</p>
                    </div>
                    
                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-zinc-950/95 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-3 backdrop-blur-sm pointer-events-none group-hover:pointer-events-auto">
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
                    <div className="w-1 h-1 rounded-full bg-amber-500"></div>
                </div>
            )}
            
            {/* Slot ID Indicator */}
            <div className="absolute bottom-0.5 right-1 text-[6px] font-black text-zinc-800 uppercase tracking-widest pointer-events-none">
                {id.split('_')[0]}
            </div>
        </div>
    );
};

// --- Main Screen ---

const CategoryArrangement: React.FC = () => {
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
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [pendingSwap, setPendingSwap] = useState<{ slotId: string, newPlayer: Player } | null>(null);
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
        const fetchData = async () => {
            try {
                const [auctionSnap, playersSnap, catsSnap] = await Promise.all([
                    db.collection('auctions').doc(id).get(),
                    db.collection('auctions').doc(id).collection('players').get(),
                    db.collection('auctions').doc(id).collection('categories').get()
                ]);

                if (auctionSnap.exists) {
                    const data = auctionSnap.data();
                    setAuctionName(data?.name || data?.title || 'SM SPORTS');
                    setAuctionLogo(data?.logoUrl || '');
                }

                const pList = playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
                const cList = catsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuctionCategory));

                setPlayers(pList);
                setCategories(cList);
                if (cList.length > 0) setActiveCategory(cList[0].id || '');

                // Fetch all drafts
                const draftsSnap = await db.collection('auctions').doc(id).collection('arrangementDrafts').get();
                const draftsMap: { [key: string]: any } = {};
                const configMap: { [key: string]: any } = {};
                draftsSnap.docs.forEach(doc => {
                    draftsMap[doc.id] = doc.data().slots || {};
                    configMap[doc.id] = doc.data().config || { rows: 0, cols: 0 };
                });
                setAllSlots(draftsMap);
                setCustomConfig(configMap);

                setLoading(false);
            } catch (err) {
                console.error(err);
                setLoading(false);
            }
        };
        fetchData();
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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);
        if (!over) return;

        const slotId = over.id as string;
        const activeData = active.data.current as any;

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

    const executeAssign = (slotId: string, player: Player) => {
        // Check if player already assigned elsewhere
        const existingSlot = Object.entries(slots).find(([_, s]) => s.playerId === player.id);
        
        const newSlots = { ...slots };

        // If player already in a slot, remove from there
        if (existingSlot) {
            delete newSlots[existingSlot[0]];
        }

        setHistory([...history, slots]);
        newSlots[slotId] = {
            playerId: player.id,
            playerName: player.name,
            category: player.category
        };

        setSlots(newSlots);
        setAllSlots(prev => ({ ...prev, [activeCategory]: newSlots }));
    };

    const handleSwap = () => {
        if (!pendingSwap) return;
        const { slotId, newPlayer } = pendingSwap;
        const oldPlayerSlot = slots[slotId];
        
        // Find if new player was elsewhere
        const existingSlot = Object.entries(slots).find(([_, s]) => s.playerId === newPlayer.id);
        
        const newSlots = { ...slots };
        
        setHistory([...history, slots]);

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
            category: newPlayer.category
        };

        setSlots(newSlots);
        setAllSlots(prev => ({ ...prev, [activeCategory]: newSlots }));
        setPendingSwap(null);
    };

    const handleReplace = () => {
        if (!pendingSwap) return;
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
        if (window.confirm("Clear all assignments for this category?")) {
            setHistory([...history, slots]);
            setSlots({});
            setAllSlots(all => ({ ...all, [activeCategory]: {} }));
        }
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
    const isAllrounderTable = currentCategory?.name.toLowerCase() === 'allrounder';
    
    const config = customConfig[activeCategory] || { rows: 0, cols: 0 };
    const totalRequired = currentCategory?.requiredPlayers || 6;
    const rowCount = config.rows || (isAllrounderTable ? categories.length : Math.ceil(totalRequired / 6));
    const colCount = config.cols || 6;
    const prefix = currentCategory?.name.substring(0, 3).toUpperCase() || 'CAT';

    const addRow = () => {
        setCustomConfig(prev => ({
            ...prev,
            [activeCategory]: {
                rows: rowCount + 1,
                cols: colCount
            }
        }));
    };

    const addCol = () => {
        if (colCount >= 10) return; // Limit columns
        setCustomConfig(prev => ({
            ...prev,
            [activeCategory]: {
                rows: rowCount,
                cols: colCount + 1
            }
        }));
    };

    if (loading) return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500/30 selection:text-amber-200">
            {/* Header */}
            <header className="bg-zinc-900/50 border-b border-zinc-800 sticky top-0 z-50 backdrop-blur-xl">
                <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate(`/admin/auction/${id}/manage`)}
                            className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all active:scale-95"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-white">Category Arrangement</h1>
                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Visual Player Board Builder</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleUndo}
                            disabled={history.length === 0}
                            className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
                        >
                            <Undo className="w-4 h-4" /> Undo
                        </button>
                        <button 
                            onClick={handleReset}
                            className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-red-400 transition-all"
                        >
                            <RotateCcw className="w-4 h-4" /> Reset
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-100 text-zinc-900 text-xs font-black uppercase tracking-widest hover:bg-white transition-all active:scale-95 shadow-lg shadow-white/5"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Draft
                        </button>
                        <button 
                            onClick={handleExport}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition-all active:scale-95 shadow-lg shadow-amber-500/20"
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
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-6 space-y-6 sticky top-28">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Player Pool</h2>
                                <span className="px-2 py-1 bg-zinc-800 rounded-lg text-[10px] font-black text-zinc-500">{filteredPlayers.length}</span>
                            </div>

                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                    <input 
                                        type="text" 
                                        placeholder="Search Players..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-zinc-100 focus:border-amber-500/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Filter Category</label>
                                    <div className="flex flex-wrap gap-2">
                                        <button 
                                            onClick={() => setFilterCategory('ALL')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterCategory === 'ALL' ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                                        >
                                            All
                                        </button>
                                        {categories.map(c => (
                                            <button 
                                                key={c.id}
                                                onClick={() => setFilterCategory(c.name)}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterCategory === c.name ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
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
                                        <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">No players found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* Right Panel: Table */}
                    <main className="flex-1 space-y-8">
                        {/* Category Tabs - Inline Options */}
                        <div className="flex flex-wrap gap-2 bg-zinc-900/30 p-2 rounded-[2rem] border border-zinc-800/50">
                            {categories.map(cat => (
                                <button 
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id || '')}
                                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                        activeCategory === cat.id 
                                        ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 scale-105' 
                                        : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <h3 className="text-lg font-black uppercase tracking-tight text-white">{currentCategory?.name} Board</h3>
                                <div className="h-4 w-[1px] bg-zinc-800"></div>
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                    {Object.keys(slots).length} / {rowCount * colCount} Slots Available
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={addRow}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-500 hover:border-amber-500/30 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Row
                                </button>
                                <button 
                                    onClick={addCol}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-500 hover:border-amber-500/30 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Column
                                </button>
                                <button 
                                    onClick={handleAutoFill}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-500 hover:border-amber-500/30 transition-all"
                                >
                                    <Shuffle className="w-3.5 h-3.5" /> Auto Fill
                                </button>
                            </div>
                        </div>

                        {/* The Board */}
                        <div className="relative">
                            <div 
                                ref={boardRef}
                                className="bg-zinc-950 border-4 border-amber-500/20 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden"
                                style={{
                                    backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.08) 0%, transparent 70%)'
                                }}
                            >
                                {/* Board Branding */}
                                <div className="text-center mb-10 space-y-2">
                                    <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-500 to-amber-700 uppercase tracking-tighter italic drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                                        AUCTION BOARD
                                    </h2>
                                    <div className="flex items-center justify-center gap-4">
                                        <div className="h-[1px] w-20 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
                                        <p className="text-[14px] font-black text-amber-500 uppercase tracking-[0.5em]">{currentCategory?.name}</p>
                                        <div className="h-[1px] w-20 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="overflow-x-auto rounded-3xl border-2 border-amber-500/30 bg-zinc-950/50 backdrop-blur-sm shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="w-24 p-5 bg-zinc-900/90 border border-amber-500/20 text-[12px] font-black text-amber-500 uppercase tracking-widest">
                                                    {isAllrounderTable ? 'CATEGORY' : '#'}
                                                </th>
                                                {Array.from({ length: colCount }).map((_, cIdx) => (
                                                    <th key={cIdx + 1} className="p-5 bg-zinc-900/90 border border-amber-500/20 text-[12px] font-black text-amber-500 uppercase tracking-widest">
                                                        {cIdx + 1}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Array.from({ length: rowCount }).map((_, rIdx) => {
                                                const rowNum = rIdx + 1;
                                                const rowLabel = isAllrounderTable ? categories[rIdx].name : `${prefix}${rowNum}`;
                                                return (
                                                    <tr key={rowLabel}>
                                                        <td className="p-5 bg-zinc-900/60 border border-amber-500/20 text-center text-[10px] font-black text-amber-200 uppercase tracking-widest whitespace-nowrap">
                                                            {rowLabel}
                                                        </td>
                                                        {Array.from({ length: colCount }).map((_, cIdx) => {
                                                            const col = cIdx + 1;
                                                            const slotId = `${rowLabel}_${col}`;
                                                            const isTarget = pendingSwap?.slotId === slotId;
                                                            const globalIndex = (rIdx * colCount) + col;
                                                            return (
                                                                <td key={slotId} className="p-0 border border-amber-500/20 min-w-[160px] relative">
                                                                    <DroppableSlot 
                                                                        id={slotId} 
                                                                        player={slots[slotId]}
                                                                        onAction={handleAction}
                                                                        isOver={activeDragId !== null}
                                                                        index={globalIndex}
                                                                    />
                                                                    {isTarget && (
                                                                        <div className="absolute inset-0 z-20 bg-zinc-950/95 flex flex-col items-center justify-center gap-2 p-2 animate-fade-in">
                                                                            <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-1">Slot Occupied</p>
                                                                            <div className="flex gap-2 w-full">
                                                                                <button 
                                                                                    onClick={handleSwap}
                                                                                    className="flex-1 bg-amber-500 text-zinc-950 text-[8px] font-black uppercase py-1.5 rounded-lg hover:bg-amber-400 transition-colors"
                                                                                >
                                                                                    Swap
                                                                                </button>
                                                                                <button 
                                                                                    onClick={handleReplace}
                                                                                    className="flex-1 bg-zinc-800 text-white text-[8px] font-black uppercase py-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
                                                                                >
                                                                                    Replace
                                                                                </button>
                                                                            </div>
                                                                            <button 
                                                                                onClick={() => setPendingSwap(null)}
                                                                                className="text-[7px] font-bold text-zinc-500 uppercase hover:text-zinc-300"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer Branding */}
                                <div className="mt-12 flex items-center justify-between px-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-zinc-950 font-black text-sm shadow-lg shadow-amber-500/20">SM</div>
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-500">SM SPORTS</p>
                                            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Premium Tournament Management</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic">Official Category Board</p>
                                        <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-1">Generated: {new Date().toLocaleDateString()}</p>
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
                        <div className="flex items-center gap-3 p-3 rounded-xl border bg-amber-500 border-amber-400 text-zinc-950 shadow-2xl scale-105 rotate-2">
                             <div className="w-8 h-8 rounded-lg bg-zinc-950/20 flex items-center justify-center">
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
                className="fixed left-[-9999px] top-0 w-[1600px] bg-zinc-950 p-12 opacity-0 pointer-events-none z-[-1]"
                style={{
                    backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.1) 0%, transparent 80%)'
                }}
            >
                {/* Header Branding */}
                <div className="flex items-center justify-between mb-12 border-b-4 border-amber-500/30 pb-10">
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 rounded-[2rem] bg-amber-500 flex items-center justify-center text-zinc-950 font-black text-4xl shadow-[0_0_50px_rgba(245,158,11,0.4)]">
                            SM
                        </div>
                        <div>
                            <h1 className="text-6xl font-black text-white uppercase tracking-tighter leading-none">SM SPORTS</h1>
                            <p className="text-xl font-black text-amber-500 uppercase tracking-[0.5em] mt-2">PREMIUM TOURNAMENT MANAGEMENT</p>
                        </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end gap-2">
                        <div className="flex items-center gap-4">
                            {auctionLogo ? (
                                <img src={auctionLogo} className="w-20 h-20 rounded-2xl object-contain bg-zinc-900 border-2 border-amber-500/30 p-2 shadow-lg shadow-amber-500/10" referrerPolicy="no-referrer" />
                            ) : (
                                <div className="w-20 h-20 rounded-2xl bg-zinc-900 border-2 border-amber-500/30 flex items-center justify-center text-amber-500 font-black text-2xl">
                                    {auctionName.substring(0, 2).toUpperCase()}
                                </div>
                            )}
                            <div className="text-right">
                                <h2 className="text-5xl font-black text-white uppercase tracking-tighter leading-none">{auctionName}</h2>
                                <p className="text-amber-500 font-black tracking-[0.3em] text-sm uppercase">OFFICIAL AUCTION BOARD</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full space-y-8">
                    <div className="text-center">
                            <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-500 to-amber-700 uppercase tracking-tighter italic drop-shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                                AUCTION BOARD
                            </h2>
                        </div>

                        <div className="rounded-[3rem] border-4 border-amber-500/40 bg-zinc-950 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative">
                            {/* Golden Glow Overlay */}
                            <div className="absolute inset-0 pointer-events-none border-[12px] border-amber-500/10 rounded-[3rem]"></div>
                            
                            <table className="w-full border-collapse relative z-10">
                                <thead>
                                    <tr className="bg-zinc-900/90">
                                        <th className="w-32 p-6 border border-amber-500/20 text-xl font-black text-amber-500 uppercase tracking-widest bg-gradient-to-b from-zinc-800 to-zinc-900">#</th>
                                        {Array.from({ length: 10 }).map((_, c) => (
                                            <th key={c} className="p-6 border border-amber-500/20 text-xl font-black text-amber-500 uppercase tracking-widest bg-gradient-to-b from-zinc-800 to-zinc-900">{c + 1}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {categories.map(cat => {
                                        const catSlots = allSlots[cat.id || ''] || {};
                                        const catConfig = customConfig[cat.id || ''] || { rows: 0, cols: 0 };
                                        const isAllrounder = cat.name.toLowerCase() === 'allrounder';
                                        const totalReq = cat.requiredPlayers || 6;
                                        const rows = catConfig.rows || (isAllrounder ? categories.length : Math.ceil(totalReq / 6));
                                        const cols = catConfig.cols || 6;
                                        const pref = cat.name.substring(0, 3).toUpperCase();

                                        return Array.from({ length: rows }).map((_, rIdx) => {
                                            const rowLabel = isAllrounder ? categories[rIdx].name : `${pref}${rIdx + 1}`;
                                            return (
                                                <tr key={`${cat.id}-${rowLabel}`} className="hover:bg-amber-500/5 transition-colors">
                                                    <td className="p-6 border border-amber-500/20 bg-zinc-900/40 text-center text-sm font-black text-amber-200 uppercase tracking-widest whitespace-nowrap">
                                                        {rowLabel}
                                                    </td>
                                                    {Array.from({ length: 10 }).map((_, cIdx) => {
                                                        const col = cIdx + 1;
                                                        const slotId = `${rowLabel}_${col}`;
                                                        const slot = catSlots[slotId];
                                                        const globalIndex = (rIdx * cols) + col;
                                                        
                                                        // Only render if within current column count for this row
                                                        if (col > cols) return <td key={slotId} className="p-6 border border-amber-500/20 bg-zinc-950/20"></td>;

                                                        return (
                                                            <td key={slotId} className="p-3 border border-amber-500/20 min-w-[180px] relative">
                                                                <div className="absolute top-1 left-1 text-[8px] font-black text-zinc-800 uppercase tracking-widest opacity-50">#{globalIndex}</div>
                                                                {slot ? (
                                                                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/80 border border-amber-500/20 shadow-lg group">
                                                                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
                                                                            <User className="w-6 h-6 text-zinc-600" />
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <p className="text-base font-black text-zinc-100 uppercase truncate leading-tight group-hover:text-amber-400 transition-colors">{slot.playerName}</p>
                                                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{slot.category}</p>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-14 flex items-center justify-center opacity-10">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        });
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                {/* Footer Branding */}
                <div className="mt-20 pt-10 border-t-4 border-amber-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-amber-500 flex items-center justify-center text-zinc-950 font-black text-2xl">SM</div>
                        <div>
                            <p className="text-2xl font-black text-white uppercase tracking-widest">SM SPORTS</p>
                            <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">PREMIUM TOURNAMENT MANAGEMENT</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black text-zinc-400 uppercase tracking-widest italic">OFFICIAL AUCTION BOARD</p>
                        <p className="text-sm font-bold text-zinc-600 uppercase tracking-widest mt-1">
                            GENERATED: {new Date().toLocaleDateString()}
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
        </div>
    );
};

export default CategoryArrangement;
