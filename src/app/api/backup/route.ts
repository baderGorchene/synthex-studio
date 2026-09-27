import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  createDatabaseBackup,
  getDatabaseBackups,
  restoreDatabaseBackup,
  deleteDatabaseBackup,
  getDatabaseFilePath,
  getBackupFilePath
} from '@/lib/db';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const isDownload = url.searchParams.get('download') === '1';
    const fileName = url.searchParams.get('fileName');

    if (isDownload) {
      let targetPath: string | null = null;
      let downloadFileName = `canvas-backup-${Date.now()}.db`;

      if (fileName) {
        targetPath = getBackupFilePath(fileName);
        if (!targetPath) {
          return NextResponse.json({ error: 'Snapshot file not found' }, { status: 404 });
        }
        downloadFileName = path.basename(targetPath);
      } else {
        targetPath = getDatabaseFilePath();
        if (!fs.existsSync(/*turbopackIgnore: true*/ targetPath)) {
          return NextResponse.json({ error: 'Database file not found' }, { status: 404 });
        }
      }

      const fileBuffer = fs.readFileSync(/*turbopackIgnore: true*/ targetPath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.sqlite3',
          'Content-Disposition': `attachment; filename="${downloadFileName}"`,
          'Content-Length': String(fileBuffer.length)
        }
      });
    }

    const snapshots = getDatabaseBackups();
    return NextResponse.json({ success: true, snapshots });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve backups' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'create') {
      const label = typeof body.label === 'string' ? body.label.slice(0, 120) : undefined;
      const snapshot = await createDatabaseBackup(label);
      return NextResponse.json({ success: true, snapshot });
    }

    if (action === 'restore') {
      const fileName = body.fileName;
      if (!fileName || typeof fileName !== 'string') {
        return NextResponse.json({ error: 'Missing snapshot fileName' }, { status: 400 });
      }
      const result = await restoreDatabaseBackup(fileName);
      return NextResponse.json({ success: true, snapshot: result.snapshot });
    }

    if (action === 'delete') {
      const fileName = body.fileName;
      if (!fileName || typeof fileName !== 'string') {
        return NextResponse.json({ error: 'Missing snapshot fileName' }, { status: 400 });
      }
      const deleted = deleteDatabaseBackup(fileName);
      return NextResponse.json({ success: deleted });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Database backup operation failed' },
      { status: 500 }
    );
  }
}
