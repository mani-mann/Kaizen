// Enable debug logging for troubleshooting
(function() {
    const ENABLE_DEBUG = true; // Changed to true for debugging
    if (!ENABLE_DEBUG && typeof console !== 'undefined') {
        const noops = ['log', 'debug', 'info', 'group', 'groupCollapsed', 'groupEnd', 'time', 'timeEnd', 'table'];
        noops.forEach(fn => { try { console[fn] = () => {}; } catch(_) {} });
    }
})();

class BusinessReportsDashboard {
constructor() {
    this.state = {
        businessData: [],
        filteredData: [],
        currentPage: 1,
        itemsPerPage: 25,
        sortColumn: '',
        sortDirection: 'desc',
        searchTerm: '',
        dateRange: { start: null, end: null }
    };
    
    this.calendarState = {
        tempRangeStart: null,
        tempRangeEnd: null,
        calendarMonth: new Date()
    };
    
    this.availableDateRange = null;
    this.availableDates = [];
    
    this.init();
}

async init() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initializeComponents());
    } else {
        this.initializeComponents();
    }
}

async initializeComponents() {
    console.log('🔍 Initializing business reports dashboard components...');
    
    this.setupEventListeners();
    console.log('✅ Event listeners setup complete');
    
    this.initializeDatePicker();
    console.log('✅ Date picker initialized');
    
    console.log('🔍 Fetching available date range...');
    await this.fetchAvailableDateRange();
    console.log('✅ Date range fetched');
    
    console.log('🔍 Loading initial data...');
    await this.loadData();
    console.log('✅ Initial data loaded');
    
    this.startAutoRefresh();
    console.log('✅ Auto refresh started');
    
    console.log('🎉 Business reports dashboard initialization complete');
}

// removed debug connectivity probe

async fetchAvailableDateRange() {
    try {
        console.log('🔍 Fetching available date range...');
        const rangeResponse = await fetch('http://localhost:5000/api/business-date-range');
        console.log('🔍 Date range response status:', rangeResponse.status);
        
        if (!rangeResponse.ok) {
            console.error('❌ Failed to fetch date range:', rangeResponse.status, rangeResponse.statusText);
            throw new Error('Failed to fetch date range');
        }
        
        const dateRange = await rangeResponse.json();
        console.log('🔍 Date range response:', dateRange);
        
        console.log('🔍 Fetching available dates...');
        const datesResponse = await fetch('http://localhost:5000/api/business-available-dates');
        console.log('🔍 Available dates response status:', datesResponse.status);
        
        if (!datesResponse.ok) {
            console.error('❌ Failed to fetch available dates:', datesResponse.status, datesResponse.statusText);
            throw new Error('Failed to fetch available dates');
        }
        
        const availableDates = await datesResponse.json();
        console.log('🔍 Available dates response:', availableDates);
        
        if (dateRange.hasData && dateRange.minDate && dateRange.maxDate && availableDates.hasData) {
            let maxDate, minDate;
            
            try {
                if (dateRange.maxDate.includes('T') && (dateRange.maxDate.endsWith('Z') || dateRange.maxDate.includes('+'))) {
                    maxDate = new Date(dateRange.maxDate);
                } else {
                    maxDate = new Date(dateRange.maxDate + 'T00:00:00');
                }
                
                if (dateRange.minDate.includes('T') && (dateRange.minDate.endsWith('Z') || dateRange.minDate.includes('+'))) {
                    minDate = new Date(dateRange.minDate);
                } else {
                    minDate = new Date(dateRange.minDate + 'T00:00:00');
                }
                
                if (isNaN(maxDate.getTime()) || isNaN(minDate.getTime())) {
                    throw new Error('Invalid date after parsing');
                }
                
            } catch (parseError) {
                maxDate = new Date('2025-01-31T00:00:00');
                minDate = new Date('2025-01-01T00:00:00');
                
                this.state.dateRange = {
                    start: new Date('2025-01-01T00:00:00'),
                    end: new Date('2025-01-31T23:59:59')
                };
                
                this.updateDateDisplay();
                return;
            }
            
            if (!maxDate || !minDate || isNaN(maxDate.getTime()) || isNaN(minDate.getTime())) {
                throw new Error('Invalid dates after parsing');
            }
            
            const daysAvailable = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
            const daysToShow = Math.min(30, daysAvailable);
            
            const end = new Date(maxDate);
            const start = new Date(maxDate);
            start.setTime(end.getTime() - ((daysToShow - 1) * 24 * 60 * 60 * 1000));
            
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            
            // Create date strings directly to avoid any timezone issues
            const startDateStr = this.formatDate(start);
            const endDateStr = this.formatDate(end);
            
            this.state.dateRange = { 
                start, 
                end,
                startStr: startDateStr,
                endStr: endDateStr
            };
            
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new Error('Invalid dates calculated');
            }
            
            this.updateDateDisplay();
            
            this.availableDateRange = {
                min: minDate,
                max: maxDate
            };
            
            this.availableDates = [];
            
            try {
                for (const dateStr of availableDates.dates) {
                    let parsedDate;
                    
                    if (dateStr.includes('T') && (dateStr.endsWith('Z') || dateStr.includes('+'))) {
                        parsedDate = new Date(dateStr);
                    } else {
                        parsedDate = new Date(dateStr + 'T00:00:00');
                    }
                    
                    if (!isNaN(parsedDate.getTime())) {
                        this.availableDates.push(parsedDate);
                    }
                }
                
            } catch (dateError) {
                this.availableDates = [];
            }
            
            if (!this.state.dateRange.start || !this.state.dateRange.end || 
                isNaN(this.state.dateRange.start.getTime()) || isNaN(this.state.dateRange.end.getTime())) {
                const fallbackStart = new Date('2025-01-01T00:00:00');
                const fallbackEnd = new Date('2025-01-31T23:59:59');
                this.state.dateRange = {
                    start: fallbackStart,
                    end: fallbackEnd,
                    startStr: this.formatDate(fallbackStart),
                    endStr: this.formatDate(fallbackEnd)
                };
                this.updateDateDisplay();
            }
            
        } else {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            // Create date strings directly to avoid any timezone issues
            const startDateStr = this.formatDate(start);
            const endDateStr = this.formatDate(end);
            
            this.state.dateRange = { 
                start, 
                end,
                startStr: startDateStr,
                endStr: endDateStr
            };
            this.updateDateDisplay();
        }
        
    } catch (error) {
        console.error('❌ Error fetching available date range:', error);
        console.error('❌ Error stack:', error.stack);
        
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        // Create date strings directly to avoid any timezone issues
        const startDateStr = this.formatDate(start);
        const endDateStr = this.formatDate(end);
        
        console.log('🔍 Using fallback date range:', { startDateStr, endDateStr });
        
        this.state.dateRange = { 
            start, 
            end,
            startStr: startDateStr,
            endStr: endDateStr
        };
        this.updateDateDisplay();
    }
}

setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', this.debounce(this.handleSearch.bind(this), 300));
    }
    
    const exportExcel = document.getElementById('exportExcel');
    const exportCSV = document.getElementById('exportCSV');
    if (exportExcel) exportExcel.addEventListener('click', () => this.exportData('excel'));
    if (exportCSV) exportCSV.addEventListener('click', () => this.exportData('csv'));
    
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    if (prevPage) prevPage.addEventListener('click', () => this.goToPage(this.state.currentPage - 1));
    if (nextPage) nextPage.addEventListener('click', () => this.goToPage(this.state.currentPage + 1));
    
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', (e) => this.handleSort(e.currentTarget.dataset.sort));
    });
    
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    if (mobileMenuBtn && sidebar) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 992) {
            if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Preset dropdown wiring
    const presetToggle = document.getElementById('presetToggle');
    const presetDropdown = document.getElementById('presetDropdown');
    if (presetToggle && presetDropdown) {
        presetToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            presetDropdown.style.display = presetDropdown.style.display === 'block' ? 'none' : 'block';
        });
        presetDropdown.addEventListener('click', async (e) => {
            e.stopPropagation();
            const btn = e.target.closest('button[data-preset]');
            if (!btn) return;
            const key = btn.getAttribute('data-preset');
            await this.applyPreset(key);
            presetDropdown.style.display = 'none';
            presetToggle.textContent = btn.textContent.trim() + ' ▾';
        });
        document.addEventListener('click', () => { presetDropdown.style.display = 'none'; });
    }
}

async loadData() {
    try {
        const url = this.state.dateRange.startStr && this.state.dateRange.endStr 
            ? `http://localhost:5000/api/business-data?start=${this.state.dateRange.startStr}&end=${this.state.dateRange.endStr}`
            : 'http://localhost:5000/api/business-data';
        
        console.log('🔍 Loading business data from URL:', url);
        console.log('🔍 Date range state:', this.state.dateRange);
        
        const response = await fetch(url);
        console.log('🔍 Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            console.error('❌ Response not OK:', response.status, response.statusText);
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('🔍 Raw API response:', data);
        console.log('🔍 Data array length:', data.data ? data.data.length : 'No data array');
        console.log('🔍 KPIs:', data.kpis);
        
        this.state.businessData = this.transformData(data.data || []);
        this.state.filteredData = [...this.state.businessData];
        
        console.log('🔍 Transformed business data:', this.state.businessData);
        console.log('🔍 Filtered data length:', this.state.filteredData.length);
        
        this.updateKPIs(data.kpis || {});
        // Also compute trend vs previous equal-length period
        await this.updateKPITrends(data.kpis || {});
        this.renderTable();
        this.updateResultsCount();
        
        console.log('✅ Data loading completed successfully');
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        console.error('❌ Error stack:', error.stack);
        this.showError(`Failed to load data: ${error.message}`);
    }
}

// ---------- Preset ranges ----------
async applyPreset(key) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);

    const startOfWeek = (d) => {
        const dt = new Date(d);
        const dow = dt.getDay();
        const sub = dow === 0 ? 6 : dow - 1; // Monday start
        dt.setDate(dt.getDate() - sub);
        dt.setHours(0,0,0,0);
        return dt;
    };
    const endOfWeek = (d) => { const s = startOfWeek(d); const e = new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return e; };

    let start = startOfToday;
    let end = endOfToday;
    switch (key) {
        case 'today':
            break;
        case 'yesterday':
            start = new Date(startOfToday); start.setDate(start.getDate()-1);
            end = new Date(start); end.setHours(23,59,59,999);
            break;
        case 'last7':
            start = new Date(endOfToday); start.setDate(start.getDate()-6); start.setHours(0,0,0,0);
            end = endOfToday;
            break;
        case 'thisWeek':
            start = startOfWeek(now); end = endOfWeek(now); break;
        case 'lastWeek':
            start = startOfWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate()-7));
            end = endOfWeek(new Date(start));
            break;
        case 'last30':
            start = new Date(endOfToday); start.setDate(start.getDate()-29); start.setHours(0,0,0,0);
            end = endOfToday;
            break;
        case 'thisMonth':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999);
            break;
        case 'lastMonth':
            start = new Date(now.getFullYear(), now.getMonth()-1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59,999);
            break;
        case 'ytd':
            start = new Date(now.getFullYear(), 0, 1);
            end = endOfToday;
            break;
        case 'lifetime':
            start = this.availableDateRange?.minDate ? new Date(this.availableDateRange.minDate) : new Date(now.getFullYear()-1, now.getMonth(), now.getDate());
            start.setHours(0,0,0,0);
            end = endOfToday;
            break;
        default:
            break;
    }

    this.state.dateRange = {
        start,
        end,
        startStr: this.formatDate(start),
        endStr: this.formatDate(end)
    };
    this.updateDateDisplay();
    await this.loadData();
}

