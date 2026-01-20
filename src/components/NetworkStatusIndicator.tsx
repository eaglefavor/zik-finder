'use client';

import React from 'react';
import { useNetworkQuality } from '@/hooks/useNetworkQuality';
import { Wifi, WifiOff, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function NetworkStatusIndicator() {
  const { quality, isOnline, isLowData } = useNetworkQuality();

  // We only want to show the indicator if:
  // 1. User is offline (Critical)
  // 2. User is on Low Data mode (Informational - showing ZIPS is working)
  const shouldShow = !isOnline || isLowData;

  if (!shouldShow) return null;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[100] flex justify-center p-2 pointer-events-none"
        >
          <div className={`
            flex items-center gap-2 px-4 py-2 rounded-full shadow-lg backdrop-blur-md border pointer-events-auto
            ${!isOnline 
              ? 'bg-red-500/90 text-white border-red-400' 
              : 'bg-blue-600/90 text-white border-blue-400'}
          `}>
            {!isOnline ? (
              <>
                <WifiOff size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">Offline Mode</span>
              </>
            ) : (
              <>
                <Zap size={14} className="fill-yellow-300 text-yellow-300" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  ZIPS Active: {quality.toUpperCase()}
                </span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
