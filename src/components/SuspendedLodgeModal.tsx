'use client';

import { createPortal } from 'react-dom';
import { ShieldAlert, X, MessageCircle, Mail, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SuspendedModalProps {
  lodgeTitle: string;
  onClose: () => void;
}

export default function SuspendedLodgeModal({ lodgeTitle, onClose }: SuspendedModalProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>

          <div className="text-center mb-6 pt-4">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border-4 border-red-100">
              <ShieldAlert size={32} />
            </div>
            <h2 className="text-xl font-black text-gray-900 leading-tight">Listing Suspended</h2>
            <p className="text-sm text-gray-500 font-medium mt-2 max-w-[260px] mx-auto">
              Your listing <strong>&quot;{lodgeTitle}&quot;</strong> has been temporarily suspended due to a policy violation or report.
            </p>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6">
            <p className="text-xs text-red-800 leading-relaxed font-bold">
              Active promotions have been paused. To resolve this issue and restore your listing, please contact our support team immediately.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => window.open('https://wa.me/2347077010948?text=Hello%20ZikLodge%20Support,%20my%20listing%20was%20suspended.%20Can%20you%20help?')}
              className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 active:scale-95 transition-all"
            >
              <MessageCircle size={20} /> Chat on WhatsApp
            </button>
            
            <div className="flex gap-2">
                <button
                onClick={() => window.open('mailto:unizikampus@gmail.com?subject=Appeal%20Suspended%20Listing')}
                className="flex-1 py-3 bg-gray-50 text-gray-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border border-gray-100 hover:bg-gray-100 transition-all active:scale-95"
                >
                <Mail size={16} /> Email Support
                </button>
                <button
                onClick={() => window.open('tel:07077010948')}
                className="flex-1 py-3 bg-gray-50 text-gray-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border border-gray-100 hover:bg-gray-100 transition-all active:scale-95"
                >
                <Phone size={16} /> Call Us
                </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}