// Enable debug logging for troubleshooting
(function() {
    const ENABLE_DEBUG = false; // Disable debug logging in production
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
        itemsPerPage: 23,
        sortColumn: '',
        sortDirection: 'desc',
        searchTerm: '',
        dateRange: this.getDefaultDateRange()
    };
    
    this.calendarState = {
        tempRangeStart: null,
        tempRangeEnd: null,
        calendarMonth: new Date()
    };
    
    this.availableDateRange = null;
    this.availableDates = [];
    
    // Chart properties
    this.chart = null;
    this.chartData = [];
    this.chartAllData = null; // lifetime data cache for Monthly view
    this.loadingAllChartData = false;
    
    // Selected metrics for chart (persist across period changes)
    this.selectedMetrics = ['sessions', 'pageViews', 'unitsOrdered', 'sales'];
    // Comment out ASIN filtering to see all data from database
    // this.allowedAsins = new Set([
    //     'B0DNKGMNTP', // Trumps: Periodic Table
    //     'B0CL3DGFPX', // Trumps: MBharat
    //     'B0BRVSWCQH', // Trumps: Cars
    //     'B0DYF6QYXG', // PTableChartCombo
    //     'B0F25YYQBP', // Mbharat: BooknCards
    //     'B0BY38CLYD', // Combo:KYWCountSolar
    //     'B09LTBF4FX', // 3ComboGeo
    //     'B089M671M6', // Country Trump Cards
    //     'B0BRVRTRB1', // Trumps: Solar
    //     'B0FBXFVZZH', // Trumps-Leaders
    //     'B0FJYJXDYQ', // Trumps-Cities
    //     'B0B52DLYW8', // Trumps: Dinosaurs
    //     'B09XFJM4FT', // Combo: Aqua Predators
    //     'B0DMPMGJFW', // Trumps: MbharatIS
    //     'B09JMZ419K', // Trumps: Predators
    //     'B09J69WBVW', // 2 + 1 Smart Cards Combo
    //     'B0BXPLCVBR', // 3in1CountriesDinoCars
    //     'B089M6YCJJ', // Know Your World Smart Cards
    //     'B09X3FVY1F', // Greatest Women Ever
    //     'B0C8HV88H4', // Trumps: CarsDinos
    //     'B09JMZ6H8P', // Trumps: Indian States
    //     'B09GB671ZH', // B8-VSR8-GXOR
    //     'B0B531LGWQ'  // Trumps:DogsnPuppies
    // ]);

    // Additional friendly name fallbacks for code-like SKUs/ASINs used in sample data
    this.skuCodeToName = new Map([
        ['SKU001','Trumps: Periodic Table'],
        ['SKU002','Trumps: MBharat'],
        ['SKU003','Trumps: Cars'],
        ['SKU004','PTableChartCombo'],
        ['SKU005','Mbharat: BooknCards']
    ]);
    this.parentCodeToName = new Map([
        ['B001','Trumps: Periodic Table'],
        ['B002','Trumps: MBharat'],
        ['B003','Trumps: Cars'],
        ['B004','PTableChartCombo'],
        ['B005','Mbharat: BooknCards']
    ]);
    // Map short internal parent codes to canonical live ASINs so both combine
    this.aliasParentToRealAsin = new Map([
        ['B001','B0DNKGMNTP'],
        ['B002','B0CL3DGFPX'],
        ['B003','B0BRVSWCQH'],
        ['B004','B0DYF6QYXG'],
        ['B005','B0F25YYQBP']
    ]);

    // Map ASIN -> Friendly Product Name for display (replaces codes in the table)
    this.asinToName = new Map([
        ['B0DNKGMNTP','Trumps: Periodic Table'],
        ['B0CL3DGFPX','Trumps: MBharat'],
        ['B0BRVSWCQH','Trumps: Cars'],
        ['B0DYF6QYXG','PTableChartCombo'],
        ['B0F25YYQBP','Mbharat: BooknCards'],
        ['B0BY38CLYD','Combo:KYWCountSolar'],
        ['B09LTBF4FX','3ComboGeo'],
        ['B089M671M6','Country Trump Cards'],
        ['B0BRVRTRB1','Trumps: Solar'],
        ['B0FBXFVZZH','Trumps-Leaders'],
        ['B0FJYJXDYQ','Trumps-Cities'],
        ['B0B52DLYW8','Trumps: Dinosaurs'],
        ['B09XFJM4FT','Combo: Aqua Predators'],
        ['B0DMPMGJFW','Trumps: MbharatIS'],
        ['B09JMZ419K','Trumps: Predators'],
        ['B09J69WBVW','2 + 1 Smart Cards Combo'],
        ['B0BXPLCVBR','3in1CountriesDinoCars'],
        ['B089M6YCJJ','Know Your World Smart Cards'],
        ['B09X3FVY1F','Greatest Women Ever'],
        ['B0C8HV88H4','Trumps: CarsDinos'],
        ['B09JMZ6H8P','Trumps: Indian States'],
        ['B09GB671ZH','B8-VSR8-GXOR'],
        ['B0B531LGWQ','Trumps:DogsnPuppies']
    ]);
    
    this.init();
}

// Lightweight health check to avoid calling APIs while DB is disconnected
async waitForBackendReady(apiBase, maxAttempts = 6, delayMs = 500) {
    try {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Try primary base first
            try {
                const res = await fetch(`${apiBase}/health`);
                if (res.ok) {
                    const j = await res.json();
                    if ((j?.database || '').toLowerCase() === 'connected') return true;
                }
            } catch (_) {}

            // Fallback: explicitly try localhost:5000 if not already
            try {
                const localBase = 'http://localhost:5000';
                if (!apiBase || !apiBase.includes('localhost:5000')) {
                    const res2 = await fetch(`${localBase}/health`);
                    if (res2.ok) {
                        const j2 = await res2.json();
                        if ((j2?.database || '').toLowerCase() === 'connected') return true;
                    }
                }
            } catch (_) {}

            await new Promise(r => setTimeout(r, delayMs));
        }
    } catch (_) {}
    return false;
}

getApiBase() {
    try {
        const host = (typeof location !== 'undefined') ? location.hostname : '';
        const port = (typeof location !== 'undefined') ? location.port : '';
        const protocol = (typeof location !== 'undefined') ? location.protocol : 'http:';
        // Always prefer same-origin backend unless explicitly on localhost:5000
        if (host === 'localhost' && (port === '5000' || port === '')) {
            return '';
        }
        // Use same origin for deployed environments (run.app, vercel, etc.)
        return `${protocol}//${host}${port ? `:${port}` : ''}`;
    } catch (_) {
        return 'http://localhost:5000';
    }
}

getDefaultDateRange() {
    // Default to Jan 1 of the current year through TODAY (skip future)
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const start = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0);
    return {
        start: start,
        end: end,
        startStr: this.formatDate(start),
        endStr: this.formatDate(end)
    };
}

async init() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initializeComponents());
    } else {
        this.initializeComponents();
    }
}

