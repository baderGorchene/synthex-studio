import { NextRequest, NextResponse } from 'next/server';
import {
  createGraphRevision,
  getGraphRevisions,
  getGraphRevisionById,
  restoreGraphRevision,
  deleteGraphRevision,
  getAllNodesFromDb,
  getAllConnectionsFromDb
} from '@/lib/db';
import { CanvasNode, Connection } from '@/types/canvas';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || 'default';
    const revisionId = searchParams.get('revisionId');

    if (revisionId) {
      const fullRevision = getGraphRevisionById(projectId, revisionId);
      if (!fullRevision) {
        return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
      }
      return NextResponse.json({ revision: fullRevision });
    }

    const revisions = getGraphRevisions(projectId);
    return NextResponse.json({ revisions });
  } catch (error) {
    console.error('Error fetching revisions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch revisions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = body.projectId || 'default';
    const action = body.action || 'create';

    if (action === 'restore') {
      const revisionId = body.revisionId;
      if (!revisionId) {
        return NextResponse.json({ error: 'revisionId is required to restore' }, { status: 400 });
      }
      const restored = restoreGraphRevision(projectId, revisionId);
      if (!restored) {
        return NextResponse.json({ error: 'Revision not found or corrupted' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        restored: true,
        revision: restored.revision,
        nodes: restored.nodes,
        relationships: restored.relationships
      });
    }

    if (action === 'delete') {
      const revisionId = body.revisionId;
      if (!revisionId) {
        return NextResponse.json({ error: 'revisionId is required to delete' }, { status: 400 });
      }
      const deleted = deleteGraphRevision(projectId, revisionId);
      return NextResponse.json({ success: deleted });
    }

    // Default: create a new revision checkpoint
    const title = typeof body.title === 'string' ? body.title : 'Snapshot checkpoint';
    const nodes: CanvasNode[] = Array.isArray(body.nodes) ? body.nodes : getAllNodesFromDb(projectId);
    const relationships: Connection[] = Array.isArray(body.relationships) ? body.relationships : getAllConnectionsFromDb(projectId);

    const revision = createGraphRevision(projectId, title, nodes, relationships);
    return NextResponse.json({ success: true, revision });
  } catch (error) {
    console.error('Error managing revisions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process revision' },
      { status: 500 }
    );
  }
}
