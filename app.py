import os
import pandas as pd
import numpy as np
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from sqlalchemy import create_engine
from dotenv import load_dotenv
import io
from datetime import datetime

# Load environment variables from .env file for local development
load_dotenv()

# =================================================================================
# 1. SETUP
# =================================================================================

# FIXED: Properly configure Flask with static files
app = Flask(__name__, static_folder='static', static_url_path='/static')

# ADDED: Explicit static file route to ensure proper serving
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

# ADDED: Debug route to test static files (remove in production)
@app.route('/debug-static')
def debug_static():
    import os
    static_path = os.path.join(os.getcwd(), 'static', 'images', 'amazon.png')
    exists = os.path.exists(static_path)
    abs_path = os.path.abspath(static_path)
    return f"""
    <h3>Static File Debug Info</h3>
    <p><strong>Current working directory:</strong> {os.getcwd()}</p>
    <p><strong>Static path:</strong> {static_path}</p>
    <p><strong>Absolute path:</strong> {abs_path}</p>
    <p><strong>File exists:</strong> {exists}</p>
    <p><strong>Static folder:</strong> {app.static_folder}</p>
    <p><strong>Static URL path:</strong> {app.static_url_path}</p>
    <hr>
    <p>Test image: <img src="/static/images/amazon.png" alt="Amazon Logo" style="max-width: 200px;"></p>
    """

# --- Helper Functions (used by the dashboard) ---
# Global engine for connection pooling
_engine = None

def get_db_connection():
    global _engine
    if _engine is None:
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            raise ValueError("Error: DATABASE_URL environment variable is not set.")
        # Configure connection pooling to prevent connection leaks
        _engine = create_engine(
            db_url,
            pool_size=5,  # Maximum 5 connections in pool
            max_overflow=10,  # Allow up to 10 additional connections
            pool_timeout=30,  # Wait up to 30 seconds for available connection
            pool_recycle=3600,  # Recycle connections after 1 hour
            pool_pre_ping=True  # Test connections before use
        )
    return _engine

def fetch_data_from_db():
    engine = get_db_connection()
    query = "SELECT * FROM amazon_ads_reports;"
    df = pd.read_sql(query, engine)
    
    db_to_app_col_map = {
        'report_date': 'date', 'search_term': 'searchTerm', 'purchases_1d': 'purchases1d',
        'sales_1d': 'sales1d', 'keyword_info': 'keyword', 'campaign_name': 'campaignName',
        'profile_id': 'profileId', 'click_through_rate': 'clickThroughRate',
        'campaign_budget_currency_code': 'campaignBudgetCurrencyCode',
        'campaign_budget_type': 'campaignBudgetType', 'campaign_budget_amount': 'campaignBudgetAmount',
        'campaign_status': 'campaignStatus', 'keyword_bid': 'keywordBid',
        'ad_group_name': 'adGroupName', 'ad_group_id': 'adGroupId',
        'keyword_type': 'keywordType', 'match_type': 'matchType',
        'ad_keyword_status': 'adKeywordStatus'
    }
    df.rename(columns=db_to_app_col_map, inplace=True)
    df['date'] = pd.to_datetime(df['date'])
    numeric_cols = ['cost', 'clicks', 'purchases1d', 'sales1d', 'impressions']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    df['week_start'] = df['date'].dt.to_period('W-MON').apply(lambda r: r.start_time)
    df['month_start'] = df['date'].dt.to_period('M').apply(lambda r: r.start_time)
    return df

def calculate_kpis(df):
    total_cost = df['cost'].sum()
    total_sales = df['sales1d'].sum()
    total_clicks = df['clicks'].sum()
    total_impressions = df['impressions'].sum()
    total_purchases = df['purchases1d'].sum()
    acos = (total_cost / total_sales * 100) if total_sales > 0 else 0
    roas = (total_sales / total_cost) if total_cost > 0 else 0
    cpc = (total_cost / total_clicks) if total_clicks > 0 else 0
    ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
    cvr = (total_purchases / total_clicks * 100) if total_clicks > 0 else 0
    return {'cost': total_cost, 'sales': total_sales, 'clicks': total_clicks, 'impressions': total_impressions, 'purchases': total_purchases, 'acos': acos, 'roas': roas, 'cpc': cpc, 'ctr': ctr, 'cvr': cvr}

