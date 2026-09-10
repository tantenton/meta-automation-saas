/**
 * Gemini / 9Router Image Generation Client
 * BirruLabs standard headless image generator.
 */

export interface GeminiImageOptions {
  prompt: string;
  model?: string;
  size?: '1024x1024' | '1024x1792' | '1792x1024' | string;
  num_steps?: number;
  routerUrl?: string;
  apiKey?: string;
}

export interface GeminiImageResult {
  imageBuffer: Buffer;
  contentType: 'image/jpeg' | 'image/png';
  model: string;
}

export async function generateGeminiImage(options: GeminiImageOptions): Promise<GeminiImageResult> {
  const prompt = options.prompt.trim();
  const model = options.model || process.env.IMAGE_GEN_MODEL || 'ag/gemini-3.1-flash-image';
  const size = options.size || '1024x1024';

  const routerUrl =
    options.routerUrl ||
    process.env.ROUTER_URL ||
    process.env.ROUTER_BASE_URL ||
    process.env.AI_BASE_URL ||
    'http://127.0.0.1:20128';

  const apiKey =
    options.apiKey ||
    process.env.ROUTER_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.BIRRULABS_API_KEY ||
    process.env.NINEROUTER_KEY ||
    '';

  // 1. Try 9Router / OpenAI-compatible image endpoint
  const endpoint = `${routerUrl.replace(/\/+$/, '')}/v1/images/generations`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const payload = {
    model,
    prompt,
    size,
    response_format: 'b64_json',
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
      };

      const item = data.data?.[0];
      if (item?.b64_json) {
        return {
          imageBuffer: Buffer.from(item.b64_json, 'base64'),
          contentType: 'image/jpeg',
          model,
        };
      }
      if (item?.url) {
        const imgFetch = await fetch(item.url);
        if (imgFetch.ok) {
          const arrBuf = await imgFetch.arrayBuffer();
          return {
            imageBuffer: Buffer.from(arrBuf),
            contentType: 'image/jpeg',
            model,
          };
        }
      }
    } else {
      const errText = await res.text();
      console.warn(`[gemini-image] 9Router image gen error (${res.status}): ${errText}`);
    }
  } catch (err) {
    console.warn(`[gemini-image] 9Router connection failed: ${err}`);
  }

  // 2. Direct Google Gemini / Imagen endpoint fallback if GEMINI_API_KEY or GOOGLE_API_KEY is available
  const googleApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (googleApiKey) {
    try {
      const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${googleApiKey}`;
      const gRes = await fetch(googleUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: size.includes('1792') ? '9:16' : '1:1' },
        }),
      });

      if (gRes.ok) {
        const gData = (await gRes.json()) as {
          predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
        };
        const gItem = gData.predictions?.[0];
        if (gItem?.bytesBase64Encoded) {
          return {
            imageBuffer: Buffer.from(gItem.bytesBase64Encoded, 'base64'),
            contentType: (gItem.mimeType as 'image/png' | 'image/jpeg') || 'image/jpeg',
            model: 'imagen-3.0-generate-002',
          };
        }
      }
    } catch (gErr) {
      console.warn(`[gemini-image] Google Imagen direct call failed: ${gErr}`);
    }
  }

  throw new Error(`Failed to generate Gemini image from all configured endpoints`);
}
