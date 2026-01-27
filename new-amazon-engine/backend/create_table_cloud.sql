-- ===============================================
-- ASIN KEYWORDS TRACKING TABLE
-- Run this directly on your CLOUD database
-- ===============================================

CREATE TABLE IF NOT EXISTS asin_keywords_tracking (
    id SERIAL PRIMARY KEY,
    tracking_date DATE NOT NULL,
    asin VARCHAR(20) NOT NULL,
    keyword_phrase TEXT NOT NULL,
    organic_rank INTEGER,
    product_title VARCHAR(500),
    cerebro_iq_score DECIMAL(10,2),
    search_volume INTEGER,
    cpr DECIMAL(10,2),
    competing_products INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tracking_date, asin, keyword_phrase)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_date ON asin_keywords_tracking(tracking_date DESC);
CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_asin ON asin_keywords_tracking(asin);
CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_date_asin ON asin_keywords_tracking(tracking_date DESC, asin);
CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_keyword ON asin_keywords_tracking(keyword_phrase);
CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_date_asin_keyword ON asin_keywords_tracking(tracking_date DESC, asin, keyword_phrase);

-- Verify
SELECT 'Table created successfully!' as status, COUNT(*) as existing_rows FROM asin_keywords_tracking;