def process_data_for_table(filtered_df, report_type):
    """Process data for table display with proper sorting and calculations"""
    if report_type == 'Keywords':
        group_cols = ['searchTerm']
        agg_dict = {
            'keyword': 'first',
            'campaignName': 'first',
            'cost': 'sum',
            'sales1d': 'sum',
            'clicks': 'sum',
            'impressions': 'sum',
            'purchases1d': 'sum'
        }
        # Only aggregate columns that exist
        agg_dict = {k: v for k, v in agg_dict.items() if k in filtered_df.columns}
        table_df = filtered_df.groupby(group_cols, as_index=False).agg(agg_dict)
        # Ensure searchTerm is a column, not just index
        if 'searchTerm' not in table_df.columns and 'searchTerm' in table_df.index.names:
            table_df = table_df.reset_index()
    elif report_type == 'Campaigns':
        table_df = filtered_df.groupby('campaignName').agg(
            cost=('cost', 'sum'), 
            sales1d=('sales1d', 'sum'), 
            clicks=('clicks', 'sum'), 
            impressions=('impressions', 'sum'), 
            purchases1d=('purchases1d', 'sum')
        ).reset_index()
    else:
        table_df = filtered_df.copy()

    # Calculate derived metrics
    table_df['acos'] = np.where(table_df['sales1d'] > 0, (table_df['cost'] / table_df['sales1d']) * 100, 0)
    table_df['roas'] = np.where(table_df['cost'] > 0, table_df['sales1d'] / table_df['cost'], 0)
    table_df['cpc'] = np.where(table_df['clicks'] > 0, table_df['cost'] / table_df['clicks'], 0)
    table_df['ctr'] = np.where(table_df['impressions'] > 0, (table_df['clicks'] / table_df['impressions']) * 100, 0)

    return table_df

