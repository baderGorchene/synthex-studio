import { getServerAuth, isClerkConfigured } from '@/lib/auth';
import { userHasProjectAccess } from '@/lib/db';
import { getCollabConfig, presenceColorFor, signCollabToken } from '@/lib/collab-token';

/** The name teammates see on your cursor and avatar. */
async function displayName(auth: Awaited<ReturnType<typeof getServerAuth>>): Promise<string> {
  if (auth.user?.name) return auth.user.name;
  if (isClerkConfigured() && auth.clerkId) {
    try {
      const { currentUser } = await import('@clerk/nextjs/server');
      const user = await currentUser();
      const name = user?.fullName || user?.firstName || user?.username;
      if (name) return name;
    } catch { /* fall through to the email */ }
  }
  if (auth.user?.email) return auth.user.email.split('@')[0];
  return 'Teammate';
}

/**
 * Issues a short-lived token for joining a map's live session. Checks access exactly like every other map route.
 * When real-time sync isn't configured, answers { enabled: false } and the app works as before.
 */
export async function GET(request: Request) {
  try {
    const config = getCollabConfig();
    if (!config) return Response.json({ enabled: false });

    const auth = await getServerAuth();
    const userId = auth.user?.id || auth.userId;
    if (!auth.isLocal && !userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const projectId = new URL(request.url).searchParams.get('projectId') || '';
    if (!projectId || projectId.length > 80 || !(await userHasProjectAccess(projectId, userId, auth.orgId, auth.clerkId))) {
      return Response.json({ error: 'Project not found.' }, { status: 404 });
    }

    return Response.json({
      enabled: true,
      url: config.url,
      token: signCollabToken(config.secret, projectId, userId),
      user: { id: userId, name: (await displayName(auth)).slice(0, 60), color: presenceColorFor(userId) }
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to issue collab token:', error);
    return Response.json({ error: 'Live collaboration is unavailable right now.' }, { status: 500 });
  }
}
