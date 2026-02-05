-- Table to track backup and sync events
CREATE TABLE IF NOT EXISTS backup_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    backup_type VARCHAR(50) NOT NULL, -- 'snapshot', 'sql_dump', 'auto_sync'
    status VARCHAR(50) NOT NULL,      -- 'success', 'failed'
    location TEXT,                    -- Path where backup was saved
    duration_seconds INTEGER,
    details TEXT
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_backup_logs_timestamp ON backup_logs(timestamp DESC);