def fetch_business_data_from_db():
    """Fetch business reports data from the amazon_sales_traffic table."""
    try:
        # Import required SQLAlchemy components
        from sqlalchemy import text
        
        # Use the shared engine with connection pooling
        engine = get_db_connection()
        
        # First check if table exists
        check_table_query = text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'amazon_sales_traffic'
        );
        """)
        
        with engine.connect() as conn:
            result = conn.execute(check_table_query).fetchone()
            table_exists = result[0] if result else False
            
        if not table_exists:
            print("Error: amazon_sales_traffic table does not exist")
            return pd.DataFrame()
        
        # Check if table has data
        count_query = text("SELECT COUNT(*) FROM amazon_sales_traffic")
        with engine.connect() as conn:
            result = conn.execute(count_query).fetchone()
            row_count = result[0] if result else 0
            
        print(f"Table exists with {row_count} rows")
        
        if row_count == 0:
            print("Warning: amazon_sales_traffic table is empty")
            return pd.DataFrame()
        
        query = text("""
        SELECT 
            date,
            parent_asin,
            sku,
            CAST(sessions AS INTEGER) as sessions,
            CAST(page_views AS INTEGER) as page_views,
            CAST(units_ordered AS INTEGER) as units_ordered,
            CAST(ordered_product_sales AS DECIMAL(10,2)) as ordered_product_sales
        FROM amazon_sales_traffic 
        ORDER BY date DESC
        """)
        
        print(f"Executing business data query")
        df = pd.read_sql(query, engine)
        print(f"Fetched {len(df)} rows from business reports table")
        
        if df.empty:
            print("Warning: No data found in amazon_sales_traffic table")
        else:
            print(f"Sample data: {df.head()}")
            
        return df
    except Exception as e:
        print(f"Error fetching business data: {e}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()

def calculate_business_kpis(df):
    """Calculate KPIs for business reports."""
    if df.empty:
        return {}
    
    # Convert currency strings to numeric, removing $ and commas
    df['ordered_product_sales'] = pd.to_numeric(df['ordered_product_sales'].astype(str).str.replace('$', '').str.replace(',', ''), errors='coerce')
    
    kpis = {
        'total_sessions': int(df['sessions'].sum()),
        'total_page_views': int(df['page_views'].sum()),
        'total_units_ordered': int(df['units_ordered'].sum()),
        'total_sales': float(df['ordered_product_sales'].sum()),
        'avg_sessions_per_day': float(df.groupby('date')['sessions'].sum().mean()),
        'avg_sales_per_day': float(df.groupby('date')['ordered_product_sales'].sum().mean()),
        'conversion_rate': float((df['units_ordered'].sum() / df['page_views'].sum()) * 100) if df['page_views'].sum() > 0 else 0
    }
    
    return kpis

def process_business_data_for_table(df, filters):
    """Process business data for DataTables display."""
    if df.empty:
        return pd.DataFrame()
    
    # Apply date filters
    if filters.get('start_date'):
        start_date = pd.to_datetime(filters['start_date']).date()
        df = df[df['date'] >= start_date]
    if filters.get('end_date'):
        end_date = pd.to_datetime(filters['end_date']).date()
        df = df[df['date'] <= end_date]
    
    # Apply SKU filter
    if filters.get('skus'):
        df = df[df['sku'].isin(filters['skus'])]
    
    # Apply Parent ASIN filter
    if filters.get('parent_asins'):
        df = df[df['parent_asin'].isin(filters['parent_asins'])]
    
    # Group by date and calculate daily totals
    daily_data = df.groupby('date').agg({
        'sessions': 'sum',
        'page_views': 'sum',
        'units_ordered': 'sum',
        'ordered_product_sales': 'sum'
    }).reset_index()
    
    # Calculate derived metrics
    daily_data['conversion_rate'] = (daily_data['units_ordered'] / daily_data['page_views'] * 100).fillna(0)
    daily_data['avg_order_value'] = (daily_data['ordered_product_sales'] / daily_data['units_ordered']).fillna(0)
    
    # Format currency
    daily_data['ordered_product_sales'] = daily_data['ordered_product_sales'].apply(lambda x: f"₹{x:,.2f}")
    daily_data['avg_order_value'] = daily_data['avg_order_value'].apply(lambda x: f"₹{x:,.2f}")
    
    return daily_data

def get_total_sales_from_business_reports(start_date=None, end_date=None):
    """Return total sales from amazon_sales_traffic for the given date range."""
    from sqlalchemy import text
    engine = get_db_connection()
    query = "SELECT SUM(CAST(ordered_product_sales AS NUMERIC)) FROM amazon_sales_traffic WHERE 1=1"
    params = {}
    if start_date:
        query += " AND date >= :start_date"
        params['start_date'] = start_date
    if end_date:
        query += " AND date <= :end_date"
        params['end_date'] = end_date
    with engine.connect() as conn:
        result = conn.execute(text(query), params).scalar()
    return float(result) if result else 0.0

# =================================================================================
# 2. ROUTE DEFINITIONS
# =================================================================================

# --- ROUTE 1: Main Portfolio Page ---
@app.route('/')
def main_portfolio():
    """Serves the main static portfolio page."""
    return render_template('main_portfolio.html')

# --- ROUTE 2: Data API for DataTables ---
@app.route('/api/data')
def get_table_data():
    """API endpoint for DataTables server-side processing"""
    try:
        # Get parameters from DataTables
        draw = int(request.args.get('draw', 1))
        start = int(request.args.get('start', 0))
        length = int(request.args.get('length', 25))
        search_value = request.args.get('search[value]', '')
        
        # Get sorting parameters
        order_column = int(request.args.get('order[0][column]', 0))
        order_dir = request.args.get('order[0][dir]', 'asc')
        
        # Get filter parameters
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        report_type = request.args.get('report_type', 'Keywords')
        selected_campaigns = request.args.getlist('campaigns[]')
        selected_keywords = request.args.getlist('keywords[]')

        # Fetch and filter data
        data_df = fetch_data_from_db()
        
        if start_date and end_date:
            date_mask = (data_df['date'] >= pd.to_datetime(start_date)) & (data_df['date'] <= pd.to_datetime(end_date))
            filtered_df = data_df[date_mask].copy()
        else:
            filtered_df = data_df.copy()

        if selected_campaigns:
            filtered_df = filtered_df[filtered_df['campaignName'].isin(selected_campaigns)]

        if report_type == 'Keywords' and selected_keywords:
            filtered_df = filtered_df[filtered_df['keyword'].isin(selected_keywords)]

        # Process data for table display
        table_df = process_data_for_table(filtered_df, report_type)

        # Define display columns
        if report_type == 'Keywords':
            display_cols = ['searchTerm', 'keyword', 'campaignName', 'cost', 'sales1d', 'acos', 'roas', 'cpc', 'ctr', 'clicks', 'impressions', 'purchases1d']
        else:
            display_cols = ['campaignName', 'cost', 'sales1d', 'acos', 'roas', 'cpc', 'ctr', 'clicks', 'impressions', 'purchases1d']

        # Ensure all required columns exist
        for col in display_cols:
            if col not in table_df.columns:
                if col in ['searchTerm', 'keyword']:
                    table_df[col] = 'N/A'
                else:
                    table_df[col] = 0

        # Filter to only include columns that exist
        available_cols = [col for col in display_cols if col in table_df.columns]
        table_df = table_df[available_cols]

        # Apply search filter
        if search_value:
            mask = pd.DataFrame([False] * len(table_df), index=table_df.index)
            for col in table_df.columns:
                if col in ['searchTerm', 'keyword', 'campaignName']:
                    mask |= table_df[col].astype(str).str.contains(search_value, case=False, na=False)
            table_df = table_df[mask]

        # Apply sorting
        column_mapping = {
            0: 'searchTerm', 1: 'keyword', 2: 'campaignName', 3: 'cost', 
            4: 'sales1d', 5: 'acos', 6: 'roas', 7: 'cpc', 8: 'ctr', 
            9: 'clicks', 10: 'impressions', 11: 'purchases1d'
        }
        
        if report_type == 'Campaigns':
            column_mapping = {
                0: 'campaignName', 1: 'cost', 2: 'sales1d', 3: 'acos', 
                4: 'roas', 5: 'cpc', 6: 'ctr', 7: 'clicks', 8: 'impressions', 9: 'purchases1d'
            }

        if order_column in column_mapping:
            sort_column = column_mapping[order_column]
            if sort_column in table_df.columns:
                table_df = table_df.sort_values(by=sort_column, ascending=(order_dir == 'asc'))

        # Get total count before pagination
        total_records = len(table_df)
        filtered_records = len(table_df)

        # Apply pagination
        table_df = table_df.iloc[start:start + length]

        # Convert to list of arrays for JSON response (DataTables format)
        data = []
        try:
            for _, row in table_df.iterrows():
                data_row = []
                for col in available_cols:
                    try:
                        if col in ['cost', 'sales1d', 'cpc']:
                            value = row[col] if pd.notna(row[col]) else 0
                            data_row.append(f"₹{value:.2f}")
                        elif col in ['acos', 'ctr']:
                            value = row[col] if pd.notna(row[col]) else 0
                            data_row.append(f"{value:.2f}%")
                        elif col in ['roas']:
                            value = row[col] if pd.notna(row[col]) else 0
                            data_row.append(f"{value:.2f}")
                        elif col in ['clicks', 'impressions', 'purchases1d']:
                            value = int(row[col]) if pd.notna(row[col]) else 0
                            data_row.append(value)
                        else:
                            value = str(row[col]) if pd.notna(row[col]) else 'N/A'
                            data_row.append(value)
                    except Exception as col_error:
                        print(f"ERROR processing column {col}: {col_error}")
                        data_row.append('N/A')
                data.append(data_row)
        except Exception as row_error:
            print(f"ERROR processing rows: {row_error}")
            data = []

        return jsonify({
            'draw': draw,
            'recordsTotal': total_records,
            'recordsFiltered': filtered_records,
            'data': data
        })

    except Exception as e:
        print(f"ERROR in API: {e}")
        return jsonify({
            'draw': 1,
            'recordsTotal': 0,
            'recordsFiltered': 0,
            'data': [],
            'error': str(e)
        })

@app.route('/businessreports')
def business_reports():
    """Business Reports Dashboard."""
    # Get filters from query parameters
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
    skus = request.args.getlist('skus')
    parent_asins = request.args.getlist('parent_asins')
    
    print(f"Business Reports Debug - Received filters: start_date={start_date}, end_date={end_date}, skus={skus}, parent_asins={parent_asins}")
    
    # Fetch all data for filters and processing
    df = fetch_business_data_from_db()
    
    if df.empty:
        print("Warning: No business data available")
        # Return empty template with default values
        total_sales_business = get_total_sales_from_business_reports(start_date, end_date)
        return render_template('business_reports.html', 
                             kpis={
                                 'total_sessions': 0,
                                 'total_page_views': 0,
                                 'total_units_ordered': 0,
                                 'total_sales': 0.0,
                                 'avg_sessions_per_day': 0.0,
                                 'avg_sales_per_day': 0.0,
                                 'conversion_rate': 0.0
                             },
                             all_skus=[],
                             all_parent_asins=[],
                             selected_skus=skus,
                             selected_parent_asins=parent_asins,
                             filters={'start_date': start_date, 'end_date': end_date},
                             total_sales_business=total_sales_business)
    
    # FIXED: Extract unique values for dropdowns from ALL data (not filtered)
    all_skus = sorted([str(sku) for sku in df['sku'].dropna().unique().tolist() if str(sku) != 'nan'])
    all_parent_asins = sorted([str(asin) for asin in df['parent_asin'].dropna().unique().tolist() if str(asin) != 'nan'])
    
    print(f"Business Reports Debug - Found {len(all_skus)} unique SKUs and {len(all_parent_asins)} unique Parent ASINs")
    print(f"Business Reports Debug - Sample SKUs: {all_skus[:5] if all_skus else 'None'}")
    print(f"Business Reports Debug - Sample ASINs: {all_parent_asins[:5] if all_parent_asins else 'None'}")
    
    # Apply filters to data for KPI calculation
    filtered_df = df.copy()
    
    # Apply date filters
    if start_date:
        try:
            start_date_parsed = pd.to_datetime(start_date).date()
            filtered_df = filtered_df[filtered_df['date'] >= start_date_parsed]
            print(f"Business Reports Debug - Applied start date filter: {start_date}")
        except Exception as e:
            print(f"Business Reports Debug - Error parsing start date: {e}")
    
    if end_date:
        try:
            end_date_parsed = pd.to_datetime(end_date).date()
            filtered_df = filtered_df[filtered_df['date'] <= end_date_parsed]
            print(f"Business Reports Debug - Applied end date filter: {end_date}")
        except Exception as e:
            print(f"Business Reports Debug - Error parsing end date: {e}")
    
    # Apply SKU filters
    if skus:
        filtered_df = filtered_df[filtered_df['sku'].isin(skus)]
        print(f"Business Reports Debug - Applied SKU filter: {skus}")
    
    # Apply Parent ASIN filters
    if parent_asins:
        filtered_df = filtered_df[filtered_df['parent_asin'].isin(parent_asins)]
        print(f"Business Reports Debug - Applied Parent ASIN filter: {parent_asins}")
    
    print(f"Business Reports Debug - Filtered data shape: {filtered_df.shape}")
    
    # Calculate KPIs with filtered data
    kpis = calculate_business_kpis(filtered_df)
    if not kpis:  # If no data, provide default values
        kpis = {
            'total_sessions': 0,
            'total_page_views': 0,
            'total_units_ordered': 0,
            'total_sales': 0.0,
            'avg_sessions_per_day': 0.0,
            'avg_sales_per_day': 0.0,
            'conversion_rate': 0.0
        }
    
    print(f"Business Reports Debug - Calculated KPIs: {kpis}")
    
    total_sales_business = get_total_sales_from_business_reports(start_date, end_date)
    return render_template('business_reports.html', 
                         kpis=kpis,
                         all_skus=all_skus,
                         all_parent_asins=all_parent_asins,
                         selected_skus=skus,
                         selected_parent_asins=parent_asins,
                         filters={'start_date': start_date, 'end_date': end_date},
                         total_sales_business=total_sales_business)

@app.route('/api/business-data')
def api_business_data():
    """API endpoint for business reports DataTables."""
    try:
        # Get DataTables parameters
        draw = int(request.args.get('draw', 1))
        start = int(request.args.get('start', 0))
        length = int(request.args.get('length', 10))
        search_value = request.args.get('search[value]', '')
        
        # Get sorting parameters
        order_column = request.args.get('order[0][column]', '0')
        order_dir = request.args.get('order[0][dir]', 'asc')
        
        # Column mapping for sorting
        column_mapping = {
            '0': 'sku',
            '1': 'parent_asin', 
            '2': 'sku',  # Product title is based on SKU
            '3': 'sessions',
            '4': 'page_views',
            '5': 'units_ordered',
            '6': 'ordered_product_sales',
            '7': 'conversion_rate',
            '8': 'avg_order_value'
        }
        
        # Get filters
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        skus = request.args.getlist('skus')
        parent_asins = request.args.getlist('parent_asins')
        
        print(f"Business API Debug - Filters: start_date={start_date}, end_date={end_date}, skus={skus}, parent_asins={parent_asins}")
        
        # Fetch and process data
        df = fetch_business_data_from_db()
        print(f"Business API Debug - Raw data shape: {df.shape}")
        
        if df.empty:
            return jsonify({
                'draw': draw,
                'recordsTotal': 0,
                'recordsFiltered': 0,
                'data': []
            })
        
        # FIXED: Apply filters properly
        filtered_df = df.copy()
        
        # Apply date filters
        if start_date:
            try:
                start_date_parsed = pd.to_datetime(start_date).date()
                filtered_df = filtered_df[filtered_df['date'] >= start_date_parsed]
                print(f"Business API Debug - Applied start date filter, shape: {filtered_df.shape}")
            except Exception as e:
                print(f"Business API Debug - Error parsing start date: {e}")
        
        if end_date:
            try:
                end_date_parsed = pd.to_datetime(end_date).date()
                filtered_df = filtered_df[filtered_df['date'] <= end_date_parsed]
                print(f"Business API Debug - Applied end date filter, shape: {filtered_df.shape}")
            except Exception as e:
                print(f"Business API Debug - Error parsing end date: {e}")
        
        # Apply SKU filters
        if skus and len(skus) > 0:
            # Filter out empty strings
            skus = [sku for sku in skus if sku.strip()]
            if skus:
                filtered_df = filtered_df[filtered_df['sku'].isin(skus)]
                print(f"Business API Debug - Applied SKU filter {skus}, shape: {filtered_df.shape}")
        
        # Apply Parent ASIN filters
        if parent_asins and len(parent_asins) > 0:
            # Filter out empty strings
            parent_asins = [asin for asin in parent_asins if asin.strip()]
            if parent_asins:
                filtered_df = filtered_df[filtered_df['parent_asin'].isin(parent_asins)]
                print(f"Business API Debug - Applied Parent ASIN filter {parent_asins}, shape: {filtered_df.shape}")
        
        # Group by product (SKU and Parent ASIN) and calculate product totals
        if not filtered_df.empty:
            product_data = filtered_df.groupby(['sku', 'parent_asin']).agg({
                'sessions': 'sum',
                'page_views': 'sum',
                'units_ordered': 'sum',
                'ordered_product_sales': 'sum'
            }).reset_index()
            
            # Calculate derived metrics
            product_data['conversion_rate'] = (product_data['units_ordered'] / product_data['page_views'] * 100).fillna(0)
            product_data['avg_order_value'] = (product_data['ordered_product_sales'] / product_data['units_ordered']).fillna(0)
            
            # Apply sorting
            if order_column in column_mapping:
                sort_column = column_mapping[order_column]
                ascending = order_dir.lower() == 'asc'
                product_data = product_data.sort_values(sort_column, ascending=ascending)
            else:
                # Default sort by SKU ascending
                product_data = product_data.sort_values('sku', ascending=True)
            
            print(f"Business API Debug - Processed data shape: {product_data.shape}")
            if not product_data.empty:
                print(f"Business API Debug - Sample processed data: {product_data.head()}")
        else:
            product_data = pd.DataFrame()
            print("Business API Debug - No data after filtering")
        
        # Apply search filter
        if search_value and not product_data.empty:
            mask = product_data.apply(lambda x: x.astype(str).str.contains(search_value, case=False, na=False)).any(axis=1)
            product_data = product_data[mask]
        
        # Get total count before pagination
        total_records = len(product_data)
        print(f"Business API Debug - Total records: {total_records}")
        
        # Apply pagination
        end_idx = start + length
        paginated_df = product_data.iloc[start:end_idx]
        
        # Convert to DataTables format - Product-wise data
        data = []
        for _, row in paginated_df.iterrows():
            data.append([
                row['sku'],                                    # 0: SKU
                row['parent_asin'],                            # 1: Parent ASIN
                f"Product {row['sku']}",                       # 2: Product Title (placeholder)
                int(row['sessions']),                          # 3: Sessions
                int(row['page_views']),                        # 4: Page Views
                int(row['units_ordered']),                     # 5: Units Ordered
                f"₹{row['ordered_product_sales']:,.2f}",      # 6: Sales
                f"{row['conversion_rate']:.2f}%",             # 7: Conversion Rate
                f"₹{row['avg_order_value']:,.2f}"             # 8: Avg Order Value
            ])
        
        response_data = {
            'draw': draw,
            'recordsTotal': total_records,
            'recordsFiltered': total_records,
            'data': data
        }
        
        print(f"Business API Debug - Response data: {response_data}")
        print(f"Business API Debug - Response data length: {len(response_data['data'])}")
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Error in business data API: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'draw': 1,
            'recordsTotal': 0,
            'recordsFiltered': 0,
            'data': [],
            'error': str(e)
        })

@app.route('/export/business-excel')
def export_business_excel():
    """Export business reports data to Excel."""
    try:
        # Get filters
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        skus = request.args.getlist('skus')
        parent_asins = request.args.getlist('parent_asins')
        
        # Fetch and process data
        df = fetch_business_data_from_db()
        processed_df = process_business_data_for_table(df, {
            'start_date': start_date,
            'end_date': end_date,
            'skus': skus,
            'parent_asins': parent_asins
        })
        
        # Create Excel file
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            processed_df.to_excel(writer, sheet_name='Business Reports', index=False)
        
        output.seek(0)
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'business_reports_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        )
        
    except Exception as e:
        print(f"Error exporting business Excel: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/export/business-csv')
def export_business_csv():
    """Export business reports data to CSV."""
    try:
        # Get filters
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        skus = request.args.getlist('skus')
        parent_asins = request.args.getlist('parent_asins')
        
        # Fetch and process data
        df = fetch_business_data_from_db()
        processed_df = process_business_data_for_table(df, {
            'start_date': start_date,
            'end_date': end_date,
            'skus': skus,
            'parent_asins': parent_asins
        })
        
        # Create CSV
        output = io.StringIO()
        processed_df.to_csv(output, index=False)
        output.seek(0)
        
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'business_reports_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )
        
    except Exception as e:
        print(f"Error exporting business CSV: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/campaign-asin-sku-map')
def api_campaign_asin_sku_map():
    """API endpoint for Campaign → ASIN → SKU mapping table."""
    try:
        from sqlalchemy import text
        # DataTables params
        draw = int(request.args.get('draw', 1))
        start = int(request.args.get('start', 0))
        length = int(request.args.get('length', 25))
        search_value = request.args.get('search[value]', '')
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        campaigns = request.args.getlist('campaigns')

        engine = get_db_connection()
        with engine.connect() as conn:
            # Check if parent_asin exists in amazon_sales_traffic
            col_check = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'amazon_sales_traffic' AND column_name = 'parent_asin'
            """)).fetchone()
            asin_col = 'parent_asin' if col_check else 'asin'

        # Build base query: campaign_name from ads, sku+asin from business reports
        query = f'''
            SELECT DISTINCT a.campaign_name, s.{asin_col}, s.sku
            FROM amazon_ads_reports a
            JOIN amazon_sales_traffic s ON a.sku = s.sku
            WHERE 1=1
        '''
        params = {}
        if start_date:
            query += ' AND a.report_date >= :start_date'
            params['start_date'] = start_date
        if end_date:
            query += ' AND a.report_date <= :end_date'
            params['end_date'] = end_date
        if campaigns:
            query += ' AND a.campaign_name = ANY(:campaigns)'
            params['campaigns'] = campaigns
        if search_value:
            query += f' AND (a.campaign_name ILIKE :search OR s.{asin_col} ILIKE :search OR s.sku ILIKE :search)'
            params['search'] = f'%{search_value}%'
        # Count total records
        count_query = f'SELECT COUNT(*) FROM ({query}) AS subquery'
        with engine.connect() as conn:
            total_records = conn.execute(text(count_query), params).scalar()
            # Pagination
            query += f' ORDER BY a.campaign_name, s.{asin_col}, s.sku OFFSET :offset LIMIT :limit'
            params['offset'] = start
            params['limit'] = length
            result = conn.execute(text(query), params)
            rows = result.fetchall()
        # Format for DataTables
        data = [[row[0], row[1], row[2]] for row in rows]
        return jsonify({
            'draw': draw,
            'recordsTotal': total_records,
            'recordsFiltered': total_records,
            'data': data
        })
    except Exception as e:
        print(f"Error in /api/campaign-asin-sku-map: {e}")
        import traceback; traceback.print_exc()
        return jsonify({'draw': 1, 'recordsTotal': 0, 'recordsFiltered': 0, 'data': [], 'error': str(e)})

