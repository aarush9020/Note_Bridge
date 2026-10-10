import type { Usage } from '../types';

/** SHARED CONTRACT. All model access goes through these interfaces. */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Ask for a JSON object response. */
  json?: boolean;
}

export interface LLMResponse {
  text: string;
  usage: Usage;
}

export interface VisionRequest {
  image: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg';
  prompt: string;
  maxTokens?: number;
}

export interface LLMProvider {
  readonly id: string;
  complete(req: LLMRequest): Promise<LLMResponse>;
  /** Read text/structure from an image. Optional: providers without vision omit it. */
  vision?(req: VisionRequest): Promise<LLMResponse>;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}
