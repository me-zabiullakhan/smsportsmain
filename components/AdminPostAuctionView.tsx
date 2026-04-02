
import React, { useState } from 'react';
import { useAuction } from '../hooks/useAuction';
import { Team, UserRole } from '../types';
import { Download, Trophy, Users, Wallet, ArrowLeft, Eye, X, RefreshCw, AlertOctagon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TeamPostAuctionView from './TeamPostAuctionView';

const AdminPostAuctionView: React.FC = () => {
    const { state, userProfile, resetAuction } = useAuction();
    const navigate = useNavigate();
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [isResetting, setIsResetting] = useState(false);

    const isAdmin = userProfile?.role === UserRole.ADMIN;

    // Calculate Global Stats
    const totalSpent = state.teams.reduce((acc, team) => {
        return acc + team.players.reduce((tSum, p) => tSum + (Number(p.soldPrice) || 0), 0);
    }, 0);

    const totalSoldPlayers = state.teams.reduce((acc, team) => acc + team.players.length, 0);

    const handleMasterDownload = () => {
        // Generate CSV for ALL players across ALL teams
        const headers = ["Player Name", "Category", "Role", "Sold Price", "Sold To (Team)"];
        let rows: any[] = [];

        state.teams.forEach(team => {
            team.players.forEach(p => {
                rows.push([
                    `"${p.name}"`,
                    `"${p.category}"`,
                    `"${p.speciality || p.category}"`,
                    p.soldPrice || 0,
                    `"${team.name}"`
                ]);
            });
        });

        // Sort by Price Descending
        rows.sort((a, b) => Number(b[3]) - Number(a[3]));

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `MASTER_AUCTION_DATA_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFullReset = async () => {
        if (!window.confirm("DANGER: Are you sure you want to RESET the entire auction? This will wipe all sales, reset budgets, and clear history. This cannot be undone.")) return;
        setIsResetting(true);
        try {
            await resetAuction();
            // Context will update state to NotStarted, which Dashboard will react to.
        } catch (e) {
            console.error(e);
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
            
            {/* Modal for viewing individual team details */}
            {selectedTeam && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-y-auto relative shadow-2xl">
                        <button 
                            onClick={() => setSelectedTeam(null)}
                            className="absolute top-4 right-4 z-50 bg-white/20 hover:bg-red-500 hover:text-white text-gray-800 p-2 rounded-full transition-all backdrop-blur-md"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <div className="pt-10">
                             {/* Reuse the existing Team View */}
                             <TeamPostAuctionView team={selectedTeam} />
                        </div>
                    </div>
                </div>
            )}

            <button onClick={() => navigate(isAdmin ? '/admin' : '/')} className="mb-6 flex items-center text-gray-500 hover:text-blue-600 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2"/> {isAdmin ? 'Back to Dashboard' : 'Back to Home'}
            </button>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 mb-8">
                {/* Header */}
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-8 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="inline-block bg-yellow-500/20 border border-yellow-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-yellow-400 mb-2">
                            Auction Completed
                        </div>
                        <h1 className="text-3xl font-bold mb-2">Auction Summary Report</h1>
                        <p className="text-gray-400 text-sm">Review final standings, statistics, and team performance.</p>
                    </div>
                    <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-white/5 to-transparent"></div>
                </div>

                {/* Global Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200 border-b border-gray-200 bg-gray-50">
                    <div className="p-6 text-center">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Turnover</p>
                        <p className="text-3xl font-black text-green-600">{totalSpent}</p>
                    </div>
                    <div className="p-6 text-center">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Players Sold</p>
                        <p className="text-3xl font-black text-blue-600">{totalSoldPlayers}</p>
                    </div>
                    <div className="p-6 flex items-center justify-center">
                        {isAdmin ? (
                            <button 
                                onClick={handleMasterDownload}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center transition-all hover:scale-105 active:scale-95"
                            >
                                <Download className="w-5 h-5 mr-2" /> Export Master Data
                            </button>
                        ) : (
                            <div className="text-gray-400 text-sm italic">
                                Master Export (Admin Only)
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Teams Grid */}
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600"/> Team Performance
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {state.teams.map(team => {
                    const teamSpent = team.players.reduce((sum, p) => sum + (Number(p.soldPrice) || 0), 0);
                    return (
                        <div key={team.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {team.logoUrl ? (
                                        <img src={team.logoUrl} className="w-10 h-10 rounded-full border border-gray-200 object-contain"/>
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500">
                                            {team.name.charAt(0)}
                                        </div>
                                    )}
                                    <h3 className="font-bold text-gray-800 truncate max-w-[150px]">{team.name}</h3>
                                </div>
                                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{team.players.length} Players</span>
                            </div>
                            
                            <div className="p-5 grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-400 text-xs uppercase font-bold">Spent</p>
                                    <p className="font-bold text-gray-800">{teamSpent}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-xs uppercase font-bold">Remaining</p>
                                    <p className="font-bold text-green-600">{team.budget}</p>
                                </div>
                            </div>

                            <div className="mt-auto p-4 bg-gray-50 border-t border-gray-100">
                                <button 
                                    onClick={() => setSelectedTeam(team)}
                                    className="w-full bg-white border border-gray-300 hover:border-blue-400 hover:text-blue-600 text-gray-600 font-semibold py-2 rounded transition-colors flex items-center justify-center text-sm"
                                >
                                    <Eye className="w-4 h-4 mr-2" /> View Full Squad
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* DANGER ZONE - ADMIN ONLY */}
            {isAdmin && (
                <div className="mt-12 border-t-2 border-red-100 pt-8">
                    <h3 className="text-red-700 font-bold uppercase tracking-wider text-sm mb-4 flex items-center">
                        <AlertOctagon className="w-4 h-4 mr-2" /> Danger Zone
                    </h3>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <h4 className="font-bold text-red-800">Reset Entire Auction</h4>
                            <p className="text-sm text-red-600">This will wipe all sales data, reset team budgets, and set the auction status to 'Not Started'. This cannot be undone.</p>
                        </div>
                        <button 
                            onClick={handleFullReset}
                            disabled={isResetting}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow transition-colors flex items-center whitespace-nowrap"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isResetting ? 'animate-spin' : ''}`} />
                            {isResetting ? 'Resetting...' : 'Reset Auction'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPostAuctionView;