async updateKPITrends(currentKpis) {
    if (!this.state?.dateRange?.startStr || !this.state?.dateRange?.endStr) return;
    const prev = this.computePreviousRange(this.state.dateRange.startStr, this.state.dateRange.endStr);
    if (!prev) return;
    try {
        const prevUrl = `http://localhost:5000/api/business-data?start=${prev.startStr}&end=${prev.endStr}`;
        const res = await fetch(prevUrl);
        if (!res.ok) return;
        const prevData = await res.json();
        this.applyTrends(currentKpis, prevData.kpis || {});
    } catch (_) {}
}

computePreviousRange(startStr, endStr) {
    try {
        const parse = (s) => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
        const start = parse(startStr);
        const end = parse(endStr);
        if (isNaN(start) || isNaN(end)) return null;
        const ms = end.getTime() - start.getTime() + 24*60*60*1000; // inclusive
        const prevEnd = new Date(start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - (ms - 1));
        return { startStr: this.formatDate(prevStart), endStr: this.formatDate(prevEnd) };
    } catch { return null; }
}

applyTrends(current, previous) {
    const defs = [
        ['totalSessions', 'totalSessions'],
        ['pageViews', 'totalPageViews'],
        ['unitsOrdered', 'totalUnitsOrdered'],
        ['totalSales', 'totalSales'],
        ['avgSessionsPerDay', 'avgSessionsPerDay'],
        ['conversionRate', 'conversionRate']
    ];
    defs.forEach(([id, key]) => {
        const curr = Number(current?.[key] || 0);
        const prev = Number(previous?.[key] || 0);
        const pct = this.percentChange(curr, prev);
        this.setTrendOnCard(id, pct);
    });
}

percentChange(curr, prev) {
    if (!isFinite(prev) || prev === 0) {
        return curr ? 100 : 0;
    }
    return ((curr - prev) / Math.abs(prev)) * 100;
}

setTrendOnCard(valueId, changePct) {
    const valueEl = document.getElementById(valueId);
    if (!valueEl) return;
    const card = valueEl.closest('.metric-card');
    if (!card) return;
    const trendEl = card.querySelector('.metric-trend');
    if (!trendEl) return;
    const icon = trendEl.querySelector('.material-icons');
    const text = trendEl.querySelector('span:last-child');
    const abs = Math.abs(changePct);
    if (Math.abs(changePct) < 0.001) {
        if (icon) icon.textContent = 'remove';
        trendEl.classList.remove('positive','negative');
        if (text) text.textContent = '—';
        return;
    }
    if (changePct >= 0) {
        trendEl.classList.add('positive');
        trendEl.classList.remove('negative');
        if (icon) icon.textContent = 'trending_up';
    } else {
        trendEl.classList.add('negative');
        trendEl.classList.remove('positive');
        if (icon) icon.textContent = 'trending_down';
    }
    if (text) text.textContent = `${abs.toFixed(1)}%`;
}

