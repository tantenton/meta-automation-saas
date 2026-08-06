import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 100 * 1024 * 1024);
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']);

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'file_required' }, { status: 400 });
    if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'unsupported_media_type', type: file.type }, { status: 415 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file_too_large', max_bytes: MAX_BYTES }, { status: 413 });

    const bucket = process.env.SUPABASE_MEDIA_BUCKET || 'meta-media';
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
    const db = getSupabaseAdmin();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await db.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = db.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ media_id: path, bucket, path, public_url: data.publicUrl, content_type: file.type, size: file.size }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'upload_failed', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
