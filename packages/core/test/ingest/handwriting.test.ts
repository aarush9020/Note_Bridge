import { describe, expect, it } from 'vitest';
import {
  IngestError,
  MockProvider,
  pageFromText,
  sniffImageType,
  transcribeImage,
  type LLMProvider,
} from '../../src';
import { TINY_PNG } from './helpers';

describe('sniffImageType', () => {
  it('recognises PNG and JPEG and rejects anything else', () => {
    expect(sniffImageType(TINY_PNG)).toBe('image/png');
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });
});

describe('transcribeImage', () => {
  it('returns the vision text with a computed confidence', async () => {
    const llm = new MockProvider().whenImage(
      TINY_PNG,
      'Velocity is the rate of change of position.\nAcceleration is the rate of change of velocity.',
    );
    const t = await transcribeImage(llm, TINY_PNG);
    expect(t.text).toContain('Velocity is the rate of change');
    expect(t.confidence).toBeGreaterThan(0.5);
    expect(t.lowConfidence).toBe(false);
  });

  it('flags low confidence when the transcript is mostly unreadable', async () => {
    const llm = new MockProvider().whenImage(TINY_PNG, '[?] [?] qzx [?] vkw [?] [?]');
    const t = await transcribeImage(llm, TINY_PNG);
    expect(t.lowConfidence).toBe(true);
    expect(t.confidence).toBeLessThan(0.5);
  });

  it('rejects a provider without vision support', async () => {
    const noVision: LLMProvider = {
      id: 'text-only',
      complete: async () => ({ text: '', usage: { inputTokens: 0, outputTokens: 0 } }),
    };
    await expect(transcribeImage(noVision, TINY_PNG)).rejects.toBeInstanceOf(IngestError);
  });

  it('rejects bytes that are not an image', async () => {
    await expect(transcribeImage(new MockProvider(), new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(
      /Unsupported image type/,
    );
  });
});

describe('pageFromText', () => {
  it('keeps line order and marks paragraph gaps from blank lines', () => {
    const p = pageFromText(2, 'first line\nsecond line\n\nnew paragraph');
    expect(p.page).toBe(2);
    expect(p.lines.map((l) => l.text)).toEqual(['first line', 'second line', 'new paragraph']);
    expect(p.lines.map((l) => l.gapBefore)).toEqual([false, false, true]);
    expect(p.lines[0]!.y).toBeGreaterThan(p.lines[1]!.y);
  });

  it('gives an empty page for empty text', () => {
    expect(pageFromText(1, '').lines).toEqual([]);
  });
});
