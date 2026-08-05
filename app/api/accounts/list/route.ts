// app/api/accounts/list/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Placeholder for now - will be connected to Supabase later
    // For demo, return empty list
    return NextResponse.json({ accounts: [] }, { status: 200 });
  } catch (error: any) {
    console.error('Get accounts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, accessToken } = body;

    if (!platform || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required fields: platform and accessToken' },
        { status: 400 }
      );
    }

    // Placeholder - will be implemented with Supabase later
    const account = {
      id: `acc_${Date.now()}`,
      platform,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ account }, { status: 201 });
  } catch (error: any) {
    console.error('Link account error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to link account' },
      { status: 500 }
    );
  }
}
