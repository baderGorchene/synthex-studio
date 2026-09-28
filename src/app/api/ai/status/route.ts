import { getAIStatus } from '@/lib/ai-service';

export async function GET() {
  const status = getAIStatus();
  return Response.json(status);
}
