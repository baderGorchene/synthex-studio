import { randomUUID } from 'node:crypto';
import { createProjectInDb, getProjectsFromDb, moveProjectToWorkspace, type ResearchProject } from '@/lib/db';
import { getServerAuth } from '@/lib/auth';

const ownedBy = (project: ResearchProject, userId?: string | null, clerkId?: string | null) =>
  Boolean(project.userId && (project.userId === userId || project.userId === clerkId));

export async function GET() {
  try {
    const auth = await getServerAuth();
    const userId = auth.user?.id || auth.userId;
    const orgId = auth.orgId;
    const clerkId = auth.clerkId;

    if (!auth.isLocal && !userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // The list follows the active workspace: the team's maps when a team is selected, personal maps otherwise.
    let projects = await getProjectsFromDb(userId, orgId, clerkId);
    // Auto-provision a starter map if this workspace has none
    if (projects.length === 0 && userId) {
      const starter = await createProjectInDb(
        `project-${randomUUID()}`,
        'Synthex Studio Guide',
        'rag',
        userId,
        orgId
      );
      projects = [starter];
    }

    // In a team, also offer the user's personal maps so they can bring one in.
    const personal = orgId ? await getProjectsFromDb(userId, null, clerkId) : [];

    return Response.json({
      workspace: { kind: orgId ? 'team' : 'personal' },
      projects: projects.map(project => ({ ...project, isOwner: ownedBy(project, userId, clerkId) })),
      personalProjects: personal.map(project => ({ ...project, isOwner: true }))
    });
  } catch (error) {
    console.error('Failed to load projects:', error);
    return Response.json({ error: 'Could not load projects.' }, { status: 500 });
  }
}

/** Move a map you created into the active team, or back to your personal workspace. */
export async function PATCH(request: Request) {
  try {
    const auth = await getServerAuth();
    const userId = auth.user?.id || auth.userId;
    const clerkId = auth.clerkId;
    if (!auth.isLocal && !userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
    const destination = body?.workspace === 'team' ? 'team' : body?.workspace === 'personal' ? 'personal' : null;
    if (!projectId || projectId.length > 80 || !destination) {
      return Response.json({ error: 'Choose a map and where to move it.' }, { status: 400 });
    }
    if (destination === 'team' && !auth.orgId) {
      return Response.json({ error: 'Switch to a team first, then move the map into it.' }, { status: 400 });
    }
    const moved = await moveProjectToWorkspace(projectId, destination === 'team' ? auth.orgId : null, userId, clerkId);
    if (!moved) return Response.json({ error: 'Only the person who created a map can move it.' }, { status: 404 });
    return Response.json({ moved: true, workspace: destination });
  } catch (error) {
    console.error('Failed to move project:', error);
    return Response.json({ error: 'Could not move that map.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getServerAuth();
    const userId = auth.user?.id || auth.userId;
    const orgId = auth.orgId;

    if (!auth.isLocal && !userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const template = body?.template === 'rag' ? 'rag' : body?.template === 'blank' ? 'blank' : undefined;
    if (!template || title.length < 2 || title.length > 80) {
      return Response.json({ error: 'Give the project a name between 2 and 80 characters and choose a starter.' }, { status: 400 });
    }
    const project = await createProjectInDb(`project-${randomUUID()}`, title, template, userId, orgId);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return Response.json({ error: 'Could not create that project.' }, { status: 500 });
  }
}
