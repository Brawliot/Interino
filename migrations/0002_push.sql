-- Web Push subscriptions (avisos en segundo plano)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  seguimientos_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
