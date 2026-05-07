CREATE TABLE IF NOT EXISTS cluster_messages (
  id BIGINT PRIMARY KEY,
  rowid BIGSERIAL,
  message_id VARCHAR(255),
  shard_id VARCHAR(50) NOT NULL,
  entity_type VARCHAR(150) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  kind INT NOT NULL,
  tag VARCHAR(50),
  payload TEXT,
  headers TEXT,
  trace_id VARCHAR(32),
  span_id VARCHAR(16),
  sampled BOOLEAN,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  request_id BIGINT NOT NULL,
  reply_id BIGINT,
  last_reply_id BIGINT,
  last_read TIMESTAMP,
  deliver_at BIGINT,
  UNIQUE (message_id)
);

CREATE TABLE IF NOT EXISTS cluster_replies (
  id BIGINT PRIMARY KEY,
  rowid BIGSERIAL,
  kind INT,
  request_id BIGINT NOT NULL,
  payload TEXT NOT NULL,
  sequence INT,
  acked BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (request_id, kind),
  UNIQUE (request_id, sequence)
);

CREATE INDEX IF NOT EXISTS cluster_messages_shard_idx
  ON cluster_messages (shard_id, processed, last_read, deliver_at);

CREATE INDEX IF NOT EXISTS cluster_messages_request_id_idx
  ON cluster_messages (request_id);

CREATE INDEX IF NOT EXISTS cluster_replies_request_lookup_idx
  ON cluster_replies (request_id, kind, acked);
