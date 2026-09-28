import { randomUUID } from 'node:crypto';
import { researchGraph } from '@/lib/ai-service';
import {
  getAllConnectionsFromDb,
  getAllNodesFromDb,
  getResearchSessions,
  saveResearchSession,
  projectExistsInDb
} from '@/lib/db';
import { normalizeGraph } from '@/lib/graph';
import type { CanvasNode, Connection, ResearchChange, ResearchMode, ResearchSession } from '@/types/canvas';

const nodeTypes = new Set(['concept', 'note', 'claim', 'question', 'hypothesis', 'ai_insight']);
const edgeLabels = new Set([
  'related_to', 'supports', 'contradicts', 'derived_from', 'depends_on', 'example_of', 'part_of',
  'causes', 'enables', 'similar_to', 'references', 'answers', 'challenges', 'extends', 'replaces'
]);

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get('projectId') || 'default';
    if (projectId.length > 80 || !projectExistsInDb(projectId)) return Response.json({ error: 'Project not found.' }, { status: 404 });
    return Response.json({ sessions: getResearchSessions(projectId) });
  } catch (error) {
    console.error('Failed to load research history:', error);
    return Response.json({ error: 'Could not load research history.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 20_000) return Response.json({ error: 'Research request is too large.' }, { status: 413 });
    const body = await request.json();
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const projectId = typeof body?.projectId === 'string' ? body.projectId : 'default';
    const mode: ResearchMode = body?.mode === 'deep' ? 'deep' : 'quick';
    if (!query || query.length > 500) return Response.json({ error: 'Enter a research question under 500 characters.' }, { status: 400 });
    if (projectId.length > 80 || !projectExistsInDb(projectId)) return Response.json({ error: 'Project not found.' }, { status: 404 });
    if (body?.mode !== 'quick' && body?.mode !== 'deep') return Response.json({ error: 'Choose quick or deep research.' }, { status: 400 });

    const graph = normalizeGraph(getAllNodesFromDb(projectId), getAllConnectionsFromDb(projectId));
    const { result, sources, searchQueries, provider, model, usedFallback } = await researchGraph(query, mode, graph, projectId);
    const existingSourceUrls = new Set(Object.values(graph.nodesById).map(node => node.url).filter(Boolean));
    const idByTempId = new Map<string, string>();
    const changes: ResearchChange[] = [];
    const baseX = Math.max(200, ...Object.values(graph.nodesById).map(node => node.x + (node.width || 280))) + 120;
    const baseY = Math.min(220, ...Object.values(graph.nodesById).map(node => node.y));

    for (const [index, item] of result.nodes.slice(0, mode === 'deep' ? 12 : 5).entries()) {
      if (!item || !nodeTypes.has(item.type) || typeof item.tempId !== 'string' || typeof item.title !== 'string') continue;
      const id = `research-${randomUUID()}`;
      idByTempId.set(item.tempId, id);
      const type = item.type as CanvasNode['type'];
      const node: CanvasNode = {
        id, type,
        x: baseX + (index % 3) * 330,
        y: baseY + Math.floor(index / 3) * 245,
        width: type === 'question' ? 300 : 280,
        color: type === 'question' ? 'terracotta' : type === 'claim' ? 'neutral' : 'cobalt',
        title: item.title.trim().slice(0, 500),
        content: String(item.content || '').slice(0, 12000),
        createdAt: Date.now(),
        metadata: {
          origin: 'ai',
          ...(type === 'claim' ? { claimStatus: 'unverified' as const } : {}),
          rationale: String(item.rationale || '').slice(0, 2000)
        }
      };
      if (node.title) changes.push({ id: randomUUID(), kind: 'node', payload: node, status: 'pending', rationale: node.metadata?.rationale });
    }

    const sourceNodes: CanvasNode[] = sources
      .filter(source => !existingSourceUrls.has(source.url))
      .map((source, index) => ({
        id: `research-${randomUUID()}`,
        type: 'source',
        x: baseX + (index % 3) * 330,
        y: baseY + 260 + Math.floor(index / 3) * 245,
        width: 280,
        color: 'sage',
        title: source.title.slice(0, 300),
        url: source.url,
        domain: (() => { try { return new URL(source.url).hostname; } catch { return ''; } })(),
        description: 'Discovered through grounded search. Review before using as evidence.',
        createdAt: Date.now(),
        metadata: { origin: 'ai', rationale: 'Discovered during this research run; not yet linked to a claim.' }
      }));
    for (const source of sourceNodes) changes.push({
      id: randomUUID(), kind: 'node', payload: source, status: 'pending', rationale: source.metadata?.rationale
    });

    const newNodeIds = new Set([...idByTempId.values()]);
    const newEdges: Connection[] = result.relationships.slice(0, 14).flatMap(item => {
      const from = idByTempId.get(item.fromTempId);
      const to = idByTempId.get(item.toTempId);
      if (!from || !to || !newNodeIds.has(from) || !newNodeIds.has(to) || from === to) return [];
      const proposedLabel = item.label.trim().toLowerCase().replace(/\s+/g, '_');
      const label = edgeLabels.has(proposedLabel) ? proposedLabel : 'related_to';
      const edge: Connection = {
        id: `research-edge-${randomUUID()}`,
        from, to, label,
        color: 'neutral',
        arrowhead: 'end',
        lineStyle: 'curved',
        strokePattern: 'solid',
        animated: false,
        metadata: {
          origin: 'ai',
          confidence: Number.isFinite(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : undefined,
          evidence: String(item.evidence || '').slice(0, 2000)
        }
      };
      return [edge];
    });
    for (const edge of newEdges) changes.push({
      id: randomUUID(), kind: 'relationship', payload: edge, status: 'pending', rationale: edge.metadata?.evidence
    });

    const session: ResearchSession = {
      id: randomUUID(), query, mode, status: 'review',
      summary: result.summary.slice(0, 6000),
      trail: [
        `Engine: ${provider} · ${model}${usedFallback ? ' (Automatic Fallback Triggered)' : ''}`,
        `Research question: ${query}`,
        ...searchQueries.map(text => `Search: ${text.slice(0, 500)}`),
        `Grounded sources discovered: ${sources.length}`,
        'Generated knowledge is unverified and remains pending until reviewed.'
      ],
      changes,
      createdAt: Date.now()
    };
    saveResearchSession(session, projectId);
    return Response.json({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'AI_NOT_CONFIGURED') {
      return Response.json({ error: 'Add OPENAI_API_KEY or GEMINI_API_KEY to the server environment to enable research.' }, { status: 503 });
    }
    console.error('Research run failed:', error);
    return Response.json({ error: 'Research could not complete. Try again.' }, { status: 502 });
  }
}
