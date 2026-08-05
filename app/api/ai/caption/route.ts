// app/api/ai/caption/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getMetaUser, getInstagramAccount } from '@/lib/meta-api/auth';
import { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const routerBaseUrl = process.env.ROUTER_BASE_URL || 'http://3.107.28.235:20128';
const routerApiKey = process.env.ROUTER_API_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = new SupabaseClient(supabaseUrl, supabaseAnonKey);

interface CaptionRequest {
  platform: 'instagram' | 'threads';
  imageUrl?: string;
  caption: string;
  brandVoice?: string;
  tone?: 'professional' | 'casual' | 'humorous' | 'inspiring' | 'witty';
  hashtags?: boolean;
  maxChars?: number;
}

interface CaptionResponse {
  caption: string;
  hashtags: string[];
  estimatedEngagement?: number;
  toneAnalysis?: {
    score: number;
    description: string;
  };
}

/**
 * Generate AI caption using 9router
 */
async function generateCaptionWithRouter(payload: {
  platform: string;
  imageUrl?: string;
  caption: string;
  brandVoice?: string;
  tone?: string;
  hashtags?: boolean;
}): Promise<CaptionResponse> {
  const response = await fetch(`${routerBaseUrl}/api/v1/caption`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${routerApiKey || 'default-key'}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to generate caption');
  }

  return await response.json();
}

/**
 * Generate caption using local AI (fallback)
 */
async function generateCaptionFallback(payload: {
  platform: string;
  imageUrl?: string;
  caption: string;
  brandVoice?: string;
  tone?: string;
}): Promise<CaptionResponse> {
  const { platform, imageUrl, caption, brandVoice, tone } = payload;

  // Basic caption generation logic
  let generatedCaption = caption;

  // Apply tone
  if (tone === 'casual') {
    generatedCaption = `Hey everyone! ${generatedCaption} Let me know what you think! 👇`;
  } else if (tone === 'professional') {
    generatedCaption = `${generatedCaption} #Professional #Excellence`;
  } else if (tone === 'inspiring') {
    generatedCaption = `${generatedCaption} ✨ Keep pushing forward! #Motivation`;
  } else if (tone === 'witty') {
    generatedCaption = `${generatedCaption} 😏 You know you want to!`;
  }

  // Add platform-specific hashtags
  const defaultHashtags = platform === 'threads' 
    ? ['#Threads', '#Community', '#Share']
    : ['#Instagram', '#Reels', '#Content'];

  if (brandVoice) {
    defaultHashtags.push(`#${brandVoice.replace(/\s/g, '')}`);
  }

  return {
    caption: generatedCaption,
    hashtags: defaultHashtags,
    toneAnalysis: {
      score: 85,
      description: 'Optimized for engagement',
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CaptionRequest = await request.json();
    const { platform, imageUrl, caption, brandVoice, tone, hashtags, maxChars = 2200 } = body;

    if (!caption || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: caption and platform' },
        { status: 400 }
      );
    }

    // Limit caption length
    const limitedCaption = caption.substring(0, maxChars);

    // Try to use 9router if available
    let result: CaptionResponse;

    if (routerBaseUrl && routerApiKey) {
      try {
        result = await generateCaptionWithRouter({
          platform,
          imageUrl,
          caption: limitedCaption,
          brandVoice,
          tone,
          hashtags,
        });
      } catch (error) {
        console.warn('9router caption generation failed, using fallback:', error);
        result = await generateCaptionFallback({
          platform,
          imageUrl,
          caption: limitedCaption,
          brandVoice,
          tone,
        });
      }
    } else {
      result = await generateCaptionFallback({
        platform,
        imageUrl,
        caption: limitedCaption,
        brandVoice,
        tone,
      });
    }

    // Add user ID to result for tracking
    result.caption = result.caption.substring(0, maxChars);

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: any) {
    console.error('Generate caption error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate caption' },
      { status: 500 }
    );
  }
}

/**
 * Get caption history for a user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const { data: captions, error } = await supabase
      .from('ai_captions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ captions }, { status: 200 });
  } catch (error: any) {
    console.error('Get caption history error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch caption history' },
      { status: 500 }
    );
  }
}
