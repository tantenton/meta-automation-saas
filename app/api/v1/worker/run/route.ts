import { NextRequest, NextResponse } from 'next/server';
import { authorizeWorker } from '@/lib/server/api-auth';
import { processDuePosts } from '@/lib/server/post-worker';

async function run(request: NextRequest) {
  const denied = authorizeWorker(request); if (denied) return denied;
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || 5), 20);
  try { return NextResponse.json({ results: await processDuePosts(limit) }); }
  catch (error) { return NextResponse.json({ error: 'worker_failed', message: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
export const GET = run;
export const POST = run;
