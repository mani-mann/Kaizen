-- ===============================================
-- ASIN KEYWORDS TRACKING TABLE
-- ===============================================
-- Stores weekly keyword data for ASINs processed through ASIN to Keyword page
-- Tracks: Date, ASIN, Keyword, Organic Rank

CREATE TABLE IF NOT EXISTS asin_keywords_tracking (
    id SERIAL PRIMARY KEY,
    tracking_date DATE NOT NULL,
    asin VARCHAR(20) NOT NULL,
    keyword_phrase TEXT NOT NULL,
    organic_rank INTEGER,
    product_title VARCHAR(500),
    
    -- Additional keyword metrics (optional but useful)
    cerebro_iq_score DECIMAL(10,2),
    search_volume INTEGER,
    cpr DECIMAL(10,2),
    competing_products INTEGER,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure we don't store duplicate entries for same date/asin/keyword
    UNIQUE(tracking_date, asin, keyword_phrase)
);

-- ===============================================
-- INDEXES FOR PERFORMANCE
-- ===============================================

-- Index for date-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_date 
ON asin_keywords_tracking(tracking_date DESC);

-- Index for ASIN-based queries
CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_asin 
ON asin_keywords_tracking(asin);

-- Composite index for date + ASIN queries (for weekly tracking)
CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_date_asin 
ON asin_keywords_tracking(tracking_date DESC, asin);

-- Index for keyword searches
CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_keyword 
ON asin_keywords_tracking(keyword_phrase);

-- Composite index for date + ASIN + keyword (for specific lookups)
CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_date_asin_keyword 
ON asin_keywords_tracking(tracking_date DESC, asin, keyword_phrase);

-- ===============================================
-- COMMENTS
-- ===============================================

COMMENT ON TABLE asin_keywords_tracking IS 'Stores weekly keyword tracking data for ASINs processed through ASIN to Keyword page';
COMMENT ON COLUMN asin_keywords_tracking.tracking_date IS 'Date when the keyword data was collected (weekly tracking)';
COMMENT ON COLUMN asin_keywords_tracking.asin IS 'Amazon ASIN identifier';
COMMENT ON COLUMN asin_keywords_tracking.keyword_phrase IS 'The keyword phrase from Helium 10 Cerebro';
COMMENT ON COLUMN asin_keywords_tracking.organic_rank IS 'Organic ranking position for this keyword';
COMMENT ON COLUMN asin_keywords_tracking.product_title IS 'Product title from Helium 10';

-- ===============================================
-- VERIFY TABLE CREATION
-- ===============================================
-- Run this query to verify the table was created:
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'asin_keywords_tracking' 
-- ORDER BY ordinal_position;
