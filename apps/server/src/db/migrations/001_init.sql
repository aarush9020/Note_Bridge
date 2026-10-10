-- 001_init: base schema. Migrations are append-only; never edit an applied migration.
-- Numbering: Dev A uses 001-099 and 100-199, Dev B uses 200-299 (see docs/TEAM.md).

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('book', 'slides', 'notes')),
  title TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 0,
  page_offset INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_documents_course ON documents(course_id);
CREATE UNIQUE INDEX idx_documents_hash ON documents(course_id, content_hash);

CREATE TABLE sections (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  summary TEXT
);
CREATE INDEX idx_sections_document ON sections(document_id);
CREATE INDEX idx_sections_parent ON sections(parent_id);

CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES sections(id) ON DELETE SET NULL,
  parent_id TEXT,
  prev_id TEXT,
  next_id TEXT,
  kind TEXT NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'definition', 'example', 'exercise', 'formula')),
  text TEXT NOT NULL,
  context_header TEXT NOT NULL DEFAULT '',
  page INTEGER NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  quality REAL NOT NULL DEFAULT 1
);
CREATE INDEX idx_chunks_document ON chunks(document_id);
CREATE INDEX idx_chunks_section ON chunks(section_id);

CREATE TABLE embeddings (
  chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  vector BLOB NOT NULL
);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id TEXT REFERENCES chunks(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  statement TEXT NOT NULL,
  has_solution INTEGER NOT NULL DEFAULT 0,
  solution TEXT,
  page INTEGER NOT NULL
);
CREATE INDEX idx_exercises_document ON exercises(document_id);

CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  prof_unit_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  book_section_id TEXT REFERENCES sections(id) ON DELETE SET NULL,
  relation TEXT NOT NULL
    CHECK (relation IN ('same', 'extends', 'conflicts', 'professor_only', 'book_only')),
  confidence REAL NOT NULL DEFAULT 0,
  rationale TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'confirmed', 'rejected', 'remapped'))
);
CREATE INDEX idx_edges_course ON edges(course_id);
CREATE INDEX idx_edges_prof ON edges(prof_unit_id);
CREATE INDEX idx_edges_book ON edges(book_section_id);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('ingest', 'align')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'failed')),
  progress REAL NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
