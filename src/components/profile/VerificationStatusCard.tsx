'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, CheckCircle, AlertCircle, FileText, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Compressor from 'compressorjs';
import { Profile } from '@/lib/types';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const PaymentModal = dynamic(() => import('@/components/PaymentModal'), { ssr: false });

interface VerificationStatusCardProps {
  user: Profile; 
}

export default function VerificationStatusCard({ user }: VerificationStatusCardProps) {
  const [uploading, setUploading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<{ id: File | null; selfie: File | null }>({
    id: null,
    selfie: null
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const checkVerificationStatus = React.useCallback(async () => {
    if (!user) return;
    
    // First check if already verified in profile
    if (user.is_verified) {
      setVerificationStatus('verified');
      return;
    }

    // Check for pending, approved or rejected docs
    const { data } = await supabase
      .from('verification_docs')
      .select('status, rejection_reason')
      .eq('landlord_id', user.id)
      .in('status', ['pending', 'approved', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      if (data.status === 'approved') {
         setVerificationStatus('verified');
      } else if (data.status === 'rejected') {
         setVerificationStatus('rejected');
         setRejectionReason(data.rejection_reason);
      } else {
         setVerificationStatus('pending');
      }
    } else {
      setVerificationStatus('none');
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      checkVerificationStatus();
    }
  }, [user, checkVerificationStatus]);

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      new Compressor(file, {
        quality: 0.6, // Moderate quality
        maxWidth: 1200, // Max width 1200px
        success(result) {
          const compressed = result as File;
          resolve(compressed);
        },
        error(err) {
          reject(err);
        },
      });
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'id' | 'selfie') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedFile = await compressImage(file);
        setSelectedFiles(prev => ({ ...prev, [type]: compressedFile }));
      } catch (err) {
        console.error('Compression failed:', err);
        // Fallback to original file if compression fails
        setSelectedFiles(prev => ({ ...prev, [type]: file }));
      }
    }
  };

  const handleInitiateVerification = () => {
    if (!selectedFiles.id || !selectedFiles.selfie) {
        toast.error('Please select both ID and Selfie first.');
        return;
    }
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (reference: string) => {
    setShowPaymentModal(false);
    setUploading(true);

    try {
        // Log transaction first (Best effort)
        await supabase.from('monetization_transactions').insert({
            user_id: user.id,
            amount: 500,
            reference: reference,
            purpose: 'verification_fee',
            status: 'success'
        });

      // 1. Upload ID
      const idExt = selectedFiles.id!.name.split('.').pop();
      const idPath = `${user.id}/id-${Math.random().toString(36).substring(2)}.${idExt}`;
      const { error: idError } = await supabase.storage
        .from('secure-docs')
        .upload(idPath, selectedFiles.id!);

      if (idError) throw idError;

      // 2. Upload Selfie
      const selfieExt = selectedFiles.selfie!.name.split('.').pop();
      const selfiePath = `${user.id}/selfie-${Math.random().toString(36).substring(2)}.${selfieExt}`;
      const { error: selfieError } = await supabase.storage
        .from('secure-docs')
        .upload(selfiePath, selectedFiles.selfie!);

      if (selfieError) throw selfieError;

      // 3. Record in DB
      // If re-submitting, delete old rejected entries and their files
      if (verificationStatus === 'rejected') {
         // Fetch old paths first
         const { data: oldDocs } = await supabase
           .from('verification_docs')
           .select('id_card_path, selfie_path')
           .eq('landlord_id', user.id)
           .eq('status', 'rejected');

         if (oldDocs && oldDocs.length > 0) {
           const pathsToDelete: string[] = [];
           oldDocs.forEach(doc => {
             if (doc.id_card_path) pathsToDelete.push(doc.id_card_path);
             if (doc.selfie_path) pathsToDelete.push(doc.selfie_path);
           });
           
           if (pathsToDelete.length > 0) {
             const { error: removeError } = await supabase.storage
               .from('secure-docs')
               .remove(pathsToDelete);
             
             if (removeError) console.error('Error removing old files:', removeError);
           }
         }

         // Delete the DB row
         await supabase.from('verification_docs').delete().eq('landlord_id', user.id).eq('status', 'rejected');
      }

      const { error: dbError } = await supabase
        .from('verification_docs')
        .insert({
          landlord_id: user.id,
          id_card_path: idPath,
          selfie_path: selfiePath,
          status: 'pending',
          payment_status: 'success',
          payment_reference: reference
        });

      if (dbError) {
        throw dbError;
      }

      setVerificationStatus('pending');
      toast.success('Payment successful & Documents uploaded! Review pending.');
      setSelectedFiles({ id: null, selfie: null }); // Reset
    } catch (error: unknown) {
      console.error('Error uploading documents:', error);
      toast.error('Error uploading documents: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  return (
    <>
        {showPaymentModal && (
            <PaymentModal
                amount={500}
                email={user.email || 'user@ziklodge.com'}
                purpose="verification_fee"
                metadata={{ userId: user.id }}
                onSuccess={handlePaymentSuccess}
                onClose={() => setShowPaymentModal(false)}
            />
        )}

    <div className={`p-5 rounded-3xl border transition-colors ${
      verificationStatus === 'verified'
        ? 'bg-green-50 border-green-100' 
        : verificationStatus === 'pending'
          ? 'bg-yellow-50 border-yellow-100'
          : verificationStatus === 'rejected'
            ? 'bg-red-50 border-red-100'
            : 'bg-blue-50 border-blue-100'
    }`}>
      <div className="flex items-start gap-3">
        {verificationStatus === 'verified' ? (
          <CheckCircle className="text-green-500 shrink-0" size={24} />
        ) : verificationStatus === 'pending' ? (
           <Loader2 className="text-yellow-600 shrink-0 animate-spin" size={24} />
        ) : verificationStatus === 'rejected' ? (
           <AlertCircle className="text-red-500 shrink-0" size={24} />
        ) : (
          <ShieldCheck className="text-blue-500 shrink-0" size={24} />
        )}
        <div className="flex-1">
          <p className={`font-bold text-sm ${
            verificationStatus === 'verified' ? 'text-green-800' : 
            verificationStatus === 'pending' ? 'text-yellow-800' : 
            verificationStatus === 'rejected' ? 'text-red-800' : 'text-blue-800'
          }`}>
            {verificationStatus === 'verified' ? 'Account Verified' : 
             verificationStatus === 'pending' ? 'Verification Pending' : 
             verificationStatus === 'rejected' ? 'Verification Rejected' : 'Identity Verification'}
          </p>
          <p className={`text-xs ${
            verificationStatus === 'verified' ? 'text-green-700' : 
            verificationStatus === 'pending' ? 'text-yellow-700' : 
            verificationStatus === 'rejected' ? 'text-red-700' : 'text-blue-700'
          }`}>
            {verificationStatus === 'verified' 
              ? 'Your account is verified. You have full access to all landlord features.' 
              : verificationStatus === 'pending'
                ? 'We are reviewing your document. This usually takes 24 hours.'
                : verificationStatus === 'rejected'
                  ? rejectionReason || 'Your documents were rejected. Please check the requirements and try again.'
                  : 'Upload a valid ID (NIN, Drivers License, etc.) to get the verified badge.'}
          </p>
          
          {(verificationStatus === 'none' || verificationStatus === 'rejected') && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                 <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Required Documents</p>
                 {verificationStatus === 'rejected' && (
                   <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">Resubmission Required</span>
                 )}
              </div>
              
              {/* ID Card Upload */}
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                    <FileText size={16} />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-gray-700">1. Valid ID Card</p>
                    <p className="text-gray-400">NIN, Voter&apos;s Card, or Driver&apos;s License</p>
                  </div>
                </div>
                <input 
                  type="file" 
                  id="id-upload"
                  className="hidden" 
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => handleFileSelect(e, 'id')}
                />
                <label 
                  htmlFor="id-upload"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    selectedFiles.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {selectedFiles.id ? 'Selected' : 'Select'}
                </label>
              </div>

              {/* Selfie Upload */}
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                    <User size={16} />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-gray-700">2. Selfie with ID</p>
                    <p className="text-gray-400">Hold your ID next to your face</p>
                  </div>
                </div>
                <input 
                  type="file" 
                  id="selfie-upload"
                  className="hidden" 
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => handleFileSelect(e, 'selfie')}
                />
                <label 
                  htmlFor="selfie-upload"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    selectedFiles.selfie ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {selectedFiles.selfie ? 'Selected' : 'Select'}
                </label>
              </div>

              <button 
                onClick={handleInitiateVerification}
                disabled={uploading || !selectedFiles.id || !selectedFiles.selfie}
                className="w-full flex items-center justify-center gap-2 mt-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Uploading...
                  </>
                ) : (
                  <>{verificationStatus === 'rejected' ? 'Pay ₦500 & Resubmit Verification' : 'Pay ₦500 & Submit Verification'}</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