# =================================================================================
# 3. RUN THE APPLICATION
# =================================================================================

@app.route('/amazonanalytics')
def amazon_dashboard():
    """The main logic for the Amazon Analytics dashboard."""
    try:
        data_df = fetch_data_from_db()
        if data_df.empty:
            return "<h1>Error: No data found in the database.</h1>"
    except Exception as e:
        print(f"ERROR fetching data: {e}")
        return "<h1>Error: Could not connect to the database. Please check server logs.</h1>"

    default_start_date = data_df['date'].min().strftime('%Y-%m-%d')
    default_end_date = data_df['date'].max().strftime('%Y-%m-%d')
    
    start_date_str = request.args.get('start_date', default_start_date)
    end_date_str = request.args.get('end_date', default_end_date)
    group_by = request.args.get('group_by', 'Daily')
    report_type = request.args.get('report_type', 'Keywords')
    selected_campaigns = request.args.getlist('campaigns')
    selected_keywords = request.args.getlist('keywords')

    date_mask = (data_df['date'] >= pd.to_datetime(start_date_str)) & (data_df['date'] <= pd.to_datetime(end_date_str))
    filtered_df = data_df[date_mask].copy()
    
    all_campaigns = sorted(filtered_df['campaignName'].astype(str).unique().tolist())
    if selected_campaigns:
        filtered_df = filtered_df[filtered_df['campaignName'].isin(selected_campaigns)]

    # Handle keyword filtering for Keywords report
    all_keywords = []
    if report_type == 'Keywords':
        all_keywords = sorted(filtered_df['keyword'].astype(str).unique().tolist())
        if selected_keywords:
            filtered_df = filtered_df[filtered_df['keyword'].isin(selected_keywords)]

    kpi_data = calculate_kpis(filtered_df)
    time_col_map = {'Daily': 'date', 'Weekly': 'week_start', 'Monthly': 'month_start'}
    time_col = time_col_map.get(group_by, 'date')
    
    trend_data = filtered_df.groupby(time_col).agg(cost=('cost', 'sum'), sales1d=('sales1d', 'sum')).reset_index()
    trend_data['acos'] = np.where(trend_data['sales1d'] > 0, (trend_data['cost'] / trend_data['sales1d']) * 100, 0)
    
    # Get business sales data for each time period to calculate TCOS
    business_sales_data = []
    tcos_data = []
    
    for _, row in trend_data.iterrows():
        period_start = row[time_col]
        
        # For weekly/monthly, we need to get the end of the period
        if group_by == 'Weekly':
            period_end = period_start + pd.Timedelta(days=6)
        elif group_by == 'Monthly':
            period_end = (period_start + pd.offsets.MonthEnd(1))
        else:  # Daily
            period_end = period_start
            
        # Get business sales for this period
        period_business_sales = get_total_sales_from_business_reports(
            period_start.strftime('%Y-%m-%d'), 
            period_end.strftime('%Y-%m-%d')
        )
        business_sales_data.append(period_business_sales)
        
        # Calculate TCOS for this period
        period_tcos = (row['cost'] / period_business_sales * 100) if period_business_sales > 0 else 0
        tcos_data.append(period_tcos)
    
    chart_data = {
        'labels': trend_data[time_col].dt.strftime('%Y-%m-%d').tolist(), 
        'spend': trend_data['cost'].round(2).tolist(), 
        'sales': trend_data['sales1d'].round(2).tolist(), 
        'acos': trend_data['acos'].round(2).tolist(),
        'total_sales': [round(x, 2) for x in business_sales_data],
        'tcos': [round(x, 2) for x in tcos_data]
    }

    # Define display columns with proper order
    if report_type == 'Keywords':
        display_cols = ['searchTerm', 'keyword', 'campaignName', 'cost', 'sales1d', 'acos', 'roas', 'cpc', 'ctr', 'clicks', 'impressions', 'purchases1d']
    else:
        display_cols = ['campaignName', 'cost', 'sales1d', 'acos', 'roas', 'cpc', 'ctr', 'clicks', 'impressions', 'purchases1d']
    
    # Create headers with proper formatting
    header_mapping = {
        'searchTerm': 'Search Term',
        'keyword': 'Keywords',
        'campaignName': 'Campaign Name',
        'cost': 'Spend',
        'sales1d': 'Sales',
        'acos': 'ACOS',
        'roas': 'ROAS',
        'cpc': 'CPC',
        'ctr': 'CTR',
        'clicks': 'Clicks',
        'impressions': 'Impressions',
        'purchases1d': 'Purchases'
    }
    
    table_headers = [header_mapping.get(col, col.title()) for col in display_cols]

    # --- Add total sales from business reports ---
    total_sales_business = get_total_sales_from_business_reports(start_date_str, end_date_str)
    # --- Calculate TCOS ---
    ad_spend = kpi_data.get('cost', 0.0)
    tcos = (ad_spend / total_sales_business * 100) if total_sales_business > 0 else 0.0

    return render_template('amazon_dashboard.html', kpi_data=kpi_data, chart_data=chart_data, table_headers=table_headers, report_type=report_type, all_campaigns=all_campaigns, selected_campaigns=selected_campaigns, all_keywords=all_keywords, selected_keywords=selected_keywords, filters={'start_date': start_date_str, 'end_date': end_date_str, 'group_by': group_by}, total_sales_business=total_sales_business, tcos=tcos)

