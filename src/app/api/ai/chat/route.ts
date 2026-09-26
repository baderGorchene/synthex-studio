import { askGraph } from '@/lib/ai-service';
import { getAllConnectionsFromDb, getAllNodesFromDb, projectExistsInDb } from '@/lib/db';
import { normalizeGraph } from '@/lib/graph';

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 20_000) return Response.json({ error: 'Question is too large.' }, { status: 413 });
    const body = await request.json();
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question || question.length > 2000) {
      return Response.json({ error: 'Enter a question under 2,000 characters.' }, { status: 400 });
    }
    const selectedNodeId = typeof body.selectedNodeId === 'string' ? body.selectedNodeId.slice(0, 200) : undefined;
    const projectId = typeof body.projectId === 'string' ? body.projectId : 'default';
    if (projectId.length > 80 || !projectExistsInDb(projectId)) return Response.json({ error: 'Project not found.' }, { status: 404 });
    const graph = normalizeGraph(getAllNodesFromDb(projectId), getAllConnectionsFromDb(projectId));
    const result = await askGraph(question, graph, selectedNodeId);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'AI_NOT_CONFIGURED') {
      return Response.json({ error: 'Add GEMINI_API_KEY to the server environment to enable AI.' }, { status: 503 });
    }
    console.error('Graph chat failed:', error);
    return Response.json({ error: 'The graph assistant could not answer. Try again.' }, { status: 502 });
  }
}
