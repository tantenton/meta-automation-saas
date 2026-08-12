/**
 * media-qc.ts
 * Media-first quality control guards for platform-native drafts.
 *
 * Rules:
 *  - Facebook: must have image/video UNLESS label includes TEXT_TEST
 *  - Instagram: always requires media (image or video)
 *  - Threads: text-only is fine; media is optional
 */

export type Platform = 'facebook' | 'instagram' | 'threads';
export type MediaType = 'text' | 'image' | 'video';

export interface DraftQCInput {
  platform: Platform;
  mediaType: MediaType;
  mediaUrl?: string | null;
  /** Pass 'TEXT_TEST' to exempt Facebook from the media requirement */
  label?: string;
}

export interface QCResult {
  pass: boolean;
  reason?: string;
}

/**
 * Enforce media-first rules per platform.
 * Returns { pass: true } when the draft is safe to persist/queue.
 */
export function enforceMediaQC(input: DraftQCInput): QCResult {
  const { platform, mediaType, mediaUrl, label } = input;
  const hasMedia = (mediaType === 'image' || mediaType === 'video') && !!mediaUrl;

  switch (platform) {
    case 'instagram':
      if (!hasMedia) {
        return { pass: false, reason: 'Instagram requires image or video media_url' };
      }
      return { pass: true };

    case 'facebook': {
      const isTextTest = typeof label === 'string' && label.includes('TEXT_TEST');
      if (!hasMedia && !isTextTest) {
        return {
          pass: false,
          reason:
            'Facebook growth draft requires image or video — add media_url or set label=TEXT_TEST to override',
        };
      }
      return { pass: true };
    }

    case 'threads':
      // Threads is conversation-first; text-only is valid
      return { pass: true };

    default:
      return { pass: false, reason: `Unknown platform: ${platform as string}` };
  }
}

/**
 * Validate a batch of drafts and return only those that pass QC.
 * Rejected drafts are returned separately with reasons.
 */
export function filterDraftsByQC<T extends DraftQCInput>(
  drafts: T[],
): { approved: T[]; rejected: Array<{ draft: T; reason: string }> } {
  const approved: T[] = [];
  const rejected: Array<{ draft: T; reason: string }> = [];

  for (const draft of drafts) {
    const result = enforceMediaQC(draft);
    if (result.pass) {
      approved.push(draft);
    } else {
      rejected.push({ draft, reason: result.reason ?? 'QC failed' });
    }
  }

  return { approved, rejected };
}
