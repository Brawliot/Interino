-- Preferencias de avisos push + marca de última comprobación
ALTER TABLE push_subscriptions ADD COLUMN prefs_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE push_subscriptions ADD COLUMN last_checked_at TEXT;
