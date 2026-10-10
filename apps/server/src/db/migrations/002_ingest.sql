-- 002_ingest: columns the ingestion pipeline needs (Phase 1a, Laptop A).
-- Migrations are append-only; 001_init.sql is never edited.

ALTER TABLE documents ADD COLUMN status TEXT NOT NULL DEFAULT 'ready'
  CHECK (status IN ('processing', 'ready', 'failed'));
ALTER TABLE documents ADD COLUMN heading_source TEXT NOT NULL DEFAULT 'single';
ALTER TABLE documents ADD COLUMN offset_confidence REAL NOT NULL DEFAULT 0;
-- JSON arrays: human-readable warnings, and per-page quality verdicts.
ALTER TABLE documents ADD COLUMN warnings TEXT NOT NULL DEFAULT '[]';
ALTER TABLE documents ADD COLUMN page_quality TEXT NOT NULL DEFAULT '[]';

-- Reading order inside a document.
ALTER TABLE sections ADD COLUMN ordinal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chunks ADD COLUMN ordinal INTEGER NOT NULL DEFAULT 0;
-- 'short' | 'oversize' when a chunk is outside the 200-400 token target on purpose.
ALTER TABLE chunks ADD COLUMN exception TEXT CHECK (exception IN ('short', 'oversize'));

-- SET NULL, not CASCADE: a failed ingest deletes its half-made document, and the failed job (with
-- its error message) must stay readable.
ALTER TABLE jobs ADD COLUMN document_id TEXT REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN error TEXT;

CREATE INDEX idx_chunks_order ON chunks(document_id, ordinal);
CREATE INDEX idx_sections_order ON sections(document_id, ordinal);
CREATE INDEX idx_jobs_document ON jobs(document_id);
