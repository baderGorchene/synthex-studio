import { NextResponse } from 'next/server';
import {
  deleteNodeFromDb,
  getAllNodesFromDb,
  saveNodeToDb,
  updateMultipleNodePositionsInDb,
  updateNodeInDb,
  updateNodePositionInDb
} from '@/lib/db';
import { CanvasNode } from '@/types/canvas';

export async function GET() {
  try {
    const nodes = getAllNodesFromDb();
    return NextResponse.json(nodes);
  } catch (error) {
    console.error('Failed to get nodes from SQLite:', error);
    return NextResponse.json({ error: 'Failed to retrieve nodes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const node = (await request.json()) as CanvasNode;
    if (!node || !node.id || !node.type) {
      return NextResponse.json({ error: 'Invalid node payload' }, { status: 400 });
    }

    saveNodeToDb(node);
    return NextResponse.json({ success: true, node });
  } catch (error) {
    console.error('Failed to save node to SQLite:', error);
    return NextResponse.json({ error: 'Failed to save node' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Batch position updates (e.g. dragging a section with member cards)
    if (Array.isArray(body)) {
      updateMultipleNodePositionsInDb(body);
      return NextResponse.json({ success: true, count: body.length });
    }

    const { id, x, y, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'Node id is required' }, { status: 400 });
    }

    if (x !== undefined && y !== undefined && Object.keys(fields).length === 0) {
      // Fast path: update position only (on grab and release)
      updateNodePositionInDb(id, x, y);
      return NextResponse.json({ success: true, id, x, y });
    }

    updateNodeInDb(id, { x, y, ...fields });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Failed to update node in SQLite:', error);
    return NextResponse.json({ error: 'Failed to update node' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Node id is required' }, { status: 400 });
    }

    deleteNodeFromDb(id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Failed to delete node from SQLite:', error);
    return NextResponse.json({ error: 'Failed to delete node' }, { status: 500 });
  }
}
