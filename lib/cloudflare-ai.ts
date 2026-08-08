/**
 * Cloudflare Workers AI — image generation client
 * Account ID: 70a4d88975db2853f5446bced93fd8ae
 */

export type CFImageModel =
  | '@cf/black-forest-labs/flux-1-schnell'
  | '@cf/black-forest-labs/flux-2-klein-4b'
  | '@cf/black-forest-labs/flux-2-klein-9b'
  | '@cf/black-forest-labs/flux-2-dev'
  | '@cf/bytedance/stable-diffusion-xl-lightning'
  | '@cf/stabilityai/stable-diffusion-xl-base-1.0';

export interface CFImageOptions {
  prompt: string;
  model?: CFImageModel;
  num_steps?: number;
}

export interface CFImageResult {
  imageBuffer: Buffer;
  contentType: 'image/jpeg';
  model: string;
}

export async function generateImageCF(options: CFImageOptions): Promise<CFImageResult> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error('CF_ACCOUNT_ID and CF_API_TOKEN env vars required');
  }

  const model = options.model ?? '@cf/black-forest-labs/flux-1-schnell';
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const body: Record<string, unknown> = { prompt: options.prompt };
  if (options.num_steps !== undefined) body.num_steps = options.num_steps;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CF AI error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { success: boolean; result?: { image?: string }; errors?: unknown[] };

  if (!data.success || !data.result?.image) {
    throw new Error(`CF AI failed: ${JSON.stringify(data.errors ?? data)}`);
  }

  const imageBuffer = Buffer.from(data.result.image, 'base64');
  return { imageBuffer, contentType: 'image/jpeg', model };
}
