CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK(file_type IN ('svg', 'eps', 'jpg')),
  file_size INTEGER,
  platform TEXT DEFAULT 'shutterstock',
  pair_group TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'done', 'error')),
  process_logs TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS check_results (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  checker_type TEXT NOT NULL CHECK(checker_type IN ('svg', 'eps', 'jpg', 'ai_content', 'cross_check')),
  valid BOOLEAN,
  errors TEXT DEFAULT '[]',
  warnings TEXT DEFAULT '[]',
  info TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_cache (
  file_hash TEXT PRIMARY KEY,
  result TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  call_count INTEGER DEFAULT 0,
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_pair_group ON assets(pair_group);
CREATE INDEX IF NOT EXISTS idx_check_results_asset_id ON check_results(asset_id);