transformData(data) {
    return data.map(row => {
        let localDateStr = 'Unknown';
        try {
            if (row.date) {
                const dt = new Date(row.date);
                if (!isNaN(dt.getTime())) {
                    // Convert to local calendar date string (YYYY-MM-DD)
                    localDateStr = this.formatDate(dt);
                } else if (typeof row.date === 'string' && /\d{4}-\d{2}-\d{2}/.test(row.date)) {
                    localDateStr = row.date;
                }
            }
        } catch (_) {}
        
        // Use the SKU as the product name (as shown in your screenshot)
        const productName = row.sku || 'Unknown';
        
        return {
            date: localDateStr,
            sku: productName, // SKU column shows the product name
            parentAsin: row.parent_asin || 'Unknown',
            productTitle: `Product ${productName}`, // Product Title shows "Product [SKU]"
            sessions: parseInt(row.sessions || 0),
            pageViews: parseInt(row.page_views || 0),
            unitsOrdered: parseInt(row.units_ordered || 0),
            sales: parseFloat(row.ordered_product_sales || 0),
            conversionRate: row.sessions > 0 ? (row.units_ordered / row.sessions * 100) : 0,
            avgOrderValue: row.units_ordered > 0 ? (row.ordered_product_sales / row.units_ordered) : 0
        };
    });
}

updateKPIs(kpis) {
    const elements = {
        'totalSessions': kpis.totalSessions || 0,
        'pageViews': kpis.totalPageViews || 0,
        'unitsOrdered': kpis.totalUnitsOrdered || 0,
        'totalSales': kpis.totalSales || 0,
        'avgSessionsPerDay': kpis.avgSessionsPerDay || 0,
        'conversionRate': kpis.conversionRate || 0
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'totalSales') {
                element.textContent = this.formatCurrency(value);
            } else if (id === 'conversionRate') {
                element.textContent = this.formatPercent(value);
            } else if (id === 'avgSessionsPerDay') {
                element.textContent = this.formatNumber(value, 1);
            } else {
                element.textContent = this.formatNumber(value);
            }
        }
    });
}

handleSearch(e) {
    this.state.searchTerm = e.target.value.toLowerCase();
    this.state.currentPage = 1;
    this.filterData();
}

filterData() {
    if (!this.state.searchTerm) {
        this.state.filteredData = [...this.state.businessData];
    } else {
        this.state.filteredData = this.state.businessData.filter(row => 
            row.sku.toLowerCase().includes(this.state.searchTerm) ||
            row.parentAsin.toLowerCase().includes(this.state.searchTerm) ||
            row.productTitle.toLowerCase().includes(this.state.searchTerm)
        );
    }
    this.renderTable();
    this.updateResultsCount();
}

handleSort(column) {
    if (this.state.sortColumn === column) {
        this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        this.state.sortColumn = column;
        this.state.sortDirection = 'desc'; // Default to descending order for better data analysis
    }
    
    this.sortData();
    this.renderTable();
    this.updateSortIcons();
}

sortData() {
    if (!this.state.sortColumn) return;
    
    this.state.filteredData.sort((a, b) => {
        let aVal = a[this.state.sortColumn];
        let bVal = b[this.state.sortColumn];
        
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (this.state.sortDirection === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });
}

updateSortIcons() {
    document.querySelectorAll('.sortable').forEach(header => {
        const icon = header.querySelector('.material-icons');
        if (icon) {
            if (header.dataset.sort === this.state.sortColumn) {
                icon.textContent = this.state.sortDirection === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
                icon.style.opacity = '1';
            } else {
                icon.textContent = 'keyboard_arrow_down'; // Default to down arrow since we default to desc
                icon.style.opacity = '0.5';
            }
        }
    });
}

renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
    const endIndex = startIndex + this.state.itemsPerPage;
    const pageData = this.state.filteredData.slice(startIndex, endIndex);
    
    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <div style="text-align: center; padding: 2rem;">
                        <span class="material-icons" style="font-size: 48px; color: var(--text-secondary);">inbox</span>
                        <h3>No data found</h3>
                        <p>Try adjusting your search criteria</p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = pageData.map(row => `
            <tr>
                <td>${this.escapeHtml(row.sku)}</td>
                <td>${this.escapeHtml(row.parentAsin)}</td>
                <td>${this.escapeHtml(row.productTitle)}</td>
                <td>${this.formatNumber(row.sessions)}</td>
                <td>${this.formatNumber(row.pageViews)}</td>
                <td>${this.formatNumber(row.unitsOrdered)}</td>
                <td>${this.formatCurrency(row.sales)}</td>
                <td>${this.formatPercent(row.conversionRate)}</td>
                <td>${this.formatCurrency(row.avgOrderValue)}</td>
            </tr>
        `).join('');
    }
    
    this.updatePagination();
}

updatePagination() {
    const totalPages = Math.ceil(this.state.filteredData.length / this.state.itemsPerPage);
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');
    const prevPageEl = document.getElementById('prevPage');
    const nextPageEl = document.getElementById('nextPage');
    
    if (currentPageEl) currentPageEl.textContent = this.state.currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    if (prevPageEl) prevPageEl.disabled = this.state.currentPage === 1;
    if (nextPageEl) nextPageEl.disabled = this.state.currentPage === totalPages;
}

goToPage(page) {
    const totalPages = Math.ceil(this.state.filteredData.length / this.state.itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    this.state.currentPage = page;
    this.renderTable();
    this.updateResultsCount();
}

updateResultsCount() {
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
        const total = this.state.filteredData.length;
        const start = (this.state.currentPage - 1) * this.state.itemsPerPage + 1;
        const end = Math.min(this.state.currentPage * this.state.itemsPerPage, total);
        
        if (total === 0) {
            resultsCount.textContent = 'No results found';
        } else {
            resultsCount.textContent = `Showing ${start} to ${end} of ${total} entries`;
        }
    }
}

