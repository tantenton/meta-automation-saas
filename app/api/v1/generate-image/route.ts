/**
 * POST /api/v1/generate-image
 *
 * Generate an image via Gemini / 9Router (default), upload to Supabase Storage,
 * and return a public URL ready for Instagram / Facebook posting.
 *
 * Body:
 *   prompt       string  required  — image description
 *   model        string  optional  — Image model ID (defaults to ag/gemini-3.1-flash-image)
 *   size         string  optional  — 1024x1024, 1024x1792, 1792x1024 (default: 1024x1024)
 *   upload       boolean optional  — if false, returns base64 only (default: true)
 */

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { generateGeminiImage } from '@/lib/gemini-image';
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

  const reqModel = typeof body.model === 'string' ? body.model : undefined;
  const size = typeof body.size === 'string' ? body.size : '1024x1024';
  const num_steps = typeof body.num_steps === 'number' ? body.num_steps : undefined;
  const shouldUpload = body.upload !== false;

  try {
    let imageBuffer: Buffer;
    let contentType: 'image/jpeg' | 'image/png';
    let usedModel = reqModel || 'ag/gemini-3.1-flash-image';

    // If explicit Cloudflare model requested
    if (reqModel && reqModel.startsWith('@cf/')) {
      const cfRes = await generateImageCF({
        prompt,
        model: reqModel as CFImageModel,
        num_steps,
      });
      imageBuffer = cfRes.imageBuffer;
      contentType = cfRes.contentType;
      usedModel = cfRes.model;
    } else {
      // Default: Gemini Image via 9Router / Google Imagen
      const geminiRes = await generateGeminiImage({
        prompt,
        model: reqModel,
        size,
        num_steps,
      });
      imageBuffer = geminiRes.imageBuffer;
      contentType = geminiRes.contentType;
      usedModel = geminiRes.model;
    }

    // 2. Optionally upload to Supabase Storage
    if (!shouldUpload) {
      return NextResponse.json({
        model: usedModel,
        prompt,
        image_base64: imageBuffer.toString('base64'),
        content_type: contentType,
      });
    }

    const bucket = process.env.SUPABASE_MEDIA_BUCKET || 'meta-media';
    const ext = contentType === 'image/png' ? 'png' : 'jpg';
    const path = `generated/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
    const db = getSupabaseAdmin();

    const { error: uploadError } = await db.storage
      .from(bucket)
      .upload(path, imageBuffer, { contentType, upsert: false });

    if (uploadError) throw new Error(uploadError.message || JSON.stringify(uploadError));

    const { data } = db.storage.from(bucket).getPublicUrl(path);

    return NextResponse.json(
      {
        model: usedModel,
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