@app.route('/export/excel')
def export_excel():
    """Export data to Excel file"""
    try:
        # Get filter parameters
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        report_type = request.args.get('report_type', 'Keywords')
        selected_campaigns = request.args.getlist('campaigns')
        selected_keywords = request.args.getlist('keywords')

        # Fetch and filter data
        data_df = fetch_data_from_db()
        
        if start_date and end_date:
            date_mask = (data_df['date'] >= pd.to_datetime(start_date)) & (data_df['date'] <= pd.to_datetime(end_date))
            filtered_df = data_df[date_mask].copy()
        else:
            filtered_df = data_df.copy()

        if selected_campaigns:
            filtered_df = filtered_df[filtered_df['campaignName'].isin(selected_campaigns)]

        if report_type == 'Keywords' and selected_keywords:
            filtered_df = filtered_df[filtered_df['keyword'].isin(selected_keywords)]

        # Process data for export - NO PAGINATION, get ALL data
        table_df = process_data_for_table(filtered_df, report_type)

        # Define display columns
        if report_type == 'Keywords':
            display_cols = ['searchTerm', 'keyword', 'campaignName', 'cost', 'sales1d', 'acos', 'roas', 'cpc', 'ctr', 'clicks', 'impressions', 'purchases1d']
        else:
            display_cols = ['campaignName', 'cost', 'sales1d', 'acos', 'roas', 'cpc', 'ctr', 'clicks', 'impressions', 'purchases1d']

        # Ensure all required columns exist
        for col in display_cols:
            if col not in table_df.columns:
                if col in ['searchTerm', 'keyword']:
                    table_df[col] = 'N/A'
                else:
                    table_df[col] = 0

        # Filter to only include columns that exist
        available_cols = [col for col in display_cols if col in table_df.columns]
        table_df = table_df[available_cols]

        # Create headers mapping
        header_mapping = {
            'searchTerm': 'Search Term',
            'keyword': 'Keywords',
            'campaignName': 'Campaign Name',
            'cost': 'Spend',
            'sales1d': 'Sales',
            'acos': 'ACOS',
            'roas': 'ROAS',
            'cpc': 'CPC',
            'ctr': 'CTR',
            'clicks': 'Clicks',
            'impressions': 'Impressions',
            'purchases1d': 'Purchases'
        }

        # Rename columns for export
        export_df = table_df.copy()
        export_df.columns = [header_mapping.get(col, col.title()) for col in export_df.columns]

        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            export_df.to_excel(writer, sheet_name=f'{report_type} Report', index=False)
        
        output.seek(0)
        
        filename = f'amazon_{report_type.lower()}_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        print(f"ERROR in Excel export: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/export/csv')
