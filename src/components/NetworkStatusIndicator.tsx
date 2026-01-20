'use client';

import React from 'react';
import { useNetworkQuality } from '@/hooks/useNetworkQuality';
import { Wifi, WifiOff, Zap, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function NetworkStatusIndicator() {
  const { quality, isOnline, isLowData } = useNetworkQuality();

  // Show if Offline or Low Data (3G/2G)
  const shouldShow = !isOnline || isLowData;

  if (!shouldShow) return null;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="relative z-50 bg-zinc-900 border-b border-zinc-800 text-zinc-400 overflow-hidden"
        >
          <div className="flex justify-between items-center px-4 py-1.5 max-w-md mx-auto min-h-[28px]">
            <div className="flex items-center gap-2">
              {!isOnline ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-red-400">
                    System Offline
                  </span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-400">
                    ZIPS Active
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {isOnline ? (
                  <>
                    <Activity size={10} className="text-zinc-500" />
                    <span className="text-[9px] font-mono font-medium text-zinc-500">
                      {quality.toUpperCase()}
                    </span>
                  </>
                ) : (
                  <WifiOff size={10} className="text-zinc-500" />
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
  );
}
