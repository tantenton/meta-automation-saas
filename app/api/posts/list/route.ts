// app/api/posts/list/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Placeholder - will be implemented with Supabase later
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status');

    // Placeholder posts array
    let posts: any[] = [];

    // Apply pagination (mock)
    const paginatedPosts = posts.slice(offset, offset + limit);

    return NextResponse.json({ posts: paginatedPosts }, { status: 200 });
  } catch (error: any) {
    console.error('Get posts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
