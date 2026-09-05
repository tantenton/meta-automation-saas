/**
 * TikTok Content Posting API Client
 * Official TikTok API v2 integration for publishing video content directly from URL.
 */

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export interface TikTokPostResult {
  publish_id: string;
}

export async function initTikTokVideoPublish(input: {
  accessToken: string;
  videoUrl: string;
  title: string;
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY' | 'FOLLOWER_OF_CREATOR';
  disableDuet?: boolean;
  disableStitch?: boolean;
  disableComment?: boolean;
  videoCoverTimestampMs?: number;
}): Promise<TikTokPostResult> {
  const url = `${TIKTOK_API_BASE}/post/publish/video/init/`;
  
  const payload = {
    post_info: {
      title: input.title,
      privacy_level: input.privacyLevel || 'PUBLIC_TO_EVERYONE',
      disable_duet: input.disableDuet ?? false,
      disable_stitch: input.disableStitch ?? false,
      disable_comment: input.disableComment ?? false,
      video_cover_timestamp_ms: input.videoCoverTimestampMs ?? 1000,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: input.videoUrl,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TikTok video init failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (data.error && data.error.code !== 'ok') {
    throw new Error(`TikTok API error: [${data.error.code}] ${data.error.message}`);
  }

  return {
    publish_id: data.data?.publish_id || data.publish_id || '',
  };
}

export async function getTikTokPublishStatus(input: {
  accessToken: string;
  publishId: string;
}): Promise<{ status: 'PROCESSING_UPLOAD' | 'PROCESSING_DOWNLOAD' | 'SUCCESS' | 'FAILED'; fail_reason?: string }> {
  const url = `${TIKTOK_API_BASE}/post/publish/status/fetch/`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ publish_id: input.publishId }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TikTok status fetch failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.data || { status: 'FAILED', fail_reason: 'Unknown response' };
}
