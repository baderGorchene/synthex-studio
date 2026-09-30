import { randomUUID } from 'node:crypto';
import { createProjectInDb, deleteProjectFromDb, getProjectsFromDb, moveProjectToWorkspace, renameProjectInDb, userHasProjectAccess, type ResearchProject } from '@/lib/db';
import { syncGraphVectors } from '@/lib/rag/vector-store';
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
        'My first map',
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

/**
 * Rename a map anyone in its workspace can open ({ projectId, title }), or move a map you created
 * into the active team or back to your personal workspace ({ projectId, workspace }).
 */
export async function PATCH(request: Request) {
  try {
    const auth = await getServerAuth();
    const userId = auth.user?.id || auth.userId;
    const clerkId = auth.clerkId;
    if (!auth.isLocal && !userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const projectId = typeof body?.projectId === 'string' ? body.projectId : '';

    if (typeof body?.title === 'string') {
      const title = body.title.trim();
      if (!projectId || projectId.length > 80) return Response.json({ error: 'Choose a map to rename.' }, { status: 400 });
      if (title.length < 2 || title.length > 80) {
        return Response.json({ error: 'Give the map a name between 2 and 80 characters.' }, { status: 400 });
      }
      if (!(await userHasProjectAccess(projectId, userId, auth.orgId, clerkId))) {
        return Response.json({ error: 'Map not found.' }, { status: 404 });
      }
      await renameProjectInDb(projectId, title);
      return Response.json({ renamed: true, title });
    }

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
    console.error('Failed to update project:', error);
    return Response.json({ error: 'Could not update that map.' }, { status: 500 });
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
    if (title.length < 2 || title.length > 80) {
      return Response.json({ error: 'Give the project a name between 2 and 80 characters.' }, { status: 400 });
    }
    const project = await createProjectInDb(`project-${randomUUID()}`, title, userId, orgId);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return Response.json({ error: 'Could not create that project.' }, { status: 500 });
  }
}

/** Delete a map you created, with its notes, links, research history, revisions and chat. */
export async function DELETE(request: Request) {
  try {
    const auth = await getServerAuth();
    const userId = auth.user?.id || auth.userId;
    const clerkId = auth.clerkId;
    if (!auth.isLocal && !userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const projectId = new URL(request.url).searchParams.get('projectId') || '';
    if (!projectId || projectId.length > 80) return Response.json({ error: 'Choose a map to delete.' }, { status: 400 });

    const deleted = await deleteProjectFromDb(projectId, userId, clerkId);
    if (!deleted) return Response.json({ error: 'Only the person who created a map can delete it.' }, { status: 404 });

    // Drop the map's search index too; the map itself is already gone, so a failure here is only logged.
    try {
      await syncGraphVectors(projectId, []);
    } catch (error) {
      console.warn('Could not clear the search index of a deleted map:', error);
    }
    return Response.json({ deleted: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return Response.json({ error: 'Could not delete that map.' }, { status: 500 });
  }
}
