import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

interface ContentPattern {
  name: string;
  description: string;
  hook_type: string;
  example_hooks: string[];
}

interface HNStory {
  id: number;
  title: string;
  score: number;
  time: number;
  url?: string;
  text?: string;
}

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request);
  if (denied) return denied;

  const db = getSupabaseAdmin();

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const accountId = body.account_id as string;

    if (!accountId) {
      return NextResponse.json({ error: 'account_id_required' }, { status: 400 });
    }

    // Fetch top HackerNews stories
    const hnTopUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json';
    const hnTopRes = await fetch(hnTopUrl);
    if (!hnTopRes.ok) {
      return NextResponse.json({ error: 'hn_top_fetch_failed', status: hnTopRes.status }, { status: 500 });
    }
    const hnStoryIds = await hnTopRes.json() as number[];

    // Fetch details for top 20 stories
    const hnStories: HNStory[] = [];
    for (const id of hnStoryIds.slice(0, 20)) {
      try {
        const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (storyRes.ok) {
          const story = await storyRes.json() as HNStory;
          hnStories.push(story);
        }
      } catch {
        // Skip stories that fail
        continue;
      }
    }

    // Filter stories with score >= 50
    const filteredStories = hnStories.filter(s => s.score >= 50);

    // Fetch current content_strategy for account
    const { data: existingStrategy } = await db.from('content_strategy')
      .select('preferred_patterns, key_learnings')
      .eq('account_id', accountId)
      .maybeSingle();

    const preferredPatterns = existingStrategy?.preferred_patterns || [];
    const keyLearnings = existingStrategy?.key_learnings || [];

    // Call AI to extract content patterns from HN stories
    const aiUrl = 'https://ws-fwyp076y0bhcpj55.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions';
    const aiApiKey = process.env.ALIYUN_MAAS_API_KEY || process.env.AI_API_KEY;

    if (!aiApiKey) {
      return NextResponse.json({ error: 'AI_API_KEY not configured' }, { status: 503 });
    }

    const hnStoryText = filteredStories.map(s => `#${s.id}: "${s.title}" (score: ${s.score})`).join('\n');

    const prompt = `Analyze these viral tech/productivity stories from HackerNews and extract 3-5 content patterns that would work for Indonesian casual social media (Threads/Facebook).

HN Stories:
${hnStoryText}

Each pattern should be:
- name: short descriptive name (camelCase)
- description: brief explanation of when to use this pattern
- hook_type: category of hook (question, curiosity, relatable, shock, how-to)
- example_hooks: 2-3 concrete hook examples in casual Indonesian

Return a JSON array of patterns. Do not include any other text.`;

    try {
      const aiRes = await fetch(aiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen3.8-max',
          max_tokens: 2000,
          stream: false,
          messages: [
            { role: 'system', content: 'You are an expert at analyzing viral content patterns and adapting them for Indonesian social media audiences. Return ONLY valid JSON.' },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        throw new Error(`AI API failed (${aiRes.status}): ${errText}`);
      }

      const aiData = await aiRes.json() as { choices: { message: { content: string } }[] };
      const rawResponse = aiData.choices?.[0]?.message?.content?.trim() || '';

      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = rawResponse.match(/\[([\s\S]*)\]/);
      const patternsJson = jsonMatch ? jsonMatch[0] : rawResponse;

      const patterns: ContentPattern[] = JSON.parse(patternsJson);

      // Upsert patterns into content_patterns table
      const upsertedPatterns: ContentPattern[] = [];

      for (const pattern of patterns) {
        const { error: upsertErr } = await db.from('content_patterns').upsert({
          account_id: accountId,
          pattern_name: pattern.name,
          description: pattern.description,
          hook_type: pattern.hook_type,
          example_hooks: pattern.example_hooks,
          times_used: 0,
          total_likes: 0,
          total_replies: 0,
          total_reposts: 0,
          total_views: 0,
          avg_engagement_rate: 0,
          effectiveness_score: 5.0,
          last_used_at: null,
        }, { onConflict: 'account_id,pattern_name' });

        if (!upsertErr) {
          upsertedPatterns.push(pattern);
        }
      }

      return NextResponse.json({
        patterns: upsertedPatterns,
        hn_stories_analyzed: hnStories.length,
        hn_filtered_count: filteredStories.length,
        preferred_patterns: preferredPatterns,
        key_learnings: keyLearnings,
      });
    } catch (err) {
      return NextResponse.json({
        error: 'ai_extraction_failed',
        message: err instanceof Error ? err.message : String(err),
      }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({
      error: 'research_failed',
      message: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
