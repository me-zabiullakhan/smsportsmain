
import React from 'react';
import { useAuction } from '../hooks/useAuction';
import { AuctionLog as AuctionLogType } from '../types';
import { MessageSquare, DollarSign, CheckCircle, XCircle } from 'lucide-react';

const LogIcon: React.FC<{type: AuctionLogType['type']}> = ({type}) => {
    switch (type) {
        case 'BID': return <DollarSign className="h-4 w-4 text-yellow-400"/>;
        case 'SOLD': return <CheckCircle className="h-4 w-4 text-green-400"/>;
        case 'UNSOLD': return <XCircle className="h-4 w-4 text-red-400"/>;
        case 'SYSTEM': return <MessageSquare className="h-4 w-4 text-blue-400"/>;
        default: return null;
    }
}

const AuctionLog: React.FC = () => {
  const { state } = useAuction();

  return (
    <div className="bg-secondary rounded-lg shadow-lg p-4 h-80 flex flex-col">
      <h3 className="text-lg font-bold mb-2 text-highlight border-b border-accent pb-2">Auction Log</h3>
      <div className="overflow-y-auto flex-grow pr-2 custom-scrollbar">
        <ul className="space-y-2">
          {state.auctionLog.map((log, index) => (
            <li key={index} className="flex items-start text-sm text-text-secondary animate-fade-in">
                <span className="mr-2 mt-1"><LogIcon type={log.type} /></span>
                <span>{log.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AuctionLog;