def export_csv():
    """Export data to CSV file"""
    try:
        # Get filter parameters
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        report_type = request.args.get('report_type', 'Keywords')
        selected_campaigns = request.args.getlist('campaigns')
        selected_keywords = request.args.getlist('keywords')

        # Fetch and filter data
        data_df = fetch_data_from_db()
        
        if start_date and end_date:
            date_mask = (data_df['date'] >= pd.to_datetime(start_date)) & (data_df['date'] <= pd.to_datetime(end_date))
            filtered_df = data_df[date_mask].copy()
        else:
            filtered_df = data_df.copy()

        if selected_campaigns:
            filtered_df = filtered_df[filtered_df['campaignName'].isin(selected_campaigns)]

        if report_type == 'Keywords' and selected_keywords:
            filtered_df = filtered_df[filtered_df['keyword'].isin(selected_keywords)]

        # Process data for export - NO PAGINATION, get ALL data
        table_df = process_data_for_table(filtered_df, report_type)

        # Define display columns
        if report_type == 'Keywords':
            display_cols = ['searchTerm', 'keyword', 'campaignName', 'cost', 'sales1d', 'acos', 'roas', 'cpc', 'ctr', 'clicks', 'impressions', 'purchases1d']
        else:
            display_cols = ['campaignName', 'cost', 'sales1d', 'acos', 'roas', 'cpc', 'ctr', 'clicks', 'impressions', 'purchases1d']

        # Ensure all required columns exist
        for col in display_cols:
            if col not in table_df.columns:
                if col in ['searchTerm', 'keyword']:
                    table_df[col] = 'N/A'
                else:
                    table_df[col] = 0

        # Filter to only include columns that exist
        available_cols = [col for col in display_cols if col in table_df.columns]
        table_df = table_df[available_cols]

        # Create headers mapping
        header_mapping = {
            'searchTerm': 'Search Term',
            'keyword': 'Keywords',
            'campaignName': 'Campaign Name',
            'cost': 'Spend',
            'sales1d': 'Sales',
            'acos': 'ACOS',
            'roas': 'ROAS',
            'cpc': 'CPC',
            'ctr': 'CTR',
            'clicks': 'Clicks',
            'impressions': 'Impressions',
            'purchases1d': 'Purchases'
        }

        # Rename columns for export
        export_df = table_df.copy()
        export_df.columns = [header_mapping.get(col, col.title()) for col in export_df.columns]

        # Create CSV file in memory
        output = io.StringIO()
        export_df.to_csv(output, index=False)
        output.seek(0)
        
        filename = f'amazon_{report_type.lower()}_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        print(f"ERROR in CSV export: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)