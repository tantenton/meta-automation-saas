import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    error: 'deprecated_endpoint',
    message: 'Use authenticated GET /api/v1/posts.',
  }, { status: 410 });
}
