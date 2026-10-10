import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig, redactConfig } from '../src';

describe('parseConfig', () => {
  it('defaults to mock providers with no env', () => {
    const cfg = parseConfig({});
    expect(cfg.LLM_PROVIDER).toBe('mock');
    expect(cfg.EMBEDDINGS_PROVIDER).toBe('mock');
    expect(cfg.MAX_TOOL_CALLS).toBe(8);
    expect(cfg.plugins).toEqual([]);
  });

  it('treats empty strings from .env as unset', () => {
    const cfg = parseConfig({ LLM_PROVIDER: '', ANTHROPIC_API_KEY: '', PORT: '' });
    expect(cfg.LLM_PROVIDER).toBe('mock');
    expect(cfg.PORT).toBe(3001);
  });

  it('requires an API key for a real provider, with a clear message', () => {
    expect(() => parseConfig({ LLM_PROVIDER: 'anthropic' })).toThrow(ConfigError);
    expect(() => parseConfig({ LLM_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => parseConfig({ LLM_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
  });

  it('rejects invalid values', () => {
    expect(() => parseConfig({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => parseConfig({ LLM_PROVIDER: 'gemini' })).toThrow(/LLM_PROVIDER/);
  });

  it('splits PLUGINS into a trimmed list', () => {
    expect(parseConfig({ PLUGINS: ' conflicts, verifier ,,' }).plugins).toEqual([
      'conflicts',
      'verifier',
    ]);
  });

  it('redacts secrets and never leaks them', () => {
    const cfg = parseConfig({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-supersecret' });
    const redacted = redactConfig(cfg);
    expect(redacted.ANTHROPIC_API_KEY).toBe('***redacted***');
    expect(JSON.stringify(redacted)).not.toContain('supersecret');
  });
});
