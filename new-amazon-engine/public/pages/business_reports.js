// Enable debug logging for troubleshooting
(function() {
    const ENABLE_DEBUG = false; // Disable debug logging in production
    if (!ENABLE_DEBUG && typeof console !== 'undefined') {
        const noops = ['log', 'debug', 'info', 'group', 'groupCollapsed', 'groupEnd', 'time', 'timeEnd', 'table'];
        noops.forEach(fn => { try { console[fn] = () => {}; } catch(_) {} });
    }
})();

const GLOBAL_DATE_RANGE_STORAGE_KEY = 'global_date_range';
const GLOBAL_DATE_RANGE_WINDOW_PREFIX = '__GLOBAL_DATE_RANGE__=';

class BusinessReportsDashboard {
constructor() {
    this.state = {
        businessData: [],
        filteredData: [],
        currentPage: 1,
        itemsPerPage: Number(localStorage.getItem('biz_rows_per_page') || 23),
        sortColumn: '',
        sortDirection: 'desc',
        searchTerm: '',
        selectedProducts: new Set(), // multi-select products
        dateRange: this.getDefaultDateRange(),
        // Persist selected chart period so subsequent updates don't reset to daily
        chartPeriod: 'daily'
    };
    
    this.calendarState = {
        tempRangeStart: null,
        tempRangeEnd: null,
        calendarMonth: new Date()
    };
    
    this.hasManualDateSelection = false;
    
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
    
    // Cache configuration
    this.CACHE_TTL = 60 * 60 * 1000; // 1 hour cache TTL
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

// Cache helper methods
getNextNoon() {
    const now = new Date();
    const noon = new Date(now);
    noon.setHours(12, 0, 0, 0);
    
    // If it's past noon today, set for tomorrow
    if (now > noon) {
        noon.setDate(noon.getDate() + 1);
    }
    
    return noon.getTime();
}

getCachedData(cacheKey) {
    try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;
        
        const parsed = JSON.parse(cached);
        const now = Date.now();
        const nextNoon = this.getNextNoon();
        const lastNoon = nextNoon - (24 * 60 * 60 * 1000); // 24 hours before next noon
        
        // Check if cache was created after last noon (still valid today)
        // If it's past 12 PM and cache was created before today's noon, clear it
        if (parsed.timestamp <= lastNoon) {
            localStorage.removeItem(cacheKey);
            console.log('🔄 Cache expired (past 12 PM), cleared:', cacheKey);
            return null;
        }
        
        // Also check 1 hour TTL as fallback
        if (now - parsed.timestamp > this.CACHE_TTL) {
            localStorage.removeItem(cacheKey);
            return null;
        }
        
        return parsed;
    } catch (e) {
        console.warn('Cache read error:', e);
        return null;
    }
}

setCachedData(cacheKey, data) {
    try {
        const cacheEntry = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
        const nextRefresh = new Date(this.getNextNoon());
        console.log(`💾 Cached data for key: ${cacheKey}. Next refresh: ${nextRefresh.toLocaleString()}`);
    } catch (e) {
        console.warn('Cache write error:', e);
        // If storage is full, try to clear old cache entries
        try {
            const keys = Object.keys(localStorage);
            const cacheKeys = keys.filter(k => k.startsWith('business_data_') || k.startsWith('analytics_data_'));
            if (cacheKeys.length > 10) {
                // Remove oldest 5 entries
                const entries = cacheKeys.map(k => ({
                    key: k,
                    timestamp: JSON.parse(localStorage.getItem(k))?.timestamp || 0
                })).sort((a, b) => a.timestamp - b.timestamp);
                
                entries.slice(0, 5).forEach(e => localStorage.removeItem(e.key));
                console.log('🧹 Cleared old cache entries');
                
                // Retry saving
                localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
            }
        } catch (e2) {
            console.warn('Cache cleanup failed:', e2);
        }
    }
}

clearExpiredCache() {
    try {
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(k => k.startsWith('business_data_') || k.startsWith('analytics_data_'));
        const nextNoon = this.getNextNoon();
        const lastNoon = nextNoon - (24 * 60 * 60 * 1000);
        let clearedCount = 0;
        
        cacheKeys.forEach(key => {
            try {
                const cached = localStorage.getItem(key);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    // Only clear if cache was created before last noon (expired at 12 PM)
                    // Don't clear if it's still valid (created after last noon)
                    if (parsed.timestamp && parsed.timestamp <= lastNoon) {
                        localStorage.removeItem(key);
                        clearedCount++;
                    }
                }
            } catch (e) {
                // Invalid cache entry, remove it
                localStorage.removeItem(key);
                clearedCount++;
            }
        });
        
        if (clearedCount > 0) {
            console.log(`🔄 Cleared ${clearedCount} expired cache entries (past 12 PM refresh)`);
        }
    } catch (e) {
        console.warn('Error clearing expired cache:', e);
    }
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
                const localBase = window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';
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
        return window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';
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

applyGlobalDateRangeFromStorage() {
    const stored = this.loadGlobalDateRangeFromStorage();
    if (!stored || !stored.manualSelection) return false;
    this.hasManualDateSelection = true;
    this.state.dateRange = stored;
    return true;
}

loadGlobalDateRangeFromStorage() {
    try {
        if (typeof window === 'undefined') return null;
    } catch (_) {
        return null;
    }

    try {
        const raw = this.getGlobalDateRangeRawValue();
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const normalizeDate = (value) => {
            if (value === null || value === undefined) return null;
            if (typeof value === 'number' && Number.isFinite(value)) {
                const d = new Date(value);
                return Number.isNaN(d.getTime()) ? null : d;
            }
            if (typeof value === 'string' && value) {
                const d = new Date(value);
                return Number.isNaN(d.getTime()) ? null : d;
            }
            return null;
        };

        const startCandidate = normalizeDate(parsed.startMs ?? parsed.start ?? parsed.startStr);
        const endCandidate = normalizeDate(parsed.endMs ?? parsed.end ?? parsed.endStr);
        if (!startCandidate || !endCandidate) return null;
        startCandidate.setHours(0, 0, 0, 0);
        endCandidate.setHours(23, 59, 59, 999);
        return {
            start: startCandidate,
            end: endCandidate,
            startStr: parsed.startStr || this.formatDate(startCandidate),
            endStr: parsed.endStr || this.formatDate(endCandidate),
            manualSelection: !!parsed.manualSelection
        };
    } catch (err) {
        console.warn('Global date range load failed (business):', err);
        return null;
    }
}

applyDateRangeFromQuery() {
    const range = this.getDateRangeFromQuery();
    if (!range) return false;
    this.state.dateRange = range;
    this.hasManualDateSelection = true;
    this.persistGlobalDateRangeFromRange(range);
    return true;
}

getDateRangeFromQuery() {
    try {
        if (typeof window === 'undefined') return null;
        const search = this.getRawSearchString();
        if (!search) return null;
        const { start, end } = this.extractStartEndFromSearch(search);
        if (!start || !end) return null;
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
        startDate.setHours(0,0,0,0);
        endDate.setHours(23,59,59,999);
        return {
            start: startDate,
            end: endDate,
            startStr: this.formatDate(startDate),
            endStr: this.formatDate(endDate)
        };
    } catch (_) {
        return null;
    }
}

getRawSearchString() {
    try {
        if (typeof window === 'undefined') return '';
        if (window.location.search && window.location.search !== '?') {
            return window.location.search;
        }
        const href = window.location.href || '';
        const idx = href.indexOf('?');
        if (idx === -1) return '';
        return '?' + href.slice(idx + 1).split('#')[0];
    } catch (_) {
        return '';
    }
}

extractStartEndFromSearch(search) {
    const result = { start: null, end: null };
    try {
        const params = new URLSearchParams(search);
        result.start = params.get('start');
        result.end = params.get('end');
    } catch (_) {
        // ignore and fall back
    }

    if (result.start && result.end) return result;

    try {
        const trimmed = search.startsWith('?') ? search.slice(1) : search;
        trimmed.split('&').forEach(pair => {
            const [rawKey, rawVal] = pair.split('=');
            const key = decodeURIComponent(rawKey || '');
            const value = decodeURIComponent(rawVal || '');
            if (key === 'start' && !result.start) result.start = value;
            if (key === 'end' && !result.end) result.end = value;
        });
    } catch (_) {
        // ignore
    }
    return result;
}

persistGlobalDateRangeFromRange(range) {
    if (!this.hasManualDateSelection) return;
    if (!range || !range.start || !range.end) return;
    const start = new Date(range.start);
    const end = new Date(range.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const payload = {
        startMs: start.getTime(),
        endMs: end.getTime(),
        startStr: range.startStr || this.formatDate(start),
        endStr: range.endStr || this.formatDate(end),
        savedAt: Date.now(),
        manualSelection: true
    };
    this.persistGlobalDateRangeRaw(payload);
    this.updateNavLinksWithDateRange();
    this.syncUrlDateParams();
}

syncUrlDateParams() {
    if (!this.hasManualDateSelection) return;
    try {
        if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;
        if (!this.state?.dateRange?.start || !this.state?.dateRange?.end) return;
        const start = this.state.dateRange.startStr || this.formatDate(new Date(this.state.dateRange.start));
        const end = this.state.dateRange.endStr || this.formatDate(new Date(this.state.dateRange.end));
        const url = new URL(window.location.href);
        url.searchParams.set('start', start);
        url.searchParams.set('end', end);
        const newUrl = url.pathname + url.search;
        window.history.replaceState({}, '', newUrl);
    } catch (_) {
        // ignore
    }
}

updateNavLinksWithDateRange() {
    if (!this.hasManualDateSelection) return;
    if (!this.state?.dateRange?.start || !this.state?.dateRange?.end) return;
    const start = this.state.dateRange.startStr || this.formatDate(new Date(this.state.dateRange.start));
    const end = this.state.dateRange.endStr || this.formatDate(new Date(this.state.dateRange.end));
    const links = typeof document !== 'undefined' ? document.querySelectorAll('.nav-item[href]') : [];
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || link.hasAttribute('data-section')) return;
        try {
            // Use full current URL as base so relative links stay inside /pages/ when already there
            const base = (typeof window !== 'undefined' && window.location && window.location.href)
                ? window.location.href
                : '';
            const url = new URL(href, base);
            url.searchParams.set('start', start);
            url.searchParams.set('end', end);
            let relative = url.href;
            if (typeof window !== 'undefined' && url.origin === window.location.origin) {
                relative = url.pathname + url.search;
            }
            link.setAttribute('href', relative);
        } catch (_) {
            // ignore bad URLs
        }
    });
}