async exportData(format) {
    try {
        // Show loading notification
        this.showNotification('Preparing export...', 'info');
        
        // Fetch fresh data for the selected date range
        const url = this.state.dateRange.startStr && this.state.dateRange.endStr 
            ? `http://localhost:5000/api/business-data?start=${this.state.dateRange.startStr}&end=${this.state.dateRange.endStr}`
            : 'http://localhost:5000/api/business-data';
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        const exportData = this.transformData(data.data || []);
        
        if (exportData.length === 0) {
            this.showNotification('No data available for export', 'warning');
            return;
        }
        
        const headers = ['Date', 'SKU', 'Parent ASIN', 'Product Title', 'Sessions', 'Page Views', 'Units Ordered', 'Sales (₹)', 'Conversion Rate (%)', 'Avg Order Value (₹)'];
        
        let csv = headers.join(',') + '\n';
        
        exportData.forEach(row => {
            // Use the actual date from the database row, not the date range
            const actualDate = row.date || this.state.dateRange.startStr;
            csv += [
                `"${actualDate}"`,
                `"${row.sku}"`,
                `"${row.parentAsin}"`,
                `"${row.productTitle}"`,
                row.sessions,
                row.pageViews,
                row.unitsOrdered,
                row.sales.toFixed(2),
                row.conversionRate.toFixed(2),
                row.avgOrderValue.toFixed(2)
            ].join(',') + '\n';
        });
        
        // Generate filename with date range
        const startDate = this.state.dateRange.startStr;
        const endDate = this.state.dateRange.endStr;
        const filename = `business-report-${startDate}-to-${endDate}.csv`;
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url2 = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url2);
        
        this.showNotification(`Export successful! (${exportData.length} records)`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        this.showNotification('Export failed. Please try again.', 'error');
    }
}

initializeDatePicker() {
    const dateFilter = document.getElementById('dateFilter');
    const datePickerDropdown = document.getElementById('datePickerDropdown');
    
    if (dateFilter && datePickerDropdown) {
        dateFilter.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCalendar();
        });
        
        document.addEventListener('click', (e) => {
            if (!dateFilter.contains(e.target) && !datePickerDropdown.contains(e.target)) {
                this.closeCalendar();
            }
        });
    }
}

toggleCalendar() {
    const dropdown = document.getElementById('datePickerDropdown');
    
    if (dropdown.style.display === 'block') {
        this.closeCalendar();
    } else {
        this.openCalendar();
    }
}

openCalendar() {
    const dropdown = document.getElementById('datePickerDropdown');
    const dateFilter = document.getElementById('dateFilter');
    
    if (dropdown) {
        dropdown.style.display = 'block';
    }
    
    if (dateFilter) {
        dateFilter.classList.add('open');
    }
    
    if (this.state.dateRange.start && this.state.dateRange.end) {
        this.calendarState.tempRangeStart = new Date(this.state.dateRange.start);
        this.calendarState.tempRangeEnd = new Date(this.state.dateRange.end);
    } else {
        const now = new Date();
        this.calendarState.tempRangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
        this.calendarState.tempRangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    
    this.calendarState.calendarMonth = new Date(this.calendarState.tempRangeEnd);
    this.calendarState.calendarMonth.setDate(1);
    
    this.renderCalendar();
}

closeCalendar() {
    const dropdown = document.getElementById('datePickerDropdown');
    const dateFilter = document.getElementById('dateFilter');
    
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    
    if (dateFilter) {
        dateFilter.classList.remove('open');
    }
}

renderCalendar() {
    const container = document.getElementById('datePickerDropdown');
    if (!container) return;
    
    container.innerHTML = '';
    
    const calendarDiv = document.createElement('div');
    calendarDiv.className = 'range-calendar';
    
    const header = this.createCalendarHeader();
    calendarDiv.appendChild(header);
    
    const weekdays = this.createCalendarWeekdays();
    calendarDiv.appendChild(weekdays);
    
    const grid = document.createElement('div');
    grid.className = 'range-calendar-grid';
    grid.id = 'calendarGrid';
    calendarDiv.appendChild(grid);
    
    const footer = this.createCalendarFooter();
    calendarDiv.appendChild(footer);
    
    container.appendChild(calendarDiv);
    
    this.renderCalendarDays();
}

createCalendarHeader() {
    const header = document.createElement('div');
    header.className = 'range-calendar-header';
    
    const prevNav = document.createElement('div');
    prevNav.className = 'range-calendar-nav';
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'range-calendar-btn';
    prevBtn.type = 'button';
    prevBtn.innerHTML = '&#8592;';
    
    prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.navigateMonth(-1);
    });
    
    prevNav.appendChild(prevBtn);
    
    const monthDisplay = document.createElement('div');
    monthDisplay.className = 'range-calendar-month';
    monthDisplay.textContent = this.calendarState.calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const nextNav = document.createElement('div');
    nextNav.className = 'range-calendar-nav';
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'range-calendar-btn';
    nextBtn.type = 'button';
    nextBtn.innerHTML = '&#8594;';
    
    nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.navigateMonth(1);
    });
    
    const todayBtn = document.createElement('button');
    todayBtn.className = 'button';
    todayBtn.type = 'button';
    todayBtn.title = 'Go to current month';
    todayBtn.textContent = 'Today';
    
    todayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.goToToday();
    });
    
    nextNav.appendChild(nextBtn);
    nextNav.appendChild(todayBtn);
    
    header.appendChild(prevNav);
    header.appendChild(monthDisplay);
    header.appendChild(nextNav);
    
    return header;
}

