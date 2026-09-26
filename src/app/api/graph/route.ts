import { bulkSaveCanvasToDb, getAllConnectionsFromDb, getAllNodesFromDb, projectExistsInDb } from '@/lib/db';
import { normalizeGraph } from '@/lib/graph';
import type { CanvasNodeType, CanvasNode, Connection } from '@/types/canvas';

const nodeTypes = new Set<CanvasNodeType>([
  'concept', 'note', 'source', 'claim', 'question', 'hypothesis', 'image', 'link',
  'group', 'research_result', 'task', 'ai_insight', 'section'
]);

function requestedProject(request: Request): string | undefined {
  const projectId = new URL(request.url).searchParams.get('projectId') || 'default';
  return projectId.length <= 80 ? projectId : undefined;
}

export async function GET(request: Request) {
  try {
    const projectId = requestedProject(request);
    if (!projectId || !projectExistsInDb(projectId)) return Response.json({ error: 'Project not found.' }, { status: 404 });
    const graph = normalizeGraph(getAllNodesFromDb(projectId), getAllConnectionsFromDb(projectId));
    return Response.json({ nodes: Object.values(graph.nodesById), relationships: Object.values(graph.edgesById) });
  } catch (error) {
    console.error('Failed to load knowledge graph:', error);
    return Response.json({ error: 'Could not load the knowledge graph.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 5_000_000) return Response.json({ error: 'Graph payload is too large.' }, { status: 413 });

    const body = await request.json();
    const projectId = typeof body?.projectId === 'string' ? body.projectId : 'default';
    if (projectId.length > 80 || !projectExistsInDb(projectId)) return Response.json({ error: 'Project not found.' }, { status: 404 });
    if (!Array.isArray(body?.nodes) || !Array.isArray(body?.relationships)) {
      return Response.json({ error: 'Expected nodes and relationships.' }, { status: 400 });
    }
    if (body.nodes.length > 5000 || body.relationships.length > 15000) {
      return Response.json({ error: 'Graph exceeds the current workspace limits.' }, { status: 413 });
    }

    const nodes = body.nodes as CanvasNode[];
    const relationships = body.relationships as Connection[];
    if (nodes.some(node =>
      !node || typeof node.id !== 'string' || node.id.length > 200 ||
      typeof node.title !== 'string' || !nodeTypes.has(node.type) || node.title.length > 500 ||
      (node.content !== undefined && (typeof node.content !== 'string' || node.content.length > 50000)) ||
      !Number.isFinite(node.x) || !Number.isFinite(node.y) ||
      (node.url !== undefined && (typeof node.url !== 'string' || node.url.length > 4096))
    )) {
      return Response.json({ error: 'One or more nodes contain invalid fields.' }, { status: 400 });
    }
    if (relationships.some(edge =>
      !edge || typeof edge.id !== 'string' || edge.id.length > 200 ||
      typeof edge.from !== 'string' || typeof edge.to !== 'string' ||
      (edge.label !== undefined && (typeof edge.label !== 'string' || edge.label.length > 120))
    )) {
      return Response.json({ error: 'Relationship labels must be 120 characters or fewer.' }, { status: 400 });
    }

    const graph = normalizeGraph(nodes, relationships);
    bulkSaveCanvasToDb(Object.values(graph.nodesById), Object.values(graph.edgesById), projectId);
    return Response.json({ saved: true, nodeCount: nodes.length, relationshipCount: relationships.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/Duplicate|missing node|cannot point|needs an id|needs a title|finite position/i.test(message)) {
      return Response.json({ error: message }, { status: 400 });
    }
    console.error('Failed to save knowledge graph:', error);
    return Response.json({ error: 'Could not save the knowledge graph.' }, { status: 500 });
  }
}
