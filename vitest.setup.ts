// Tests and CI never call real models and never download embedding weights.
process.env.LLM_PROVIDER = 'mock';
process.env.EMBEDDINGS_PROVIDER = 'mock';
process.env.DATABASE_PATH = ':memory:';