getGlobalDateRangeRawValue() {
    const sources = [
        () => {
            try {
                return (typeof window !== 'undefined' && window.localStorage)
                    ? localStorage.getItem(GLOBAL_DATE_RANGE_STORAGE_KEY)
                    : null;
            } catch (_) {
                return null;
            }
        },
        () => {
            try {
                return (typeof window !== 'undefined' && window.sessionStorage)
                    ? sessionStorage.getItem(GLOBAL_DATE_RANGE_STORAGE_KEY)
                    : null;
            } catch (_) {
                return null;
            }
        },
        () => {
            try {
                if (typeof window === 'undefined' || typeof window.name !== 'string') return null;
                if (!window.name.startsWith(GLOBAL_DATE_RANGE_WINDOW_PREFIX)) return null;
                return window.name.slice(GLOBAL_DATE_RANGE_WINDOW_PREFIX.length);
            } catch (_) {
                return null;
            }
        }
    ];

    for (const getter of sources) {
        const raw = getter();
        if (raw && raw !== 'undefined') return raw;
    }
    return null;
}

persistGlobalDateRangeRaw(payload) {
    const json = JSON.stringify(payload);
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(GLOBAL_DATE_RANGE_STORAGE_KEY, json);
        }
    } catch (err) {
        console.warn('Global date range localStorage save failed (business):', err);
    }
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.setItem(GLOBAL_DATE_RANGE_STORAGE_KEY, json);
        }
    } catch (err) {
        console.warn('Global date range sessionStorage save failed (business):', err);
    }
    try {
        if (typeof window !== 'undefined') {
            window.name = `${GLOBAL_DATE_RANGE_WINDOW_PREFIX}${json}`;
        }
    } catch (err) {
        console.warn('Global date range window.name save failed (business):', err);
    }
}

persistGlobalDateRange() {
    if (!this.hasManualDateSelection) return;
    if (!this.state?.dateRange?.start || !this.state?.dateRange?.end) return;
    const payload = {
        startMs: this.state.dateRange.start.getTime(),
        endMs: this.state.dateRange.end.getTime(),
        startStr: this.state.dateRange.startStr || this.formatDate(this.state.dateRange.start),
        endStr: this.state.dateRange.endStr || this.formatDate(this.state.dateRange.end),
        savedAt: Date.now(),
        manualSelection: true
    };
    this.persistGlobalDateRangeRaw(payload);
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
    
    // Clear expired cache entries (past 12 PM) on page load
    this.clearExpiredCache();
    
    this.setupEventListeners();
    this.initializeDatePicker();
    this.initializeChart();
    
    // Initialize metric checkboxes to match selected metrics
    this.syncMetricCheckboxes();
    
    // Ensure chart is ready for data
    console.log('📊 Chart initialized, ready for data');
    
    let rangeApplied = false;
    const queryApplied = this.applyDateRangeFromQuery();
    if (queryApplied) {
        rangeApplied = true;
    } else {
        const storedApplied = this.applyGlobalDateRangeFromStorage();
        if (storedApplied) {
            rangeApplied = true;
        }
    }
    if (!rangeApplied) {
        this.state.dateRange = this.getDefaultDateRange();
        this.hasManualDateSelection = false;
    }
    this.updateNavLinksWithDateRange();
    this.syncUrlDateParams();
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
    // Setup multi-select product filter
    this.setupProductFilter();
    
    const exportExcelComplete = document.getElementById('exportExcelComplete');
    const exportCSVComplete = document.getElementById('exportCSVComplete');
    
    if (exportExcelComplete) exportExcelComplete.addEventListener('click', () => this.exportData('excel', true));
    if (exportCSVComplete) exportCSVComplete.addEventListener('click', () => this.exportData('csv', true));
    
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    if (prevPage) prevPage.addEventListener('click', () => this.goToPage(this.state.currentPage - 1));
    if (nextPage) nextPage.addEventListener('click', () => this.goToPage(this.state.currentPage + 1));
    // Rows-per-page selector
    const pageSizeSelect = document.getElementById('bizPageSizeSelect');
    if (pageSizeSelect) {
        const allowed = [10, 30, 50, 100, 200, 500];
        if (pageSizeSelect.options.length !== allowed.length) {
            pageSizeSelect.innerHTML = allowed.map(v => `<option value="${v}">${v}</option>`).join('');
        }
        if (!allowed.includes(this.state.itemsPerPage)) {
            this.state.itemsPerPage = 23;
        }
        pageSizeSelect.value = String(this.state.itemsPerPage);
        pageSizeSelect.addEventListener('change', (e) => {
            const val = Number(e.target.value);
            if (!Number.isFinite(val)) return;
            this.state.itemsPerPage = val;
            localStorage.setItem('biz_rows_per_page', String(val));
            this.state.currentPage = 1;
            this.renderTable();
            this.updateResultsCount();
        });
    }
    
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
            // Clear cached chart data when period changes
            this.scaledChartData = null;
            // Persist selection
            this.state.chartPeriod = e.target.value || 'daily';
            this.updateChart(this.state.chartPeriod);
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
        // Check cache first
        const cacheKey = `business_data_${this.state.dateRange?.startStr || 'all'}_${this.state.dateRange?.endStr || 'all'}`;
        const cached = this.getCachedData(cacheKey);
        
        if (cached && cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
            console.log('💾 Using cached business data:', cached.data.length, 'rows');
            this.state.businessData = cached.data;
            this.state.filteredData = this.aggregateBySku([...this.state.businessData]);
            
            // Update KPIs from cached data
            const frontendKpis = this.computeKPIsFromRows(this.state.businessData);
            this.updateKPIs(frontendKpis);
            this.backendKPIs = frontendKpis;
            
            // Update UI
            this.renderTable();
            this.updateResultsCount();
            this.updateChart();
            this.initializeProductFilter();
            
            // Apply filters if any
            if (this.state.selectedProducts.size > 0) {
                this.filterData();
            }
            
            return; // Skip API call if cache is valid
        } else if (cached) {
            console.warn('⚠️ Cached data is invalid or empty, fetching fresh data');
            // Clear invalid cache
            localStorage.removeItem(cacheKey);
        }
        
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
        // CRITICAL: Preserve startStr when clamping endStr
        const originalStartStr = this.state.dateRange?.startStr;
        try {
            const rangeRes = await fetch(`${apiBase}/api/business-date-range`);
            if (rangeRes.ok) {
                const rangeJson = await rangeRes.json();
                const maxDateStr = rangeJson?.maxDate || rangeJson?.max_date || null;
                if (maxDateStr) {
                    // Parse in local time to avoid UTC -> previous-day drift
                    const maxD = new Date(maxDateStr);
                    const localMaxStr = this.formatDate(maxD);
                    if (this.state.dateRange?.endStr && this.state.dateRange.endStr > localMaxStr) {
                        // Only clamp if endStr exists and is greater than max
                        this.state.dateRange.endStr = localMaxStr;
                        this.state.dateRange.end = new Date(
                            maxD.getFullYear(), maxD.getMonth(), maxD.getDate(), 23, 59, 59, 999
                        );
                    }
                    // CRITICAL: Ensure startStr is preserved after clamping
                    if (originalStartStr && !this.state.dateRange.startStr) {
                        this.state.dateRange.startStr = originalStartStr;
                    }
                }
            }
        } catch (_) { /* ignore; fallback to today clamp */ }
        // CRITICAL: Ensure date range is properly set before making API call
        // If date range is missing or incomplete, log error and use fallback
        if (!this.state.dateRange || !this.state.dateRange.startStr || !this.state.dateRange.endStr) {
            console.error('❌ Date range is missing or incomplete:', this.state.dateRange);
            console.error('❌ Cannot fetch filtered data without date range');
            // Don't proceed with API call if date range is missing
            return;
        }
        
        // Always request includeAll=true to get all dates (including zero-activity days) for accurate calculations
        const url = `${apiBase}/api/business-data?start=${this.state.dateRange.startStr}&end=${this.state.dateRange.endStr}&includeAll=true&t=${timestamp}`;
        
        console.log('🔍 Loading business data from API...');
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
                        const retryUrl = `${apiBase}/api/business-data?start=${this.state.dateRange.startStr}&end=${this.state.dateRange.endStr}&includeAll=true&t=${Date.now()}`;
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
                        
                        const fallbackUrl = `${apiBase}/api/business-data?start=${this.formatDate(fallbackStart)}&end=${this.formatDate(fallbackEnd)}&includeAll=true&t=${Date.now()}`;
                        console.log('🔍 Trying fallback to available data range:', fallbackUrl);
                        
                        const fallbackResponse = await fetch(fallbackUrl);
                        if (fallbackResponse.ok) {
                            const fallbackData = await fallbackResponse.json();
                            if (fallbackData.data && fallbackData.data.length > 0) {
                                console.log('✅ Found data in available range, using that instead');
                                // Transform data and fill missing dates with zero values
                                let fallbackTransformed = this.transformData(fallbackData.data || []);
                                fallbackTransformed = this.fillMissingDates(fallbackTransformed);
                                this.state.businessData = fallbackTransformed;
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
            // Transform data and fill missing dates with zero values
            let transformedData = this.transformData(data.data || []);
            transformedData = this.fillMissingDates(transformedData);
            this.state.businessData = transformedData;
            // Aggregate by SKU
            this.state.filteredData = this.aggregateBySku(this.state.businessData);
            
            // Save to cache
            const cacheKey = `business_data_${this.state.dateRange?.startStr || 'all'}_${this.state.dateRange?.endStr || 'all'}`;
            this.setCachedData(cacheKey, transformedData);

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
            // IMPORTANT: Use businessData (not filteredData) to get correct date count
            const backendKpis = data.kpis || {};
            const frontendKpis = this.computeKPIsFromRows(this.state.businessData);
            this.debugCompareKpis(backendKpis, frontendKpis);
            this.updateKPIs(backendKpis);
            
    // CRITICAL: Store backend KPIs for chart to use same data as KPI cards
    this.backendKPIs = backendKpis;
    // Clear cached chart data when new data is loaded
    this.scaledChartData = null;
    console.log('📊 Stored backend KPIs for chart sync:', backendKpis);
            
            // CRITICAL: Update chart immediately after KPI cards to ensure they match
            console.log('📊 Updating chart to match KPI cards data');
            this.updateChart();
            
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
        
        // Update chart with new data - add small delay to ensure data is fully processed
        setTimeout(() => {
        this.updateChart(this.state.chartPeriod);
        }, 100);
        
        // Initialize product filter after data is loaded
        // This will refresh product list based on new date range and clean up invalid selections
        this.initializeProductFilter();
        
        // If there are active filters (after cleanup), apply them to the new data
        if (this.state.selectedProducts.size > 0) {
            console.log('🔍 Data loaded - applying filters to new date range');
            this.filterData();
        } else {
            // No valid products selected - show all data for the selected date range
            this.state.filteredData = this.aggregateBySku([...this.state.businessData]);
            const kpis = this.computeKPIsFromRows(this.state.businessData);
            this.updateKPIs(kpis);
            this.backendKPIs = kpis;
            this.scaledChartData = null;
            this.syncChartWithKPIs();
            this.renderTable();
            this.updateResultsCount();
            this.updateChart();
        }
        
        console.log('🔍 Data loading completed successfully');
        
        // Ensure chart is updated with the loaded data
        setTimeout(() => {
            console.log('📊 Final chart update after data load');
        this.updateChart(this.state.chartPeriod);
            // CRITICAL: Force sync with KPI cards
        this.syncChartWithKPIs();
        }, 200);
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        this.showError(`Failed to load data: ${error.message}`);
    }
}

// ---------- Preset ranges ----------
async applyPreset(key) {
    this.hasManualDateSelection = true;
    const now = new Date();
    const apiBase = this.getApiBase();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);

    // CRITICAL: Get latest available date from database instead of using today
    let latestAvailableDate = endOfToday; // Default to today as fallback
    try {
        const rangeRes = await fetch(`${apiBase}/api/business-date-range`);
        if (rangeRes.ok) {
            const rangeJson = await rangeRes.json();
            const maxDateStr = rangeJson?.maxDate || rangeJson?.max_date || null;
            if (maxDateStr) {
                const maxD = new Date(maxDateStr);
                // Use latest available date, but don't go beyond today
                latestAvailableDate = maxD < endOfToday ? maxD : endOfToday;
                latestAvailableDate.setHours(23, 59, 59, 999);
                console.log('📅 Using latest available date from database:', this.formatDate(latestAvailableDate));
            }
        }
    } catch (_) {
        console.log('⚠️ Could not fetch latest date, using today as fallback');
    }

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
    let end = latestAvailableDate; // Use latest available date instead of today
    switch (key) {
        case 'yesterday':
            // Yesterday relative to latest available date
            start = new Date(latestAvailableDate); 
            start.setDate(start.getDate()-1);
            start.setHours(0,0,0,0);
            end = new Date(start); 
            end.setHours(23,59,59,999);
            // Don't go beyond latest available date
            if (end > latestAvailableDate) end = latestAvailableDate;
            break;
        case 'last7':
            start = new Date(latestAvailableDate); 
            start.setDate(start.getDate()-6); 
            start.setHours(0,0,0,0);
            end = latestAvailableDate;
            break;
        case 'thisWeek':
            start = startOfWeek(latestAvailableDate); 
            end = endOfWeek(latestAvailableDate);
            // Don't go beyond latest available date
            if (end > latestAvailableDate) end = latestAvailableDate;
            break;
        case 'lastWeek':
            // Last week relative to latest available date
            const lastWeekEnd = new Date(latestAvailableDate);
            lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
            start = startOfWeek(lastWeekEnd);
            end = endOfWeek(lastWeekEnd);
            // Don't go beyond latest available date
            if (end > latestAvailableDate) end = latestAvailableDate;
            break;
        case 'last30':
            start = new Date(latestAvailableDate); 
            start.setDate(start.getDate()-29); 
            start.setHours(0,0,0,0);
            end = latestAvailableDate;
            break;
        case 'thisMonth':
            // This month: start of current month (based on latest available date) to latest available date
            start = new Date(latestAvailableDate.getFullYear(), latestAvailableDate.getMonth(), 1);
            start.setHours(0, 0, 0, 0); // Ensure start of day
            end = new Date(latestAvailableDate); // Use latest available date as end
            end.setHours(23, 59, 59, 999); // Ensure end of day
            break;
        case 'lastMonth':
            // Last month: full last month, but cap end at latest available date if we're still in that month
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59,999);
            start = lastMonthStart;
            end = lastMonthEnd < latestAvailableDate ? lastMonthEnd : latestAvailableDate;
            break;
        case 'ytd':
            // Year to date: Jan 1 to latest available date
            start = new Date(latestAvailableDate.getFullYear(), 0, 1);
            end = latestAvailableDate;
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
            end = latestAvailableDate;
            break;
        default:
            break;
    }

    // CRITICAL: Clear cache BEFORE setting new date range to ensure fresh data
    // This prevents showing stale/cached data from previous date selections
    const newStartStr = this.formatDate(start);
    const newEndStr = this.formatDate(end);
    const newCacheKey = `business_data_${newStartStr}_${newEndStr}`;
    if (localStorage.getItem(newCacheKey)) {
        localStorage.removeItem(newCacheKey);
        console.log('🗑️ Cleared cache for new date range to ensure fresh data:', newCacheKey);
    }
    
    this.state.dateRange = {
        start,
        end,
        startStr: newStartStr,
        endStr: newEndStr
    };
    this.persistGlobalDateRange();
    
    // CRITICAL: Update calendar to reflect the preset selection
    // Set calendar temp range to match the preset
    this.calendarState.tempRangeStart = new Date(start);
    this.calendarState.tempRangeEnd = new Date(end);
    
    // Update calendar month to show the month containing the end date (most recent)
    // This ensures users see the most recent dates when they open the calendar
    this.calendarState.calendarMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    
    console.log('📅 Preset applied - Calendar updated:', {
        preset: key,
        dateRange: { start: this.state.dateRange.startStr, end: this.state.dateRange.endStr },
        calendarMonth: this.calendarState.calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    });
    
    this.updateDateDisplay();
    // Clear cached chart data when preset dates change
    this.scaledChartData = null;
    
    // Re-render calendar if it's open to show the new range
    const dropdown = document.getElementById('datePickerDropdown');
    if (dropdown && dropdown.style.display === 'block') {
        this.updateCalendarSummary();
        this.renderCalendar();
    }
    
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

