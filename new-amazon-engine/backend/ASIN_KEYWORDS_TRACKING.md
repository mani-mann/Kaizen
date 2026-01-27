# ASIN Keywords Tracking - Database Integration

This feature automatically stores keyword data from the ASIN to Keyword page into your PostgreSQL database for weekly tracking and historical analysis.

## 📊 What Gets Stored

When you process ASINs through the ASIN to Keyword page, the following data is automatically saved:

- **Date** - Tracking date (weekly)
- **ASIN** - Amazon product identifier
- **Keyword Phrase** - The keyword from Helium 10 Cerebro
- **Organic Rank** - Ranking position for this keyword
- **Product Title** - Product name from Helium 10
- **Additional Metrics**:
  - Cerebro IQ Score
  - Search Volume
  - CPR (Competing Products Rank)
  - Competing Products count

## 🚀 Setup

### 1. Create the Database Table

Run the setup script:

```bash
cd backend
node setup-asin-keywords-table.js
```

Or manually run the SQL file:

```bash
psql $DATABASE_URL -f create_asin_keywords_table.sql
```

### 2. Verify Table Creation

```sql
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'asin_keywords_tracking' 
ORDER BY ordinal_position;
```

## 📝 How It Works

1. **Process ASINs** - Use the ASIN to Keyword page to upload and process ASINs
2. **Automatic Storage** - When keywords are fetched from Helium 10, they're automatically saved to the database
3. **Weekly Tracking** - Each time you process the same ASIN, new data is stored with the current date
4. **Duplicate Prevention** - The table uses a unique constraint on (date, ASIN, keyword) to prevent duplicates

## 🔍 Querying the Data

### Get All Keywords for an ASIN

```sql
SELECT * FROM asin_keywords_tracking 
WHERE asin = 'B08XYZ1234' 
ORDER BY tracking_date DESC, organic_rank;
```

### Get Weekly Summary

```sql
SELECT 
  tracking_date,
  COUNT(*) as total_keywords,
  AVG(organic_rank) as avg_rank,
  MIN(organic_rank) as best_rank
FROM asin_keywords_tracking
WHERE asin = 'B08XYZ1234'
GROUP BY tracking_date
ORDER BY tracking_date DESC;
```

### Track Keyword Ranking Over Time

```sql
SELECT 
  tracking_date,
  keyword_phrase,
  organic_rank
FROM asin_keywords_tracking
WHERE asin = 'B08XYZ1234' 
  AND keyword_phrase = 'your keyword'
ORDER BY tracking_date DESC;
```

## 🌐 API Endpoints

### Get Keyword Tracking Data

```bash
GET /api/cerebro/keywords-tracking?asin=B08XYZ1234&startDate=2024-01-01&endDate=2024-01-31
```

**Query Parameters:**
- `asin` - Filter by ASIN (optional)
- `startDate` - Start date (YYYY-MM-DD, optional)
- `endDate` - End date (YYYY-MM-DD, optional)
- `keyword` - Search keyword phrase (optional, partial match)

**Response:**
```json
{
  "success": true,
  "count": 150,
  "data": [
    {
      "id": 1,
      "tracking_date": "2024-01-27",
      "asin": "B08XYZ1234",
      "keyword_phrase": "wireless headphones",
      "organic_rank": 5,
      "product_title": "Premium Wireless Headphones",
      "cerebro_iq_score": 85.5,
      "search_volume": 12000,
      "cpr": 2.5,
      "competing_products": 150
    }
  ]
}
```

### Get Weekly Summary

```bash
GET /api/cerebro/keywords-summary?asin=B08XYZ1234&weeks=4
```

**Query Parameters:**
- `asin` - ASIN (required)
- `weeks` - Number of weeks to look back (default: 4)

**Response:**
```json
{
  "success": true,
  "asin": "B08XYZ1234",
  "weeks": 4,
  "summary": [
    {
      "tracking_date": "2024-01-27",
      "total_keywords": 150,
      "keywords_with_rank": 120,
      "avg_organic_rank": 8.5,
      "best_rank": 1
    }
  ]
}
```

## 📈 Use Cases

1. **Track Ranking Changes** - See how your organic rankings change over time
2. **Keyword Performance** - Identify which keywords are improving or declining
3. **Weekly Reports** - Generate weekly reports on keyword performance
4. **Historical Analysis** - Analyze long-term trends in keyword rankings
5. **Competitive Tracking** - Track multiple ASINs and compare performance

## 🔧 Maintenance

### Clean Up Old Data (Optional)

If you want to keep only recent data:

```sql
-- Delete data older than 6 months
DELETE FROM asin_keywords_tracking 
WHERE tracking_date < CURRENT_DATE - INTERVAL '6 months';
```

### Export Data

```sql
-- Export to CSV
COPY (
  SELECT * FROM asin_keywords_tracking 
  WHERE asin = 'B08XYZ1234'
) TO '/path/to/export.csv' WITH CSV HEADER;
```

## ⚠️ Important Notes

- **Automatic Storage**: Data is saved automatically when processing ASINs - no manual action needed
- **Weekly Tracking**: Each processing session creates a new entry with the current date
- **Database Required**: Make sure your database connection is working (`dbConnected = true`)
- **No Duplicates**: The unique constraint prevents storing the same keyword twice for the same date/ASIN
- **Updates**: If you process the same ASIN/keyword on the same day, it will update the existing record

## 🐛 Troubleshooting

### Data Not Being Saved

1. Check database connection:
   ```bash
   node test.js
   ```

2. Check server logs for errors:
   ```bash
   # Look for: "Error saving keywords to database"
   ```

3. Verify table exists:
   ```sql
   SELECT COUNT(*) FROM asin_keywords_tracking;
   ```

### Slow Queries

Make sure indexes are created (they're created automatically by the setup script):
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'asin_keywords_tracking';
```
