import { randomUUID } from 'node:crypto';
import { askGraph, askGraphStream, type GraphAnswer } from '@/lib/ai-service';
import {
  getAllConnectionsFromDb,
  getAllNodesFromDb,
  getChatMessages,
  getLatestChatThreadId,
  saveChatMessages,
  userHasProjectAccess,
  type ChatMessageRecord
} from '@/lib/db';
import { normalizeGraph } from '@/lib/graph';
import { getServerAuth } from '@/lib/auth';
import { deductCredits, refundCredits } from '@/lib/credits';
import type { CanvasNode, Connection } from '@/types/canvas';

const THREAD_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Turns loaded as conversation memory; ai-chat trims them further to its token budget. */
const HISTORY_LOAD_LIMIT = 12;

/** Chat threads are private to the user who wrote them, even on shared maps. */
function chatUserKey(auth: { userId?: string | null; user?: { id?: string } | null }) {
  return auth.user?.id || auth.userId || 'local';
}

function exchangeRecords(
  base: { projectId: string; threadId: string; userKey: string },
  question: string,
  answer: Pick<GraphAnswer, 'answer' | 'referencedNodeIds' | 'toolCall' | 'provider' | 'model'>
): ChatMessageRecord[] {
  const now = Date.now();
  return [
    { ...base, id: randomUUID(), role: 'user', content: question, referencedNodeIds: [], toolCall: null, createdAt: now },
    {
      ...base,
      id: randomUUID(),
      role: 'assistant',
      content: answer.answer,
      referencedNodeIds: answer.referencedNodeIds,
      toolCall: answer.toolCall ?? null,
      provider: answer.provider ?? null,
      model: answer.model ?? null,
      createdAt: now + 1
    }
  ];
}