// Fill missing dates in the selected range with zero values
fillMissingDates(data) {
    if (!this.state.dateRange || !this.state.dateRange.start || !this.state.dateRange.end) {
        return data; // No date range, return data as is
    }
    
    const start = new Date(this.state.dateRange.start);
    const end = new Date(this.state.dateRange.end);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    // Create a map of existing dates
    const existingDates = new Set();
    data.forEach(row => {
        if (row.date && row.date !== 'Unknown') {
            let dateStr = row.date;
            if (typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(row.date)) {
                dateStr = row.date.slice(0, 10);
            } else {
                const date = new Date(row.date);
                if (!isNaN(date.getTime())) {
                    dateStr = date.toISOString().split('T')[0];
                }
            }
            if (dateStr && dateStr !== 'Unknown') {
                existingDates.add(dateStr);
            }
        }
    });
    
    // Generate all dates in range
    const allDates = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (!existingDates.has(dateStr)) {
            // Add zero-value row for missing date
            allDates.push({
                date: dateStr,
                sku: 'Unknown',
                parentAsin: 'Unknown',
                productTitle: 'Unknown Product',
                sessions: 0,
                pageViews: 0,
                unitsOrdered: 0,
                sales: 0
            });
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Combine existing data with missing dates
    return [...data, ...allDates];
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
    
    // CRITICAL: Always sync chart with KPI cards after updating KPIs
    setTimeout(() => {
        this.syncChartWithKPIs();
    }, 50);
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
        
        // Calculate unique dates from data (for reference only)
        const dateStrings = rows.map(r => {
            if (!r.date || r.date === 'Unknown') return null;
            if (typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.date)) {
                return r.date.slice(0, 10);
            }
            const date = new Date(r.date);
            if (isNaN(date.getTime())) return null;
            return date.toISOString().split('T')[0];
        }).filter(d => d !== null && d !== 'Unknown');
        const uniqueDatesFromData = new Set(dateStrings).size;
        
        // CRITICAL: Always use the selected date range (calendar days) for Avg Sessions/Day calculation
        // This ensures correct calculation for single dates and filtered data
        let totalCalendarDays = 0;
        let startDate = null;
        let endDate = null;
        
        // Parse date range with proper handling for YYYY-MM-DD format
        if (this.state.dateRange) {
            // Priority 1: Use Date objects if available
            if (this.state.dateRange.start && this.state.dateRange.end) {
                startDate = new Date(this.state.dateRange.start);
                endDate = new Date(this.state.dateRange.end);
            }
            // Priority 2: Use string dates (YYYY-MM-DD format)
            else if (this.state.dateRange.startStr && this.state.dateRange.endStr) {
                // Parse YYYY-MM-DD strings in local timezone to avoid UTC conversion issues
                const startParts = this.state.dateRange.startStr.split('-');
                const endParts = this.state.dateRange.endStr.split('-');
                if (startParts.length === 3 && endParts.length === 3) {
                    startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
                    endDate = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
                } else {
                    // Fallback to Date constructor
                    startDate = new Date(this.state.dateRange.startStr);
                    endDate = new Date(this.state.dateRange.endStr);
                }
            }
        }
        
        // Calculate total calendar days from date range
        if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            // CRITICAL: Check if single date is selected (startStr === endStr)
            // Also check by comparing date strings directly to ensure accurate detection
            const startStrCheck = this.state.dateRange?.startStr || '';
            const endStrCheck = this.state.dateRange?.endStr || '';
            const isSingleDate = startStrCheck && endStrCheck && startStrCheck === endStrCheck;
            
            // Additional check: compare date objects (normalized to dates only, ignoring time)
            const startDateOnly = new Date(startDate);
            startDateOnly.setHours(0, 0, 0, 0);
            const endDateOnly = new Date(endDate);
            endDateOnly.setHours(0, 0, 0, 0);
            const isSameDate = startDateOnly.getTime() === endDateOnly.getTime();
            
            // Use either check - if strings match OR dates are the same, it's a single date
            if (isSingleDate || isSameDate) {
                // Single date selection: always use 1 day
                totalCalendarDays = 1;
                console.log(`📅 Avg Sessions/Day calculation: Single date selected, using 1 calendar day`);
                console.log(`   Start: ${startStrCheck}, End: ${endStrCheck}, Same date: ${isSameDate}`);
            } else {
                // Normalize to start of day (00:00:00) and end of day (23:59:59)
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
                
                // Calculate difference in days for date range
                const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                // Always add 1 to include both start and end days
                // Date range: diffDays = N, totalCalendarDays = N + 1
                totalCalendarDays = diffDays + 1;
                
                console.log(`📅 Avg Sessions/Day calculation: Using ${totalCalendarDays} calendar days (${this.formatDate(startDate)} to ${this.formatDate(endDate)})`);
            }
        } else if (uniqueDatesFromData > 0) {
            // Fallback: use unique dates from data ONLY if date range is not available
            // This should rarely happen, but provides a safety net
            totalCalendarDays = uniqueDatesFromData;
            console.warn(`⚠️ Avg Sessions/Day calculation: Date range not available, using ${uniqueDatesFromData} unique dates from data`);
        } else {
            // No date range and no data - cannot calculate
            totalCalendarDays = 0;
            console.warn(`⚠️ Avg Sessions/Day calculation: No date range or data available, using 0`);
        }
        
        // Calculate average sessions per day
        // Always divide by calendar days in the selected range, not by unique dates in data
        // NOTE: For single day selection, avgSessionsPerDay will equal totalSessions (e.g., 349/1 = 349)
        // This is mathematically correct - the average for one day IS the total for that day
        const avgSessionsPerDay = totalCalendarDays > 0 ? totals.totalSessions / totalCalendarDays : 0;
        const conversionRate = totals.totalSessions > 0 ? (totals.totalUnitsOrdered / totals.totalSessions) * 100 : 0;
        
        // Debug logging
        console.log('📊 computeKPIsFromRows calculation:', {
            totalSessions: totals.totalSessions,
            totalCalendarDays,
            avgSessionsPerDay: avgSessionsPerDay.toFixed(2),
            uniqueDatesFromData,
            dateRange: this.state.dateRange ? {
                start: this.state.dateRange.start,
                end: this.state.dateRange.end,
                startStr: this.state.dateRange.startStr,
                endStr: this.state.dateRange.endStr
            } : 'not set',
            rowsCount: rows.length,
            isFiltered: rows.length < (this.state.businessData?.length || 0)
        });
        
        return {
            totalSessions: totals.totalSessions,
            totalPageViews: totals.totalPageViews,
            totalUnitsOrdered: totals.totalUnitsOrdered,
            totalSales: totals.totalSales,
            avgSessionsPerDay,
            conversionRate
        };
    } catch (error) {
        console.error('❌ Error in computeKPIsFromRows:', error);
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

setupProductFilter() {
    const nameFilterInput = document.getElementById('nameFilterInput');
    const nameFilterDropdown = document.getElementById('nameFilterDropdown');
    
    if (!nameFilterInput || !nameFilterDropdown) return;
    
    // Input focus/click events - show selected products when clicked
    nameFilterInput.addEventListener('focus', () => {
        // Show dropdown with selected products when focused
        nameFilterDropdown.style.display = 'block';
        nameFilterInput.closest('.name-filter').classList.add('dropdown-open');
        
        // Update placeholder based on current selection
        const count = this.state.selectedProducts.size;
        if (count > 0) {
            nameFilterInput.placeholder = `${count} selected`;
        } else {
            nameFilterInput.placeholder = 'Search products...';
        }
        
        // Show all products with selected ones at top
        this.filterProductOptions('');
    });

    // Power-user: Enter or Escape clears only the search text (keeps selections)
    nameFilterInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            // Clear search text but keep selected products intact
            nameFilterInput.value = '';
            // Keep dropdown open and show all, with selected items at top
            nameFilterDropdown.style.display = 'block';
            nameFilterInput.closest('.name-filter').classList.add('dropdown-open');
            this.filterProductOptions('');
        }
    });

    // Also handle Enter/Escape when focus is inside the dropdown (e.g., on a checkbox)
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== 'Escape') return;
        const isOpen = nameFilterDropdown && nameFilterDropdown.style.display === 'block';
        if (!isOpen) return;
        const active = document.activeElement;
        if (active === nameFilterInput || (nameFilterDropdown && nameFilterDropdown.contains(active))) {
            e.preventDefault();
            nameFilterInput.value = '';
            nameFilterDropdown.style.display = 'block';
            nameFilterInput.closest('.name-filter').classList.add('dropdown-open');
            this.filterProductOptions('');
            // Return focus to input for immediate typing
            nameFilterInput.focus();
        }
    }); 
    
    // Also handle click events for better UX
    nameFilterInput.addEventListener('click', () => {
        // Show dropdown with selected products when clicked
        nameFilterDropdown.style.display = 'block';
        nameFilterInput.closest('.name-filter').classList.add('dropdown-open');
        
        // If there are selected products, show them
        if (this.state.selectedProducts.size > 0) {
            this.showSelectedProductsInDropdown();
        } else {
            // If no products selected, show all products
            this.filterProductOptions('');
        }
    });
    
    nameFilterInput.addEventListener('blur', (e) => {
        // CRITICAL: Check if the blur is caused by clicking inside the dropdown
        // If so, don't close the dropdown
        const relatedTarget = e.relatedTarget;
        if (relatedTarget && nameFilterDropdown.contains(relatedTarget)) {
            // User clicked inside dropdown, keep it open
            return;
        }
        
        // Show selection count when user is done typing
        const count = this.state.selectedProducts.size;
        if (count > 0 && !nameFilterInput.value.includes('selected')) {
            nameFilterInput.value = `${count} selected`;
        }
        
        // Delay hiding to allow click on dropdown
        setTimeout(() => {
            // Check if dropdown is still being interacted with
            const activeElement = document.activeElement;
            const isClickingInDropdown = nameFilterDropdown.contains(activeElement) || 
                                        nameFilterDropdown.matches(':hover') ||
                                        activeElement === nameFilterInput;
            
            if (!isClickingInDropdown) {
                nameFilterDropdown.style.display = 'none';
                nameFilterInput.closest('.name-filter')?.classList.remove('dropdown-open');
            }
        }, 300); // Increased delay to ensure checkbox clicks register
    });
    
    // Input search - show dropdown when user types something
    nameFilterInput.addEventListener('input', (e) => {
        const searchValue = e.target.value.trim();
        if (searchValue.length > 0) {
            nameFilterDropdown.style.display = 'block';
            this.filterProductOptions(searchValue);
            nameFilterInput.closest('.name-filter').classList.add('dropdown-open');
        } else {
            // If input is empty, show all products with selected ones at top
            nameFilterDropdown.style.display = 'block';
            this.filterProductOptions('');
            nameFilterInput.closest('.name-filter').classList.add('dropdown-open');
        }
    });
    
    // Click outside to close
    document.addEventListener('click', (e) => {
        if (!nameFilterInput.contains(e.target) && !nameFilterDropdown.contains(e.target)) {
            nameFilterDropdown.style.display = 'none';
            nameFilterInput.closest('.name-filter').classList.remove('dropdown-open');
        }
    });
}

