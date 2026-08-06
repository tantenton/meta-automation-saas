import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    error: 'deprecated_endpoint',
    message: 'Use authenticated POST /api/v1/posts. This endpoint no longer returns mock success.',
  }, { status: 410 });
}
