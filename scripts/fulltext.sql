CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS "search";

CREATE TABLE IF NOT EXISTS "search".post_translation_vectors (
  id serial PRIMARY KEY,
  post_translation_id int NOT NULL,
  locale varchar(8) NOT NULL,
  embedding vector(384) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT post_translation_vectors_unique UNIQUE (post_translation_id, locale),
  CONSTRAINT post_translation_vectors_post_translation_id_fkey
    FOREIGN KEY (post_translation_id)
    REFERENCES public.post_translations(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS post_translation_vectors_embedding_idx
ON "search".post_translation_vectors
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS post_translation_vectors_locale_idx
ON "search".post_translation_vectors (locale);
