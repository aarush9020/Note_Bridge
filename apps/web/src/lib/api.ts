export interface Health {
  ok: boolean;
  llmProvider: string;
  embeddingsProvider: string;
  plugins: string[];
}

export async function getHealth(): Promise<Health> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`);
  return (await res.json()) as Health;
}
