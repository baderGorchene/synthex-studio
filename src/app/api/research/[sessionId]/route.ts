import { getResearchSession, reviewResearchSession, projectExistsInDb } from '@/lib/db';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const body = await request.json();
    const projectId = typeof body?.projectId === 'string' ? body.projectId : 'default';
    if (projectId.length > 80 || !projectExistsInDb(projectId)) return Response.json({ error: 'Project not found.' }, { status: 404 });
    const session = getResearchSession(sessionId, projectId);
    if (!session) return Response.json({ error: 'Research session not found.' }, { status: 404 });
    if (!Array.isArray(body?.decisions) || body.decisions.length > 100) {
      return Response.json({ error: 'Expected a list of review decisions.' }, { status: 400 });
    }
    const validIds = new Set(session.changes.filter(change => change.status === 'pending').map(change => change.id));
    if (body.decisions.some((decision: { changeId?: unknown; status?: unknown }) =>
      typeof decision?.changeId !== 'string' || !validIds.has(decision.changeId) ||
      (decision.status !== 'accepted' && decision.status !== 'rejected')
    )) {
      return Response.json({ error: 'One or more review decisions are invalid.' }, { status: 400 });
    }
    const updated = reviewResearchSession(sessionId, body.decisions, projectId);
    return Response.json({ session: updated });
  } catch (error) {
    console.error('Failed to review research changes:', error);
    return Response.json({ error: 'Could not apply those review decisions.' }, { status: 400 });
  }
}
