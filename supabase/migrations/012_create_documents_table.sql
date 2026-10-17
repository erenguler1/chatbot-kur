-- Migration 012: pgvector extension + documents table for RAG
-- Enables semantic search over uploaded documents per bot.

-- Enable pgvector extension (already enabled via Dashboard, but idempotent here for docs)
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table: one row per chunk
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1024) NOT NULL,
  source_name TEXT,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ
);

-- Index for filtering by bot (most common query)
CREATE INDEX idx_documents_bot_id ON documents(bot_id) WHERE deleted_at IS NULL;

-- Vector similarity search index (IVFFlat for cosine distance)
-- Lists=100 is a good default for small-to-medium tables (<100k rows)
CREATE INDEX idx_documents_embedding ON documents 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Updated_at trigger (reuse Faz 1 trigger function from Migration 001)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();