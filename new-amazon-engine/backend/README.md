# Amazon Analytics Backend

## 🚨 SECURITY FIRST

Before you start, read these important security documents:
- **[CREDENTIALS_ROTATION_GUIDE.md](../CREDENTIALS_ROTATION_GUIDE.md)** - If credentials were exposed
- **[SECURITY.md](../SECURITY.md)** - Comprehensive security best practices

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with your actual credentials
nano .env  # or use your preferred editor
```

**NEVER commit the .env file to Git!**

### 2. Install Dependencies

```bash
npm install
```

### 3. Test Database Connection

```bash
node test-db.js
```

Expected output:
```
✅ Connected to PostgreSQL
📦 amazon_sales_traffic rows: [number]
📢 amazon_ads_reports rows: [number]
```

### 4. Set Up Database Indexes (First Time Only)

```bash
# Option 1: Using Node.js
node setup-indexes.js

# Option 2: Using psql directly
psql $DATABASE_URL -f add-indexes.sql
```

### 5. Start Server

```bash
# Development
npm start

# Production
NODE_ENV=production npm start
```

Server will start on http://localhost:5000

## API Endpoints

### Health Check
```bash
GET /health
```

### Analytics Data
```bash
GET /api/analytics?start=2024-01-01&end=2024-01-31
```

### Business Data
```bash
GET /api/business-data?start=2024-01-01&end=2024-01-31
```

### Trend Reports
```bash
GET /api/trend-reports?category=products&start=2024-01-01&end=2024-01-31
```

## Environment Variables

See `.env.example` for all available configuration options.

### Required
- `DATABASE_URL` - PostgreSQL connection string

### Optional
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `PGSSL` - Force SSL on/off (default: auto-detect)

## Database Schema

### amazon_ads_reports
```sql
- id: SERIAL PRIMARY KEY
- report_date: DATE
- search_term: VARCHAR(255)
- keyword: VARCHAR(255)
- campaign_name: VARCHAR(255)
- cost: DECIMAL(10,2)
- sales_1d: DECIMAL(10,2)
- clicks: INTEGER
- impressions: INTEGER
```

### amazon_sales_traffic
```sql
- id: SERIAL PRIMARY KEY
- date: DATE
- parent_asin: VARCHAR(255)
- sku: VARCHAR(255)
- sessions: INTEGER
- page_views: INTEGER
- units_ordered: INTEGER
- ordered_product_sales: DECIMAL(10,2)
```

## Performance

### Caching
- Default TTL: 5 minutes
- Configure via `CACHE_TTL` environment variable

### Database Indexes
Make sure to run `setup-indexes.js` for optimal performance:
- 50-300x faster queries
- Reduced database load
- Better response times

## Security Checklist

- [ ] .env file created and configured
- [ ] .env file is in .gitignore
- [ ] Strong database password used
- [ ] Database indexes installed
- [ ] SSL enabled for production
- [ ] IP whitelisting configured
- [ ] CORS properly configured
- [ ] Rate limiting enabled (future)

## Troubleshooting

### Database Connection Failed
```bash
# Check your DATABASE_URL
echo $DATABASE_URL

# Test connection
node test-db.js

# Verify PostgreSQL is running
psql $DATABASE_URL -c "SELECT version();"
```

### Slow Queries
```bash
# Make sure indexes are installed
node setup-indexes.js

# Test query performance
node test-performance.js
```

### CORS Errors
```bash
# Update ALLOWED_ORIGINS in .env
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## Development

### Testing
```bash
npm test  # Currently not implemented
```

### Linting
```bash
npm run lint  # Currently not implemented
```

### Database Migrations
```bash
# Future: Add migration system
# npm run migrate
```

## Production Deployment

### Environment Variables
Set these in your deployment platform:
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
NODE_ENV=production
PORT=8080
ALLOWED_ORIGINS=https://yourdomain.com
```

### Health Checks
Use `/health` endpoint for readiness/liveness probes

### Monitoring
- Check logs for performance warnings
- Monitor slow query alerts (>2s)
- Set up error tracking (Sentry, etc.)

## Support

For issues:
1. Check [SECURITY.md](../SECURITY.md) for security issues
2. Review [CREDENTIALS_ROTATION_GUIDE.md](../CREDENTIALS_ROTATION_GUIDE.md) for credential issues
3. Check application logs
4. Review Google Cloud SQL logs

## License

Internal company use only.

