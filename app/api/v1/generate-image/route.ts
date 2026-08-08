/**
 * POST /api/v1/generate-image
 *
 * Generate an image via Cloudflare AI, upload to Supabase Storage,
 * and return a public URL ready for Instagram posting.
 *
 * Body:
 *   prompt       string  required  — image description
 *   model        string  optional  — CF model ID (defaults to flux-1-schnell)
 *   num_steps    number  optional  — inference steps (model-dependent)
 *   upload       boolean optional  — if false, returns base64 only (default: true)
 */

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { generateImageCF, CFImageModel } from '@/lib/cloudflare-ai';

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return NextResponse.json({ error: 'prompt_required' }, { status: 400 });
  }

  const model = (body.model as CFImageModel | undefined) ?? '@cf/black-forest-labs/flux-1-schnell';
  const num_steps = typeof body.num_steps === 'number' ? body.num_steps : undefined;
  const shouldUpload = body.upload !== false;

  try {
    // 1. Generate image via Cloudflare AI
    const { imageBuffer, contentType } = await generateImageCF({ prompt, model, num_steps });

    // 2. Optionally upload to Supabase Storage
    if (!shouldUpload) {
      return NextResponse.json({
        model,
        prompt,
        image_base64: imageBuffer.toString('base64'),
        content_type: contentType,
      });
    }

    const bucket = process.env.SUPABASE_MEDIA_BUCKET || 'meta-media';
    const path = `generated/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.jpg`;
    const db = getSupabaseAdmin();

    const { error: uploadError } = await db.storage
      .from(bucket)
      .upload(path, imageBuffer, { contentType, upsert: false });

    if (uploadError) throw new Error(uploadError.message || JSON.stringify(uploadError));

    const { data } = db.storage.from(bucket).getPublicUrl(path);

    return NextResponse.json(
      {
        model,
        prompt,
        media_id: path,
        bucket,
        path,
        public_url: data.publicUrl,
        content_type: contentType,
        size: imageBuffer.byteLength,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'generation_failed', message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
