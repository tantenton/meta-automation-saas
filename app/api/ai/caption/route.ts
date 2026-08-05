import { NextResponse } from "next/server";

const routerBaseUrl = process.env.ROUTER_BASE_URL || 'http://127.0.0.1:20128';
const routerApiKey = process.env.ROUTER_API_KEY;

const fallbackCaptions = [
  "Amazing shot! Love the colors and composition. ✨",
  "This is exactly what I needed to see today. Perfect!",
  "Capturing moments like these makes life beautiful. 🌟",
  "Never seen anything like this before. Stunning! 😍",
  "Living my best life! Join me on this journey. 🚀",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageUrl, caption, platform, tone, brandVoice } = body;

    if (!platform) {
      return NextResponse.json(
        { error: "platform is required" },
        { status: 400 }
      );
    }

    // Try 9router first if API key available
    if (routerApiKey) {
      try {
        const prompt = `Generate an engaging ${platform} caption${tone ? ` with a ${tone} tone` : ''}${brandVoice ? ` for brand ${brandVoice}` : ''}${caption ? `. Context: ${caption}` : ''}. Include relevant hashtags. Keep it concise.`;

        const res = await fetch(`${routerBaseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${routerApiKey}`,
          },
          body: JSON.stringify({
            model: 'ali/qwen3-coder-flash',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
            stream: false,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const aiCaption = data.choices?.[0]?.message?.content?.trim();
          if (aiCaption) {
            return NextResponse.json({ caption: aiCaption });
          }
        }
      } catch (e) {
        console.warn('9router unavailable, using fallback');
      }
    }

    // Fallback: generate based on tone
    let generatedCaption = caption || fallbackCaptions[Math.floor(Math.random() * fallbackCaptions.length)];

    if (tone === 'casual') generatedCaption = `Hey! ${generatedCaption} 👇`;
    else if (tone === 'inspiring') generatedCaption = `${generatedCaption} ✨ Keep pushing forward!`;
    else if (tone === 'professional') generatedCaption = `${generatedCaption} #Excellence`;
    else if (tone === 'humorous') generatedCaption = `${generatedCaption} 😂 Tag a friend!`;

    const hashtags = platform === 'threads'
      ? ['#Threads', '#Community']
      : ['#Instagram', '#Content', '#Viral'];

    if (brandVoice) hashtags.push(`#${brandVoice.replace(/\s/g, '')}`);

    return NextResponse.json({
      caption: generatedCaption,
      hashtags,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate caption" }, { status: 500 });
  }
}