createCalendarWeekdays() {
    const weekdays = document.createElement('div');
    weekdays.className = 'range-calendar-weekdays';
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach(day => {
        const dayElement = document.createElement('div');
        dayElement.className = 'range-calendar-weekday';
        dayElement.textContent = day;
        weekdays.appendChild(dayElement);
    });
    
    return weekdays;
}

createCalendarFooter() {
    const footer = document.createElement('div');
    footer.className = 'range-calendar-footer';
    
    const summary = document.createElement('div');
    summary.className = 'range-calendar-summary';
    summary.id = 'calendarSummary';
    summary.textContent = 'Select a date range';
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'range-calendar-confirm';
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'Confirm';
    
    confirmBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.confirmDateRange();
    });
    
    footer.appendChild(summary);
    footer.appendChild(confirmBtn);
    
    return footer;
}

renderCalendarDays() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    
    const firstDay = new Date(this.calendarState.calendarMonth);
    const lastDay = new Date(this.calendarState.calendarMonth.getFullYear(), this.calendarState.calendarMonth.getMonth() + 1, 0);
    const jsDay = firstDay.getDay();
    const startOffset = jsDay === 0 ? 6 : jsDay - 1;
    
    for (let i = 0; i < startOffset; i++) {
        const emptyCell = document.createElement('div');
        grid.appendChild(emptyCell);
    }
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const date = new Date(this.calendarState.calendarMonth.getFullYear(), this.calendarState.calendarMonth.getMonth(), d);
        const isSelected = this.isDateInRange(date);
        const isToday = this.isToday(date);
        
        let classes = 'range-calendar-day';
        if (isSelected) {
            if (this.calendarState.tempRangeStart && this.calendarState.tempRangeEnd) {
                const start = new Date(this.calendarState.tempRangeStart);
                const end = new Date(this.calendarState.tempRangeEnd);
                start.setHours(0,0,0,0);
                end.setHours(0,0,0,0);
                date.setHours(0,0,0,0);
                
                if (date.getTime() === start.getTime()) {
                    classes += ' start';
                } else if (date.getTime() === end.getTime()) {
                    classes += ' end';
                } else if (date > start && date < end) {
                    classes += ' in-range';
                }
            } else if (this.calendarState.tempRangeStart) {
                const start = new Date(this.calendarState.tempRangeStart);
                start.setHours(0,0,0,0);
                date.setHours(0,0,0,0);
                if (date.getTime() === start.getTime()) {
                    classes += ' start end';
                }
            }
        }
        if (isToday) classes += ' today';
        
        if (this.availableDates && this.availableDates.length > 0) {
            const dateStr = this.formatDate(date);
            const hasBusinessData = this.availableDates.some(availableDate => 
                this.formatDate(availableDate) === dateStr
            );
            
            if (!hasBusinessData) {
                classes += ' disabled';
            }
        } else if (this.availableDateRange) {
            if (date < this.availableDateRange.min || date > this.availableDateRange.max) {
                classes += ' disabled';
            }
        } else {
            if (date > new Date()) classes += ' disabled';
        }
        
        const dayElement = document.createElement('div');
        dayElement.className = classes;
        dayElement.dataset.date = this.formatDate(date);
        dayElement.textContent = d;
        
        const dateStr = this.formatDate(date);
        const isDisabled = classes.includes('disabled');
        
        dayElement.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isDisabled) return;
            
            if (this.availableDates && this.availableDates.length > 0) {
                const hasBusinessData = this.availableDates.some(availableDate => 
                    this.formatDate(availableDate) === dateStr
                );
                
                if (!hasBusinessData) return;
            } else if (this.availableDateRange) {
                // Parse date string directly to avoid timezone issues
                const [year, month, day] = dateStr.split('-').map(Number);
                const clickedDate = new Date(year, month - 1, day);
                if (clickedDate < this.availableDateRange.min || clickedDate > this.availableDateRange.max) {
                    return;
                }
            }
            
            this.handleCalendarDayClick(dateStr);
        });

        // Hover preview: show range from start to hovered date
        dayElement.addEventListener('mouseenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isDisabled) return;
            this.handleCalendarHover(dateStr);
        });
        
        dayElement.style.cursor = 'pointer';
        
        let tooltip = `Click to select: ${dateStr}`;
        if (this.availableDates && this.availableDates.length > 0) {
            const hasBusinessData = this.availableDates.some(availableDate => 
                this.formatDate(availableDate) === dateStr
            );
            
            if (hasBusinessData) {
                tooltip += ' (Has business data)';
            } else {
                tooltip += ' (No business data)';
            }
        } else if (this.availableDateRange) {
            // Parse date string directly to avoid timezone issues
            const [year, month, day] = dateStr.split('-').map(Number);
            const clickedDate = new Date(year, month - 1, day);
            if (clickedDate >= this.availableDateRange.min && clickedDate <= this.availableDateRange.max) {
                tooltip += ' (Has data)';
            } else {
                tooltip += ' (No data)';
            }
        }
        dayElement.title = tooltip;
        
        grid.appendChild(dayElement);
    }
}

