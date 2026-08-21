import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caption, platform = 'instagram', tone = 'inspiring', brandVoice, imageUrl } = body;

    const aiBaseUrl = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1';
    const aiApiKey = process.env.AI_API_KEY || process.env.BIRRULABS_API_KEY || process.env.ROUTER_API_KEY;
    const aiModel = process.env.AI_MODEL || 'marketku/mk/haiku-4.5';

    const prompt = `You are a social media copywriter for BirruLabs.
Generate a captivating, engaging, and high-converting ${platform} caption.

Tone: ${tone}
${brandVoice ? `Brand Voice: ${brandVoice}` : ''}
${caption ? `Topic / Initial thoughts: ${caption}` : ''}
${imageUrl ? `Image context: Attached media at ${imageUrl}` : ''}

Guidelines:
- Platform-native style for ${platform}
- Strong hook in the first line
- Clear value and concise storytelling
- Natural call-to-action
- 3 to 6 relevant trending hashtags at the end
- Return ONLY the final caption text ready to publish, without markdown quotes or explanation.`;

    if (aiApiKey) {
      try {
        const res = await fetch(`${aiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiApiKey}`,
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              { role: 'system', content: 'You are an expert social media manager. Provide concise, viral, high-quality post captions.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 400,
            temperature: 0.7,
          }),
        });

        if (res.ok) {
          const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
          const generated = data.choices?.[0]?.message?.content?.trim();
          if (generated) {
            return NextResponse.json({ caption: generated });
          }
        }
      } catch (err) {
        console.warn('[ai/caption] Cloud AI failed, falling back to local heuristic:', err);
      }
    }

    // Try local 9router if available
    const routerBaseUrl = process.env.ROUTER_BASE_URL || 'http://127.0.0.1:20128';
    if (process.env.ROUTER_API_KEY) {
      try {
        const res = await fetch(`${routerBaseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'ali/qwen3-coder-flash',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 300,
          }),
        });
        if (res.ok) {
          const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
          const text = data.choices?.[0]?.message?.content?.trim();
          if (text) return NextResponse.json({ caption: text });
        }
      } catch {}
    }

    // Dynamic smart template fallback
    const base = caption?.trim() || 'Building the future of autonomous systems and creator tools.';
    const toneMap: Record<string, string> = {
      inspiring: `✨ ${base}\n\nEvery step forward is compounding progress. Focus on building real value, test relentlessly, and let the output speak for itself.\n\n#BirruLabs #Automation #BuildInPublic #Innovation`,
      casual: `Quick update: ${base} 🚀\n\nShipping features, tweaking workflows, and keeping things clean. What are you building today?\n\n#TechCommunity #Builders #CreatorEconomy`,
      professional: `${base}\n\nKey takeaways from our latest implementation: prioritize reliability, isolate secrets, and maintain high standards across all surfaces.\n\n#Engineering #SaaS #CloudArchitecture #BirruLabs`,
      humorous: `${base} 😅\n\nWhen the code runs on the first try without errors, that's when you know you should check the logs twice.\n\n#DevLife #TechHumor #ShipIt`,
      witty: `${base} ⚡\n\nAutomate the routine, engineer the edge cases, never compromise on quality.\n\n#AntiSlop #FullStack #Productivity`,
    };

    const finalFallback = toneMap[tone] || toneMap.inspiring;
    return NextResponse.json({ caption: finalFallback });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate caption" }, { status: 500 });
  }
}
