import { Upload } from 'tus-js-client';
import { supabase, supabaseUrl } from './supabase';

export const uploadFileResumable = async (
  bucketName: string,
  filePath: string,
  file: File,
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void
): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      reject(new Error('No active session'));
      return;
    }

    const upload = new Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000], // Aggressive retries for 3G
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'true', // Overwrite if exists
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true, // Allow re-uploading same file
      metadata: {
        bucketName: bucketName,
        objectName: filePath,
        contentType: file.type,
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // 6MB chunks (Supabase limit)
      onError: (error) => {
        console.error('TUS Upload Failed:', error);
        reject(error);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (onProgress) onProgress(bytesUploaded, bytesTotal);
      },
      onSuccess: () => {
        // Construct public URL
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
        resolve(publicUrl);
      },
    });

    // Check if there are any previous uploads to continue.
    upload.findPreviousUploads().then(function (previousUploads) {
      // Found previous uploads so we select the first one. 
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      // Start the upload
      upload.start();
    });
  });
};
