import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';

// Internal AI proxy — forwards to configured AI backend
// Used by engage endpoint and other AI features
export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;

  const aiBaseUrl = process.env.AI_BASE_URL;
  const aiApiKey = process.env.AI_API_KEY || 'dummy';

  if (!aiBaseUrl) return NextResponse.json({ error: 'AI_BASE_URL not configured' }, { status: 500 });

  try {
    const body = await request.json();
    // Force non-streaming
    const payload = { ...body, stream: false };

    const res = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'ai_proxy_failed', message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
