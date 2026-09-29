/**
 * Synthex Studio: Google Cloud Storage (GCS) Document Vault Integration
 * Manages research papers, PDFs, and media attachments with signed URLs
 */

export interface GcsUploadResult {
  url: string;
  gcsPath: string;
  bucket: string;
  sizeBytes: number;
}

export function isGcsConfigured(): boolean {
  return Boolean(process.env.GCS_BUCKET_NAME);
}

export function getGcsBucketName(): string {
  return process.env.GCS_BUCKET_NAME || 'synthex-research-vault';
}

async function getStorageClient() {
  const { Storage } = await import('@google-cloud/storage');
  if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
    try {
      const credentials = typeof process.env.GCP_SERVICE_ACCOUNT_KEY === 'string'
        ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
        : process.env.GCP_SERVICE_ACCOUNT_KEY;
      return new Storage({ credentials });
    } catch (parseErr) {
      console.warn('Failed to parse GCP_SERVICE_ACCOUNT_KEY JSON:', parseErr);
    }
  }
  return new Storage();
}

/**
 * Upload an in-memory file buffer directly to Google Cloud Storage
 */
export async function uploadBufferToGcs(
  buffer: Buffer,
  destinationPath: string,
  contentType: string
): Promise<GcsUploadResult> {
  const bucketName = getGcsBucketName();

  // Lazy-load @google-cloud/storage to avoid runtime failure if not installed in offline mode
  try {
    const storage = await getStorageClient();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(destinationPath);

    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: 'public, max-age=86400',
        uploadedBy: 'synthex-studio'
      }
    });

    // Public URL if bucket is configured for uniform public access or authenticated URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${destinationPath}`;

    return {
      url: publicUrl,
      gcsPath: destinationPath,
      bucket: bucketName,
      sizeBytes: buffer.length
    };
  } catch (err) {
    console.warn('GCS SDK upload failed or not installed, falling back to local simulation:', err);
    throw new Error(
      `GCS_UPLOAD_FAILED: ${err instanceof Error ? err.message : 'Could not upload to Google Cloud Storage.'}`
    );
  }
}

/**
 * Generate a v4 signed URL for temporary direct read access to a private research document
 */
/**
 * Delete a document from the GCS bucket
 */