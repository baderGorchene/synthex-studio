import { isAIConfigured } from '@/lib/ai-service';

export async function GET() {
  return Response.json({ configured: isAIConfigured(), provider: 'Gemini' });
}