async initializeComponents() {
    console.log('🔍 Initializing business reports components...');
    this.setupEventListeners();
    this.initializeDatePicker();
    this.initializeChart();
    
    // Initialize metric checkboxes to match selected metrics
    this.syncMetricCheckboxes();
    
    // Use default range (last 30 days) for better performance
    // User can select "Lifetime" from the preset dropdown if they want all data
    this.state.dateRange = this.getDefaultDateRange();
    this.updateDateDisplay();
    
    // Skip the problematic date range fetch for now - load data directly
    console.log('🔍 Skipping date range fetch, loading data directly');
    
    // Add a small delay to ensure DOM is fully ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('🔍 Loading data...');
    await this.loadData();
    // Auto-refresh intentionally disabled for consistent snapshots
    console.log('🔍 Business reports initialization completed');
}

// removed debug connectivity probe

async fetchAvailableDateRange() {
    try {
        console.log('🔍 Fetching available date range from API...');
        
        const apiBase = this.getApiBase();
        // Prefer business-specific date bounds
        let businessRange = null;
        try {
            const br = await fetch(`${apiBase}/api/business-date-range`);
            if (br.ok) {
                const j = await br.json();
                if (j && j.hasData && (j.minDate || j.min_date) && (j.maxDate || j.max_date)) {
                    businessRange = {
                        min: new Date(j.minDate || j.min_date),
                        max: new Date(j.maxDate || j.max_date)
                    };
                }
            }
        } catch (_) {}
        
        // Also get a global analytics window as a fallback signal
        const analyticsResponse = await fetch(`${apiBase}/api/analytics`);
        
        if (!analyticsResponse.ok) {
            throw new Error('Failed to fetch analytics date range');
        }
        
        const analyticsData = await analyticsResponse.json();
        console.log('🔍 Analytics date range response:', analyticsData.dataRange);
        
        // Also get business-specific dates for the calendar grid
        const datesResponse = await fetch(`${apiBase}/api/business-available-dates`);
        
        if (!datesResponse.ok) {
            throw new Error('Failed to fetch available dates');
        }
        
        const availableDates = await datesResponse.json();
        console.log('🔍 API available dates response:', availableDates);
        
        if ((businessRange && businessRange.min && businessRange.max) || (analyticsData.dataRange && analyticsData.dataRange.min && analyticsData.dataRange.max && availableDates.hasData)) {
            let maxDate, minDate;
            
            try {
                if (businessRange) {
                    maxDate = new Date(businessRange.max);
                    minDate = new Date(businessRange.min);
                } else {
                    maxDate = new Date(analyticsData.dataRange.max);
                    minDate = new Date(analyticsData.dataRange.min);
                }
                
                if (isNaN(maxDate.getTime()) || isNaN(minDate.getTime())) {
                    throw new Error('Invalid date after parsing');
                }
                
            } catch (parseError) {
                console.log('🔍 Using fallback dates due to parse error');
                // If we can't parse the dates from API, use a reasonable fallback
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 29);
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                
                this.state.dateRange = {
                    start: start,
                    end: end,
                    startStr: this.formatDate(start),
                    endStr: this.formatDate(end)
                };
                
                this.updateDateDisplay();
                return;
            }
            
            if (!maxDate || !minDate || isNaN(maxDate.getTime()) || isNaN(minDate.getTime())) {
                throw new Error('Invalid dates after parsing');
            }
            
            // Use the FULL date range from the database, not just 30 days
            const start = new Date(minDate);
            const end = new Date(maxDate);
            
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
            
            console.log('🔍 Set date range from API:', this.state.dateRange);
            
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
                // Use default date range as fallback
                console.log('🔍 Using fallback date range');
                this.state.dateRange = this.getDefaultDateRange();
                this.updateDateDisplay();
            }
            
        } else {
            // Use default date range as fallback
            console.log('🔍 No data from API, using fallback date range');
            this.state.dateRange = this.getDefaultDateRange();
            this.updateDateDisplay();
        }
        
    } catch (error) {
        // Use default date range as fallback
        console.log('🔍 Error fetching date range, using fallback:', error.message);
        this.state.dateRange = this.getDefaultDateRange();
        this.updateDateDisplay();
    }
}

setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', this.debounce(this.handleSearch.bind(this), 300));
    }
    
    const exportExcelComplete = document.getElementById('exportExcelComplete');
    const exportCSVComplete = document.getElementById('exportCSVComplete');
    
    if (exportExcelComplete) exportExcelComplete.addEventListener('click', () => this.exportData('excel', true));
    if (exportCSVComplete) exportCSVComplete.addEventListener('click', () => this.exportData('csv', true));
    
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
    
    // Chart period selector
    const chartPeriod = document.getElementById('chartPeriod');
    if (chartPeriod) {
        chartPeriod.addEventListener('change', (e) => {
            this.updateChart(e.target.value);
        });
    }
    
    // Metric selector functionality
    const metricToggle = document.getElementById('metricToggle');
    const metricDropdown = document.getElementById('metricDropdown');
    
    if (metricToggle && metricDropdown) {
        metricToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = metricDropdown.style.display === 'block';
            metricDropdown.style.display = isOpen ? 'none' : 'block';
        });

        // Handle metric checkbox changes
        document.querySelectorAll('#metricDropdown input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const metric = e.target.id.replace('metric-', '');
                if (e.target.checked) {
                    if (!this.selectedMetrics.includes(metric)) {
                        this.selectedMetrics.push(metric);
                    }
                } else {
                    this.selectedMetrics = this.selectedMetrics.filter(m => m !== metric);
                }
                // Update chart with new metric selection
                const currentPeriod = document.getElementById('chartPeriod')?.value || 'daily';
                this.updateChart(currentPeriod);
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!metricDropdown.contains(e.target) && !metricToggle.contains(e.target)) {
                metricDropdown.style.display = 'none';
            }
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
            const isMobile = window.innerWidth <= 768;
            if (presetDropdown.style.display === 'block') {
                presetDropdown.style.display = 'none';
            } else {
                presetDropdown.style.display = 'block';
                // On mobile, position dropdown better
                if (isMobile) {
                    // Add mobile-specific class for better positioning
                    presetDropdown.classList.add('mobile-dropdown');
                    // Position relative to viewport
                    const rect = presetToggle.getBoundingClientRect();
                    presetDropdown.style.top = `${rect.bottom + 8}px`;
                    presetDropdown.style.left = '16px';
                    presetDropdown.style.right = '16px';
                    presetDropdown.style.width = 'auto';
                } else {
                    presetDropdown.classList.remove('mobile-dropdown');
                }
            }
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
        document.addEventListener('click', (e) => { 
            // Don't close if clicking on dropdown or toggle
            if (!presetDropdown.contains(e.target) && !presetToggle.contains(e.target)) {
                presetDropdown.style.display = 'none';
            }
        });
    }
}

