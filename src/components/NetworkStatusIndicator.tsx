'use client';

import React, { useState } from 'react';
import { useNetworkQuality } from '@/hooks/useNetworkQuality';
import { WifiOff, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function NetworkStatusIndicator() {
  const { quality, isOnline, isLowData } = useNetworkQuality();
  const [isExpanded, setIsExpanded] = useState(false);

  // Status Logic
  let statusColor = 'bg-emerald-500';
  let statusTextColor = 'text-emerald-400';
  let statusText = 'System Stable';
  
  if (!isOnline) {
    statusColor = 'bg-red-500';
    statusTextColor = 'text-red-400';
    statusText = 'System Offline';
  } else if (isLowData) {
    statusColor = 'bg-amber-500';
    statusTextColor = 'text-amber-400';
    statusText = 'ZIPS Active';
  }

  return (
    <>
      {/* Dot Indicator (Always visible when collapsed) */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            key="dot"
            data-testid="network-status-dot"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed top-3 left-3 z-[100] cursor-pointer group"
            onClick={() => setIsExpanded(true)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${statusColor} shadow-lg shadow-black/50 ring-1 ring-black/20 group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-offset-black group-hover:ring-${statusColor.replace('bg-', '')}`} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Bar */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="bar"
            data-testid="network-status-bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-50 bg-zinc-900 border-b border-zinc-800 text-zinc-400 overflow-hidden cursor-pointer"
            onClick={() => setIsExpanded(false)}
          >
            <div className="flex justify-between items-center px-4 py-1.5 max-w-md mx-auto min-h-[28px]">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${statusColor} ${!isOnline ? 'animate-pulse' : ''}`} />
                <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${statusTextColor}`}>
                  {statusText}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {!isOnline ? (
                    <WifiOff size={10} className="text-zinc-500" />
                  ) : (
                    <>
                      <Activity size={10} className="text-zinc-500" />
                      <span className="text-[9px] font-mono font-medium text-zinc-500">
                        {quality.toUpperCase()}
                      </span>
                    </>
                  )}
                </div>
                {isOnline && (
                  <div className="text-[9px] font-mono font-bold text-blue-500 bg-blue-500/10 px-1.5 rounded">
                    L5
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
