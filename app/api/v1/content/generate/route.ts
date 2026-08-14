import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

interface ContentPattern {
  pattern_name: string;
  description: string;
  hook_type: string;
  example_hooks: string[];
  effectiveness_score: number;
}

interface RecentPost {
  content: string;
  meta_post_id: string;
}

interface GeneratedVariant {
  content: string;
  pattern_used: string;
  hook_type: string;
  ai_score: number;
  pattern_history_score: number;
  novelty_score: number;
  composite_score: number;
  rank: number;
  reasoning: string;
}

function jaccardSimilarity(text1: string, text2: string): number {
  const normalize = (t: string) => t.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const set1 = new Set(normalize(text1));
  const set2 = new Set(normalize(text2));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request);
  if (denied) return denied;

  const db = getSupabaseAdmin();

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const accountId = body.account_id as string;
    const platform = body.platform as 'threads' | 'facebook';
    const topic = body.topic as string | undefined;

    if (!accountId) {
      return NextResponse.json({ error: 'account_id_required' }, { status: 400 });
    }

    // Fetch content_strategy
    const { data: strategy } = await db.from('content_strategy')
      .select('preferred_patterns, key_learnings')
      .eq('account_id', accountId)
      .maybeSingle();

    const preferredPatterns = strategy?.preferred_patterns || [];
    const keyLearnings = strategy?.key_learnings || [];

    // Fetch top 5 content_patterns by effectiveness_score
    const { data: topPatterns } = await db.from('content_patterns')
      .select('pattern_name, description, hook_type, example_hooks, effectiveness_score')
      .eq('account_id', accountId)
      .order('effectiveness_score', { ascending: false })
      .limit(5);

    // Fetch last 10 published posts
    const { data: recentPosts } = await db.from('posts')
      .select('content, meta_post_id')
      .eq('account_id', accountId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(10);

    // Prepare AI prompt
    const personaSystem = `Kamu adalah Birru — cowok 25 tahun yang suka share hal-hal simpel yang bikin hidup lebih enak, lebih rapi, dan lebih produktif.

Cara kamu menulis post untuk Threads/Facebook:
- Casual, natural, seperti ngobrol sama temen
- Singkat (2-3 paragraf max)
- Sesuai konteks topik
- Kadang balik tanya kalau natural
- Jangan "Terima kasih kak!", jangan formal, jangan emoji berlebihan
- Pakai "gue/lo" tapi jangan dipaksain tiap kalimat
- Komentar humor/lucu: balas dengan humor juga, jangan kaku
- NO CTA (call-to-action)
- Vary opening: JANGAN mulai gue/aku

Tone: ramah, relatable, casual, sedikit humor.`;

    const patternsInfo = topPatterns?.map((p: ContentPattern) => ({
      name: p.pattern_name,
      desc: p.description,
      hook: p.hook_type,
      examples: p.example_hooks,
      score: p.effectiveness_score,
    })) || [];

    const topicsHint = topic ? `Topik saat ini: "${topic}".\n\n` : '';
    const recentPostsHint = recentPosts?.length
      ? `JANGAN ulang konten ini (untuk novelty):\n${recentPosts.map((p: RecentPost, i: number) => `${i + 1}. ${p.content.substring(0, 100)}...`).join('\n')}`
      : '';

    const prompt = `${topicsHint}Buat 5 variasi post untuk platform ${platform.toUpperCase()} dengan persona Birru.

Format setiap post:
1. Hook (mengikuti pattern yang disebutkan)
2. Isi konten (natural, casual)
3. Pattern yang digunakan

Pattern yang tersedia (dengan effectiveness score):
${patternsInfo.map((p: { name: string; score: number; desc: string; hook: string; examples: string[] }, i: number) => `${i + 1}. ${p.name} (${p.score.toFixed(1)}): ${p.desc}\n   Hook type: ${p.hook}\n   Contoh: ${p.examples.join(', ')}`).join('\n\n')}

${recentPostsHint}

Return JSON array dengan struktur:
[
  {
    "content": "konten post lengkap",
    "pattern_used": "nama pattern",
    "hook_type": "tipe hook yang digunakan",
    "ai_score": skor virality 0-10,
    "reasoning": "penjelasan mengapa post ini effective"
  }
]
`;

    // Call AI to generate 5 variants
    const aiUrl = 'https://api.birrulabs.biz.id/v1/chat/completions';
    const aiApiKey = process.env.BIRRULABS_API_KEY || process.env.AI_API_KEY;

    if (!aiApiKey) {
      return NextResponse.json({ error: 'AI_API_KEY not configured' }, { status: 503 });
    }

    let generatedVariants: { content: string; pattern_used: string; hook_type: string; ai_score: number; reasoning: string }[] = [];

    try {
      const aiRes = await fetch(aiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: 'marketku/mk/qwen3-coder-next',
          max_tokens: 3000,
          stream: false,
          messages: [
            { role: 'system', content: personaSystem },
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

      // Extract JSON from response
      const jsonMatch = rawResponse.match(/\[([\s\S]*)\]/);
      const variantsJson = jsonMatch ? jsonMatch[0] : rawResponse;

      generatedVariants = JSON.parse(variantsJson);
    } catch (err) {
      return NextResponse.json({
        error: 'ai_generation_failed',
        message: err instanceof Error ? err.message : String(err),
      }, { status: 500 });
    }

    // Calculate novelty scores
    const variantsWithNovelty = generatedVariants.map(v => {
      const maxOverlap = recentPosts?.length
        ? Math.max(...recentPosts.map((p: RecentPost) => jaccardSimilarity(v.content, p.content || '')))
        : 0;
      const noveltyScore = Math.max(0, Math.min(10, (1 - maxOverlap) * 10));
      return { ...v, novelty_score: noveltyScore };
    });

    // Map patterns to scores
    const patternScores: Record<string, number> = {};
    for (const p of topPatterns || []) {
      patternScores[p.pattern_name] = p.effectiveness_score || 5;
    }

    // Call AI to rank variants
    const rankPrompt = `Rank these variants for virality potential on ${platform}.

Variants:
${variantsWithNovelty.map((v, i) => `${i + 1}. ${v.content.substring(0, 100)}... (pattern: ${v.pattern_used}, novelty: ${v.novelty_score.toFixed(1)})`).join('\n\n')}

For each variant, return:
- ai_score: virality potential 0-10
- pattern_history_score: from pattern effectiveness (0-10)
- novelty_score: already calculated
- composite: 0.4*ai + 0.3*history + 0.3*novelty
- reasoning: brief explanation

Return JSON array with all fields.`;

    let rankedVariants: GeneratedVariant[] = [];

    try {
      const rankRes = await fetch(aiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: 'marketku/mk/qwen3-coder-next',
          max_tokens: 2000,
          stream: false,
          messages: [
            { role: 'system', content: 'You are an expert at ranking social media content for virality. Return ONLY valid JSON.' },
            { role: 'user', content: rankPrompt },
          ],
        }),
      });

      if (!rankRes.ok) {
        throw new Error(`Ranking AI failed (${rankRes.status})`);
      }

      const rankData = await rankRes.json() as { choices: { message: { content: string } }[] };
      const rankResponse = rankData.choices?.[0]?.message?.content?.trim() || '';

      const jsonMatch = rankResponse.match(/\[([\s\S]*)\]/);
      const rankJson = jsonMatch ? jsonMatch[0] : rankResponse;

      rankedVariants = JSON.parse(rankJson) as GeneratedVariant[];

      // Preserve original content if ranking model returns scores only.
      rankedVariants = rankedVariants.map((ranked, i) => ({ ...variantsWithNovelty[i], ...ranked, content: ranked.content || variantsWithNovelty[i]?.content || "", pattern_used: ranked.pattern_used || variantsWithNovelty[i]?.pattern_used || "", hook_type: ranked.hook_type || variantsWithNovelty[i]?.hook_type || "" }));

      // Sort by composite_score descending and assign ranks
      rankedVariants.sort((a, b) => b.composite_score - a.composite_score);
      rankedVariants = rankedVariants.map((v, i) => ({ ...v, rank: i + 1 }));
    } catch (err) {
      // Fallback ranking if AI fails
      rankedVariants = variantsWithNovelty.map(v => ({
        content: v.content,
        pattern_used: v.pattern_used,
        hook_type: v.hook_type,
        ai_score: v.ai_score || 5,
        pattern_history_score: patternScores[v.pattern_used] || 5,
        novelty_score: v.novelty_score || 5,
        composite_score: 5,
        rank: 0,
        reasoning: v.reasoning || 'Fallback ranking',
      }));
      rankedVariants.sort((a, b) => b.composite_score - a.composite_score);
      rankedVariants = rankedVariants.map((v, i) => ({ ...v, rank: i + 1 }));
    }

    // Calculate final composite scores
    const finalVariants = rankedVariants.map(v => ({
      ...v,
      composite_score: parseFloat((0.4 * v.ai_score + 0.3 * v.pattern_history_score + 0.3 * v.novelty_score).toFixed(2)),
    }));

    finalVariants.sort((a, b) => b.composite_score - a.composite_score);
    finalVariants.forEach((v, i) => v.rank = i + 1);

    const best = finalVariants[0];

    return NextResponse.json({
      variants: finalVariants,
      best,
    });
  } catch (err) {
    return NextResponse.json({
      error: 'generate_failed',
      message: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
