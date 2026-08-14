/**
 * Regression tests for parseJsonArray helper in content/generate route.
 * We extract the function via dynamic import of the compiled module — but since
 * Next.js route files are not importable in unit tests, we duplicate the logic
 * here and test it in isolation. Any changes to parseJsonArray in route.ts must
 * be mirrored here to keep the tests authoritative.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Inline copy of parseJsonArray (kept in sync with route.ts)
// ---------------------------------------------------------------------------
function parseJsonArray(raw: string): unknown[] {
  const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const defenced = cleaned.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');

  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < defenced.length; i++) {
    if (defenced[i] === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (defenced[i] === ']') {
      depth--;
      if (depth === 0 && start !== -1) {
        candidates.push(defenced.slice(start, i + 1));
        start = -1;
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error('No JSON array found in AI response: ' + defenced.slice(0, 200));
  }

  candidates.sort((a, b) => b.length - a.length);
  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(
    'Failed to parse JSON array from AI response. Errors: ' +
      errors.join('; ') +
      ' | Raw (first 300): ' +
      defenced.slice(0, 300),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseJsonArray — happy paths', () => {
  it('parses a bare JSON array', () => {
    const input = '[{"a":1},{"a":2}]';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(2);
    expect((result[0] as { a: number }).a).toBe(1);
  });

  it('parses array wrapped in prose', () => {
    const input = 'Here are the variants:\n[{"content":"post 1","ai_score":8}]\nDone.';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(1);
    expect((result[0] as { content: string }).content).toBe('post 1');
  });

  it('parses array inside ```json fenced block', () => {
    const input = '```json\n[{"content":"fenced","ai_score":7}]\n```';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(1);
    expect((result[0] as { content: string }).content).toBe('fenced');
  });

  it('parses array inside ``` fenced block (no language tag)', () => {
    const input = '```\n[{"content":"no-lang","ai_score":6}]\n```';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(1);
  });

  it('parses array with multiline string values', () => {
    const input = `[
  {
    "content": "line1\\nline2\\nline3",
    "pattern_used": "curiosityGap",
    "hook_type": "curiosity",
    "ai_score": 9,
    "reasoning": "high novelty"
  }
]`;
    const result = parseJsonArray(input);
    expect(result).toHaveLength(1);
    expect((result[0] as { hook_type: string }).hook_type).toBe('curiosity');
  });

  it('picks the longest array when response contains multiple', () => {
    // Shorter array appears before longer one — should pick the longer
    const input = 'Ignore this: [1,2]. Real data: [{"content":"a"},{"content":"b"},{"content":"c"}]';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(3);
  });
});

describe('parseJsonArray — control character inputs', () => {
  it('strips NUL bytes (\\x00) before parsing', () => {
    const input = '[\x00{"content":"clean","ai_score":5}\x00]';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(1);
  });

  it('strips form feed (\\x0C) before parsing', () => {
    const input = '[{"content":"ff\x0Ctest","ai_score":5}]';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(1);
  });

  it('preserves tab, newline, carriage-return (valid JSON whitespace)', () => {
    const input = '[\r\n\t{"content":"ws","ai_score":5}\r\n]';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(1);
  });

  it('strips \\x01–\\x08 range', () => {
    const ctrl = '\x01\x02\x03\x04\x05\x06\x07\x08';
    const input = `[{"content":"${ctrl}ok","ai_score":4}]`;
    const result = parseJsonArray(input);
    expect((result[0] as { content: string }).content).toBe('ok');
  });
});

describe('parseJsonArray — malformed inputs', () => {
  it('throws when no array bracket found', () => {
    expect(() => parseJsonArray('This is just prose with no JSON.')).toThrow(
      'No JSON array found',
    );
  });

  it('throws when array brackets are present but content is invalid JSON', () => {
    expect(() => parseJsonArray('[{broken json,,}]')).toThrow();
  });

  it('throws with descriptive message containing raw preview', () => {
    const bad = '[not valid json at all %%%]';
    let msg = '';
    try {
      parseJsonArray(bad);
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    }
    expect(msg).toMatch(/Failed to parse JSON array/);
  });

  it('returns empty array for []', () => {
    const result = parseJsonArray('[]');
    expect(result).toHaveLength(0);
  });
});

describe('parseJsonArray — fenced block variants', () => {
  it('handles ```JSON (uppercase) fencing', () => {
    const input = '```JSON\n[{"content":"upper","ai_score":7}]\n```';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(1);
  });

  it('handles fenced block with trailing whitespace after backticks', () => {
    const input = '```json   \n[{"content":"trailing-ws","ai_score":6}]\n```';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(1);
  });

  it('handles nested arrays inside objects (not top-level)', () => {
    const input =
      '[{"content":"post","example_hooks":["hook1","hook2"],"ai_score":8}]';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(1);
    expect(
      (result[0] as { example_hooks: string[] }).example_hooks,
    ).toHaveLength(2);
  });
});