async loadData() {
    try {
        const apiBase = this.getApiBase();
        const timestamp = Date.now(); // Cache busting
        // Ensure backend DB is connected before we issue queries
        const ready = await this.waitForBackendReady(apiBase, 4, 400);
        if (!ready) {
            console.warn('⚠️ Health probe failed; proceeding to fetch data anyway');
        }
        // Clamp end to TODAY to avoid requesting future dates
        if (this.state.dateRange?.endStr) {
            const today = new Date();
            const todayStr = this.formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
            if (this.state.dateRange.endStr > todayStr) {
                this.state.dateRange.endStr = todayStr;
                this.state.dateRange.end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
            }
        }
        // Additionally clamp end to the latest available business date from backend (e.g., 16th if 17th has no data)
        try {
            const rangeRes = await fetch(`${apiBase}/api/business-date-range`);
            if (rangeRes.ok) {
                const rangeJson = await rangeRes.json();
                const maxDateStr = rangeJson?.maxDate || rangeJson?.max_date || null;
                if (maxDateStr) {
                    // Parse in local time to avoid UTC -> previous-day drift
                    const maxD = new Date(maxDateStr);
                    const localMaxStr = this.formatDate(maxD);
                    if (!this.state.dateRange?.endStr || this.state.dateRange.endStr > localMaxStr) {
                        this.state.dateRange.endStr = localMaxStr;
                        this.state.dateRange.end = new Date(
                            maxD.getFullYear(), maxD.getMonth(), maxD.getDate(), 23, 59, 59, 999
                        );
                    }
                }
            }
        } catch (_) { /* ignore; fallback to today clamp */ }
        const url = this.state.dateRange.startStr && this.state.dateRange.endStr 
            ? `${apiBase}/api/business-data?start=${this.state.dateRange.startStr}&end=${this.state.dateRange.endStr}&t=${timestamp}`
            : `${apiBase}/api/business-data?t=${timestamp}`;
        
        console.log('🔍 Loading business data...');
        console.log('🔍 Date range:', this.state.dateRange);
        console.log('🔍 API URL:', url);
        console.log('🔍 Start date:', this.state.dateRange.startStr);
        console.log('🔍 End date:', this.state.dateRange.endStr);
        
        let response = await fetch(url);
        // If backend returns 503 (e.g., end date has no data yet), retry once after clamping to DB max date
        if (!response.ok && response.status === 503) {
            try {
                const rangeRes2 = await fetch(`${apiBase}/api/business-date-range`);
                if (rangeRes2.ok) {
                    const rj = await rangeRes2.json();
                    const maxSrc = rj?.maxDate || rj?.max_date || null;
                    if (maxSrc) {
                        const maxD2 = new Date(maxSrc);
                        const maxStr = this.formatDate(maxD2);
                        if (!this.state.dateRange?.endStr || this.state.dateRange.endStr > maxStr) {
                            this.state.dateRange.endStr = maxStr;
                            this.state.dateRange.end = new Date(maxD2.getFullYear(), maxD2.getMonth(), maxD2.getDate(), 23,59,59,999);
                        }
                        const retryUrl = `${apiBase}/api/business-data?start=${this.state.dateRange.startStr}&end=${this.state.dateRange.endStr}&t=${Date.now()}`;
                        console.log('🔁 Retrying after 503 with clamped end date:', retryUrl);
                        response = await fetch(retryUrl);
                    }
                }
            } catch (_) { /* ignore */ }
        }
        
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('🔍 Raw API response:', data);
        console.log('🔍 Data length:', data.data?.length || 0);
        console.log('🔍 KPIs:', data.kpis);
        
        // Handle data display - show data for available dates, skip empty dates
        if (!data.data || data.data.length === 0) {
            console.log('⚠️ No data found for selected date range, trying to get any available data');
            // Try to get data from the backend's available date range
            try {
                // Get the actual available date range from the backend
                const availableDatesResponse = await fetch(`${apiBase}/api/business-available-dates`);
                if (availableDatesResponse.ok) {
                    const availableDates = await availableDatesResponse.json();
                    if (availableDates.dates && availableDates.dates.length > 0) {
                        // Use the most recent available dates
                        const sortedDates = availableDates.dates.sort();
                        const latestDate = sortedDates[sortedDates.length - 1];
                        const earliestDate = sortedDates[0];
                        
                        // Create a range around the latest available data
                        const fallbackEnd = new Date(latestDate);
                        const fallbackStart = new Date(Math.max(
                            new Date(earliestDate).getTime(),
                            new Date(latestDate).getTime() - (29 * 24 * 60 * 60 * 1000) // 30 days before latest
                        ));
                        
                        const fallbackUrl = `${apiBase}/api/business-data?start=${this.formatDate(fallbackStart)}&end=${this.formatDate(fallbackEnd)}&t=${Date.now()}`;
                        console.log('🔍 Trying fallback to available data range:', fallbackUrl);
                        
                        const fallbackResponse = await fetch(fallbackUrl);
                        if (fallbackResponse.ok) {
                            const fallbackData = await fallbackResponse.json();
                            if (fallbackData.data && fallbackData.data.length > 0) {
                                console.log('✅ Found data in available range, using that instead');
                                this.state.businessData = this.transformData(fallbackData.data || []);
                                this.state.filteredData = this.aggregateBySku(this.state.businessData);
                                this.updateKPIs(fallbackData.kpis || {});
                                this.showNotification(`Showing available data from ${this.formatDate(fallbackStart)} to ${this.formatDate(fallbackEnd)} (no data in selected range)`, 'info');
                                this.renderTable();
                                this.updateResultsCount();
                                return;
                            }
                        }
                    }
                }
            } catch (fallbackError) {
                console.log('🔍 Fallback also failed:', fallbackError.message);
            }
            
            this.state.businessData = [];
            this.state.filteredData = [];
            
            // Reset KPIs to zero values
            const emptyKPIs = {
                totalSessions: 0,
                totalPageViews: 0,
                totalUnitsOrdered: 0,
                totalSales: 0,
                avgSessionsPerDay: 0,
                conversionRate: 0
            };
            
            this.updateKPIs(emptyKPIs);
            this.showNotification('No data available for the selected date range', 'warning');
        } else {
            this.state.businessData = this.transformData(data.data || []);
            // Aggregate by SKU
            this.state.filteredData = this.aggregateBySku(this.state.businessData);

            // Ensure we only consider dates that actually exist (skip missing/zero days)
            // Build totals per available date
            const byDate = new Map();
            (this.state.businessData || []).forEach(r => {
                const key = String(r.date || '').slice(0,10);
                if (!key) return;
                const prev = byDate.get(key) || { s: 0, p: 0, u: 0, o: 0 };
                byDate.set(key, {
                    s: prev.s + Number(r.sessions || 0),
                    p: prev.p + Number(r.pageViews || 0),
                    u: prev.u + Number(r.unitsOrdered || 0),
                    o: prev.o + Number(r.sales || 0)
                });
            });

            // Drop trailing today if totals are zero (partial day)
            const sortedKeys = Array.from(byDate.keys()).sort();
            while (sortedKeys.length > 0) {
                const last = sortedKeys[sortedKeys.length - 1];
                const v = byDate.get(last) || { s:0,p:0,u:0,o:0 };
                if ((v.s + v.p + v.u + v.o) > 0) break;
                byDate.delete(last);
                sortedKeys.pop();
            }

            // Nothing else to do for table because it already uses only available rows.
            
            console.log('🔍 Transformed data:', this.state.businessData.slice(0, 3));
            console.log('🔍 Showing data for available dates within the selected range');
            
            // Prefer backend KPIs (SQL-accurate for the same date window)
            // Also run a debug cross-check against the rows we display
            const backendKpis = data.kpis || {};
            const frontendKpis = this.computeKPIsFromRows(this.state.filteredData);
            this.debugCompareKpis(backendKpis, frontendKpis);
            this.updateKPIs(backendKpis);
            
            // Show success notification indicating data is displayed for available dates
            const availableDates = [...new Set(this.state.businessData.map(row => row.date))];
            if (availableDates.length > 0) {
                // Check if we have data for all dates in the range or just some
                const startDate = this.state.dateRange.startStr;
                const endDate = this.state.dateRange.endStr;
                
                if (startDate && endDate) {
                    // Calculate total days in range
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                    
                    if (availableDates.length === totalDays) {
                        console.log(`✅ Data displayed for all ${availableDates.length} days in the selected range`);
                    } else {
                        console.log(`📊 Data displayed for ${availableDates.length} of ${totalDays} days in the selected range (some dates have no data)`);
                        console.log(`📅 Available dates: ${availableDates.sort().join(', ')}`);
                    }
                } else {
                    console.log(`✅ Data displayed for ${availableDates.length} available date(s)`);
                }
            }
            
            // Fallback: Try updating KPIs again after a short delay
            // Keep KPIs stable to what is displayed; skip backend fallback
        }
        
        // Also compute trend vs previous equal-length period
        await this.updateKPITrends(data.kpis || {});
        this.renderTable();
        this.updateResultsCount();
        
        // Update chart with new data
        await this.updateChart();
        
        console.log('🔍 Data loading completed successfully');
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        this.showError(`Failed to load data: ${error.message}`);
    }
}

