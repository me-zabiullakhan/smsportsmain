
import React from 'react';
import { Player, AuctionStatus } from '../types';
import { useAuction } from '../hooks/useAuction';
import { Globe, User, Tag } from 'lucide-react';

interface PlayerFocusProps {
  player: Player;
}

const Timer: React.FC = () => {
    const { state } = useAuction();
    const { timer } = state;
    const progress = (timer / 10) * 100;
    const timerColor = timer <= 3 ? 'bg-red-500' : timer <= 6 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div className="w-full bg-accent rounded-full h-6 md:h-8 overflow-hidden shadow-inner mt-4">
            <div 
                className={`h-full rounded-full ${timerColor} transition-all duration-500 ease-linear text-white flex items-center justify-center font-bold text-sm md:text-lg`}
                style={{ width: `${progress}%` }}
            >
                {timer}s
            </div>
        </div>
    );
}

const PlayerFocus: React.FC<PlayerFocusProps> = ({ player }) => {
  const { state } = useAuction();
  const { currentBid, highestBidder, status } = state;

  const displayPrice = (currentBid !== null && currentBid > 0) ? Math.max(currentBid, player.basePrice) : player.basePrice;
  const isSold = status === AuctionStatus.Sold || player.status === 'SOLD';
  const isUnsold = status === AuctionStatus.Unsold || player.status === 'UNSOLD';

  return (
    <div className="bg-secondary rounded-lg shadow-2xl p-4 md:p-6 relative overflow-hidden border-2 border-accent flex flex-col justify-between min-h-[350px] md:min-h-[400px]">
        <div className="absolute -top-12 -right-12 w-32 h-32 md:w-48 md:h-48 bg-highlight/10 rounded-full"></div>
        <div className="absolute -bottom-16 -left-12 w-24 h-24 md:w-40 md:h-40 bg-highlight/10 rounded-full"></div>

        <div className="relative z-10 flex flex-col h-full">
            {/* Player Info Header */}
            <div className="flex flex-col items-center text-center space-y-3 md:space-y-4 mb-4 md:mb-6">
                <img src={player.photoUrl} alt={player.name} className="w-24 h-24 md:w-40 md:h-40 rounded-full border-4 border-highlight object-cover shadow-2xl" />
                <div>
                    <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-wide">{player.name}</h2>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-2 md:mt-3">
                        {/* ROLE (Player Type) - Primary Badge */}
                        <span className="px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-bold rounded-full uppercase tracking-wider shadow-sm bg-blue-600 text-white flex items-center">
                            <User className="w-3 h-3 mr-1.5 opacity-80"/>
                            {player.role || player.category}
                        </span>
                        
                        {/* AUCTION CATEGORY (Group) - Secondary Badge */}
                        <span className="px-3 py-1 md:px-3 md:py-1.5 text-xs md:text-sm font-bold rounded-full uppercase tracking-wider bg-gray-700 text-gray-300 border border-gray-600 flex items-center shadow-sm">
                            <Tag className="w-3 h-3 mr-1.5 opacity-70"/>
                            {player.category}
                        </span>

                        {/* Nationality Badge */}
                        <span className="flex items-center text-text-secondary font-medium bg-primary/50 px-3 py-1 md:px-3 md:py-1.5 text-xs md:text-sm rounded-full border border-white/5">
                            <Globe className="w-3 h-3 md:w-4 md:h-4 mr-1 text-highlight"/>{player.nationality}
                        </span>
                    </div>
                </div>
            </div>

            {/* Bidding Info */}
            <div className="bg-primary/40 p-4 md:p-6 rounded-xl border border-white/5 flex flex-col items-center justify-center flex-grow relative overflow-hidden">
                {isSold && (
                    <div className="absolute inset-0 bg-black/60 z-20 flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
                        <div className="bg-green-600 text-white font-black text-3xl md:text-5xl px-8 py-4 border-4 border-white -rotate-12 shadow-2xl tracking-widest uppercase">SOLD</div>
                        {player.soldTo && <div className="mt-4 text-white text-lg font-bold">To {player.soldTo}</div>}
                        {player.soldPrice && <div className="text-highlight text-xl font-bold">for {player.soldPrice}</div>}
                    </div>
                )}
                {isUnsold && (
                    <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center animate-fade-in backdrop-blur-sm">
                        <div className="bg-red-600 text-white font-black text-3xl md:text-5xl px-8 py-4 border-4 border-white -rotate-12 shadow-2xl tracking-widest uppercase">UNSOLD</div>
                    </div>
                )}

                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-highlight to-transparent"></div>
                
                <p className="text-text-secondary uppercase tracking-widest text-[10px] md:text-sm font-bold mb-1 md:mb-2">
                    {highestBidder ? 'Current Bid' : 'Starting Price'}
                </p>
                <p className="text-5xl sm:text-6xl md:text-8xl font-black text-highlight tabular-nums drop-shadow-lg mb-2">
                    {displayPrice}
                </p>
                
                <div className="flex items-center space-x-4 md:space-x-6 mt-2">
                    <div className="text-center px-2 md:px-4 border-r border-gray-600">
                        <p className="text-[10px] md:text-xs text-gray-400 uppercase">Base Price</p>
                        <p className="text-lg md:text-xl font-bold text-white">{player.basePrice}</p>
                    </div>
                    <div className="text-center px-2 md:px-4">
                        <p className="text-[10px] md:text-xs text-gray-400 uppercase">Highest Bidder</p>
                        <div className="flex items-center justify-center mt-1">
                            {highestBidder ? (
                                <>
                                    {highestBidder.logoUrl && <img src={highestBidder.logoUrl} className="w-4 h-4 md:w-5 md:h-5 rounded-full mr-2" alt=""/>}
                                    <span className="text-base md:text-lg font-bold text-green-400 truncate max-w-[120px] md:max-w-[150px]">{highestBidder.name}</span>
                                </>
                            ) : (
                                <span className="text-base md:text-lg font-bold text-gray-500 italic">No Bids Yet</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Timer />
        </div>
    </div>
  );
};

export default PlayerFocus;