/** Restores a chat thread: the one named by ?threadId, else the user's latest on this project. */
export async function GET(request: Request) {
  try {
    const auth = await getServerAuth();
    const userId = auth.user?.id || auth.userId;
    if (!auth.isLocal && !userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const projectId = params.get('projectId') || '';
    if (!projectId || projectId.length > 80 || !(await userHasProjectAccess(projectId, userId, auth.orgId, auth.clerkId))) {
      return Response.json({ error: 'Project not found.' }, { status: 404 });
    }
    const userKey = chatUserKey(auth);
    const requested = params.get('threadId');
    const threadId = requested && THREAD_ID.test(requested) ? requested : await getLatestChatThreadId(projectId, userKey);
    if (!threadId) return Response.json({ threadId: null, messages: [] });

    const messages = await getChatMessages(projectId, userKey, threadId, 50);
    return Response.json({
      threadId,
      messages: messages.map(({ id, role, content, referencedNodeIds, provider, model, createdAt }) => ({
        id, role, content, referencedNodeIds, provider, model, createdAt
      }))
    });
  } catch (error) {
    console.error('Failed to load chat history:', error);
    return Response.json({ error: 'Could not load chat history.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getServerAuth();
    const userId = auth.user?.id || auth.userId;
    const orgId = auth.orgId;
    const clerkId = auth.clerkId;
    if (!auth.isLocal && !userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const length = Number(request.headers.get('content-length') || 0);
    if (length > 20_000) return Response.json({ error: 'Question is too large.' }, { status: 413 });
    const body = await request.json();
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question || question.length > 2000) {
      return Response.json({ error: 'Enter a question under 2,000 characters.' }, { status: 400 });
    }
    const selectedNodeId = typeof body.selectedNodeId === 'string' ? body.selectedNodeId.slice(0, 200) : undefined;
    const projectId = typeof body.projectId === 'string' ? body.projectId : '';
    if (!projectId || projectId.length > 80 || !(await userHasProjectAccess(projectId, userId, orgId, clerkId))) {
      return Response.json({ error: 'Project not found.' }, { status: 404 });
    }

    const userKey = chatUserKey(auth);
    const threadId = typeof body.threadId === 'string' && THREAD_ID.test(body.threadId) ? body.threadId : randomUUID();

    const [rawNodes, rawEdges, pastMessages] = await Promise.all([
      getAllNodesFromDb(projectId),
      getAllConnectionsFromDb(projectId),
      getChatMessages(projectId, userKey, threadId, HISTORY_LOAD_LIMIT)
    ]);
    const history = pastMessages.map(({ role, content, referencedNodeIds }) => ({ role, content, referencedNodeIds }));
    const remember = async (answer: Parameters<typeof exchangeRecords>[2]) => {
      if (!answer.answer.trim()) return;
      await Promise.resolve(saveChatMessages(exchangeRecords({ projectId, threadId, userKey }, question, answer)))
        .catch(err => console.error('Could not save chat messages:', err));
    };
    const graph = normalizeGraph(rawNodes as CanvasNode[], rawEdges as Connection[]);

    // Charge Context Credits up front (atomic), refund if the answer fails.
    const creditNote = `Asked: "${question.slice(0, 50)}..."`;
    let creditsRemaining: number | undefined;
    if (userId) {
      const charge = await deductCredits(userId, 'chat', creditNote);
      if (!charge.success) {
        return Response.json({
          error: 'INSUFFICIENT_CREDITS',
          message: charge.error || 'Insufficient Context Credits. Please top up to continue.',
          requiredCredits: charge.cost,
          currentBalance: charge.balance
        }, { status: 402 });
      }
      creditsRemaining = charge.balance;
    }
    const refund = async () => {
      if (userId) await refundCredits(userId, 'chat', `Refund: ${creditNote}`).catch(err => console.error('Credit refund failed:', err));
    };
    const wantsStream = request.headers.get('accept')?.includes('text/event-stream') || body?.stream === true;

    if (wantsStream) {
      const encoder = new TextEncoder();
      // Stops the model call when the client disconnects or cancels the stream.
      const cancel = new AbortController();
      const signal = AbortSignal.any([request.signal, cancel.signal]);
      let open = true;
      const stream = new ReadableStream({
        async start(controller) {
          const send = (event: string, data: unknown) => {
            if (open) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };
          try {
            send('thread', { threadId });
            for await (const event of askGraphStream(question, graph, { selectedNodeId, projectId, history, signal })) {
              send(event.type, event);
              if (event.type === 'done') {
                await remember({
                  answer: event.text ?? '',
                  referencedNodeIds: event.referencedNodeIds ?? [],
                  toolCall: event.toolCall,
                  provider: event.provider,
                  model: event.model
                });
              }
            }
            if (creditsRemaining !== undefined) send('credits', { creditsRemaining });
          } catch (err) {
            if (signal.aborted) {
              console.info('Graph chat stream cancelled by the client.');
            } else {
              console.error('Graph chat stream failed:', err);
            }
            await refund();
            const errorMsg = err instanceof Error && err.message === 'AI_NOT_CONFIGURED'
              ? 'AI is not configured on the server.'
              : 'The graph assistant could not answer. Your credit was refunded.';
            send('error', { error: errorMsg });
          } finally {
            if (open) {
              open = false;
              controller.close();
            }
          }
        },
        cancel() {
          open = false;
          cancel.abort();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        }
      });
    }

    let result: Awaited<ReturnType<typeof askGraph>>;
    try {
      result = await askGraph(question, graph, { selectedNodeId, projectId, history, signal: request.signal });
    } catch (err) {
      await refund();
      throw err;
    }

    await remember(result);
    return Response.json({ ...result, threadId, creditsRemaining });
  } catch (error) {
    if (error instanceof Error && error.message === 'AI_NOT_CONFIGURED') {
      return Response.json({ error: 'Add OPENAI_API_KEY or GEMINI_API_KEY to the server environment to enable AI.' }, { status: 503 });
    }
    console.error('Graph chat failed:', error);
    return Response.json({ error: 'The graph assistant could not answer. Try again.' }, { status: 502 });
  }
}