handleCalendarHover(dateStr) {
    // Only when a start is chosen and end not yet set
    if (!this.calendarState.tempRangeStart || this.calendarState.tempRangeEnd) return;
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    // Clear previous preview classes
    grid.querySelectorAll('.preview-in-range, .preview-end').forEach(el => {
        el.classList.remove('preview-in-range', 'preview-end');
    });

    // Normalize dates to midnight local
    const ds = new Date(this.calendarState.tempRangeStart);
    ds.setHours(0,0,0,0);
    const parts = dateStr.split('-').map(Number);
    const de = new Date(parts[0], parts[1] - 1, parts[2]);
    de.setHours(0,0,0,0);

    const invert = de < ds;
    const from = invert ? de : ds;
    const to = invert ? ds : de;

    grid.querySelectorAll('.range-calendar-day').forEach(cell => {
        const dAttr = cell.getAttribute('data-date');
        if (!dAttr) return;
        const [y,m,d] = dAttr.split('-').map(Number);
        const cd = new Date(y, m - 1, d);
        cd.setHours(0,0,0,0);
        if (cd > from && cd < to) cell.classList.add('preview-in-range');
        if (cd.getTime() === to.getTime()) cell.classList.add('preview-end');
    });

    // Optionally update the summary to reflect hovered range
    const summary = document.getElementById('calendarSummary');
    if (summary) {
        const s = this.calendarState.tempRangeStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const e = de.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        summary.textContent = `${s} - ${e}`;
    }
}