// ---------- Preset ranges ----------
async applyPreset(key) {
    const now = new Date();
    const apiBase = this.getApiBase();
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
            // Prefer backend-provided minimum business date. If not loaded yet, fetch it once.
            {
                let minSource = this.availableDateRange?.min || this.availableDateRange?.minDate;
                if (!minSource) {
                    try {
                        const res = await fetch(`${apiBase}/api/business-date-range`);
                        if (res.ok) {
                            const j = await res.json();
                            // Normalize possible keys from backend
                            minSource = j.minDate || j.min || j.min_date;
                            // Cache for subsequent lifetime clicks
                            this.availableDateRange = this.availableDateRange || {};
                            if (minSource) this.availableDateRange.min = minSource;
                        }
                    } catch (_) {}
                }
                if (minSource) {
                    start = new Date(minSource);
                } else {
                    // Fallback only if API couldn't provide min (keeps UI responsive)
                    start = new Date(now.getFullYear()-1, now.getMonth(), now.getDate());
                }
            }
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
        const apiBase = this.getApiBase();
        const prevUrl = `${apiBase}/api/business-data?start=${prev.startStr}&end=${prev.endStr}`;
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
        
        // Prefer friendly product names (mapping by Parent ASIN); fallback to DB values
        let asin = String(row.parent_asin || '').toUpperCase() || 'Unknown';
        // Normalize short internal codes (e.g., B001..B005) to canonical ASINs for display/grouping
        try {
            if (this.aliasParentToRealAsin && this.aliasParentToRealAsin.has(asin)) {
                asin = this.aliasParentToRealAsin.get(asin) || asin;
            }
        } catch (_) {}
        const friendlyFromAsin = this.asinToName ? (this.asinToName.get(asin) || null) : null;
        const friendlyFromSku = this.skuCodeToName ? (this.skuCodeToName.get(String(row.sku || '').toUpperCase()) || null) : null;
        const friendlyFromParentCode = this.parentCodeToName ? (this.parentCodeToName.get(String(row.parent_asin || '').toUpperCase()) || null) : null;
        const friendly = friendlyFromAsin || friendlyFromSku || friendlyFromParentCode;
        const sku = friendly || row.sku || 'Unknown';
        const resolvedTitle = (
            row.product_title || row.product_name || row.asin_title || row.title || (friendly ? `Product ${friendly}` : (row.parent_asin || row.sku || 'Unknown'))
        );
        
        return {
            date: localDateStr,
            sku: sku,
            parentAsin: asin || 'Unknown',
            productTitle: resolvedTitle,
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
    console.log('🔍 updateKPIs called with:', kpis);
    
    if (!kpis || typeof kpis !== 'object') {
        console.error('❌ Invalid KPIs data:', kpis);
        return;
    }
    
    const elements = {
        'totalSessions': kpis.totalSessions || 0,
        'pageViews': kpis.totalPageViews || 0,
        'unitsOrdered': kpis.totalUnitsOrdered || 0,
        'totalSales': kpis.totalSales || 0,
        'avgSessionsPerDay': kpis.avgSessionsPerDay || 0,
        'conversionRate': kpis.conversionRate || 0
    };
    
    console.log('🔍 KPI elements to update:', elements);
    
    // Ensure DOM is ready
    if (document.readyState !== 'complete') {
        console.log('🔍 DOM not ready, retrying in 100ms...');
        setTimeout(() => this.updateKPIs(kpis), 100);
        return;
    }
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        console.log(`🔍 Updating ${id}: ${value} (element found: ${!!element})`);
        if (element) {
            try {
                if (id === 'totalSales') {
                    element.textContent = this.formatCurrency(value);
                } else if (id === 'conversionRate') {
                    element.textContent = this.formatPercent(value);
                } else if (id === 'avgSessionsPerDay') {
                    element.textContent = this.formatNumber(value, 1);
                } else {
                    element.textContent = this.formatNumber(value);
                }
                console.log(`✅ ${id} updated to: ${element.textContent}`);
            } catch (error) {
                console.error(`❌ Error updating ${id}:`, error);
            }
        } else {
            console.error(`❌ Element not found: ${id}`);
            // Try to find the element with a different selector
            const altElement = document.querySelector(`[id="${id}"]`);
            if (altElement) {
                console.log(`🔍 Found element with alternative selector for ${id}`);
            }
        }
    });
}

computeKPIsFromRows(rows) {
    try {
        const totals = rows.reduce((acc, r) => {
            acc.totalSessions += Number(r.sessions || 0);
            acc.totalPageViews += Number(r.pageViews || 0);
            acc.totalUnitsOrdered += Number(r.unitsOrdered || 0);
            acc.totalSales += Number(r.sales || 0);
            return acc;
        }, { totalSessions: 0, totalPageViews: 0, totalUnitsOrdered: 0, totalSales: 0 });
        const uniqueDates = new Set(rows.map(r => r.date)).size;
        const avgSessionsPerDay = uniqueDates > 0 ? totals.totalSessions / uniqueDates : 0;
        const conversionRate = totals.totalSessions > 0 ? (totals.totalUnitsOrdered / totals.totalSessions) * 100 : 0;
        return {
            totalSessions: totals.totalSessions,
            totalPageViews: totals.totalPageViews,
            totalUnitsOrdered: totals.totalUnitsOrdered,
            totalSales: totals.totalSales,
            avgSessionsPerDay,
            conversionRate
        };
    } catch (_) {
        return { totalSessions: 0, totalPageViews: 0, totalUnitsOrdered: 0, totalSales: 0, avgSessionsPerDay: 0, conversionRate: 0 };
    }
}

