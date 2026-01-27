-- ===============================================
-- ADD RANK COMPARISON COLUMNS
-- ===============================================
-- Adds previous_rank and rank_change columns to track weekly improvements

-- Add previous_rank column (stores last week's rank)
ALTER TABLE asin_keywords_tracking 
ADD COLUMN IF NOT EXISTS previous_rank INTEGER;

-- Add rank_change column (positive = declined, negative = improved, null = no previous data)
-- Example: rank_change = -2 means improved by 2 positions (rank 5 -> rank 3)
ALTER TABLE asin_keywords_tracking 
ADD COLUMN IF NOT EXISTS rank_change INTEGER;

-- Add comment
COMMENT ON COLUMN asin_keywords_tracking.previous_rank IS 'Previous week''s organic rank for comparison';
COMMENT ON COLUMN asin_keywords_tracking.rank_change IS 'Rank change from previous week (negative = improved, positive = declined)';
