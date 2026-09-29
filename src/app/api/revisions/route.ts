import { NextRequest, NextResponse } from 'next/server';
import {
  createGraphRevision,
  getGraphRevisions,
  getGraphRevisionById,
  restoreGraphRevision,
  deleteGraphRevision,
  getAllNodesFromDb,
  getAllConnectionsFromDb,
  userHasProjectAccess
} from '@/lib/db';
import { getServerAuth } from '@/lib/auth';
import { CanvasNode, Connection } from '@/types/canvas';

export async function GET(request: NextRequest) {
  try {
    const auth = await getServerAuth();
    const userId = auth.user?.id || auth.userId;
    const orgId = auth.orgId;
    const clerkId = auth.clerkId;
    if (!auth.isLocal && !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || '';
    if (!projectId || !(await userHasProjectAccess(projectId, userId, orgId, clerkId))) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const revisionId = searchParams.get('revisionId');

    if (revisionId) {
      const fullRevision = await getGraphRevisionById(projectId, revisionId);
      if (!fullRevision) {
        return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
      }
      return NextResponse.json({ revision: fullRevision });
    }

    const revisions = await getGraphRevisions(projectId);
    return NextResponse.json({ revisions });
  } catch (error) {
    console.error('Error fetching revisions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revisions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getServerAuth();
    const userId = auth.user?.id || auth.userId;
    const orgId = auth.orgId;
    const clerkId = auth.clerkId;
    if (!auth.isLocal && !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const projectId = body.projectId || '';
    if (!projectId || !(await userHasProjectAccess(projectId, userId, orgId, clerkId))) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }
    const action = body.action || 'create';

    if (action === 'restore') {
      const revisionId = body.revisionId;
      if (!revisionId) {
        return NextResponse.json({ error: 'revisionId is required to restore' }, { status: 400 });
      }
      const restored = await restoreGraphRevision(projectId, revisionId);
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
      const deleted = await deleteGraphRevision(projectId, revisionId);
      return NextResponse.json({ success: deleted });
    }

    // Default: create a new revision checkpoint
    const title = typeof body.title === 'string' ? body.title : 'Snapshot checkpoint';
    const nodes: CanvasNode[] = Array.isArray(body.nodes) ? body.nodes : ((await getAllNodesFromDb(projectId)) as CanvasNode[]);
    const relationships: Connection[] = Array.isArray(body.relationships) ? body.relationships : ((await getAllConnectionsFromDb(projectId)) as Connection[]);

    const revision = await createGraphRevision(projectId, title, nodes, relationships);
    return NextResponse.json({ success: true, revision });
  } catch (error) {
    console.error('Error managing revisions:', error);
    return NextResponse.json(
      { error: 'Failed to process revision' },
      { status: 500 }
    );
  }
}
