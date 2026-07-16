-- General Mao D1 schema.
-- The live game state and the secret ruleset live in each table's Durable Object,
-- never here. D1 holds only durable, shareable records: finished-match archives
-- (for the post-match reveal and "cracked it" cards) and bring-your-own rulesets
-- addressable by a permanent link.

CREATE TABLE IF NOT EXISTS matches (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL,
  finished_at   INTEGER NOT NULL,
  theme         TEXT NOT NULL,
  difficulty    TEXT NOT NULL,
  winner_name   TEXT,
  player_count  INTEGER NOT NULL,
  penalty_count INTEGER NOT NULL,
  -- The revealed ruleset text, safe to store only because the match is over.
  reveal_json   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matches_finished_at ON matches (finished_at DESC);

CREATE TABLE IF NOT EXISTS custom_rulesets (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  author_name TEXT,
  name        TEXT NOT NULL,
  -- Author-written English. Structured into a secret ruleset at match start.
  source_text TEXT NOT NULL
);
