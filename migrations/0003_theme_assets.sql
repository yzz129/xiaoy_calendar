CREATE TABLE IF NOT EXISTS user_theme_assets (
  user_id TEXT PRIMARY KEY,
  image_blob BLOB NOT NULL,
  content_type TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