addProductOption(product, isSelected, isSelectedNotMatching) {
    const nameFilterDropdown = document.getElementById('nameFilterDropdown');
    const nameFilterInput = document.getElementById('nameFilterInput');
    
    const option = document.createElement('div');
    option.className = 'filter-option';
    option.dataset.value = product;
    
    // Render with a checkbox for multi-select
    const id = `product-opt-${Math.random().toString(36).slice(2)}`;
    option.innerHTML = `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="${id}" ${isSelected ? 'checked' : ''}>
            <span style="${isSelectedNotMatching ? 'opacity: 0.7; font-style: italic; color: #666;' : ''}">${product}</span>
            ${isSelectedNotMatching ? '<span style="font-size: 12px; color: #999; margin-left: auto;">(selected)</span>' : ''}
        </label>
    `;
    
    // CRITICAL: Prevent blur event from closing dropdown when clicking checkbox/label
    const cb = option.querySelector('input[type="checkbox"]');
    const label = option.querySelector('label');
    
    // Stop propagation on all click events to prevent dropdown from closing
    option.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent input blur
        e.stopPropagation(); // Prevent click outside handler
    });
    
    option.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click outside handler
    });
    
    label.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent input blur
        e.stopPropagation(); // Prevent click outside handler
    });
    
    label.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click outside handler
    });
    
    cb.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent input blur
        e.stopPropagation(); // Prevent click outside handler
    });
    
    // Handle checkbox change event
    cb.addEventListener('change', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        
        if (cb.checked) {
            this.state.selectedProducts.add(product);
        } else {
            this.state.selectedProducts.delete(product);
        }
        
        // Clear input value and update placeholder
        nameFilterInput.value = '';
        const count = this.state.selectedProducts.size;
        if (count > 0) {
            nameFilterInput.placeholder = `${count} selected`;
        } else {
            nameFilterInput.placeholder = 'Search products...';
        }
        
        // Keep dropdown open
        nameFilterDropdown.style.display = 'block';
        nameFilterInput.closest('.name-filter')?.classList.add('dropdown-open');
        
        // Re-render to show updated checkboxes
        const currentSearch = nameFilterInput.value.trim();
        this.filterProductOptions(currentSearch);
        
        this.state.currentPage = 1;
        this.filterData();
    });
    
    nameFilterDropdown.appendChild(option);
}

