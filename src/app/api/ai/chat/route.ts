import { askGraph, askGraphStream } from '@/lib/ai-service';
import { getAllConnectionsFromDb, getAllNodesFromDb, userHasProjectAccess } from '@/lib/db';
import { normalizeGraph } from '@/lib/graph';
import { getServerAuth } from '@/lib/auth';
import { deductCredits, refundCredits } from '@/lib/credits';
import type { CanvasNode, Connection } from '@/types/canvas';

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

    const [rawNodes, rawEdges] = await Promise.all([
      getAllNodesFromDb(projectId),
      getAllConnectionsFromDb(projectId)
    ]);
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
            for await (const event of askGraphStream(question, graph, { selectedNodeId, projectId, signal })) {
              send(event.type, event);
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
      result = await askGraph(question, graph, { selectedNodeId, projectId, signal: request.signal });
    } catch (err) {
      await refund();
      throw err;
    }

    return Response.json({ ...result, creditsRemaining });
  } catch (error) {
    if (error instanceof Error && error.message === 'AI_NOT_CONFIGURED') {
      return Response.json({ error: 'Add OPENAI_API_KEY or GEMINI_API_KEY to the server environment to enable AI.' }, { status: 503 });
    }
    console.error('Graph chat failed:', error);
    return Response.json({ error: 'The graph assistant could not answer. Try again.' }, { status: 502 });
  }
}

