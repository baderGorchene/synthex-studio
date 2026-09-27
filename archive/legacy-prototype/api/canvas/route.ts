import { NextResponse } from 'next/server';
import { bulkSaveCanvasToDb, getAllConnectionsFromDb, getAllNodesFromDb } from '@/lib/db';
import { CanvasNode, Connection } from '@/types/canvas';

export async function GET() {
  try {
    const nodes = getAllNodesFromDb();
    const connections = getAllConnectionsFromDb();
    return NextResponse.json({ nodes, connections });
  } catch (error) {
    console.error('Failed to get canvas data from SQLite:', error);
    return NextResponse.json({ error: 'Failed to retrieve canvas from database' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nodes = body.nodes as CanvasNode[];
    const connections = body.connections as Connection[];

    if (Array.isArray(nodes) && Array.isArray(connections)) {
      bulkSaveCanvasToDb(nodes, connections);
      return NextResponse.json({ success: true, count: nodes.length });
    }

    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  } catch (error) {
    console.error('Failed to save canvas data to SQLite:', error);
    return NextResponse.json({ error: 'Failed to save canvas to database' }, { status: 500 });
  }
}
