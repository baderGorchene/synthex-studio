import { getAllConnectionsFromDb, getAllNodesFromDb, getProjectsFromDb, projectExistsInDb } from '@/lib/db';
import { normalizeGraph } from '@/lib/graph';
import { buildVaultFiles, createZipArchive, sanitizeVaultFilename } from '@/lib/vault-export';
import type { KnowledgeGraph } from '@/lib/graph';
import type { CanvasNode, Connection } from '@/types/canvas';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId') || 'default';

    if (!(await projectExistsInDb(projectId))) {
      return Response.json({ error: 'Project not found.' }, { status: 404 });
    }

    const projects = await getProjectsFromDb();
    const currentProject = projects.find(p => p.id === projectId);
    const projectTitle = currentProject?.title || 'Research Workspace';

    const rawNodes = (await getAllNodesFromDb(projectId)) as CanvasNode[];
    const rawEdges = (await getAllConnectionsFromDb(projectId)) as Connection[];
    const graph = normalizeGraph(rawNodes, rawEdges);

    const files = buildVaultFiles(graph, projectTitle);
    const zipBuffer = createZipArchive(files);

    const safeTitle = sanitizeVaultFilename(projectTitle).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'synthex-vault';

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeTitle}-obsidian-vault.zip"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Failed to export Obsidian vault:', error);
    return Response.json({ error: 'Failed to generate vault export.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawGraph = body?.graph as KnowledgeGraph;
    const projectTitle = typeof body?.title === 'string' ? body.title : 'Research Workspace';

    if (!rawGraph || !rawGraph.nodesById || !rawGraph.edgesById) {
      return Response.json({ error: 'Invalid graph payload provided.' }, { status: 400 });
    }

    const nodes = Object.values(rawGraph.nodesById);
    const edges = Object.values(rawGraph.edgesById);
    const graph = normalizeGraph(nodes, edges);

    const files = buildVaultFiles(graph, projectTitle);
    const zipBuffer = createZipArchive(files);

    const safeTitle = sanitizeVaultFilename(projectTitle).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'synthex-vault';

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeTitle}-obsidian-vault.zip"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Failed to export Obsidian vault from body:', error);
    return Response.json({ error: 'Failed to generate vault export.' }, { status: 500 });
  }
}