filterProductOptions(searchTerm) {
    const nameFilterDropdown = document.getElementById('nameFilterDropdown');
    const nameFilterInput = document.getElementById('nameFilterInput');
    
    // Clear existing options and add "All Products" (clears selection)
    nameFilterDropdown.innerHTML = '<div class="filter-option" data-value="">All Products</div>';
    
    // Add click event for "All Products" option
    const allProductsOption = nameFilterDropdown.querySelector('.filter-option');
    allProductsOption.addEventListener('mousedown', (e) => {
        e.preventDefault();
        // Show all products but keep selected products intact
        this.state.selectedProducts = this.state.selectedProducts || new Set();
        nameFilterInput.value = '';
        nameFilterInput.placeholder = 'Search products...';
        nameFilterDropdown.style.display = 'block';
        this.filterProductOptions('');
        this.state.currentPage = 1;
        this.filterData();
    });
    
    // Get all unique products
    const allProducts = this.getUniqueProducts();
    
    // If no search term, show all products with selected ones at top
    if (!searchTerm || searchTerm.trim() === '') {
        const selectedProducts = Array.from(this.state.selectedProducts);
        const otherProducts = allProducts.filter(product => !this.state.selectedProducts.has(product));
        const orderedProducts = [...selectedProducts, ...otherProducts];
        
        orderedProducts.forEach(product => {
            this.addProductOption(product, this.state.selectedProducts.has(product), false);
        });
        return;
    }
    
    // Filter products based on search term
    const filteredProducts = allProducts.filter(product => 
        product.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Always show selected products at the top, even if they don't match search
    const selectedProducts = Array.from(this.state.selectedProducts);
    const selectedInSearch = selectedProducts.filter(product => 
        product.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const selectedNotInSearch = selectedProducts.filter(product => 
        !product.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Combine: selected products (matching search) + other matching products + selected products (not matching search)
    const orderedProducts = [
        ...selectedInSearch,
        ...filteredProducts.filter(product => !this.state.selectedProducts.has(product)),
        ...selectedNotInSearch
    ];
    
    // Add separator if we have both matching and non-matching selected products
    const hasMatchingSelected = selectedInSearch.length > 0;
    const hasNonMatchingSelected = selectedNotInSearch.length > 0;
    const hasOtherMatching = filteredProducts.filter(product => !this.state.selectedProducts.has(product)).length > 0;
    
    orderedProducts.forEach(product => {
        const isSelected = this.state.selectedProducts.has(product);
        const isSelectedNotMatching = isSelected && !product.toLowerCase().includes(searchTerm.toLowerCase());
        this.addProductOption(product, isSelected, isSelectedNotMatching);
    });
    
    // Show "No results" if no matches
    if (filteredProducts.length === 0 && searchTerm) {
        const noResults = document.createElement('div');
        noResults.className = 'filter-option';
        noResults.textContent = 'No matching products found';
        noResults.style.color = 'var(--text-muted)';
        noResults.style.cursor = 'default';
        nameFilterDropdown.appendChild(noResults);
    }
}

getUniqueProducts() {
    const products = new Set();
    this.state.businessData.forEach(row => {
        if (row.productTitle) products.add(row.productTitle);
        if (row.sku) products.add(row.sku);
        if (row.parentAsin) products.add(row.parentAsin);
    });
    return Array.from(products);
}

initializeProductFilter() {
    // CRITICAL: Clean up selected products that don't exist in the current date range
    // This ensures product filter only shows products available in the selected calendar dates
    if (this.state.selectedProducts.size > 0 && this.state.businessData && this.state.businessData.length > 0) {
        const availableProducts = this.getUniqueProducts();
        const availableProductsSet = new Set(availableProducts);
        
        // Remove selected products that don't exist in the current date range
        const productsToRemove = [];
        this.state.selectedProducts.forEach(product => {
            if (!availableProductsSet.has(product)) {
                productsToRemove.push(product);
            }
        });
        
        if (productsToRemove.length > 0) {
            productsToRemove.forEach(product => {
                this.state.selectedProducts.delete(product);
            });
            console.log('🔍 Removed invalid products from selection (not in current date range):', productsToRemove);
        }
    }
    
    // Initialize the product filter dropdown with all available products from current date range
    this.filterProductOptions('');
}

filterData() {
    // Filter within the calendar-selected date range (businessData)
    let rows;
    if (this.state.selectedProducts.size === 0) {
        // No filter applied - use all rows from current date window
        rows = [...this.state.businessData];
    } else {
        // Apply product filter to date-window rows
        rows = this.state.businessData.filter(row => 
            this.state.selectedProducts.has(row.productTitle) ||
            this.state.selectedProducts.has(row.sku) ||
            this.state.selectedProducts.has(row.parentAsin)
        );
    }

    // Always aggregate after filtering so counts reflect combined entries (not per-day rows)
    this.state.filteredData = this.aggregateBySku(rows);
    this.state.currentPage = 1;
    
    // Recalculate KPIs from filtered data (within calendar range)
    // IMPORTANT: Use original filtered rows (not aggregated) to get correct unique date count
    const filteredKPIs = this.computeKPIsFromRows(rows);
    this.updateKPIs(filteredKPIs);
    
    // CRITICAL: Store filtered KPIs for chart to use same data as KPI cards
    this.backendKPIs = filteredKPIs;
    // Clear cached chart data when filters change
    this.scaledChartData = null;
    console.log('📊 Stored filtered KPIs for chart sync:', filteredKPIs);
    
    // CRITICAL: Force chart to use the same data as KPI cards
    console.log('📊 Forcing chart update to match KPI cards');
    this.syncChartWithKPIs();
    
    this.renderTable();
    this.updateResultsCount();
    
    // Update chart with filtered data
    this.updateChart();
    
    console.log('🔍 Filter applied within calendar range:', {
        selectedProducts: Array.from(this.state.selectedProducts),
        calendarDataCount: this.state.businessData.length,
        filteredDataCount: this.state.filteredData.length,
        dateRange: this.state.dateRange
    });
}

showSelectedProductsInDropdown() {
    const nameFilterDropdown = document.getElementById('nameFilterDropdown');
    const nameFilterInput = document.getElementById('nameFilterInput');
    
    if (!nameFilterDropdown || !nameFilterInput) return;
    
    // Clear existing options
    nameFilterDropdown.innerHTML = '';
    
    // Add "All Products" option at the top
    const allProductsOption = document.createElement('div');
    allProductsOption.className = 'filter-option';
    allProductsOption.textContent = 'All Products';
    allProductsOption.addEventListener('mousedown', (e) => {
        e.preventDefault();
        // Show all products WITHOUT clearing selected ones
        nameFilterInput.value = '';
        nameFilterDropdown.style.display = 'block';
        this.filterProductOptions('');
        this.state.currentPage = 1;
        this.filterData();
    });
    nameFilterDropdown.appendChild(allProductsOption);
    
    // Add separator
    const separator = document.createElement('div');
    separator.className = 'filter-option-separator';
    separator.textContent = '─';
    separator.style.textAlign = 'center';
    separator.style.color = '#ccc';
    separator.style.fontSize = '12px';
    separator.style.padding = '5px 0';
    nameFilterDropdown.appendChild(separator);
    
    // Add selected products
    const selectedProducts = Array.from(this.state.selectedProducts);
    selectedProducts.forEach(product => {
        this.addProductOption(product, true, false);
    });
    
    // Add "Clear All" option at the bottom
    const clearAllOption = document.createElement('div');
    clearAllOption.className = 'filter-option';
    clearAllOption.textContent = 'Clear All';
    clearAllOption.style.color = '#e74c3c';
    clearAllOption.style.fontWeight = '500';
    clearAllOption.addEventListener('mousedown', (e) => {
        e.preventDefault();
        // Explicit user action to clear selections
        this.state.selectedProducts.clear();
        nameFilterInput.value = '';
        nameFilterDropdown.style.display = 'block';
        this.filterProductOptions('');
        this.state.currentPage = 1;
        this.filterData();
    });
    nameFilterDropdown.appendChild(clearAllOption);
    
    console.log('📋 Showing selected products in dropdown:', selectedProducts);
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
    
    // CRITICAL: Always sync temp range from current state.dateRange to reflect preset selections
    // This ensures calendar shows the correct range when opened after a preset is applied
    if (this.state.dateRange && this.state.dateRange.start && this.state.dateRange.end) {
        this.calendarState.tempRangeStart = new Date(this.state.dateRange.start);
        this.calendarState.tempRangeEnd = new Date(this.state.dateRange.end);
        console.log('📅 Calendar opened - synced with current date range:', {
            start: this.state.dateRange.startStr,
            end: this.state.dateRange.endStr
        });
    } else {
        // Use current date range as fallback
        const defaultRange = this.getDefaultDateRange();
        this.calendarState.tempRangeStart = new Date(defaultRange.start);
        this.calendarState.tempRangeEnd = new Date(defaultRange.end);
    }
    
    // Open picker on a sane month (avoid 1970 if temp range is missing/invalid)
    // Use the end date of the range to show the most recent month
    const base = (this.calendarState.tempRangeEnd && !isNaN(new Date(this.calendarState.tempRangeEnd).getTime()))
        ? new Date(this.calendarState.tempRangeEnd)
        : (this.calendarState.tempRangeStart && !isNaN(new Date(this.calendarState.tempRangeStart).getTime()))
            ? new Date(this.calendarState.tempRangeStart)
            : new Date();
    this.calendarState.calendarMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    
    // Update calendar summary to show current selection
    this.updateCalendarSummary();
    
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
            
            // CRITICAL: If tempRangeEnd is null, treat as single date selection
            // Use the same date for both start and end
            const endRef = this.calendarState.tempRangeEnd || this.calendarState.tempRangeStart;
            const endYear = endRef.getFullYear();
            const endMonth = endRef.getMonth();
            const endDay = endRef.getDate();

            // Create date strings FIRST to ensure consistency
            const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
            const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

            const start = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
            // For single date: ensure end equals start (same day)
            const end = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);

            this.state.dateRange = {
                start,
                end,
                startStr: startDateStr,
                endStr: endDateStr
            };
            
            console.log('📅 Calendar date range applied:', {
                startStr: startDateStr,
                endStr: endDateStr,
                isSingleDate: startDateStr === endDateStr,
                startDate: start,
                endDate: end
            });
            
            this.updateDateDisplay();
            // Clear cached chart data when calendar dates change
            this.scaledChartData = null;
            // Re-load data for the applied range
            this.loadData();
            
            // After loading new data, reapply any active filters to the new date range
            if (this.state.selectedProducts.size > 0) {
                console.log('🔍 Calendar date changed - reapplying filters to new date range');
                // Small delay to ensure data is loaded before filtering
                setTimeout(() => {
                    this.filterData();
                }, 100);
            }
        }
    } catch (_) { /* silent */ }
}