navigateMonth(direction) {
    const newMonth = new Date(this.calendarState.calendarMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    
    this.calendarState.calendarMonth = newMonth;
    
    this.renderCalendar();
}

goToToday() {
    console.log('🔄 Going to today...');
    const today = new Date();
    const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    console.log('📅 Current month was:', this.calendarState.calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    console.log('📅 Setting calendar to today\'s month:', todayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    
    this.calendarState.calendarMonth = todayMonth;
    this.renderCalendar();
}


handleCalendarDayClick(dateString) {
    try {
        console.log('🔍 Calendar day clicked:', dateString);
        
        // Parse date string directly to avoid timezone issues
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day, 0, 0, 0, 0);
        
        console.log('🔍 Parsed date:', {
            dateString,
            year, month, day,
            date: date.toISOString(),
            dateLocal: date.toLocaleDateString()
        });
        
        if (isNaN(date.getTime())) {
            console.error('❌ Invalid date created from:', dateString);
            return;
        }
        
        console.log('🔍 Current temp range state:', {
            tempRangeStart: this.calendarState.tempRangeStart?.toISOString(),
            tempRangeEnd: this.calendarState.tempRangeEnd?.toISOString()
        });
        
        if (!this.calendarState.tempRangeStart || (this.calendarState.tempRangeStart && this.calendarState.tempRangeEnd)) {
            console.log('🔍 Setting new start date');
            this.calendarState.tempRangeStart = new Date(date);
            this.calendarState.tempRangeEnd = null;
        } else {
            const start = new Date(this.calendarState.tempRangeStart);
            start.setHours(0, 0, 0, 0);
            
            console.log('🔍 Comparing dates:', {
                clickedDate: date.toISOString(),
                startDate: start.toISOString(),
                isClickedBeforeStart: date < start
            });
            
            if (date < start) {
                console.log('🔍 Clicked date is before start, swapping');
                this.calendarState.tempRangeEnd = start;
                this.calendarState.tempRangeStart = new Date(date);
            } else {
                console.log('🔍 Clicked date is after start, setting as end');
                this.calendarState.tempRangeEnd = new Date(date);
            }
        }
        
        console.log('🔍 Updated temp range state:', {
            tempRangeStart: this.calendarState.tempRangeStart?.toISOString(),
            tempRangeEnd: this.calendarState.tempRangeEnd?.toISOString()
        });
        
        this.renderCalendar();
        this.updateCalendarSummary();
        
    } catch (error) {
        console.error('❌ Error handling calendar day click:', error);
    }
}

isDateInRange(date) {
    if (!this.calendarState.tempRangeStart) return false;
    
    const start = new Date(this.calendarState.tempRangeStart);
    const end = this.calendarState.tempRangeEnd ? new Date(this.calendarState.tempRangeEnd) : start;
    
    const checkDate = new Date(date);
    checkDate.setHours(0,0,0,0);
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    
    return checkDate >= start && checkDate <= end;
}

isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

updateCalendarSummary() {
    const summary = document.getElementById('calendarSummary');
    if (!summary) return;
    
    if (this.calendarState.tempRangeStart && this.calendarState.tempRangeEnd) {
        const startStr = this.calendarState.tempRangeStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = this.calendarState.tempRangeEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        summary.textContent = `${startStr} - ${endStr}`;
    } else if (this.calendarState.tempRangeStart) {
        const startStr = this.calendarState.tempRangeStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        summary.textContent = `${startStr} - ...`;
    } else {
        summary.textContent = 'Select a date range';
    }
}

async confirmDateRange() {
    if (!this.calendarState.tempRangeStart) {
        console.warn('⚠️ No temp range start date - cannot confirm');
        return;
    }
    
    // Hide calendar immediately when confirm is clicked
    this.closeCalendar();
    
    console.log('🔄 Confirming date range...');
    console.log('📅 Temp range before confirmation:', {
        tempStart: this.calendarState.tempRangeStart?.toISOString(),
        tempEnd: this.calendarState.tempRangeEnd?.toISOString(),
        tempStartLocal: this.calendarState.tempRangeStart?.toLocaleDateString(),
        tempEndLocal: this.calendarState.tempRangeEnd?.toLocaleDateString()
    });
    
    // Create dates without timezone issues by using local date components
    const startYear = this.calendarState.tempRangeStart.getFullYear();
    const startMonth = this.calendarState.tempRangeStart.getMonth();
    const startDay = this.calendarState.tempRangeStart.getDate();
    
    const endYear = (this.calendarState.tempRangeEnd || this.calendarState.tempRangeStart).getFullYear();
    const endMonth = (this.calendarState.tempRangeEnd || this.calendarState.tempRangeStart).getMonth();
    const endDay = (this.calendarState.tempRangeEnd || this.calendarState.tempRangeStart).getDate();
    
    console.log('📅 Date components extracted:', {
        start: { year: startYear, month: startMonth, day: startDay },
        end: { year: endYear, month: endMonth, day: endDay }
    });
    
    // Create date strings FIRST directly from calendar values to avoid timezone conversion
    const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    
    console.log('📅 Date strings created directly from calendar values:', { 
        startDateStr: startDateStr,
        endDateStr: endDateStr
    });
    
    // Create Date objects using local timezone to avoid UTC conversion
    const start = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
    const end = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);
    
    console.log('📅 Date objects created:', {
        start: start.toISOString(),
        end: end.toISOString(),
        startLocal: start.toLocaleDateString(),
        endLocal: end.toLocaleDateString()
    });
    
    this.state.dateRange = { 
        start, 
        end,
        startStr: startDateStr,
        endStr: endDateStr
    };
    
    console.log('📅 Final state verification:', {
        startStr: this.state.dateRange.startStr,
        endStr: this.state.dateRange.endStr,
        startISO: this.state.dateRange.start.toISOString(),
        endISO: this.state.dateRange.end.toISOString()
    });
    
    console.log('🔄 State updated:', this.state.dateRange);
    console.log('🔄 Updating date display...');
    this.updateDateDisplay();
    
    console.log('🔄 Loading data with new date range...');
    await this.loadData();
    
    console.log('✅ Date range confirmation complete');
}

updateDateDisplay() {
    const display = document.getElementById('dateRangeDisplay');
    
    if (!display) return;
    
    if (!this.state.dateRange.startStr || !this.state.dateRange.endStr) {
        display.textContent = '—';
        return;
    }
    
    // Parse date strings directly to avoid timezone conversion issues
    const parseDateString = (dateStr) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };
    
    const startDate = parseDateString(this.state.dateRange.startStr);
    const endDate = parseDateString(this.state.dateRange.endStr);
    
    const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    display.textContent = `${startStr} - ${endStr}`;
}

formatNumber(value, decimals = 0) {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

formatCurrency(value) {
    if (value === null || value === undefined) return '—';
    return '₹' + this.formatNumber(value, 2);
}

formatPercent(value) {
    if (value === null || value === undefined) return '—';
    return value.toFixed(2) + '%';
}

formatDate(date) {
    // Use local date components to avoid timezone issues
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

showError(message) {
    console.error(message);
    alert(message);
}

showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="material-icons">${this.getNotificationIcon(type)}</span>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <span class="material-icons">close</span>
        </button>
    `;
    
    // Add notification styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: 8px;
        padding: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        z-index: 1002;
        min-width: 300px;
        box-shadow: var(--shadow-lg);
        animation: slideInRight 0.3s ease-out;
    `;
    
    // Type-specific styling
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#007bff'
    };
    
    notification.style.borderLeftColor = colors[type] || colors.info;
    notification.style.borderLeftWidth = '4px';
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

getNotificationIcon(type) {
    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };
    return icons[type] || icons.info;
}

startAutoRefresh() {
    setInterval(() => {
        this.loadData();
    }, 5 * 60 * 1000);
}

// debug function removed
}

document.addEventListener('DOMContentLoaded', () => {
new BusinessReportsDashboard();
});