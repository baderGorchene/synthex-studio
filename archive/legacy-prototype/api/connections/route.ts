import { NextResponse } from 'next/server';
import { deleteConnectionFromDb, getAllConnectionsFromDb, saveConnectionToDb, updateConnectionInDb } from '@/lib/db';
import { Connection } from '@/types/canvas';

export async function GET() {
  try {
    const connections = getAllConnectionsFromDb();
    return NextResponse.json(connections);
  } catch (error) {
    console.error('Failed to get connections from SQLite:', error);
    return NextResponse.json({ error: 'Failed to retrieve connections' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const conn = (await request.json()) as Connection;
    if (!conn || !conn.id || !conn.from || !conn.to) {
      return NextResponse.json({ error: 'Invalid connection payload' }, { status: 400 });
    }

    saveConnectionToDb(conn);
    return NextResponse.json({ success: true, connection: conn });
  } catch (error) {
    console.error('Failed to save connection to SQLite:', error);
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();
    if (!payload || !payload.id) {
      return NextResponse.json({ error: 'Connection id is required' }, { status: 400 });
    }

    updateConnectionInDb(payload.id, payload);
    return NextResponse.json({ success: true, updated: payload });
  } catch (error) {
    console.error('Failed to update connection in SQLite:', error);
    return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Connection id is required' }, { status: 400 });
    }

    deleteConnectionFromDb(id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Failed to delete connection from SQLite:', error);
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
  }
}
