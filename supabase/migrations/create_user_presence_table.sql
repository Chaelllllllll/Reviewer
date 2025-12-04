-- Create user_presence table for tracking online users
CREATE TABLE IF NOT EXISTS user_presence (
  session_id TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on last_seen for faster queries
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen);

-- Enable Row Level Security
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert/update their own presence
CREATE POLICY "Anyone can upsert their presence"
  ON user_presence
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to clean up old presence records (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM user_presence
  WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a scheduled job to clean up old records periodically
-- This would need to be set up in Supabase dashboard or via pg_cron
-- SELECT cron.schedule('cleanup-presence', '* * * * *', 'SELECT cleanup_old_presence()');
