CREATE TABLE IF NOT EXISTS user_theme_originals (
  user_id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_theme_original_chunks (
  user_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_blob BLOB NOT NULL,
  PRIMARY KEY (user_id, chunk_index),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
