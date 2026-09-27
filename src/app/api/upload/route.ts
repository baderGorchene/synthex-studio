import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

// Max file upload limit: 50MB
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const rawProjectId = formData.get('projectId');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No valid file provided for upload.' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: `File exceeds maximum allowed size of 50MB (${Math.round(file.size / 1024 / 1024)}MB uploaded).` },
        { status: 413 }
      );
    }

    // Sanitize projectId to prevent path traversal
    const projectId = typeof rawProjectId === 'string'
      ? rawProjectId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'default'
      : 'default';

    // Get original filename and safe extension
    const rawName = 'name' in file && typeof file.name === 'string' ? file.name : 'upload';
    const parsed = path.parse(rawName);
    const safeExt = parsed.ext.toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 16);
    const baseSlug = parsed.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 60) || 'file';

    // Unique filename: timestamp + random suffix + safe extension
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fileName = `${baseSlug}-${uniqueSuffix}${safeExt}`;

    // Target upload folder in public/uploads/{projectId}
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', projectId);
    await fs.mkdir(uploadsDir, { recursive: true });

    const targetFilePath = path.join(uploadsDir, fileName);

    // Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(targetFilePath, Buffer.from(arrayBuffer));

    // Return the publicly accessible relative URL
    const relativeUrl = `/uploads/${projectId}/${fileName}`;
    const fileType = safeExt.replace('.', '') || file.type.split('/')[1] || 'bin';

    return NextResponse.json({
      url: relativeUrl,
      fileName: rawName,
      fileSize: file.size,
      fileType,
      mimeType: file.type
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save file to server storage.' },
      { status: 500 }
    );
  }
}
