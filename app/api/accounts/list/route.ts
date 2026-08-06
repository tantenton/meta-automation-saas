import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'deprecated_endpoint', message: 'Use authenticated GET /api/v1/accounts.' }, { status: 410 });
}
export async function POST() {
  return NextResponse.json({ error: 'deprecated_endpoint', message: 'Use authenticated POST /api/v1/accounts.' }, { status: 410 });
}
