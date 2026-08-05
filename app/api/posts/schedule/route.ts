// app/api/posts/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, content, mediaUrl, scheduledAt } = body;

    if (!accountId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId and content' },
        { status: 400 }
      );
    }

    // Validate scheduledAt if provided
    let scheduledAtDate: string | null = null;
    if (scheduledAt) {
      const date = new Date(scheduledAt);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduledAt date' }, { status: 400 });
      }
      scheduledAtDate = date.toISOString();
    }

    // Placeholder - will be implemented with Supabase later
    const post = {
      id: `post_${Date.now()}`,
      account_id: accountId,
      content,
      media_url: mediaUrl ? [mediaUrl] : [],
      status: scheduledAtDate ? 'scheduled' : 'draft',
      scheduled_at: scheduledAtDate,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, post }, { status: 201 });
  } catch (error: any) {
    console.error('Schedule post error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to schedule post' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Placeholder - will be implemented with Supabase later
    return NextResponse.json({ posts: [] }, { status: 200 });
  } catch (error: any) {
    console.error('Get scheduled posts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch scheduled posts' },
      { status: 500 }
    );
  }
}
