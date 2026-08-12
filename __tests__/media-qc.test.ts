import { describe, it, expect } from 'vitest';
import { enforceMediaQC, filterDraftsByQC } from '../lib/scheduler/media-qc';

// ---------------------------------------------------------------------------
// enforceMediaQC — per-platform rules
// ---------------------------------------------------------------------------

describe('enforceMediaQC — Instagram', () => {
  it('fails when mediaType is text', () => {
    const r = enforceMediaQC({ platform: 'instagram', mediaType: 'text' });
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/Instagram/);
  });

  it('fails when mediaType is image but no mediaUrl', () => {
    const r = enforceMediaQC({ platform: 'instagram', mediaType: 'image', mediaUrl: null });
    expect(r.pass).toBe(false);
  });

  it('fails when mediaType is video but mediaUrl is empty string', () => {
    const r = enforceMediaQC({ platform: 'instagram', mediaType: 'video', mediaUrl: '' });
    expect(r.pass).toBe(false);
  });

  it('passes when mediaType is image with a mediaUrl', () => {
    const r = enforceMediaQC({
      platform: 'instagram',
      mediaType: 'image',
      mediaUrl: 'https://cdn.example.com/img.jpg',
    });
    expect(r.pass).toBe(true);
  });

  it('passes when mediaType is video with a mediaUrl', () => {
    const r = enforceMediaQC({
      platform: 'instagram',
      mediaType: 'video',
      mediaUrl: 'https://cdn.example.com/reel.mp4',
    });
    expect(r.pass).toBe(true);
  });
});

describe('enforceMediaQC — Facebook', () => {
  it('fails when no media and no TEXT_TEST label', () => {
    const r = enforceMediaQC({ platform: 'facebook', mediaType: 'text' });
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/Facebook/);
  });

  it('fails when mediaType=image but mediaUrl is null', () => {
    const r = enforceMediaQC({ platform: 'facebook', mediaType: 'image', mediaUrl: null });
    expect(r.pass).toBe(false);
  });

  it('passes when label contains TEXT_TEST (explicit override)', () => {
    const r = enforceMediaQC({
      platform: 'facebook',
      mediaType: 'text',
      label: 'TEXT_TEST',
    });
    expect(r.pass).toBe(true);
  });

  it('passes when label contains TEXT_TEST embedded in longer string', () => {
    const r = enforceMediaQC({
      platform: 'facebook',
      mediaType: 'text',
      label: 'experiment:TEXT_TEST:v2',
    });
    expect(r.pass).toBe(true);
  });

  it('passes when mediaType=image with valid mediaUrl', () => {
    const r = enforceMediaQC({
      platform: 'facebook',
      mediaType: 'image',
      mediaUrl: 'https://cdn.example.com/photo.jpg',
    });
    expect(r.pass).toBe(true);
  });

  it('passes when mediaType=video with valid mediaUrl', () => {
    const r = enforceMediaQC({
      platform: 'facebook',
      mediaType: 'video',
      mediaUrl: 'https://cdn.example.com/reel.mp4',
    });
    expect(r.pass).toBe(true);
  });
});

describe('enforceMediaQC — Threads', () => {
  it('passes text-only post (conversation-first)', () => {
    const r = enforceMediaQC({ platform: 'threads', mediaType: 'text' });
    expect(r.pass).toBe(true);
  });

  it('passes image post', () => {
    const r = enforceMediaQC({
      platform: 'threads',
      mediaType: 'image',
      mediaUrl: 'https://cdn.example.com/img.jpg',
    });
    expect(r.pass).toBe(true);
  });

  it('passes text with no mediaUrl (no media required)', () => {
    const r = enforceMediaQC({ platform: 'threads', mediaType: 'text', mediaUrl: null });
    expect(r.pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterDraftsByQC — batch filtering
// ---------------------------------------------------------------------------

describe('filterDraftsByQC', () => {
  it('separates approved from rejected drafts', () => {
    const drafts = [
      { platform: 'threads' as const, mediaType: 'text' as const },
      { platform: 'instagram' as const, mediaType: 'text' as const },         // rejected
      { platform: 'facebook' as const, mediaType: 'text' as const },          // rejected
      {
        platform: 'instagram' as const,
        mediaType: 'image' as const,
        mediaUrl: 'https://cdn.example.com/a.jpg',
      },
      {
        platform: 'facebook' as const,
        mediaType: 'image' as const,
        mediaUrl: 'https://cdn.example.com/b.jpg',
      },
    ];

    const { approved, rejected } = filterDraftsByQC(drafts);
    expect(approved).toHaveLength(3);
    expect(rejected).toHaveLength(2);
    expect(rejected[0].reason).toBeTruthy();
  });

  it('returns empty arrays for empty input', () => {
    const { approved, rejected } = filterDraftsByQC([]);
    expect(approved).toHaveLength(0);
    expect(rejected).toHaveLength(0);
  });

  it('preserves extra fields on approved drafts', () => {
    const drafts = [
      {
        platform: 'threads' as const,
        mediaType: 'text' as const,
        content: 'hello',
        patternUsed: 'curiosity',
      },
    ];
    const { approved } = filterDraftsByQC(drafts);
    expect(approved[0].content).toBe('hello');
    expect(approved[0].patternUsed).toBe('curiosity');
  });
});
