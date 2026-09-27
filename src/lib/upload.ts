/**
 * Helper to upload a local File or Blob to the Next.js server disk storage (/api/upload).
 * Returns the public relative URL (/uploads/...) and file metadata.
 */
export async function uploadFile(
  file: File | Blob,
  projectId = 'default',
  originalName?: string
): Promise<{
  url: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}> {
  const formData = new FormData();
  if (file instanceof File) {
    formData.append('file', file);
  } else {
    formData.append('file', file, originalName || 'file');
  }
  formData.append('projectId', projectId);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Upload failed with HTTP status ${response.status}`);
  }

  return response.json();
}
