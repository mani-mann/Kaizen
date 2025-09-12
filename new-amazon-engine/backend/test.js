require('dotenv').config();
const { Client } = require('pg');

// Database connection configuration
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
});

async function testDatabaseConnection() {
    console.log('🔍 Testing database connection...');
    console.log('📋 Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    try {
        // Connect to database
        await client.connect();
        console.log('✅ Successfully connected to PostgreSQL database');
        
        // Test basic query
        const result = await client.query('SELECT NOW() as current_time');
        console.log('⏰ Current database time:', result.rows[0].current_time);
        
        // Check if our tables exist
        console.log('\n🔍 Checking for required tables...');
        
        // Check amazon_ads_reports table
        const adsTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'amazon_ads_reports'
            );
        `);
        
        if (adsTableCheck.rows[0].exists) {
            console.log('✅ amazon_ads_reports table exists');
            
            // Get table structure
            const adsStructure = await client.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'amazon_ads_reports' 
                ORDER BY ordinal_position;
            `);
            console.log('📊 amazon_ads_reports structure:');
            adsStructure.rows.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
            });
            
            // Get row count
            const adsCount = await client.query('SELECT COUNT(*) as count FROM amazon_ads_reports');
            console.log(`📈 amazon_ads_reports has ${adsCount.rows[0].count} rows`);
            
            // Get date range
            const adsDateRange = await client.query(`
                SELECT MIN(report_date) as min_date, MAX(report_date) as max_date 
                FROM amazon_ads_reports 
                WHERE report_date IS NOT NULL
            `);
            if (adsDateRange.rows[0].min_date) {
                console.log(`📅 Date range: ${adsDateRange.rows[0].min_date} to ${adsDateRange.rows[0].max_date}`);
            }
        } else {
            console.log('❌ amazon_ads_reports table does not exist');
        }
        
        // Check amazon_sales_traffic table
        const salesTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'amazon_sales_traffic'
            );
        `);
        
        if (salesTableCheck.rows[0].exists) {
            console.log('✅ amazon_sales_traffic table exists');
            
            // Get table structure
            const salesStructure = await client.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'amazon_sales_traffic' 
                ORDER BY ordinal_position;
            `);
            console.log('📊 amazon_sales_traffic structure:');
            salesStructure.rows.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
            });
            
            // Get row count
            const salesCount = await client.query('SELECT COUNT(*) as count FROM amazon_sales_traffic');
            console.log(`📈 amazon_sales_traffic has ${salesCount.rows[0].count} rows`);
            
            // Get date range
            const salesDateRange = await client.query(`
                SELECT MIN(date) as min_date, MAX(date) as max_date 
                FROM amazon_sales_traffic 
                WHERE date IS NOT NULL
            `);
            if (salesDateRange.rows[0].min_date) {
                console.log(`📅 Date range: ${salesDateRange.rows[0].min_date} to ${salesDateRange.rows[0].max_date}`);
            }
        } else {
            console.log('❌ amazon_sales_traffic table does not exist');
        }
        
        // Test sample data queries
        console.log('\n🔍 Testing sample data queries...');
        
        if (adsTableCheck.rows[0].exists) {
            const sampleAds = await client.query(`
                SELECT search_term, campaign_name, cost, sales_1d, clicks, impressions, report_date 
                FROM amazon_ads_reports 
                ORDER BY report_date DESC 
                LIMIT 3
            `);
            console.log('📊 Sample ads data:');
            sampleAds.rows.forEach((row, index) => {
                console.log(`   ${index + 1}. ${row.search_term || 'N/A'} | ${row.campaign_name || 'N/A'} | Cost: $${row.cost || 0} | Sales: $${row.sales_1d || 0}`);
            });
        }
        
        if (salesTableCheck.rows[0].exists) {
            const sampleSales = await client.query(`
                SELECT parent_asin, sku, sessions, page_views, units_ordered, ordered_product_sales, date 
                FROM amazon_sales_traffic 
                ORDER BY date DESC 
                LIMIT 3
            `);
            console.log('📊 Sample sales data:');
            sampleSales.rows.forEach((row, index) => {
                console.log(`   ${index + 1}. ${row.parent_asin || 'N/A'} | Sessions: ${row.sessions || 0} | Sales: $${row.ordered_product_sales || 0}`);
            });
        }
        
        console.log('\n🎉 Database connection test completed successfully!');
        
    } catch (error) {
        console.error('❌ Database connection failed:');
        console.error('Error:', error.message);
        console.error('Code:', error.code);
        
        if (error.code === 'ENOTFOUND') {
            console.log('\n💡 Troubleshooting tips:');
            console.log('   - Check if your database server is running');
            console.log('   - Verify the hostname in your DATABASE_URL');
            console.log('   - Ensure your network connection is working');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Troubleshooting tips:');
            console.log('   - Check if PostgreSQL is running on the specified port');
            console.log('   - Verify the port number in your DATABASE_URL');
            console.log('   - Check firewall settings');
        } else if (error.code === '28P01') {
            console.log('\n💡 Troubleshooting tips:');
            console.log('   - Check your username and password in DATABASE_URL');
            console.log('   - Verify the user has proper permissions');
        } else if (error.code === '3D000') {
            console.log('\n💡 Troubleshooting tips:');
            console.log('   - Check if the database name exists');
            console.log('   - Verify the database name in your DATABASE_URL');
        }
        
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

// Run the test
testDatabaseConnection();