-- 史境 · PostgreSQL + pgvector 一库多用 Schema（适配 4C4G 服务器）
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  doc_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL,           -- 官方文书 / 商贸账簿 / 口述史 / 考古报告 / 外文游记
  language TEXT,
  region TEXT,
  pub_year INT,
  narrative_period TEXT,
  file_path TEXT,
  status TEXT DEFAULT '待校对',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_chunks (
  chunk_id TEXT PRIMARY KEY,
  doc_id TEXT REFERENCES documents(doc_id) ON DELETE CASCADE,
  page_number INT,
  bbox JSONB,                       -- [x, y, w, h] 原图百分比坐标框
  content TEXT NOT NULL,
  reviewed BOOLEAN DEFAULT false,
  embedding VECTOR(1024)
);

CREATE TABLE IF NOT EXISTS entities (
  entity_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS relations (
  relation_id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES entities(entity_id),
  target_id TEXT REFERENCES entities(entity_id),
  relation_type TEXT NOT NULL,
  chunk_id TEXT REFERENCES evidence_chunks(chunk_id),
  confidence REAL DEFAULT 0.75,
  status TEXT DEFAULT 'AI_Candidate', -- AI_Candidate | Human_Verified | Rejected
  verified_by TEXT,
  verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
