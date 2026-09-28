import { randomUUID } from 'node:crypto';
import { createProjectInDb, getProjectsFromDb } from '@/lib/db';

export async function GET() {
  try {
    const projects = await getProjectsFromDb();
    return Response.json({ projects });
  } catch (error) {
    console.error('Failed to load projects:', error);
    return Response.json({ error: 'Could not load projects.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const template = body?.template === 'rag' ? 'rag' : body?.template === 'blank' ? 'blank' : undefined;
    if (!template || title.length < 2 || title.length > 80) {
      return Response.json({ error: 'Give the project a name between 2 and 80 characters and choose a starter.' }, { status: 400 });
    }
    const project = await createProjectInDb(`project-${randomUUID()}`, title, template);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return Response.json({ error: 'Could not create that project.' }, { status: 500 });
  }
}
