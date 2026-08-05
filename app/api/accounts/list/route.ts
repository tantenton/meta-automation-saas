// app/api/accounts/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SupabaseClient } from '@supabase/supabase-js';
import { getInstagramAccount } from '@/lib/meta-api/auth';
import { refreshAccessToken } from '@/lib/meta-api/token-refresh';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = new SupabaseClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Refresh token if needed
    let userTokens = await supabase
      .from('users')
      .select('meta_access_token, meta_token_expiry, meta_refresh_token')
      .eq('id', session.user.id)
      .single();

    if (userTokens.data && userTokens.data.meta_access_token) {
      const needsRefresh = userTokens.data.meta_token_expiry 
        ? new Date(userTokens.data.meta_token_expiry) < new Date()
        : false;

      if (needsRefresh && userTokens.data.meta_refresh_token) {
        try {
          const { data: user, error } = await supabase
            .from('users')
            .select('meta_refresh_token')
            .eq('id', session.user.id)
            .single();

          if (!error && user) {
            // Note: The actual refresh logic needs to be implemented
            // For now, we continue with the existing token
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      }
    }

    // Get social accounts for user
    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ accounts }, { status: 200 });
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
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { platform, accessToken } = body;

    if (!platform || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required fields: platform and accessToken' },
        { status: 400 }
      );
    }

    // Fetch user info from the platform
    let userId: string;
    let username: string | null = null;
    let pictureUrl: string | null = null;

    if (platform === 'instagram' || platform === 'facebook') {
      // For Instagram/Facebook, we need to get the user ID from the token
      // This would require calling the platform's API
      // For now, we'll use a placeholder
      const userIdMatch = accessToken.match(/facebook\.com|instagram\.com/);
      if (!userIdMatch) {
        // Extract from access token - in practice, this would call the platform API
        // For demo purposes, we'll generate a placeholder
        userId = `fb_${Date.now()}`;
      } else {
        userId = `fb_${Date.now()}`;
      }
    } else {
      return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
    }

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('platform_user_id', userId)
      .single();

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Account already linked' },
        { status: 409 }
      );
    }

    // Save account to database
    const { data: account, error } = await supabase
      .from('social_accounts')
      .insert({
        user_id: session.user.id,
        platform,
        platform_user_id: userId,
        username: username || undefined,
        access_token: accessToken,
        token_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ account }, { status: 201 });
  } catch (error: any) {
    console.error('Link account error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to link account' },
      { status: 500 }
    );
  }
}