debugCompareKpis(backend, frontend) {
    try {
        const fields = [
            ['totalSessions','totalSessions'],
            ['totalPageViews','totalPageViews'],
            ['totalUnitsOrdered','totalUnitsOrdered'],
            ['totalSales','totalSales']
        ];
        const diffs = [];
        fields.forEach(([k]) => {
            const b = Number(backend?.[k] || 0);
            const f = Number(frontend?.[k] || 0);
            if (Math.abs(b - f) > 0.001) diffs.push({ key: k, backend: b, frontend: f, delta: b - f });
        });
        if (diffs.length) {
            console.log('🔍 KPI mismatch (backend vs frontend rows):', diffs);
        } else {
            console.log('🔍 KPI check OK: backend matches frontend aggregation');
        }
    } catch (e) {
        // silent
    }
}

aggregateByParentAsin(rows) {
    try {
        const map = new Map();
        for (const r of rows) {
            let asinCode = String(r.parentAsin || 'Unknown');
            // Normalize short parent codes (B001..B005) to real ASINs so they combine with live rows
            if (this.aliasParentToRealAsin && this.aliasParentToRealAsin.has(asinCode)) {
                asinCode = this.aliasParentToRealAsin.get(asinCode);
            }
            const friendlyFromAsin = this.asinToName ? (this.asinToName.get(asinCode) || null) : null;
            const friendlyFromSku = this.skuCodeToName ? (this.skuCodeToName.get(String(r.sku || '').toUpperCase()) || null) : null;
            const friendlyFromParentCode = this.parentCodeToName ? (this.parentCodeToName.get(asinCode) || null) : null;
            const displayName = friendlyFromAsin || friendlyFromSku || friendlyFromParentCode || r.sku || asinCode;
            const key = asinCode; // combine by Parent ASIN to yield ~23 entities
            if (!map.has(key)) {
                map.set(key, {
                    date: r.date,
                    sku: displayName,
                    parentAsin: asinCode,
                    productTitle: `Product ${displayName}`,
                    sessions: 0,
                    pageViews: 0,
                    unitsOrdered: 0,
                    sales: 0,
                    conversionRate: 0,
                    avgOrderValue: 0
                });
            }
            const acc = map.get(key);
            acc.sessions += Number(r.sessions || 0);
            acc.pageViews += Number(r.pageViews || 0);
            acc.unitsOrdered += Number(r.unitsOrdered || 0);
            acc.sales += Number(r.sales || 0);
            // Prefer most descriptive SKU/title as friendly name
            if ((r.sales || 0) > (acc._maxSales || 0)) { acc.sku = displayName; acc.productTitle = `Product ${displayName}`; acc._maxSales = Number(r.sales || 0); }
        }
        let combined = Array.from(map.values()).map(x => {
            x.avgOrderValue = x.unitsOrdered > 0 ? (x.sales / x.unitsOrdered) : 0;
            x.conversionRate = x.sessions > 0 ? (x.unitsOrdered / x.sessions) * 100 : 0;
            delete x._maxSales;
            return x;
        });
        // Keep only entities that actually have data in the selected range
        combined = combined.filter(x => (x.sessions + x.pageViews + x.unitsOrdered + x.sales) > 0);
        // Stable sort by sales desc
        combined.sort((a,b) => b.sales - a.sales);
        return combined;
    } catch (_) {
        return [...rows];
    }
}

