import { askGraph, askGraphStream } from '@/lib/ai-service';
import { getAllConnectionsFromDb, getAllNodesFromDb, projectExistsInDb } from '@/lib/db';
import { normalizeGraph } from '@/lib/graph';
import { getServerAuth } from '@/lib/auth';
import { verifyCreditBalance, deductCredits } from '@/lib/credits';

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

    // Check Context Credits balance
    const auth = await getServerAuth();
    const userId = auth.user?.id || auth.clerkId;
    if (userId) {
      const check = verifyCreditBalance(userId, 'chat');
      if (!check.hasSufficient) {
        return Response.json({
          error: 'INSUFFICIENT_CREDITS',
          message: check.error || 'Insufficient Context Credits. Please top up to continue.',
          requiredCredits: check.cost,
          currentBalance: check.currentBalance
        }, { status: 402 });
      }
    }

    const graph = normalizeGraph(getAllNodesFromDb(projectId), getAllConnectionsFromDb(projectId));
    const wantsStream = request.headers.get('accept')?.includes('text/event-stream') || body?.stream === true;

    if (wantsStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of askGraphStream(question, graph, selectedNodeId, projectId)) {
              controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
            }
            if (userId) {
              const deduction = deductCredits(userId, 'chat', `Asked: "${question.slice(0, 50)}..."`);
              controller.enqueue(encoder.encode(`event: credits\ndata: ${JSON.stringify({ creditsRemaining: deduction.balance })}\n\n`));
            }
            controller.close();
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'The graph assistant could not answer.';
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`));
            controller.close();
          }
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

    const result = await askGraph(question, graph, selectedNodeId, projectId);
    let creditsRemaining: number | undefined;
    if (userId) {
      const deduction = deductCredits(userId, 'chat', `Asked: "${question.slice(0, 50)}..."`);
      creditsRemaining = deduction.balance;
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

