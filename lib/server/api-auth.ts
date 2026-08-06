import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function authorizeMachine(request: NextRequest): NextResponse | null {
  const expected = process.env.HERMES_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: 'server_not_configured', message: 'HERMES_API_KEY is missing' }, { status: 503 });
  }
  const auth = request.headers.get('authorization') || '';
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!supplied || !safeEqual(supplied, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

export function authorizeWorker(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET || process.env.HERMES_API_KEY;
  if (!secret) return NextResponse.json({ error: 'server_not_configured' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!supplied || !safeEqual(supplied, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return null;
}