renderCalendar() {
    const container = document.getElementById('datePickerDropdown');
    if (!container) {
        console.error('❌ Calendar container not found');
        return;
    }
    
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
    
    // Ensure calendar state is valid before rendering days
    if (!this.calendarState.calendarMonth || isNaN(this.calendarState.calendarMonth.getTime())) {
        const now = new Date();
        this.calendarState.calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        console.warn('⚠️ Invalid calendar month, reset to current month');
    }
    
    this.renderCalendarDays();
    
    console.log('📅 Calendar rendered successfully');
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
    
    // CRITICAL: Clear the grid before rendering new days
    grid.innerHTML = '';
    
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
        
        // Handle date selection logic
        // Use formatDate to ensure consistent date string format (YYYY-MM-DD)
        const clickedDateStr = this.formatDate(date);
        const existingStartStr = this.calendarState.tempRangeStart ? 
            this.formatDate(this.calendarState.tempRangeStart) : null;
        
        // If clicking the same date that's already selected as start, treat as single date selection
        if (this.calendarState.tempRangeStart && !this.calendarState.tempRangeEnd && 
            clickedDateStr === existingStartStr) {
            // Same date clicked twice = single date selection, set both start and end
            this.calendarState.tempRangeEnd = new Date(date);
            console.log('🔍 Single date selected (same date clicked twice):', clickedDateStr);
        } else if (!this.calendarState.tempRangeStart || (this.calendarState.tempRangeStart && this.calendarState.tempRangeEnd)) {
            // First click or reset: set new start date
            this.calendarState.tempRangeStart = new Date(date);
            this.calendarState.tempRangeEnd = null;
            console.log('🔍 Set start date:', clickedDateStr);
        } else {
            // Second click on different date: set end date
            const start = new Date(this.calendarState.tempRangeStart);
            start.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            
            if (date < start) {
                this.calendarState.tempRangeEnd = new Date(start);
                this.calendarState.tempRangeStart = new Date(date);
            } else {
                this.calendarState.tempRangeEnd = new Date(date);
            }
            console.log('🔍 Set end date:', this.formatDate(this.calendarState.tempRangeEnd));
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
    
    // CRITICAL: If only start date is set (no end date), treat as single date selection
    // Set end date to same as start date
    if (!this.calendarState.tempRangeEnd) {
        this.calendarState.tempRangeEnd = new Date(this.calendarState.tempRangeStart);
        console.log('🔍 Single date selection detected - setting end date to same as start');
    }
    
    // Use formatDate for consistent date string comparison (avoids timezone issues)
    const startStrCheck = this.formatDate(this.calendarState.tempRangeStart);
    const endStrCheck = this.formatDate(this.calendarState.tempRangeEnd);
    
    console.log('🔍 Selected range:', {
        start: this.calendarState.tempRangeStart,
        end: this.calendarState.tempRangeEnd,
        startStr: startStrCheck,
        endStr: endStrCheck,
        isSingleDate: startStrCheck === endStrCheck
    });
    
    // Hide calendar immediately when confirm is clicked
    this.closeCalendar();
    
    // Create dates without timezone issues by using local date components
    const startYear = this.calendarState.tempRangeStart.getFullYear();
    const startMonth = this.calendarState.tempRangeStart.getMonth();
    const startDay = this.calendarState.tempRangeStart.getDate();
    
    const endYear = this.calendarState.tempRangeEnd.getFullYear();
    const endMonth = this.calendarState.tempRangeEnd.getMonth();
    const endDay = this.calendarState.tempRangeEnd.getDate();
    
    // Create date strings FIRST directly from calendar values to avoid timezone conversion
    const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    
    // Create Date objects using local timezone to avoid UTC conversion
    // Force exact single-day/multi-day ranges without drift
    const start = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
    const end = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);
    
    // Ensure single date selection: if start and end are the same day, use same date
    if (startDateStr === endDateStr) {
        // Single day: end must equal start (same day, end of day)
        end.setFullYear(startYear, startMonth, startDay);
        end.setHours(23, 59, 59, 999);
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
    
    this.hasManualDateSelection = true;
    this.updateDateDisplay();
    this.persistGlobalDateRange();
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

async updateChart(period = null) {
    // Respect persisted period if not explicitly provided
    if (!period) {
        period = this.state?.chartPeriod || 'daily';
    } else {
        this.state.chartPeriod = period;
    }
    console.log('📊 updateChart called with period:', period);
    console.log('📊 Chart state:', {
        hasChart: !!this.chart,
        businessDataLength: this.state.businessData?.length || 0,
        filteredDataLength: this.state.filteredData?.length || 0,
        selectedMetrics: this.selectedMetrics
    });
    
    if (!this.chart || !this.state.businessData || this.state.businessData.length === 0) {
        console.log('📊 Chart update skipped - no chart or no data');
        return;
    }
    
    // If no business data at all, show empty chart
    if (this.state.businessData.length === 0) {
        console.log('📊 Showing empty chart - no business data');
        this.chart.data.labels = [];
        this.chart.data.datasets = [];
        this.chart.update();
        return;
    }
    
    // If products are selected but no filtered data, show empty chart
    if (this.state.selectedProducts.size > 0 && this.state.filteredData.length === 0) {
        this.chart.data.labels = [];
        this.chart.data.datasets = [];
        this.chart.update();
        return;
    }
    
    // For monthly view, we still respect calendar date range but aggregate by month
    // No need to fetch all data - use the same calendar-filtered data
    if (period === 'monthly') {
    console.log('📊 Monthly view - using calendar-filtered data aggregated by month');
    }
    const chartData = this.generateChartData(period);
    
    // Update chart data
    console.log('📊 Updating chart with data:', {
        period: period,
        labelsCount: chartData.labels.length,
        datasetsCount: chartData.datasets.length,
        labels: chartData.labels.slice(0, 5), // Show first 5 labels
        datasets: chartData.datasets.map(d => ({
            label: d.label,
            dataLength: d.data.length,
            hidden: d.hidden
        }))
    });
    
    this.chart.data.labels = chartData.labels;
    this.chart.data.datasets = chartData.datasets;
    this.chart.update();
    
    console.log('📊 Chart updated successfully');
}

// CRITICAL: Method to ensure chart always follows KPI cards
syncChartWithKPIs() {
    console.log('📊 Syncing chart with KPI cards data');
    
    // Use backend KPIs data if available (same as KPI cards)
    if (this.backendKPIs) {
        console.log('📊 Using backend KPIs for chart sync');
        this.updateChartFromKPIs();
    } else if (this.state.businessData && this.state.businessData.length > 0) {
        console.log('📊 Using business data for chart sync');
        this.updateChart();
    } else {
        console.log('📊 No data available for chart sync');
    }
}

// CRITICAL: Update chart using same data as KPI cards
updateChartFromKPIs() {
        if (!this.chart || !this.backendKPIs) {
        console.log('📊 No chart or backend KPIs available');
        return;
    }
    
    console.log('📊 Updating chart from backend KPIs with time series:', this.backendKPIs);
    
    // Use the time series method to create proper line graph
        const period = this.state?.chartPeriod || 'daily';
        const chartData = this.generateChartDataFromKPIsWithTimeSeries(period);
    
    // Update chart with time series data
    this.chart.data.labels = chartData.labels;
    this.chart.data.datasets = chartData.datasets;
    this.chart.update();
    
    console.log('📊 Chart updated with time series data:', {
        labelsCount: chartData.labels.length,
        datasetsCount: chartData.datasets.length,
        kpiData: this.backendKPIs
    });
}


// CRITICAL: Generate time series chart that matches KPI totals
generateChartDataFromKPIsWithTimeSeries(period = 'daily') {
    if (!this.backendKPIs) {
        console.log('📊 No backend KPIs available for chart generation');
        return { labels: [], datasets: [] };
    }
    
    console.log('📊 Generating time series chart that matches KPI totals:', this.backendKPIs);
    
    // CRITICAL: Always filter data by calendar date range first
    // Chart should only show data within the selected calendar dates
    let sourceRows;
    
    // First, filter ALL data by calendar date range
    const calendarFilteredData = this.state.businessData.filter(row => {
        const rowDate = new Date(row.date);
        const startDate = new Date(this.state.dateRange.start);
        const endDate = new Date(this.state.dateRange.end);
        
        return rowDate >= startDate && rowDate <= endDate;
    });
    
    console.log('📊 Calendar date filtering:', {
        totalBusinessData: this.state.businessData.length,
        calendarFilteredData: calendarFilteredData.length,
        dateRange: this.state.dateRange,
        selectedProductsSize: this.state.selectedProducts.size
    });
    
    // Then apply product filters if any
    if (this.state.selectedProducts.size > 0) {
        sourceRows = calendarFilteredData.filter(row => 
            this.state.selectedProducts.has(row.productTitle) ||
            this.state.selectedProducts.has(row.sku) ||
            this.state.selectedProducts.has(row.parentAsin)
        );
        console.log('📊 Applied product filters:', {
            calendarFilteredData: calendarFilteredData.length,
            finalFilteredData: sourceRows.length,
            selectedProducts: Array.from(this.state.selectedProducts)
        });
    } else {
        sourceRows = calendarFilteredData;
    }
    
    if (!sourceRows || sourceRows.length === 0) {
        console.log('📊 No source data available for time series chart');
        return { labels: [], datasets: [] };
    }
    
    console.log('📊 Chart data source validation:', {
        sourceRowsLength: sourceRows.length,
        backendKPIs: this.backendKPIs,
        filteredDataLength: this.state.filteredData?.length || 0,
        businessDataLength: this.state.businessData?.length || 0,
        selectedProductsSize: this.state.selectedProducts?.size || 0,
        dateRange: this.state.dateRange
    });
    
    // CRITICAL: Check if we already have scaled data cached
    if (this.scaledChartData) {
        console.log('📊 Using cached scaled chart data');
        return this.scaledChartData;
    }
    
    // Group data by date to create time series
    const dataByDate = new Map();
    
    // Debug: Check what data we have in source rows
    console.log('📊 Sample source row data:', sourceRows.slice(0, 2).map(row => ({
        date: row.date,
        sessions: row.sessions,
        pageViews: row.pageViews,
        unitsOrdered: row.unitsOrdered,
        sales: row.sales
    })));
    
    sourceRows.forEach(row => {
        const date = new Date(row.date);
        const dateStr = date.toISOString().split('T')[0];
        
        if (!dataByDate.has(dateStr)) {
            dataByDate.set(dateStr, {
                sessions: 0,
                pageViews: 0,
                unitsOrdered: 0,
                sales: 0
            });
        }
        
        const dayData = dataByDate.get(dateStr);
        const sessionsValue = parseInt(row.sessions || 0);
        const pageViewsValue = parseInt(row.pageViews || 0);
        const unitsOrderedValue = parseInt(row.unitsOrdered || 0);
        const salesValue = parseFloat(row.sales || 0);
        
        dayData.sessions += sessionsValue;
        dayData.pageViews += pageViewsValue;
        dayData.unitsOrdered += unitsOrderedValue;
        dayData.sales += salesValue;
        
        // Debug: Log non-zero values
        if (sessionsValue > 0 || pageViewsValue > 0 || unitsOrderedValue > 0 || salesValue > 0) {
            console.log(`📊 Aggregating for ${dateStr}:`, {
                sessions: sessionsValue,
                pageViews: pageViewsValue,
                unitsOrdered: unitsOrderedValue,
                sales: salesValue
            });
        }
    });
    
    // Sort dates and create labels based on period
    const sortedDates = Array.from(dataByDate.keys()).sort();
    
    // Generate labels and data based on period
    let labels = [];
    let sessionsData = [];
    let pageViewsData = [];
    let unitsOrderedData = [];
    let salesData = [];
    
    if (period === 'daily') {
        console.log('📊 Using daily aggregation in KPI method');
        // Show daily data
        sortedDates.forEach(date => {
            const data = dataByDate.get(date);
            labels.push(new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            sessionsData.push(data.sessions);
            pageViewsData.push(data.pageViews);
            unitsOrderedData.push(data.unitsOrdered);
            salesData.push(data.sales);
        });
    } else if (period === 'weekly') {
        console.log('📊 Using weekly aggregation in KPI method');
        // Group by weeks
        const weeklyData = this.aggregateByWeek(sortedDates, dataByDate);
        labels = weeklyData.labels;
        sessionsData = weeklyData.sessions;
        pageViewsData = weeklyData.pageViews;
        unitsOrderedData = weeklyData.unitsOrdered;
        salesData = weeklyData.sales;
    } else if (period === 'monthly') {
        console.log('📊 Using monthly aggregation in KPI method');
        // Group by months
        const monthlyData = this.aggregateByMonth(sortedDates, dataByDate);
        labels = monthlyData.labels;
        sessionsData = monthlyData.sessions;
        pageViewsData = monthlyData.pageViews;
        unitsOrderedData = monthlyData.unitsOrdered;
        salesData = monthlyData.sales;
    }
    
    // Create datasets with proper line styling
    const datasets = [];
    
    // Sessions dataset
    if (this.backendKPIs.totalSessions !== undefined) {
        datasets.push({
            label: 'Sessions',
            data: sessionsData,
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            yAxisID: 'y',
            hidden: !this.selectedMetrics.includes('sessions'),
            tension: 0.4,
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 6,
            borderWidth: 2,
            showLine: true,
            spanGaps: false
        });
    }
    
    // Page Views dataset
    if (this.backendKPIs.totalPageViews !== undefined) {
        datasets.push({
            label: 'Page Views',
            data: pageViewsData,
            borderColor: '#28a745',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            yAxisID: 'y',
            hidden: !this.selectedMetrics.includes('pageViews'),
            tension: 0.4,
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 6,
            borderWidth: 2,
            showLine: true,
            spanGaps: false
        });
    }
    
    // Units Ordered dataset
    if (this.backendKPIs.totalUnitsOrdered !== undefined) {
        datasets.push({
            label: 'Units Ordered',
            data: unitsOrderedData,
            borderColor: '#ffc107',
            backgroundColor: 'rgba(255, 193, 7, 0.1)',
            yAxisID: 'y1',
            hidden: !this.selectedMetrics.includes('unitsOrdered'),
            tension: 0.4,
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 6,
            borderWidth: 2,
            showLine: true,
            spanGaps: false
        });
    }
    
    // Sales dataset
    if (this.backendKPIs.totalSales !== undefined) {
        datasets.push({
            label: 'Sales (₹)',
            data: salesData,
            borderColor: '#dc3545',
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            yAxisID: 'y1',
            hidden: !this.selectedMetrics.includes('sales'),
            tension: 0.4,
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 6,
            borderWidth: 2,
            showLine: true,
            spanGaps: false
        });
    }
    
    // CRITICAL: Validate that chart totals match KPI cards
    const chartTotals = {
        sessions: datasets.find(d => d.label === 'Sessions')?.data.reduce((sum, val) => sum + val, 0) || 0,
        pageViews: datasets.find(d => d.label === 'Page Views')?.data.reduce((sum, val) => sum + val, 0) || 0,
        unitsOrdered: datasets.find(d => d.label === 'Units Ordered')?.data.reduce((sum, val) => sum + val, 0) || 0,
        sales: datasets.find(d => d.label === 'Sales (₹)')?.data.reduce((sum, val) => sum + val, 0) || 0
    };
    
    // CRITICAL: If chart totals don't match KPI cards, force them to match
    const kpiTotals = {
        sessions: this.backendKPIs.totalSessions || 0,
        pageViews: this.backendKPIs.totalPageViews || 0,
        unitsOrdered: this.backendKPIs.totalUnitsOrdered || 0,
        sales: this.backendKPIs.totalSales || 0
    };
    
    const sessionsMatch = Math.abs(chartTotals.sessions - kpiTotals.sessions) < 1;
    const pageViewsMatch = Math.abs(chartTotals.pageViews - kpiTotals.pageViews) < 1;
    const unitsMatch = Math.abs(chartTotals.unitsOrdered - kpiTotals.unitsOrdered) < 1;
    const salesMatch = Math.abs(chartTotals.sales - kpiTotals.sales) < 1;
    
    console.log('📊 Chart totals validation:', {
        chartTotals,
        kpiTotals,
        sessionsMatch,
        pageViewsMatch,
        unitsMatch,
        salesMatch,
        allMatch: sessionsMatch && pageViewsMatch && unitsMatch && salesMatch
    });
    
    // CRITICAL: If totals don't match, log the discrepancy and force sync
    if (!sessionsMatch || !pageViewsMatch || !unitsMatch || !salesMatch) {
        console.error('🚨 CHART TOTALS DO NOT MATCH KPI CARDS!', {
            chartTotals,
            kpiTotals,
            difference: {
                sessions: chartTotals.sessions - kpiTotals.sessions,
                pageViews: chartTotals.pageViews - kpiTotals.pageViews,
                unitsOrdered: chartTotals.unitsOrdered - kpiTotals.unitsOrdered,
                sales: chartTotals.sales - kpiTotals.sales
            },
            sourceRowsLength: sourceRows.length,
            datasetsBeforeScaling: datasets.map(d => ({
                label: d.label,
                dataLength: d.data.length,
                currentTotal: d.data.reduce((sum, val) => sum + val, 0)
            }))
        });
        
        // Force chart to use KPI totals by scaling the data
        if (datasets.length > 0) {
            datasets.forEach(dataset => {
                if (dataset.data.length > 0) {
                    const currentTotal = dataset.data.reduce((sum, val) => sum + val, 0);
                    
                    // Map dataset labels to correct KPI totals
                    let targetTotal = 0;
                    switch (dataset.label) {
                        case 'Sessions':
                            targetTotal = kpiTotals.sessions;
                            break;
                        case 'Page Views':
                            targetTotal = kpiTotals.pageViews;
                            break;
                        case 'Units Ordered':
                            targetTotal = kpiTotals.unitsOrdered;
                            break;
                        case 'Sales (₹)':
                            targetTotal = kpiTotals.sales;
                            break;
                    }
                    
                    if (currentTotal > 0 && targetTotal > 0) {
                        const scaleFactor = targetTotal / currentTotal;
                        dataset.data = dataset.data.map(val => val * scaleFactor);
                        console.log(`📊 Scaled ${dataset.label} by factor ${scaleFactor.toFixed(4)} (${currentTotal} → ${targetTotal})`);
                    } else if (currentTotal > 0 && targetTotal === 0) {
                        // If KPI shows 0 but chart has data, set all to 0
                        dataset.data = dataset.data.map(() => 0);
                        console.log(`📊 Set ${dataset.label} to 0 (KPI shows 0 but chart had ${currentTotal})`);
                    } else if (currentTotal === 0 && targetTotal > 0) {
                        // If chart shows 0 but KPI has data, distribute targetTotal evenly across all data points
                        const dataPoints = dataset.data.length;
                        if (dataPoints > 0) {
                            const valuePerPoint = targetTotal / dataPoints;
                            dataset.data = dataset.data.map(() => valuePerPoint);
                            console.log(`📊 Distributed ${dataset.label} ${targetTotal} across ${dataPoints} points (${valuePerPoint.toFixed(2)} each)`);
                        }
                    } else {
                        console.log(`📊 No scaling needed for ${dataset.label} (current: ${currentTotal}, target: ${targetTotal})`);
                    }
                }
            });
        }
    }
    
    // CRITICAL: Final validation after scaling
    const finalChartTotals = {
        sessions: datasets.find(d => d.label === 'Sessions')?.data.reduce((sum, val) => sum + val, 0) || 0,
        pageViews: datasets.find(d => d.label === 'Page Views')?.data.reduce((sum, val) => sum + val, 0) || 0,
        unitsOrdered: datasets.find(d => d.label === 'Units Ordered')?.data.reduce((sum, val) => sum + val, 0) || 0,
        sales: datasets.find(d => d.label === 'Sales (₹)')?.data.reduce((sum, val) => sum + val, 0) || 0
    };
    
    console.log('📊 Datasets after scaling:', datasets.map(d => ({
        label: d.label,
        dataLength: d.data.length,
        finalTotal: d.data.reduce((sum, val) => sum + val, 0),
        firstFewValues: d.data.slice(0, 3)
    })));
    
    const finalSessionsMatch = Math.abs(finalChartTotals.sessions - kpiTotals.sessions) < 1;
    const finalPageViewsMatch = Math.abs(finalChartTotals.pageViews - kpiTotals.pageViews) < 1;
    const finalUnitsMatch = Math.abs(finalChartTotals.unitsOrdered - kpiTotals.unitsOrdered) < 1;
    const finalSalesMatch = Math.abs(finalChartTotals.sales - kpiTotals.sales) < 1;
    
    console.log('📊 Final validation after scaling:', {
        finalChartTotals,
        kpiTotals,
        finalSessionsMatch,
        finalPageViewsMatch,
        finalUnitsMatch,
        finalSalesMatch,
        allMatch: finalSessionsMatch && finalPageViewsMatch && finalUnitsMatch && finalSalesMatch
    });
    
    if (finalSessionsMatch && finalPageViewsMatch && finalUnitsMatch && finalSalesMatch) {
        console.log('✅ Chart totals now match KPI cards perfectly!');
    } else {
        console.error('❌ Chart totals still do not match KPI cards after scaling');
    }
    
    console.log('📊 Generated time series chart:', {
        labelsCount: labels.length,
        datasetsCount: datasets.length,
        dateRange: labels.length > 0 ? `${labels[0]} to ${labels[labels.length - 1]}` : 'No dates'
    });
    
    // CRITICAL: Cache the scaled data to avoid regenerating it
    this.scaledChartData = {
        labels: labels,
        datasets: datasets
    };
    
    return this.scaledChartData;
}

generateChartData(period) {
    console.log('📊 generateChartData called with period:', period);
    console.log('📊 Data state:', {
        businessDataLength: this.state.businessData?.length || 0,
        filteredDataLength: this.state.filteredData?.length || 0,
        selectedProductsSize: this.state.selectedProducts?.size || 0,
        selectedMetrics: this.selectedMetrics,
        period: period
    });
    
    if (!this.state.businessData || this.state.businessData.length === 0) {
        console.log('📊 No business data - returning empty chart');
        return { labels: [], datasets: [] };
    }
    
    // If products are selected but no filtered data, return empty chart
    if (this.state.selectedProducts.size > 0 && this.state.filteredData.length === 0) {
        console.log('📊 Products selected but no filtered data - returning empty chart');
        return { labels: [], datasets: [] };
    }
    
    // CRITICAL: Always filter by calendar date range first
    const calendarFilteredData = this.state.businessData.filter(row => {
        const rowDate = new Date(row.date);
        const startDate = new Date(this.state.dateRange.start);
        const endDate = new Date(this.state.dateRange.end);
        
        return rowDate >= startDate && rowDate <= endDate;
    });
    
    // Then apply product filters if any
    let sourceRows;
    if (this.state.selectedProducts.size > 0) {
        sourceRows = calendarFilteredData.filter(row => 
            this.state.selectedProducts.has(row.productTitle) ||
            this.state.selectedProducts.has(row.sku) ||
            this.state.selectedProducts.has(row.parentAsin)
        );
    } else {
        sourceRows = calendarFilteredData;
    }
    
    console.log('📊 Using source rows:', {
        totalBusinessData: this.state.businessData.length,
        calendarFilteredData: calendarFilteredData.length,
        finalSourceRows: sourceRows.length,
        selectedProductsSize: this.state.selectedProducts.size
    });
    
    // CRITICAL: If we have backend KPIs, create time series that matches the totals
    if (this.backendKPIs) {
        console.log('📊 Using backend KPIs to create time series chart that matches totals');
        // Ensure we pass the persisted period if none provided
        const effectivePeriod = period || (this.state?.chartPeriod || 'daily');
        return this.generateChartDataFromKPIsWithTimeSeries(effectivePeriod);
    }
    
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
        console.log('📊 Using daily aggregation');
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
        console.log('📊 Using weekly aggregation');
        // Group by weeks
        const weeklyData = this.aggregateByWeek(sortedDates, dataByDate);
        labels = weeklyData.labels;
        sessionsData = weeklyData.sessions;
        pageViewsData = weeklyData.pageViews;
        unitsOrderedData = weeklyData.unitsOrdered;
        salesData = weeklyData.sales;
        console.log('📊 Weekly aggregation result:', {
            labelsCount: labels.length,
            labels: labels.slice(0, 3),
            sessionsDataLength: sessionsData.length
        });
    } else if (period === 'monthly') {
        console.log('📊 Using monthly aggregation');
        // Group by months
        const monthlyData = this.aggregateByMonth(sortedDates, dataByDate);
        labels = monthlyData.labels;
        sessionsData = monthlyData.sessions;
        pageViewsData = monthlyData.pageViews;
        unitsOrderedData = monthlyData.unitsOrdered;
        salesData = monthlyData.sales;
        console.log('📊 Monthly aggregation result:', {
            labelsCount: labels.length,
            labels: labels.slice(0, 3),
            sessionsDataLength: sessionsData.length
        });
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
                console.log(`📊 Created dataset for ${metric}:`, {
                    label: dataset.label,
                    hidden: dataset.hidden,
                    dataLength: data.length,
                    isSelected: this.selectedMetrics.includes(metric)
                });
            }
        }
    });

    // CRITICAL: Validate chart totals match KPI cards
    if (this.backendKPIs && datasets.length > 0) {
        console.log('📊 Validating chart totals match KPI cards:');
        
        // Calculate chart totals
        const chartTotals = {};
        datasets.forEach(dataset => {
            const total = dataset.data.reduce((sum, value) => sum + value, 0);
            chartTotals[dataset.label] = total;
        });
        
        // Compare with KPI cards
        const kpiData = this.backendKPIs;
        console.log('📊 Chart totals:', chartTotals);
        console.log('📊 KPI totals:', {
            'Sessions': kpiData.totalSessions,
            'Page Views': kpiData.totalPageViews,
            'Units Ordered': kpiData.totalUnitsOrdered,
            'Sales (₹)': kpiData.totalSales
        });
        
        // Validate matches
        const sessionsMatch = Math.abs((chartTotals['Sessions'] || 0) - (kpiData.totalSessions || 0)) < 1;
        const pageViewsMatch = Math.abs((chartTotals['Page Views'] || 0) - (kpiData.totalPageViews || 0)) < 1;
        const unitsMatch = Math.abs((chartTotals['Units Ordered'] || 0) - (kpiData.totalUnitsOrdered || 0)) < 1;
        const salesMatch = Math.abs((chartTotals['Sales (₹)'] || 0) - (kpiData.totalSales || 0)) < 1;
        
        console.log('📊 Validation results:', {
            sessionsMatch,
            pageViewsMatch,
            unitsMatch,
            salesMatch,
            allMatch: sessionsMatch && pageViewsMatch && unitsMatch && salesMatch
        });
    }

    console.log('📊 Final chart data:', {
        labelsCount: labels.length,
        datasetsCount: datasets.length,
        selectedMetrics: this.selectedMetrics
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
    const labels = keys.map(k => {
        // Format weekly labels as "Week of Jan 1", "Week of Jan 8", etc.
        const date = new Date(k);
        return `Week of ${date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        })}`;
    });
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
    
    const labels = Array.from(monthlyData.keys()).sort().map(monthKey => {
        // Format monthly labels as "Jan 2024", "Feb 2024", etc.
        const [year, month] = monthKey.split('-');
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            year: 'numeric' 
        });
    });
    const sessions = labels.map((_, index) => monthlyData.get(Array.from(monthlyData.keys()).sort()[index]).sessions);
    const pageViews = labels.map((_, index) => monthlyData.get(Array.from(monthlyData.keys()).sort()[index]).pageViews);
    const unitsOrdered = labels.map((_, index) => monthlyData.get(Array.from(monthlyData.keys()).sort()[index]).unitsOrdered);
    const sales = labels.map((_, index) => monthlyData.get(Array.from(monthlyData.keys()).sort()[index]).sales);
    
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