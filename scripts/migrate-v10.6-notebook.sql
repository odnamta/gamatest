-- V10.6: Digital Notebook Migration
-- Adds is_flagged and notes columns to user_card_progress table

-- Add is_flagged column with default false
ALTER TABLE user_card_progress
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE;

-- Add notes column with default null
ALTER TABLE user_card_progress
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Create index for flagged cards queries (for flagged study mode)
CREATE INDEX IF NOT EXISTS idx_user_card_progress_flagged 
ON user_card_progress (user_id, is_flagged) 
WHERE is_flagged = TRUE;

-- Comment for documentation
COMMENT ON COLUMN user_card_progress.is_flagged IS 'V10.6: User bookmark flag for later review';
COMMENT ON COLUMN user_card_progress.notes IS 'V10.6: User personal notes/annotations for the card';