aggregateBySku(rows) {
    try {
        const map = new Map();
        for (const r of rows) {
            const skuName = r.sku || 'Unknown';
            const key = skuName;
            if (!map.has(key)) {
                map.set(key, {
                    date: r.date,
                    sku: skuName,
                    parentAsin: r.parentAsin || 'Unknown',
                    productTitle: `Product ${skuName}`,
                    sessions: 0,
                    pageViews: 0,
                    unitsOrdered: 0,
                    sales: 0,
                    conversionRate: 0,
                    avgOrderValue: 0,
                    _maxSales: 0
                });
            }
            const acc = map.get(key);
            acc.sessions += Number(r.sessions || 0);
            acc.pageViews += Number(r.pageViews || 0);
            acc.unitsOrdered += Number(r.unitsOrdered || 0);
            acc.sales += Number(r.sales || 0);
            if ((r.sales || 0) > acc._maxSales) {
                acc.parentAsin = r.parentAsin || acc.parentAsin;
                acc._maxSales = Number(r.sales || 0);
            }
        }
        let combined = Array.from(map.values()).map(x => {
            x.avgOrderValue = x.unitsOrdered > 0 ? (x.sales / x.unitsOrdered) : 0;
            x.conversionRate = x.sessions > 0 ? (x.unitsOrdered / x.sessions) * 100 : 0;
            delete x._maxSales;
            return x;
        });
        // Filter out all-zero rows
        combined = combined.filter(x => (x.sessions + x.pageViews + x.unitsOrdered + x.sales) > 0);
        // Sort by sales desc
        combined.sort((a,b) => b.sales - a.sales);
        return combined;
    } catch (_) {
        return [...rows];
    }
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

async exportData(format, includeAll = true) {
    try {
        // Always export ALL individual entries from database
        const exportData = await this.fetchCompleteDataForExport();
        
        if (exportData.length === 0) {
            this.showNotification('No data available for export', 'warning');
            return;
        }
        
        const headers = ['Date', 'SKU', 'Parent ASIN', 'Product Title', 'Sessions', 'Page Views', 'Units Ordered', 'Sales (₹)', 'Conversion Rate (%)', 'Avg Order Value (₹)'];
        
        // Generate filename with date range
        const startDate = this.state.dateRange.startStr;
        const endDate = this.state.dateRange.endStr;
        
        if (format === 'excel') {
            const rows = exportData.map(row => ({
                'Date': row.date || this.state.dateRange.startStr,
                'SKU': row.sku,
                'Parent ASIN': row.parentAsin,
                'Product Title': row.productTitle,
                'Sessions': row.sessions,
                'Page Views': row.pageViews,
                'Units Ordered': row.unitsOrdered,
                'Sales (₹)': Number(row.sales || 0),
                'Conversion Rate (%)': Number(row.conversionRate || 0),
                'Avg Order Value (₹)': Number(row.avgOrderValue || 0)
            }));

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Business');

            const filename = `business-report-${startDate}-to-${endDate}.xlsx`;
            const ab = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

            const blob = new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showNotification(`Excel export successful! (${exportData.length} records)`, 'success');
            
        } else {
            // CSV format
            let csv = headers.join(',') + '\n';
            
            exportData.forEach(row => {
                const actualDate = row.date || this.state.dateRange.startStr;
                csv += [
                    `"${actualDate}"`,
                    `"${row.sku}"`,
                    `"${row.parentAsin}"`,
                    `"${row.productTitle}"`,
                    row.sessions,
                    row.pageViews,
                    row.unitsOrdered,
                    Number(row.sales || 0).toFixed(2),
                    Number(row.conversionRate || 0).toFixed(2),
                    Number(row.avgOrderValue || 0).toFixed(2)
                ].join(',') + '\n';
            });
            
            const filename = `business-report-${startDate}-to-${endDate}.csv`;
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showNotification(`CSV export successful! (${exportData.length} records)`, 'success');
        }
        
    } catch (error) {
        this.showNotification('Export failed. Please try again.', 'error');
    }
}

async fetchCompleteDataForExport() {
    try {
        const apiBase = this.getApiBase();
        const startDate = this.state.dateRange.startStr;
        const endDate = this.state.dateRange.endStr;
        
        // Fetch ALL individual entries from database without aggregation
        const url = `${apiBase}/api/business-data?start=${startDate}&end=${endDate}&includeAll=true`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch complete data: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Transform data but DON'T aggregate - keep individual entries
        const individualEntries = this.transformData(data.data || []);
        
        // Return individual entries without aggregation
        return individualEntries;
        
    } catch (error) {
        console.error('Error fetching complete data:', error);
        // Fallback to filtered data if complete fetch fails
        return [...this.state.filteredData];
    }
}

createExcelContent(headers, data) {
    // Create Excel XML format (Excel 2003+ compatible)
    let xml = '<?xml version="1.0"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
    xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
    xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:html="http://www.w3.org/TR/REC-html40">\n';
    
    // Styles
    xml += '<Styles>\n';
    xml += '<Style ss:ID="Header">\n';
    xml += '<Font ss:Bold="1"/>\n';
    xml += '<Interior ss:Color="#CCCCCC" ss:Pattern="Solid"/>\n';
    xml += '</Style>\n';
    xml += '<Style ss:ID="Currency">\n';
    xml += '<NumberFormat ss:Format="Currency"/>\n';
    xml += '</Style>\n';
    xml += '<Style ss:ID="Percent">\n';
    xml += '<NumberFormat ss:Format="Percent"/>\n';
    xml += '</Style>\n';
    xml += '</Styles>\n';
    
    // Worksheet
    xml += '<Worksheet ss:Name="Business Report">\n';
    xml += '<Table>\n';
    
    // Headers
    xml += '<Row>\n';
    headers.forEach(header => {
        xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${this.escapeXml(header)}</Data></Cell>\n`;
    });
    xml += '</Row>\n';
    
    // Data rows
    data.forEach(row => {
        xml += '<Row>\n';
        const actualDate = row.date || this.state.dateRange.startStr;
        
        // Date
        xml += `<Cell><Data ss:Type="String">${this.escapeXml(actualDate)}</Data></Cell>\n`;
        // SKU
        xml += `<Cell><Data ss:Type="String">${this.escapeXml(row.sku)}</Data></Cell>\n`;
        // Parent ASIN
        xml += `<Cell><Data ss:Type="String">${this.escapeXml(row.parentAsin)}</Data></Cell>\n`;
        // Product Title
        xml += `<Cell><Data ss:Type="String">${this.escapeXml(row.productTitle)}</Data></Cell>\n`;
        // Sessions
        xml += `<Cell><Data ss:Type="Number">${row.sessions}</Data></Cell>\n`;
        // Page Views
        xml += `<Cell><Data ss:Type="Number">${row.pageViews}</Data></Cell>\n`;
        // Units Ordered
        xml += `<Cell><Data ss:Type="Number">${row.unitsOrdered}</Data></Cell>\n`;
        // Sales (with currency formatting)
        xml += `<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(row.sales || 0).toFixed(2)}</Data></Cell>\n`;
        // Conversion Rate (with percentage formatting)
        xml += `<Cell ss:StyleID="Percent"><Data ss:Type="Number">${(Number(row.conversionRate || 0) / 100).toFixed(4)}</Data></Cell>\n`;
        // Avg Order Value (with currency formatting)
        xml += `<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(row.avgOrderValue || 0).toFixed(2)}</Data></Cell>\n`;
        
        xml += '</Row>\n';
    });
    
    xml += '</Table>\n';
    xml += '</Worksheet>\n';
    xml += '</Workbook>';
    
    return xml;
}

escapeXml(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

async fetchCompleteDataForExport() {
    try {
        const apiBase = this.getApiBase();
        const startDate = this.state.dateRange.startStr;
        const endDate = this.state.dateRange.endStr;
        
        // Fetch ALL individual entries from database without aggregation
        const url = `${apiBase}/api/business-data?start=${startDate}&end=${endDate}&includeAll=true`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch complete data: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Transform data but DON'T aggregate - keep individual entries
        const individualEntries = this.transformData(data.data || []);
        
        // Return individual entries without aggregation
        return individualEntries;
        
    } catch (error) {
        console.error('Error fetching complete data:', error);
        // Fallback to filtered data if complete fetch fails
        return [...this.state.filteredData];
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
        // Use current date range as fallback
        const defaultRange = this.getDefaultDateRange();
        this.calendarState.tempRangeStart = new Date(defaultRange.start);
        this.calendarState.tempRangeEnd = new Date(defaultRange.end);
    }
    
    // Open picker on a sane month (avoid 1970 if temp range is missing/invalid)
    const base = (this.calendarState.tempRangeEnd && !isNaN(new Date(this.calendarState.tempRangeEnd)))
        ? new Date(this.calendarState.tempRangeEnd)
        : (this.calendarState.tempRangeStart && !isNaN(new Date(this.calendarState.tempRangeStart)))
            ? new Date(this.calendarState.tempRangeStart)
            : new Date();
    this.calendarState.calendarMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    
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

    // Auto-apply selected range when calendar closes (no extra Confirm needed)
    try {
        if (this.calendarState && this.calendarState.tempRangeStart) {
            const startYear = this.calendarState.tempRangeStart.getFullYear();
            const startMonth = this.calendarState.tempRangeStart.getMonth();
            const startDay = this.calendarState.tempRangeStart.getDate();
            const endRef = this.calendarState.tempRangeEnd || this.calendarState.tempRangeStart;
            const endYear = endRef.getFullYear();
            const endMonth = endRef.getMonth();
            const endDay = endRef.getDate();

            const start = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
            const end = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);

            this.state.dateRange = {
                start,
                end,
                startStr: this.formatDate(start),
                endStr: this.formatDate(end)
            };
            this.updateDateDisplay();
            // Re-load data for the applied range
            this.loadData();
        }
    } catch (_) { /* silent */ }
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
    
    // Define current date once for the entire function
    const currentDate = new Date();
    currentDate.setHours(23, 59, 59, 999);
    
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
        
        // Check if this date is in the future (disabled)
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        const isFuture = date > today;
        
        if (isFuture) {
            classes += ' future-date';
        } else {
            classes += ' available-date';
        }
        
        // Allow selection of any date - we'll validate data availability on the backend
        const dateStr = this.formatDate(date);
        
        const dayElement = document.createElement('div');
        dayElement.className = classes;
        dayElement.dataset.date = dateStr;
        dayElement.textContent = d;
        
        const isDisabled = classes.includes('disabled') || classes.includes('future-date');
        
        dayElement.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isDisabled) return;
            
            // Allow selection of any date up to today
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
        
        const tooltip = `Click to select: ${dateStr}`;
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
    const today = new Date();
    const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    this.calendarState.calendarMonth = todayMonth;
    this.renderCalendar();
}


handleCalendarDayClick(dateString) {
    try {
        console.log('🔍 Calendar day clicked:', dateString);
        
        // Parse date string directly to avoid timezone issues
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day, 0, 0, 0, 0);
        
        if (isNaN(date.getTime())) {
            console.error('❌ Invalid date:', dateString);
            return;
        }
        
        // Validate date is not in the future (up to current date)
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        
        if (date > today) {
            console.log('⚠️ Selected date is in the future');
            this.showNotification('Cannot select future dates. Please select dates up to today.', 'warning');
            return;
        }
        
        if (!this.calendarState.tempRangeStart || (this.calendarState.tempRangeStart && this.calendarState.tempRangeEnd)) {
            this.calendarState.tempRangeStart = new Date(date);
            this.calendarState.tempRangeEnd = null;
            console.log('🔍 Set start date:', this.calendarState.tempRangeStart);
        } else {
            const start = new Date(this.calendarState.tempRangeStart);
            start.setHours(0, 0, 0, 0);
            
            if (date < start) {
                this.calendarState.tempRangeEnd = start;
                this.calendarState.tempRangeStart = new Date(date);
            } else {
                this.calendarState.tempRangeEnd = new Date(date);
            }
            console.log('🔍 Set end date:', this.calendarState.tempRangeEnd);
        }
        
        this.renderCalendar();
        this.updateCalendarSummary();
        
    } catch (error) {
        // Silent error handling
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
    console.log('🔍 Confirm date range clicked');
    
    if (!this.calendarState.tempRangeStart) {
        console.log('❌ No start date selected');
        return;
    }
    
    console.log('🔍 Selected range:', {
        start: this.calendarState.tempRangeStart,
        end: this.calendarState.tempRangeEnd
    });
    
    // Hide calendar immediately when confirm is clicked
    this.closeCalendar();
    
    // Create dates without timezone issues by using local date components
    const startYear = this.calendarState.tempRangeStart.getFullYear();
    const startMonth = this.calendarState.tempRangeStart.getMonth();
    const startDay = this.calendarState.tempRangeStart.getDate();
    
    const endYear = (this.calendarState.tempRangeEnd || this.calendarState.tempRangeStart).getFullYear();
    const endMonth = (this.calendarState.tempRangeEnd || this.calendarState.tempRangeStart).getMonth();
    const endDay = (this.calendarState.tempRangeEnd || this.calendarState.tempRangeStart).getDate();
    
    // Create date strings FIRST directly from calendar values to avoid timezone conversion
    const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    
    // Create Date objects using local timezone to avoid UTC conversion
    // Force exact single-day/multi-day ranges without drift
    const start = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
    let end = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);
    if (!this.calendarState.tempRangeEnd) {
        // single day: end must equal start (23:59:59)
        end = new Date(startYear, startMonth, startDay, 23, 59, 59, 999);
    }
    
    this.state.dateRange = { 
        start, 
        end,
        startStr: startDateStr,
        endStr: endDateStr
    };
    
    // Validate the selected date range is not in the future and not inverted
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    if (this.state.dateRange.start > today || this.state.dateRange.end > today) {
        this.showNotification('Cannot select future dates. Please select dates up to today.', 'warning');
        return;
    }
    if (this.state.dateRange.end < this.state.dateRange.start) {
        this.showNotification('Invalid range. End date cannot be before start date.', 'warning');
        return;
    }
    
    this.updateDateDisplay();
    await this.loadData();
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
    alert(message);
}

showNotification(message, type = 'info') {
    // Notifications disabled to avoid popup overlay
    return;
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
    // Auto-refresh disabled for stable snapshots
    // setInterval(() => { this.loadData(); }, 5 * 60 * 1000);
}

// Debug function - can be called from browser console
debugUpdateKPIs() {
    console.log('🔍 Manual KPI update triggered');
    const testKPIs = {
        totalSessions: 1525,
        totalPageViews: 2030,
        totalUnitsOrdered: 103,
        totalSales: 37965,
        avgSessionsPerDay: 66.3,
        conversionRate: 6.75
    };
    this.updateKPIs(testKPIs);
}

// Chart methods
syncMetricCheckboxes() {
    document.querySelectorAll('#metricDropdown input[type="checkbox"]').forEach(checkbox => {
        const metric = checkbox.id.replace('metric-', '');
        checkbox.checked = this.selectedMetrics.includes(metric);
    });
}

// Helper method to create dataset configuration for a metric
createMetricDataset(metric, data) {
    const configs = {
        sessions: {
            label: 'Sessions',
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            yAxisID: 'y'
        },
        pageViews: {
            label: 'Page Views',
            borderColor: '#28a745',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            yAxisID: 'y'
        },
        unitsOrdered: {
            label: 'Units Ordered',
            borderColor: '#ffc107',
            backgroundColor: 'rgba(255, 193, 7, 0.1)',
            yAxisID: 'y1'
        },
        sales: {
            label: 'Sales (₹)',
            borderColor: '#dc3545',
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            yAxisID: 'y1'
        }
    };

    const config = configs[metric];
    if (!config) return null;

    return {
        label: config.label,
        data: data,
        borderColor: config.borderColor,
        backgroundColor: config.backgroundColor,
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 3,
        showLine: true,
        spanGaps: true,
        pointStyle: 'circle',
        capBezierPoints: true,
        cubicInterpolationMode: 'monotone',
        yAxisID: config.yAxisID,
        elements: {
            point: {
                hoverRadius: 6
            },
            line: {
                tension: 0.4,
                borderJoinStyle: 'round',
                borderCapStyle: 'round'
            }
        }
    };
}

initializeChart() {
    const ctx = document.getElementById('businessChart');
    if (!ctx) return;
    
    // Initialize with empty chart
    this.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    onClick: (e, legendItem, legend) => {
                        // Toggle dataset visibility using Chart.js built-in functionality
                        const index = legendItem.datasetIndex;
                        const chart = legend.chart;
                        const meta = chart.getDatasetMeta(index);
                        
                        // Toggle visibility
                        meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                        chart.update();
                        
                        // Also sync with dropdown checkboxes
                        const dataset = chart.data.datasets[index];
                        const metricName = dataset.label;
                        
                        // Map display names to internal metric keys
                        const metricMap = {
                            'Sessions': 'sessions',
                            'Page Views': 'pageViews', 
                            'Units Ordered': 'unitsOrdered',
                            'Sales (₹)': 'sales'
                        };
                        
                        const metricKey = metricMap[metricName];
                        if (metricKey) {
                            // Update selectedMetrics array based on visibility
                            const isVisible = !meta.hidden;
                            if (isVisible && !this.selectedMetrics.includes(metricKey)) {
                                this.selectedMetrics.push(metricKey);
                            } else if (!isVisible && this.selectedMetrics.includes(metricKey)) {
                                this.selectedMetrics = this.selectedMetrics.filter(m => m !== metricKey);
                            }
                            
                            // Sync the dropdown checkboxes
                            this.syncMetricCheckboxes();
                        }
                    },
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    enabled: true,
                    usePointStyle: true,
                    callbacks: {
                        label: (ctx) => {
                            const label = ctx.dataset.label || '';
                            const raw = Number(ctx.parsed.y || 0);
                            if (label.includes('Sales')) {
                                return `${label}: ₹${raw.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
                            }
                            return `${label}: ${raw.toLocaleString('en-IN')}`;
                        },
                        title: (items) => {
                            return items && items.length ? items[0].label : '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6c757d',
                        font: { size: 11 },
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6c757d',
                        font: { size: 11 },
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6c757d',
                        font: { size: 11 },
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
}

async updateChart(period = 'daily') {
    if (!this.chart || !this.state.businessData || this.state.businessData.length === 0) {
        return;
    }
    
    // Ensure monthly uses ALL data (ignore date filter)
    if (period === 'monthly') {
        if (!this.chartAllData && !this.loadingAllChartData) {
            try {
                this.loadingAllChartData = true;
                const apiBase = this.getApiBase();
                // Hit analytics to get lifetime business series (already aggregated by date)
                const res = await fetch(`${apiBase}/api/business-data`);
                if (res.ok) {
                    const j = await res.json();
                    // Reuse transform to normalize
                    this.chartAllData = (j?.data || []).map(r => ({
                        date: this.formatDate(new Date(r.date)),
                        sessions: Number(r.sessions || 0),
                        pageViews: Number(r.page_views || 0),
                        unitsOrdered: Number(r.units_ordered || 0),
                        sales: Number(r.ordered_product_sales || 0)
                    }));
                }
            } catch (_) { /* ignore */ }
            finally { this.loadingAllChartData = false; }
        }
    }
    const chartData = this.generateChartData(period);
    
    // Update chart data
    this.chart.data.labels = chartData.labels;
    this.chart.data.datasets = chartData.datasets;
    this.chart.update();
}

generateChartData(period) {
    if (!this.state.businessData || this.state.businessData.length === 0) {
        return { labels: [], datasets: [] };
    }
    
    // Source rows: for monthly use lifetime cache, otherwise current filtered data
    const sourceRows = (period === 'monthly' && Array.isArray(this.chartAllData) && this.chartAllData.length)
        ? this.chartAllData
        : this.state.businessData;
    
    // Group data by date
    const dataByDate = new Map();
    
    sourceRows.forEach(row => {
        const date = row.date;
        if (!dataByDate.has(date)) {
            dataByDate.set(date, {
                sessions: 0,
                pageViews: 0,
                unitsOrdered: 0,
                sales: 0
            });
        }
        
        const dayData = dataByDate.get(date);
        dayData.sessions += row.sessions || 0;
        dayData.pageViews += row.pageViews || 0;
        dayData.unitsOrdered += row.unitsOrdered || 0;
        dayData.sales += row.sales || 0;
    });
    
    // Sort dates
    const sortedDates = Array.from(dataByDate.keys()).sort();
    
    // Generate labels and data based on period
    let labels = [];
    let sessionsData = [];
    let pageViewsData = [];
    let unitsOrderedData = [];
    let salesData = [];
    
    if (period === 'daily') {
        // Show daily data
        sortedDates.forEach(date => {
            const data = dataByDate.get(date);
            labels.push(this.formatDateForChart(date));
            sessionsData.push(data.sessions);
            pageViewsData.push(data.pageViews);
            unitsOrderedData.push(data.unitsOrdered);
            salesData.push(data.sales);
        });
    } else if (period === 'weekly') {
        // Group by weeks
        const weeklyData = this.aggregateByWeek(sortedDates, dataByDate);
        labels = weeklyData.labels;
        sessionsData = weeklyData.sessions;
        pageViewsData = weeklyData.pageViews;
        unitsOrderedData = weeklyData.unitsOrdered;
        salesData = weeklyData.sales;
    } else if (period === 'monthly') {
        // Group by months
        const monthlyData = this.aggregateByMonth(sortedDates, dataByDate);
        labels = monthlyData.labels;
        sessionsData = monthlyData.sessions;
        pageViewsData = monthlyData.pageViews;
        unitsOrderedData = monthlyData.unitsOrdered;
        salesData = monthlyData.sales;
    }
    
    // Create datasets for all metrics (but respect visibility state)
    const datasets = [];
    const metricDataMap = {
        sessions: sessionsData,
        pageViews: pageViewsData,
        unitsOrdered: unitsOrderedData,
        sales: salesData
    };

    // Always include all metrics, but set hidden state based on selectedMetrics
    const allMetrics = ['sessions', 'pageViews', 'unitsOrdered', 'sales'];
    allMetrics.forEach(metric => {
        const data = metricDataMap[metric];
        if (data) {
            const dataset = this.createMetricDataset(metric, data);
            if (dataset) {
                // Set hidden state based on whether metric is in selectedMetrics
                dataset.hidden = !this.selectedMetrics.includes(metric);
                datasets.push(dataset);
            }
        }
    });

    return {
        labels: labels,
        datasets: datasets
    };
}

aggregateByWeek(sortedDates, dataByDate) {
    const weeklyData = new Map();
    
    sortedDates.forEach(date => {
        const dateObj = new Date(date);
        const weekStart = this.getWeekStart(dateObj); // Monday start
        const y = weekStart.getFullYear();
        const m = String(weekStart.getMonth() + 1).padStart(2, '0');
        const d = String(weekStart.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`; // ISO key for correct sorting
        
        if (!weeklyData.has(key)) {
            weeklyData.set(key, {
                sessions: 0,
                pageViews: 0,
                unitsOrdered: 0,
                sales: 0
            });
        }
        
        const data = dataByDate.get(date);
        const weekData = weeklyData.get(key);
        weekData.sessions += data.sessions;
        weekData.pageViews += data.pageViews;
        weekData.unitsOrdered += data.unitsOrdered;
        weekData.sales += data.sales;
    });
    
    const keys = Array.from(weeklyData.keys()).sort();
    const labels = keys.map(k => this.formatDateForChart(k));
    const sessions = keys.map(k => weeklyData.get(k).sessions);
    const pageViews = keys.map(k => weeklyData.get(k).pageViews);
    const unitsOrdered = keys.map(k => weeklyData.get(k).unitsOrdered);
    const sales = keys.map(k => weeklyData.get(k).sales);
    
    return { labels, sessions, pageViews, unitsOrdered, sales };
}

aggregateByMonth(sortedDates, dataByDate) {
    const monthlyData = new Map();
    
    sortedDates.forEach(date => {
        const dateObj = new Date(date);
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, {
                sessions: 0,
                pageViews: 0,
                unitsOrdered: 0,
                sales: 0
            });
        }
        
        const data = dataByDate.get(date);
        const monthData = monthlyData.get(monthKey);
        monthData.sessions += data.sessions;
        monthData.pageViews += data.pageViews;
        monthData.unitsOrdered += data.unitsOrdered;
        monthData.sales += data.sales;
    });
    
    const labels = Array.from(monthlyData.keys()).sort();
    const sessions = labels.map(label => monthlyData.get(label).sessions);
    const pageViews = labels.map(label => monthlyData.get(label).pageViews);
    const unitsOrdered = labels.map(label => monthlyData.get(label).unitsOrdered);
    const sales = labels.map(label => monthlyData.get(label).sales);
    
    return { labels, sessions, pageViews, unitsOrdered, sales };
}

getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
}

formatDateForChart(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
    });
}

}

// Make debug function available globally
window.debugUpdateKPIs = () => {
    if (window.businessReportsDashboard) {
        window.businessReportsDashboard.debugUpdateKPIs();
    } else {
        console.error('❌ Business reports dashboard not found');
    }
};

document.addEventListener('DOMContentLoaded', () => {
window.businessReportsDashboard = new BusinessReportsDashboard();
});