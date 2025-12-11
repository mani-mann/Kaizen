// Comparison Report JavaScript
// Uses the same /api/analytics endpoint as AD Reports to fetch data for two ranges

const DEFAULT_COMPARISON_METRICS = ['totalSales', 'adSales', 'adSpend'];
const ALL_COMPARISON_METRICS = ['totalSales', 'adSales', 'adSpend', 'acos', 'tcos', 'sessions', 'pageViews', 'unitsOrdered', 'conversionRate'];

class ComparisonReport {
    constructor() {
        // Date ranges for A (primary) and B (comparison)
        this.rangeA = null;
        this.rangeB = null;

        // Raw data from backend
        this.dataA = { rows: [], kpis: null };
        this.dataB = { rows: [], kpis: null };

        // Filtered data for chart/KPIs
        this.filteredRowsA = [];
        this.filteredRowsB = [];
        this.selectedCampaigns = new Set();
        this.selectedKeywords = new Set();
        this.daySeries = [];
        this.selectedDayIndex = -1; // -1 means no day selected (show timeline view)

        // Chart
        this.chart = null;
        this.chartPeriod = 'daily';
        this.chartMode = 'normalized'; // 'normalized' or 'overlay'
        this.selectedChartMetrics = new Set(DEFAULT_COMPARISON_METRICS);

        this.init();
    }

    init() {
        // Clear expired cache on page load
        if (typeof BrowserCache !== 'undefined') {
            BrowserCache.clearExpired('compare');
        }
        
        this.setupMobileMenu();
        this.initRangesFromQueryOrDefault();
        this.setupDatePickers();
        this.setupChartControls();
        this.updateDateRangeDisplay();
        this.fetchBothRanges();
    }

    getApiBase() {
        try {
            if (typeof window.getApiUrl === 'function') {
                // config.js helper is loaded before this script
                const full = window.getApiUrl('/api/analytics');
                // getApiUrl may return relative or absolute
                const url = new URL(full, window.location.origin);
                return `${url.origin}${url.pathname.replace('/api/analytics', '')}`;
            }
        } catch (_) {}
        return '';
    }

    initRangesFromQueryOrDefault() {
        try {
            const url = new URL(window.location.href);
            const startA = url.searchParams.get('start') || null;
            const endA = url.searchParams.get('end') || null;
            const startB = url.searchParams.get('start2') || null;
            const endB = url.searchParams.get('end2') || null;

            const today = new Date();
            const toYmd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

            if (startA && endA) {
                this.rangeA = { startStr: startA, endStr: endA };
            } else {
                // Default primary: last 30 days
                const end = new Date(today);
                const start = new Date(today);
                start.setDate(start.getDate() - 29);
                this.rangeA = { startStr: toYmd(start), endStr: toYmd(end) };
            }

            if (startB && endB) {
                this.rangeB = { startStr: startB, endStr: endB };
            } else {
                // Default comparison: previous 30 days before rangeA
                const endAdate = this.parseYmd(this.rangeA.endStr);
                const endBdate = new Date(endAdate);
                endBdate.setDate(endBdate.getDate() - 30);
                const startBdate = new Date(endBdate);
                startBdate.setDate(startBdate.getDate() - 29);
                this.rangeB = { startStr: toYmd(startBdate), endStr: toYmd(endBdate) };
            }
        } catch (_) {
            // Fallback if URL parsing fails
            const today = new Date();
            const toYmd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const end = new Date(today);
            const start = new Date(today);
            start.setDate(start.getDate() - 29);
            this.rangeA = { startStr: toYmd(start), endStr: toYmd(end) };

            const endBdate = new Date(start);
            endBdate.setDate(endBdate.getDate() - 1);
            const startBdate = new Date(endBdate);
            startBdate.setDate(startBdate.getDate() - 29);
            this.rangeB = { startStr: toYmd(startBdate), endStr: toYmd(endBdate) };
        }
    }

    parseYmd(str) {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d, 0, 0, 0, 0);
    }

    addDays(dateStr, days) {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    updateDateRangeDisplay() {
        const elA = document.getElementById('dateRangeDisplayA');
        const elB = document.getElementById('dateRangeDisplayB');
        if (elA && this.rangeA) {
            elA.textContent = `${this.rangeA.startStr} → ${this.rangeA.endStr}`;
        }
        if (elB && this.rangeB) {
            elB.textContent = `${this.rangeB.startStr} → ${this.rangeB.endStr}`;
        }
        // Update last update time
        const nowEl = document.getElementById('lastUpdateTime');
        if (nowEl) {
            nowEl.textContent = new Date().toLocaleString();
        }
    }

    setupMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        if (mobileMenuBtn && sidebar) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
            document.addEventListener('click', (e) => {
                if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            });
        }
    }

    setupDatePickers() {
        this.setupSingleDatePicker('A');
        this.setupSingleDatePicker('B');
    }

    setupSingleDatePicker(suffix) {
        const dateFilter = document.getElementById(`dateFilter${suffix}`);
        const datePickerDropdown = document.getElementById(`datePickerDropdown${suffix}`);
        const presetToggle = document.getElementById(`presetToggle${suffix}`);
        const presetDropdown = document.getElementById(`presetDropdown${suffix}`);

        if (dateFilter && datePickerDropdown) {
            
            // Build full range calendar matching AD Reports (only once)
            if (!datePickerDropdown.dataset.initialized) {
                const calendar = document.createElement('div');
                calendar.id = `rangeCalendar${suffix}`;
                calendar.className = 'range-calendar';
                datePickerDropdown.appendChild(calendar);

                const footer = document.createElement('div');
                footer.className = 'range-calendar-footer';
                footer.innerHTML = `
                    <div class="range-calendar-summary"></div>
                    <div>
                        <button type="button" class="date-btn primary range-calendar-confirm" id="confirmDatePicker${suffix}">Confirm</button>
                    </div>
                `;
                datePickerDropdown.appendChild(footer);

                // Initialize temp range and calendar month
                const currentRange = suffix === 'A' ? this.rangeA : this.rangeB;
                this[`tempRangeStart${suffix}`] = currentRange ? this.parseYmd(currentRange.startStr) : new Date();
                this[`tempRangeEnd${suffix}`] = currentRange ? this.parseYmd(currentRange.endStr) : new Date();
                this[`calendarMonth${suffix}`] = new Date(this[`tempRangeEnd${suffix}`]);
                this[`calendarMonth${suffix}`].setDate(1);

                datePickerDropdown.dataset.initialized = 'true';
            }

            // Attach click handler to date filter (always, outside the init block)
            if (!dateFilter.dataset.clickHandlerAttached) {
                dateFilter.addEventListener('click', (e) => {
                    // Don't open calendar if clicking on preset toggle button or its children
                    if (e.target.closest('.preset-toggle') || e.target.closest('.preset-dropdown')) {
                        return;
                    }
                    
                    e.stopPropagation();
                    const wasOpen = datePickerDropdown.style.display === 'block';
                    
                    // Close all OTHER dropdowns first
                    document.querySelectorAll('.date-picker-dropdown').forEach(dd => {
                        if (dd !== datePickerDropdown) {
                            dd.style.display = 'none';
                        }
                    });
                    document.querySelectorAll('.date-filter').forEach(df => {
                        if (df !== dateFilter) {
                            df.classList.remove('open');
                        }
                    });
                    document.querySelectorAll('.preset-dropdown').forEach(pd => pd.style.display = 'none');
                    
                    // Toggle this calendar
                    if (!wasOpen) {
                        // Reset temp range to current range
                        const range = suffix === 'A' ? this.rangeA : this.rangeB;
                        this[`tempRangeStart${suffix}`] = range ? this.parseYmd(range.startStr) : new Date();
                        this[`tempRangeEnd${suffix}`] = range ? this.parseYmd(range.endStr) : new Date();
                        this[`calendarMonth${suffix}`] = new Date(this[`tempRangeEnd${suffix}`]);
                        this[`calendarMonth${suffix}`].setDate(1);
                        
                        // Render and show
                        this.renderCalendar(suffix);
                        datePickerDropdown.style.display = 'block';
                        dateFilter.classList.add('open');
                    } else {
                        // Close this calendar
                        datePickerDropdown.style.display = 'none';
                        dateFilter.classList.remove('open');
                    }
                });

                // Mark as attached
                dateFilter.dataset.clickHandlerAttached = 'true';

                // Prevent dropdown from closing when clicking inside
                datePickerDropdown.addEventListener('click', (e) => e.stopPropagation());

                // Global click handler to close dropdowns
                document.addEventListener('click', () => {
                    datePickerDropdown.style.display = 'none';
                    dateFilter.classList.remove('open');
                });
            }

            // Confirm button handler (setup after calendar structure exists)
            const confirmBtn = datePickerDropdown.querySelector(`#confirmDatePicker${suffix}`);
            if (confirmBtn && !confirmBtn.dataset.handlerAttached) {
                confirmBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const start = this.toInputDate(this[`tempRangeStart${suffix}`]);
                    const end = this.toInputDate(this[`tempRangeEnd${suffix}`]);
                    if (!start || !end) return;
                    
                    if (suffix === 'A') {
                        this.rangeA = { startStr: start, endStr: end };
                        this.persistGlobalRangeA();
                    } else {
                        this.rangeB = { startStr: start, endStr: end };
                    }
                    this.updateUrlParams();
                    this.updateDateRangeDisplay();
                    this.fetchBothRanges();
                    datePickerDropdown.style.display = 'none';
                    dateFilter.classList.remove('open');
                });
                confirmBtn.dataset.handlerAttached = 'true';
            }
        }

        if (presetToggle && presetDropdown) {
            if (!presetToggle.dataset.initialized) {
                presetToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = presetDropdown.style.display === 'block';
                    // Close all other dropdowns
                    document.querySelectorAll('.preset-dropdown').forEach(dd => dd.style.display = 'none');
                    document.querySelectorAll('.date-picker-dropdown').forEach(dd => dd.style.display = 'none');
                    document.querySelectorAll('.date-filter').forEach(df => df.classList.remove('open'));
                    
                    if (!isOpen) {
                        presetDropdown.style.display = 'block';
                    }
                });

                presetDropdown.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const btn = e.target.closest('button[data-preset]');
                    if (!btn) return;
                    const key = btn.getAttribute('data-preset');
                    this.applyPreset(suffix, key);
                    const label = btn.textContent.trim();
                    presetToggle.textContent = `${label} ▾`;
                    presetDropdown.style.display = 'none';
                });

                document.addEventListener('click', () => {
                    presetDropdown.style.display = 'none';
                });

                presetToggle.dataset.initialized = 'true';
            }
        }
    }

    renderCalendar(suffix) {
        const container = document.getElementById(`rangeCalendar${suffix}`);
        if (!container) return;
        container.innerHTML = '';

        const calMonth = this[`calendarMonth${suffix}`];
        const header = document.createElement('div');
        header.className = 'range-calendar-header';
        header.innerHTML = `
            <div class="range-calendar-nav">
                <button class="range-calendar-btn" id="calPrev${suffix}">&#8592;</button>
            </div>
            <div class="range-calendar-month">${calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
            <div class="range-calendar-nav">
                <button class="range-calendar-btn" id="calNext${suffix}">&#8594;</button>
                <button class="range-calendar-btn" id="calToday${suffix}" title="Go to current month">Today</button>
            </div>
        `;
        container.appendChild(header);

        const weekdays = document.createElement('div');
        weekdays.className = 'range-calendar-weekdays';
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(n => {
            const el = document.createElement('div');
            el.className = 'range-calendar-weekday';
            el.textContent = n;
            weekdays.appendChild(el);
        });
        container.appendChild(weekdays);

        const grid = document.createElement('div');
        grid.className = 'range-calendar-grid';

        const firstDay = new Date(calMonth);
        const lastDay = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0);
        const jsDay = firstDay.getDay();
        const startOffset = jsDay === 0 ? 6 : jsDay - 1;

        // Define ds and de outside the loop so they can be used for the summary
        const ds = this[`tempRangeStart${suffix}`] ? new Date(this[`tempRangeStart${suffix}`]) : null;
        const de = this[`tempRangeEnd${suffix}`] ? new Date(this[`tempRangeEnd${suffix}`]) : null;
        if (ds) ds.setHours(0, 0, 0, 0);
        if (de) de.setHours(0, 0, 0, 0);

        for (let i = 0; i < startOffset; i++) grid.appendChild(document.createElement('div'));

        for (let d = 1; d <= lastDay.getDate(); d++) {
            const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), d);
            const cell = document.createElement('div');
            cell.className = 'range-calendar-day';
            cell.textContent = String(d);
            cell.dataset.date = this.toInputDate(date);

            const cd = new Date(date);
            cd.setHours(0, 0, 0, 0);

            if (ds && de) {
                if (cd.getTime() === ds.getTime()) cell.classList.add('start');
                if (cd.getTime() === de.getTime()) cell.classList.add('end');
                if (cd > ds && cd < de) cell.classList.add('in-range');
            } else if (ds && !de && cd.getTime() === ds.getTime()) {
                cell.classList.add('start', 'end');
            }

            const today = new Date();
            today.setHours(23, 59, 59, 999);
            if (cd > today) {
                cell.classList.add('disabled');
            }

            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleCalendarDayClick(suffix, date);
            });
            grid.appendChild(cell);
        }
        container.appendChild(grid);

        container.querySelector(`#calPrev${suffix}`)?.addEventListener('click', (e) => {
            e.stopPropagation();
            this[`calendarMonth${suffix}`].setMonth(this[`calendarMonth${suffix}`].getMonth() - 1);
            this.renderCalendar(suffix);
        });
        container.querySelector(`#calNext${suffix}`)?.addEventListener('click', (e) => {
            e.stopPropagation();
            this[`calendarMonth${suffix}`].setMonth(this[`calendarMonth${suffix}`].getMonth() + 1);
            this.renderCalendar(suffix);
        });
        container.querySelector(`#calToday${suffix}`)?.addEventListener('click', (e) => {
            e.stopPropagation();
            this[`calendarMonth${suffix}`] = new Date();
            this[`calendarMonth${suffix}`].setDate(1);
            this.renderCalendar(suffix);
        });

        // Update summary
        const summary = container.parentElement.querySelector('.range-calendar-summary');
        if (summary && ds && de) {
            summary.textContent = `${this.toInputDate(ds)} - ${this.toInputDate(de)}`;
        }
    }

    handleCalendarDayClick(suffix, date) {
        const ds = this[`tempRangeStart${suffix}`];
        const de = this[`tempRangeEnd${suffix}`];

        if (!ds || (ds && de)) {
            // Start new range
            this[`tempRangeStart${suffix}`] = new Date(date);
            this[`tempRangeEnd${suffix}`] = null;
        } else {
            // Complete range
            if (date < ds) {
                this[`tempRangeEnd${suffix}`] = new Date(ds);
                this[`tempRangeStart${suffix}`] = new Date(date);
            } else {
                this[`tempRangeEnd${suffix}`] = new Date(date);
            }
        }
        this.renderCalendar(suffix);
    }

    toInputDate(date) {
        if (!date) return '';
        // If already a string in YYYY-MM-DD format, return as-is
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
            return date.slice(0, 10);
        }
        // Otherwise convert Date object to YYYY-MM-DD
        const d = new Date(date);
        if (isNaN(d)) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    applyPreset(suffix, key) {
        const today = new Date();
        const toYmd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

        const start = new Date(today);
        const end = new Date(today);

        switch (key) {
            case 'yesterday':
                start.setDate(start.getDate() - 1);
                end.setDate(end.getDate() - 1);
                break;
            case 'last7':
                start.setDate(start.getDate() - 6);
                break;
            case 'thisWeek': {
                const day = start.getDay() || 7; // Monday start
                start.setDate(start.getDate() - (day - 1));
                break;
            }
            case 'lastWeek': {
                const day = start.getDay() || 7;
                start.setDate(start.getDate() - (day - 1) - 7);
                end.setDate(start.getDate() + 6);
                break;
            }
            case 'last30':
                start.setDate(start.getDate() - 29);
                break;
            case 'thisMonth':
                start.setDate(1);
                break;
            case 'lastMonth': {
                start.setMonth(start.getMonth() - 1, 1);
                end.setMonth(end.getMonth() - 1 + 1, 0);
                break;
            }
            case 'ytd':
                start.setMonth(0, 1);
                break;
            case 'lifetime':
                // Leave as is; backend will clamp by data range
                start.setFullYear(2000, 0, 1);
                break;
            default:
                break;
        }

        const range = { startStr: toYmd(start), endStr: toYmd(end) };
        if (suffix === 'A') {
            this.rangeA = range;
            this.persistGlobalRangeA();
        } else {
            this.rangeB = range;
        }
        this.updateUrlParams();
        this.updateDateRangeDisplay();
        this.fetchBothRanges();
    }

    persistGlobalRangeA() {
        try {
            const start = this.parseYmd(this.rangeA.startStr);
            const end = this.parseYmd(this.rangeA.endStr);
            const payload = {
                startMs: start.getTime(),
                endMs: end.getTime(),
                startStr: this.rangeA.startStr,
                endStr: this.rangeA.endStr,
                savedAt: Date.now(),
                manualSelection: true
            };
            window.localStorage.setItem('global_date_range', JSON.stringify(payload));
        } catch (_) {
            // ignore storage errors
        }
    }

    updateUrlParams() {
        try {
            const url = new URL(window.location.href);
            if (this.rangeA) {
                url.searchParams.set('start', this.rangeA.startStr);
                url.searchParams.set('end', this.rangeA.endStr);
            }
            if (this.rangeB) {
                url.searchParams.set('start2', this.rangeB.startStr);
                url.searchParams.set('end2', this.rangeB.endStr);
            }
            window.history.replaceState({}, '', url.toString());
        } catch (_) {
            // ignore URL errors
        }
    }

    async fetchBothRanges() {
        if (!this.rangeA || !this.rangeB) return;
        
        // Create cache key based on both date ranges
        const cacheKey = `${this.rangeA.startStr}_${this.rangeA.endStr}_${this.rangeB.startStr}_${this.rangeB.endStr}`;
        
        // Try to get cached data first
        let cachedData = null;
        if (typeof BrowserCache !== 'undefined') {
            cachedData = BrowserCache.get('compare', [cacheKey]);
            if (cachedData) {
                console.log('✅ Using cached comparison data');
                // Restore from cache
                this.dataA.rows = cachedData.dataA.rows || [];
                this.dataB.rows = cachedData.dataB.rows || [];
                this.rawBizDataA = cachedData.rawBizDataA || [];
                this.rawBizDataB = cachedData.rawBizDataB || [];
                this.filteredRowsA = [...this.dataA.rows];
                this.filteredRowsB = [...this.dataB.rows];
                
                // Recalculate and render from cached data
                this.recalculateKpisFromFiltered();
                this.renderKpis();
                this.buildChart();
                this.populateFilters();
                this.refreshDaySelector();
                return;
            }
        }
        
        try {
            const base = this.getApiBase();
            
            // Use exact dates - same as main AD Reports page
            const qsA = `?start=${encodeURIComponent(this.rangeA.startStr)}&end=${encodeURIComponent(this.rangeA.endStr)}`;
            const qsB = `?start=${encodeURIComponent(this.rangeB.startStr)}&end=${encodeURIComponent(this.rangeB.endStr)}`;

            console.log('🔄 Fetching fresh comparison data from API...');

            // Fetch both AD data and Business data for both ranges
            const [resA, resB, bizResA, bizResB] = await Promise.all([
                fetch(`${base}/api/analytics${qsA}`),
                fetch(`${base}/api/analytics${qsB}`),
                fetch(`${base}/api/business-data${qsA}`),
                fetch(`${base}/api/business-data${qsB}`)
            ]);

            const jsonA = resA.ok ? await resA.json() : { rows: [], kpis: null };
            const jsonB = resB.ok ? await resB.json() : { rows: [], kpis: null };
            const bizJsonA = bizResA.ok ? await bizResA.json() : { data: [] };
            const bizJsonB = bizResB.ok ? await bizResB.json() : { data: [] };

            // Normalize date fields to avoid timezone issues (same as main AD Reports page)
            const normalizeDates = (rows) => {
                if (!Array.isArray(rows)) return rows;
                return rows.map(row => {
                    if (row && row.report_date) {
                        try {
                            const d = new Date(row.report_date);
                            if (!isNaN(d.getTime())) {
                                row.report_date = this.toInputDate(d);
                            }
                        } catch (_) {}
                    }
                    if (row && row.date) {
                        try {
                            const d2 = new Date(row.date);
                            if (!isNaN(d2.getTime())) {
                                row.date = this.toInputDate(d2);
                            }
                        } catch (_) {}
                    }
                    return row;
                });
            };

            // Normalize dates in both AD and Business data
            jsonA.rows = normalizeDates(jsonA.rows || []);
            jsonB.rows = normalizeDates(jsonB.rows || []);
            bizJsonA.data = normalizeDates(bizJsonA.data || []);
            bizJsonB.data = normalizeDates(bizJsonB.data || []);

            // Store raw business data separately (for accurate totals when no filters are active)
            this.rawBizDataA = bizJsonA.data || [];
            this.rawBizDataB = bizJsonB.data || [];
            
            // Merge business data into ad data by date
            this.dataA.rows = this.mergeAdAndBusinessData(jsonA.rows, bizJsonA.data);
            this.dataB.rows = this.mergeAdAndBusinessData(jsonB.rows, bizJsonB.data);

            this.filteredRowsA = [...this.dataA.rows];
            this.filteredRowsB = [...this.dataB.rows];

            // Calculate KPIs from merged data (includes both AD and business metrics)
            this.recalculateKpisFromFiltered();
            this.renderKpis();
            // this.buildComparisonSummary(); // Summary box removed from UI
            this.buildChart();
            this.populateFilters();
            this.refreshDaySelector();
            
            // Cache the fetched and processed data
            if (typeof BrowserCache !== 'undefined') {
                const dataToCache = {
                    dataA: {
                        rows: this.dataA.rows
                    },
                    dataB: {
                        rows: this.dataB.rows
                    },
                    rawBizDataA: this.rawBizDataA,
                    rawBizDataB: this.rawBizDataB
                };
                BrowserCache.set('compare', [cacheKey], dataToCache);
                console.log('💾 Comparison data cached successfully');
            }
        } catch (err) {
            // Soft-fail; leave existing data in place
            console.error('ComparisonReport fetch error', err);
        }
    }

    mergeAdAndBusinessData(adRows, bizRows) {
        // Group business data by date - sum all ASINs for the same date
        const bizByDate = new Map();
        
        bizRows.forEach(row => {
            let date = String(row.date || '').slice(0, 10);
            // Handle different date formats
            if (date && !date.includes('-')) {
                // Might be a timestamp, try to parse it
                const d = new Date(row.date);
                if (!isNaN(d)) {
                    date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                }
            }
            
            if (!date || date === '') return;
            
            // Aggregate by date (for total sales per day)
            if (!bizByDate.has(date)) {
                bizByDate.set(date, {
                    sessions: 0,
                    pageViews: 0,
                    unitsOrdered: 0,
                    totalSales: 0
                });
            }
            const agg = bizByDate.get(date);
            agg.sessions += Number(row.sessions || 0);
            agg.pageViews += Number(row.page_views || row.pageViews || 0);
            agg.unitsOrdered += Number(row.units_ordered || row.unitsOrdered || 0);
            agg.totalSales += Number(row.ordered_product_sales || row.totalSales || 0);
        });

        // Group AD rows by date first to avoid duplicating business data
        const adByDate = new Map();
        adRows.forEach(adRow => {
            let date = String(adRow.date || adRow.report_date || '').slice(0, 10);
            // Handle different date formats
            if (date && !date.includes('-')) {
                const d = new Date(adRow.date || adRow.report_date);
                if (!isNaN(d)) {
                    date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                }
            }
            
            if (!adByDate.has(date)) {
                adByDate.set(date, []);
            }
            adByDate.get(date).push(adRow);
        });

        // Simplified merge: just attach date-level business data to ad rows
        // Business data is shown when no filters are active, hidden when campaign filter is active
        const mergedRows = [];
        
        adByDate.forEach((rows, date) => {
            const bizData = bizByDate.get(date) || { sessions: 0, pageViews: 0, unitsOrdered: 0, totalSales: 0 };
            
            rows.forEach((adRow, index) => {
                // For first row per date: attach date-level aggregated business data
                // For other rows: set business data to 0 (we use hasBizData flag to count only once)
                const isFirstRowForDate = index === 0;
                const businessDataForRow = isFirstRowForDate ? bizData : {
                    sessions: 0,
                    pageViews: 0,
                    unitsOrdered: 0,
                    totalSales: 0
                };
                
                mergedRows.push({
                    ...adRow,
                    date: date,
                    // Attach business data (only first row per date has real values)
                    sessions: businessDataForRow.sessions,
                    pageViews: businessDataForRow.pageViews,
                    unitsOrdered: businessDataForRow.unitsOrdered,
                    totalSales: businessDataForRow.totalSales,
                    // Keep ad data
                    spend: adRow.cost || adRow.spend || 0,
                    adSales: adRow.sales_1d || adRow.sales || adRow.adSales || 0,
                    clicks: adRow.clicks || 0,
                    impressions: adRow.impressions || 0,
                    // hasBizData: first row per date has business data
                    hasBizData: isFirstRowForDate
                });
            });
        });

        // Log summary
        const uniqueDates = new Set(mergedRows.map(r => r.date)).size;
        console.log(`📊 Merged ${mergedRows.length} ad rows across ${uniqueDates} dates`);

        return mergedRows;
    }

    formatCurrency(value) {
        const num = Number(value || 0);
        if (!Number.isFinite(num)) return '₹0';
        return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }

    formatPercent(value) {
        const num = Number(value || 0);
        if (!Number.isFinite(num)) return '0%';
        return num.toFixed(1) + '%';
    }

    renderKpis() {
        const apply = (prefix, kpis) => {
            const set = (id, val) => {
                const el = document.getElementById(`metric${prefix}-${id}`);
                if (el) el.textContent = val;
            };
            if (!kpis) {
                ['adSpend','adSales','totalSales','acos','tcos','roas','adClicks','avgCpc',
                 'sessions','pageViews','unitsOrdered','avgSessionsPerDay','conversionRate']
                .forEach(key => set(key, '—'));
                return;
            }
            set('adSpend', this.formatCurrency(kpis.adSpend));
            set('adSales', this.formatCurrency(kpis.adSales));
            set('totalSales', this.formatCurrency(kpis.totalSales));
            set('acos', this.formatPercent(kpis.acos));
            set('tcos', this.formatPercent(kpis.tcos));
            set('roas', (Number(kpis.roas || 0)).toFixed(2));
            set('adClicks', (Number(kpis.adClicks || 0)).toLocaleString('en-IN'));
            set('avgCpc', this.formatCurrency(kpis.avgCpc));
            set('sessions', (Number(kpis.sessions || 0)).toLocaleString('en-IN'));
            set('pageViews', (Number(kpis.pageViews || 0)).toLocaleString('en-IN'));
            set('unitsOrdered', (Number(kpis.unitsOrdered || 0)).toLocaleString('en-IN'));
            set('avgSessionsPerDay', (Number(kpis.avgSessionsPerDay || 0)).toFixed(1));
            set('conversionRate', this.formatPercent(kpis.conversionRate));
        };

        apply('A', this.dataA.kpis);
        apply('B', this.dataB.kpis);

        // Calculate and display deltas
        this.renderKpiDeltas();
    }

    renderKpiDeltas() {
        const kA = this.dataA.kpis || {};
        const kB = this.dataB.kpis || {};

        const metrics = [
            { key: 'adSpend', type: 'currency', invertColor: true },
            { key: 'adSales', type: 'currency', invertColor: false },
            { key: 'totalSales', type: 'currency', invertColor: false },
            { key: 'acos', type: 'percent', invertColor: true }, // Lower is better
            { key: 'tcos', type: 'percent', invertColor: true }, // Lower is better
            { key: 'roas', type: 'decimal', invertColor: false },
            { key: 'adClicks', type: 'count', invertColor: false },
            { key: 'avgCpc', type: 'currency', invertColor: true }, // Lower is better
            { key: 'sessions', type: 'count', invertColor: false },
            { key: 'pageViews', type: 'count', invertColor: false },
            { key: 'unitsOrdered', type: 'count', invertColor: false },
            { key: 'avgSessionsPerDay', type: 'decimal', invertColor: false },
            { key: 'conversionRate', type: 'percent', invertColor: false }
        ];

        metrics.forEach(m => {
            const deltaEl = document.getElementById(`delta-${m.key}`);
            if (!deltaEl) return;

            // Get values
            let valA = Number(kA[m.key] || 0);
            let valB = Number(kB[m.key] || 0);

            const diff = valB - valA;
            const pctChange = valA !== 0 ? (diff / valA) * 100 : 0;

            // Determine direction
            let direction = 'neutral';
            if (diff !== 0) {
                // Invert color logic for metrics where lower is better
                if (m.invertColor) {
                    direction = diff > 0 ? 'negative' : 'positive';
                } else {
                    direction = diff > 0 ? 'positive' : 'negative';
                }
            }

            // Format the absolute difference
            let formattedDiff;
            if (m.type === 'currency') {
                formattedDiff = this.formatCurrency(Math.abs(diff));
            } else if (m.type === 'percent') {
                formattedDiff = Math.abs(diff).toFixed(1) + 'pp'; // percentage points
            } else if (m.type === 'decimal') {
                formattedDiff = Math.abs(diff).toFixed(2);
            } else {
                formattedDiff = Math.abs(diff).toLocaleString('en-IN');
            }

            // Add sign based on actual mathematical difference
            // If COMPARE (B) is less than PRIMARY (A), show negative (-)
            // If COMPARE (B) is more than PRIMARY (A), show positive (+)
            let impactSign;
            if (diff === 0) {
                impactSign = '';
            } else {
                impactSign = diff > 0 ? '+' : '-';
            }
            
            // Debug log for AD SPEND
            if (m.key === 'adSpend') {
                console.log(`🔍 AD SPEND Delta: PRIMARY=${valA}, COMPARE=${valB}, diff=${diff}, sign=${impactSign}`);
            }
            
            const absEl = deltaEl.querySelector('.delta-abs');
            const pctEl = deltaEl.querySelector('.delta-pct');

            if (absEl) {
                // Force the sign - ensure it matches the mathematical difference
                const finalText = `${impactSign}${formattedDiff}`;
                absEl.textContent = finalText;
                // Debug for AD SPEND
                if (m.key === 'adSpend') {
                    console.log(`✅ Setting AD SPEND delta text: "${finalText}"`);
                }
            }
            if (pctEl) {
                const finalPctText = `${impactSign}${Math.abs(pctChange).toFixed(1)}%`;
                pctEl.textContent = finalPctText;
                // Debug for AD SPEND
                if (m.key === 'adSpend') {
                    console.log(`✅ Setting AD SPEND percentage: "${finalPctText}"`);
                }
            }

            // Update class
            deltaEl.className = `metric-compare-delta ${direction}`;
        });
    }

    buildComparisonSummary() {
        const container = document.getElementById('comparisonSummaryGrid');
        if (!container) return;
        container.innerHTML = '';

        const kA = this.dataA.kpis || {};
        const kB = this.dataB.kpis || {};

        const metrics = [
            { key: 'totalSales', label: 'Total Sales', formatter: this.formatCurrency.bind(this) },
            { key: 'adSpend', label: 'Ad Spend', formatter: this.formatCurrency.bind(this) },
            { key: 'adSales', label: 'Ad Sales', formatter: this.formatCurrency.bind(this) },
            { key: 'acos', label: 'ACOS', formatter: this.formatPercent.bind(this) },
            { key: 'tcos', label: 'TCOS', formatter: this.formatPercent.bind(this) },
            { key: 'roas', label: 'ROAS', formatter: (v) => Number(v || 0).toFixed(2) },
            { key: 'sessions', label: 'Sessions', formatter: (v) => Number(v || 0).toLocaleString('en-IN') },
            { key: 'conversionRate', label: 'Conversion', formatter: this.formatPercent.bind(this) },
        ];

        metrics.forEach(m => {
            const a = Number(kA[m.key] || 0);
            const b = Number(kB[m.key] || 0);
            const diff = b - a;
            const pct = a !== 0 ? (diff / a) * 100 : 0;
            const direction = diff === 0 ? 'neutral' : (diff > 0 ? 'up' : 'down');

            const card = document.createElement('div');
            card.className = `comparison-summary-card direction-${direction}`;
            card.innerHTML = `
                <div class="summary-label">${m.label}</div>
                <div class="summary-values">
                    <span class="summary-a">${m.formatter(a)}</span>
                    <span class="summary-b">${m.formatter(b)}</span>
                </div>
                <div class="summary-delta">
                    <span class="delta-abs">${diff > 0 ? '+' : ''}${m.formatter(diff)}</span>
                    <span class="delta-pct">${pct > 0 ? '+' : ''}${pct.toFixed(1)}%</span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    setupChartControls() {
        const periodSelect = document.getElementById('comparisonChartPeriod');
        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                this.chartPeriod = e.target.value || 'daily';
                this.buildChart();
            });
        }

        const modeSelect = document.getElementById('comparisonChartMode');
        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                this.chartMode = e.target.value || 'overlay';
                this.buildChart();
            });
        }

        const metricToggle = document.getElementById('comparisonMetricToggle');
        const metricDropdown = document.getElementById('comparisonMetricDropdown');
        if (metricToggle && metricDropdown) {
            metricToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = metricDropdown.style.display === 'block';
                metricDropdown.style.display = isOpen ? 'none' : 'block';
            });
            metricDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target && e.target.matches('input[type="checkbox"][data-metric]')) {
                    const metric = e.target.getAttribute('data-metric');
                    if (e.target.checked) {
                        this.selectedChartMetrics.add(metric);
                    } else {
                        this.selectedChartMetrics.delete(metric);
                    }
                    this.buildChart();
                }
            });
            document.addEventListener('click', () => {
                metricDropdown.style.display = 'none';
            });
        }

        const fsBtn = document.getElementById('comparisonChartRotateFullscreen');
        if (fsBtn) {
            fsBtn.addEventListener('click', async () => {
                const chartSection = document.querySelector('.chart-section .chart-container');
                if (!chartSection) return;
                chartSection.classList.add('chart-fullscreen-active');
                try {
                    if (chartSection.requestFullscreen) {
                        await chartSection.requestFullscreen({ navigationUI: 'hide' });
                    }
                } catch (_) {}
            });
        }

        this.syncMetricCheckboxes();
    }

    syncMetricCheckboxes() {
        const metricDropdown = document.getElementById('comparisonMetricDropdown');
        if (!metricDropdown) return;
        metricDropdown.querySelectorAll('input[type="checkbox"][data-metric]').forEach(cb => {
            const metric = cb.getAttribute('data-metric');
            cb.checked = this.selectedChartMetrics.has(metric);
        });
    }

    buildChart() {
        const canvas = document.getElementById('comparisonChart');
        if (!canvas) return;

        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }

        // Build chart based on selected mode
        if (this.chartMode === 'normalized') {
            this.buildNormalizedChart();
        } else {
            this.buildDayWiseComparisonChart();
        }
    }

    buildDayWiseComparisonChart() {
        const canvas = document.getElementById('comparisonChart');
        if (!canvas) return;

        // Update day series first
        this.updateDaySeries();
        
        if (!this.daySeries || this.daySeries.length === 0) {
            return;
        }

        // Create day number labels for X-axis (Day 1, Day 2, etc.)
        const labels = this.daySeries.map((_, idx) => `Day ${idx + 1}`);
        
        // Extract data for each metric across all days
        const datasets = [];
        
        // All available metrics with their configurations
        const allMetrics = {
            totalSales: { label: 'Total Sales', color: '#28a745', colorB: '#90EE90' },
            adSales: { label: 'Ad Sales', color: '#ffc107', colorB: '#FFE082' },
            adSpend: { label: 'Ad Spend', color: '#007bff', colorB: '#64B5F6' },
            acos: { label: 'ACOS (%)', color: '#dc3545', colorB: '#EF9A9A' },
            tcos: { label: 'TCOS (%)', color: '#6f42c1', colorB: '#B39DDB' },
            sessions: { label: 'Sessions', color: '#17a2b8', colorB: '#80DEEA' },
            pageViews: { label: 'Page Views', color: '#20c997', colorB: '#80CBC4' },
            unitsOrdered: { label: 'Units Ordered', color: '#6610f2', colorB: '#B388FF' },
            conversionRate: { label: 'Conversion Rate (%)', color: '#e83e8c', colorB: '#F48FB1' }
        };

        // Show all metrics, but respect visibility
        Object.keys(allMetrics).forEach(metricKey => {
            const metric = allMetrics[metricKey];
            if (!metric) return;
            const isVisible = this.selectedChartMetrics.has(metricKey);
            
            // Range A dataset
            datasets.push({
                label: `${metric.label} (A)`,
                data: this.daySeries.map(day => day.metricsA?.[metricKey] || 0),
                borderColor: metric.color,
                backgroundColor: metric.color + '33',
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                metricKey: metricKey,
                rangeType: 'A',
                hidden: !isVisible
            });
            
            // Range B dataset
            datasets.push({
                label: `${metric.label} (B)`,
                data: this.daySeries.map(day => day.metricsB?.[metricKey] || 0),
                borderColor: metric.colorB,
                backgroundColor: metric.colorB + '33',
                borderDash: [5, 5],
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                metricKey: metricKey,
                rangeType: 'B',
                hidden: !isVisible
            });
        });

        try {
            this.chart = new Chart(canvas, {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                pointStyle: 'circle',
                                padding: 20,
                                font: { size: 12 },
                                boxWidth: 10,
                                boxHeight: 10,
                                generateLabels: (chart) => {
                                    const datasets = chart.data.datasets;
                                    const labels = [];
                                    const seenMetrics = new Set();
                                    
                                    // Create one legend item per metric (not per range)
                                    datasets.forEach((dataset, i) => {
                                        if (dataset.rangeType === 'A') {
                                            const metricName = dataset.label.replace(' (A)', '');
                                            if (!seenMetrics.has(metricName)) {
                                                seenMetrics.add(metricName);
                                                labels.push({
                                                    text: metricName,
                                                    fillStyle: dataset.borderColor,
                                                    strokeStyle: dataset.borderColor,
                                                    lineWidth: 2,
                                                    hidden: !chart.isDatasetVisible(i),
                                                    datasetIndex: i,
                                                    pointStyle: 'circle'
                                                    ,
                                                    className: chart.isDatasetVisible(i)
                                                        ? 'comparison-legend-item'
                                                        : 'comparison-legend-item legend-item-hidden'
                                                });
                                            }
                                        }
                                    });
                                    return labels;
                                }
                            },
                            onClick: (e, legendItem, legend) => {
                                const index = legendItem.datasetIndex;
                                const chart = legend.chart;
                                
                                // Toggle both A and B datasets for this metric
                                if (chart.isDatasetVisible(index)) {
                                    chart.hide(index);
                                    chart.hide(index + 1);
                                } else {
                                    chart.show(index);
                                    chart.show(index + 1);
                                }
                            }
                        },
                        tooltip: {
                            enabled: true,
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 12 },
                            padding: 14,
                            displayColors: true,
                            callbacks: {
                                title: (tooltipItems) => {
                                    if (tooltipItems.length === 0) return '';
                                    const dayIndex = tooltipItems[0].dataIndex;
                                    const dayData = this.daySeries[dayIndex];
                                    const dayNumber = dayIndex + 1;
                                    return `Day ${dayNumber}: ${dayData?.dateA || 'N/A'} vs ${dayData?.dateB || 'N/A'}`;
                                },
                                label: () => {
                                    // Don't show individual dataset labels
                                    return null;
                                },
                                afterBody: (tooltipItems) => {
                                    if (tooltipItems.length === 0) return [];
                                    
                                    const dayIndex = tooltipItems[0].dataIndex;
                                    const dayData = this.daySeries[dayIndex];
                                    if (!dayData) return [];
                                    
                                    const metricsA = dayData.metricsA || {};
                                    const metricsB = dayData.metricsB || {};
                                    
                                    const lines = [''];  // Add blank line after title
                                    
                                    const metricLabels = {
                                        totalSales: 'Total Sales',
                                        adSales: 'Ad Sales',
                                        adSpend: 'Ad Spend',
                                        acos: 'ACOS',
                                        tcos: 'TCOS',
                                        sessions: 'Sessions',
                                        pageViews: 'Page Views',
                                        unitsOrdered: 'Units Ordered',
                                        conversionRate: 'Conversion Rate'
                                    };
                                    
                                    const formatValue = (value, metricKey) => {
                                        if (['totalSales', 'adSales', 'adSpend'].includes(metricKey)) {
                                            return '₹' + Math.round(value).toLocaleString('en-IN');
                                        } else if (['acos', 'tcos', 'conversionRate'].includes(metricKey)) {
                                            return value.toFixed(1) + '%';
                                        }
                                        return Math.round(value).toLocaleString('en-IN');
                                    };
                                    
                                    // Show all selected metrics
                                    const metricsArray = ALL_COMPARISON_METRICS.filter(metricKey => this.selectedChartMetrics.has(metricKey));
                                    metricsArray.forEach((metricKey, index) => {
                                        const label = metricLabels[metricKey] || metricKey;
                                        lines.push(`${label} (A): ${formatValue(metricsA[metricKey] || 0, metricKey)}`);
                                        lines.push(`${label} (B): ${formatValue(metricsB[metricKey] || 0, metricKey)}`);
                                        if (index < metricsArray.length - 1) {
                                            lines.push('');
                                        }
                                    });
                                    
                                    return lines;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: '#6c757d', font: { size: 11 } }
                        },
                        y: {
                            type: 'linear',
                            position: 'left',
                            title: { display: true, text: 'Amount (₹) / Count' },
                            ticks: {
                                color: '#6c757d',
                                font: { size: 11 },
                                callback: (v) => '₹' + Number(v).toLocaleString('en-IN')
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating day-wise comparison chart:', error);
        }
    }

    buildNormalizedChart() {
        const canvas = document.getElementById('comparisonChart');
        if (!canvas) return;
        
        // Get fresh context
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Update day series first
        this.updateDaySeries();
        
        if (!this.daySeries || this.daySeries.length === 0) {
            return;
        }

        // Create day number labels for X-axis
        const labels = this.daySeries.map((_, idx) => `Day ${idx + 1}`);
        
        // All available metrics with their configurations
        const allMetrics = {
            totalSales: { label: 'Total Sales', color: '#28a745', colorB: '#90EE90' },
            adSales: { label: 'Ad Sales', color: '#ffc107', colorB: '#FFE082' },
            adSpend: { label: 'Ad Spend', color: '#007bff', colorB: '#64B5F6' },
            acos: { label: 'ACOS (%)', color: '#dc3545', colorB: '#EF9A9A' },
            tcos: { label: 'TCOS (%)', color: '#6f42c1', colorB: '#B39DDB' },
            sessions: { label: 'Sessions', color: '#17a2b8', colorB: '#80DEEA' },
            pageViews: { label: 'Page Views', color: '#20c997', colorB: '#80CBC4' },
            unitsOrdered: { label: 'Units Ordered', color: '#6610f2', colorB: '#B388FF' },
            conversionRate: { label: 'Conversion Rate (%)', color: '#e83e8c', colorB: '#F48FB1' }
        };

        const maxA = {}, maxB = {};
        Object.keys(allMetrics).forEach(metricKey => {
            const valuesA = this.daySeries.map(day => day.metricsA?.[metricKey] || 0);
            const valuesB = this.daySeries.map(day => day.metricsB?.[metricKey] || 0);
            maxA[metricKey] = Math.max(...valuesA, 0.001);
            maxB[metricKey] = Math.max(...valuesB, 0.001);
        });

        // Build datasets - TWO lines per metric (A and B), each with its own max
        const datasets = [];
        
        Object.keys(allMetrics).forEach(metricKey => {
            const metric = allMetrics[metricKey];
            if (!metric) return;
            const isVisible = this.selectedChartMetrics.has(metricKey);

            // A line - normalized to A's max
            const normA = this.daySeries.map(day => (day.metricsA?.[metricKey] || 0) / maxA[metricKey]);
            // B line - normalized to B's max
            const normB = this.daySeries.map(day => (day.metricsB?.[metricKey] || 0) / maxB[metricKey]);

            // A line (solid) - shown in legend
            datasets.push({
                label: metric.label, // No (A) suffix - cleaner legend
                data: normA,
                borderColor: metric.color,
                backgroundColor: metric.color + '33',
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                metricKey: metricKey,
                normDataB: normB,
                isSeriesA: true,
                hidden: !isVisible
            });

            // B line (dashed) - hidden from legend
            datasets.push({
                label: `${metric.label} (B)`,
                data: normB,
                borderColor: metric.colorB,
                backgroundColor: metric.colorB + '33',
                borderDash: [6, 4],
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                metricKey: metricKey,
                isSeriesA: false,
                hidden: !isVisible
            });
        });

        try {
            this.chart = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        title: {
                            display: false
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 15,
                                usePointStyle: true,
                                generateLabels: (chart) => {
                                    const datasets = chart.data.datasets;
                                    const labels = [];
                                    const seenMetrics = new Set();
                                    datasets.forEach((dataset, index) => {
                                        if (!dataset.isSeriesA) return;
                                        if (seenMetrics.has(dataset.label)) return;
                                        seenMetrics.add(dataset.label);
                                        labels.push({
                                            text: dataset.label,
                                            fillStyle: dataset.borderColor,
                                            strokeStyle: dataset.borderColor,
                                            lineWidth: 2,
                                            hidden: !chart.isDatasetVisible(index),
                                            datasetIndex: index,
                                            pointStyle: 'circle',
                                            className: chart.isDatasetVisible(index)
                                                ? 'comparison-legend-item'
                                                : 'comparison-legend-item legend-item-hidden'
                                        });
                                    });
                                    return labels;
                                }
                            },
                            onClick: (e, legendItem, legend) => {
                                const chart = legend.chart;
                                const datasetIndex = legendItem.datasetIndex;
                                const clickedDataset = chart.data.datasets[datasetIndex];
                                const metricKey = clickedDataset.metricKey;
                                
                                // Toggle both A and B datasets for this metric
                                chart.data.datasets.forEach((ds, idx) => {
                                    if (ds.metricKey === metricKey) {
                                        const isHidden = chart.getDatasetMeta(idx).hidden;
                                        chart.getDatasetMeta(idx).hidden = !isHidden;
                                    }
                                });
                                
                                chart.update();
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            titleColor: '#333',
                            bodyColor: '#666',
                            borderColor: '#ddd',
                            borderWidth: 1,
                            padding: 12,
                            callbacks: {
                                title: (items) => {
                                    if (items.length === 0) return '';
                                    const dayIdx = items[0].dataIndex;
                                    const dayInfo = this.daySeries[dayIdx];
                                    if (dayInfo) {
                                        return `Day ${dayIdx + 1}: ${dayInfo.dateA || ''} vs ${dayInfo.dateB || ''}`;
                                    }
                                    return items[0].label;
                                },
                                label: (context) => {
                                    // Only show A series in tooltip (includes B value)
                                    if (!context.dataset.isSeriesA) return null;
                                    
                                    const metricKey = context.dataset.metricKey;
                                    const valA = context.parsed.y;
                                    
                                    // Get B value from stored data
                                    const valB = context.dataset.normDataB?.[context.dataIndex] || 0;
                                    
                                    // "Total Sales: A=0.31, B=0.45"
                                    return `${context.dataset.label}: A=${valA.toFixed(2)}, B=${valB.toFixed(2)}`;
                                },
                                filter: (item) => {
                                    // Only show A series in tooltip
                                    return item.dataset.isSeriesA === true;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: '#6c757d', font: { size: 11 } }
                        },
                        y: {
                            type: 'linear',
                            position: 'left',
                            min: 0,
                            max: 1.05, // Slightly above 1 for visual padding
                            title: { display: true, text: 'Normalized Value (0-1)' },
                            ticks: {
                                color: '#6c757d',
                                font: { size: 11 },
                                stepSize: 0.25,
                                callback: (v) => (v * 100).toFixed(0) + '%'
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating normalized chart:', error);
        }
    }

    // Keep old timeline chart method for reference (not used anymore)
    buildTimelineChart_OLD() {
        const canvas = document.getElementById('comparisonChart');
        if (!canvas) return;

        // Use filtered data for chart
        const seriesA = this.aggregateRowsByDate(this.filteredRowsA, this.chartPeriod);
        const seriesB = this.aggregateRowsByDate(this.filteredRowsB, this.chartPeriod);

        const allLabelsSet = new Set([
            ...seriesA.labels,
            ...seriesB.labels
        ]);
        const labels = Array.from(allLabelsSet).sort();
        if (labels.length === 0) return;

        const map = (labelsArr, srcLabels, values) => {
            const mapObj = {};
            srcLabels.forEach((d, i) => { mapObj[d] = values[i]; });
            return labelsArr.map(d => (d in mapObj ? mapObj[d] : null));
        };

        // Metric configurations matching AD Reports
        const metricConfigs = {
            totalSales: { label: 'Total Sales', color: '#28a745', colorB: '#90EE90', yAxis: 'y', format: 'currency' },
            adSales: { label: 'Ad Sales', color: '#ffc107', colorB: '#FFE082', yAxis: 'y', format: 'currency' },
            adSpend: { label: 'Ad Spend', color: '#007bff', colorB: '#64B5F6', yAxis: 'y', format: 'currency' },
            acos: { label: 'ACOS (%)', color: '#dc3545', colorB: '#EF9A9A', yAxis: 'y1', format: 'percent' },
            tcos: { label: 'TCOS (%)', color: '#6f42c1', colorB: '#B39DDB', yAxis: 'y1', format: 'percent' },
            sessions: { label: 'Sessions', color: '#17a2b8', colorB: '#80DEEA', yAxis: 'y', format: 'count' },
            pageViews: { label: 'Page Views', color: '#20c997', colorB: '#80CBC4', yAxis: 'y', format: 'count' },
            unitsOrdered: { label: 'Units Ordered', color: '#6610f2', colorB: '#B388FF', yAxis: 'y', format: 'count' },
            conversionRate: { label: 'Conversion Rate (%)', color: '#e83e8c', colorB: '#F48FB1', yAxis: 'y1', format: 'percent' }
        };

        const datasets = [];
        this.selectedChartMetrics.forEach(metric => {
            const cfg = metricConfigs[metric];
            if (!cfg) return;
            
            datasets.push(
                {
                    label: `${cfg.label} (A)`,
                    data: map(labels, seriesA.labels, seriesA[metric]),
                    borderColor: cfg.color,
                    backgroundColor: cfg.color.replace(')', ',0.1)').replace('rgb', 'rgba').replace('#', 'rgba('),
                    tension: 0.3,
                    yAxisID: cfg.yAxis,
                    valueType: cfg.format
                },
                {
                    label: `${cfg.label} (B)`,
                    data: map(labels, seriesB.labels, seriesB[metric]),
                    borderColor: cfg.colorB,
                    backgroundColor: cfg.colorB.replace(')', ',0.1)').replace('rgb', 'rgba').replace('#', 'rgba('),
                    tension: 0.3,
                    borderDash: [6, 4],
                    yAxisID: cfg.yAxis,
                    valueType: cfg.format
                }
            );
        });

        const data = { labels, datasets };

        // Build scales
        const scales = {
            x: {
                grid: { display: false },
                ticks: { color: '#6c757d', font: { size: 11 } }
            }
        };

        // Add y-axis for currency/counts if any metric uses it
        const usesY = datasets.some(d => d.yAxisID === 'y');
        if (usesY) {
            scales.y = {
                type: 'linear',
                position: 'left',
                title: { display: true, text: 'Amount (₹) / Count' },
                ticks: {
                    color: '#6c757d',
                    font: { size: 11 },
                    callback: (v) => {
                        // Format as currency for readability
                        return '₹' + Number(v).toLocaleString('en-IN');
                    }
                }
            };
        }

        // Add y1-axis for percentages if any metric uses it
        const usesY1 = datasets.some(d => d.yAxisID === 'y1');
        if (usesY1) {
            scales.y1 = {
                type: 'linear',
                position: 'right',
                title: { display: true, text: 'Percentage (%)' },
                ticks: {
                    color: '#6c757d',
                    font: { size: 11 },
                    callback: (v) => v.toFixed(0) + '%'
                },
                grid: { drawOnChartArea: false }
            };
        }

        this.chart = new Chart(canvas, {
            type: 'line',
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const ds = ctx.dataset;
                                const val = ctx.parsed.y;
                                let formatted = val;
                                if (ds.valueType === 'currency') {
                                    formatted = '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
                                } else if (ds.valueType === 'percent') {
                                    formatted = val.toFixed(2) + '%';
                                } else {
                                    formatted = val.toLocaleString('en-IN');
                                }
                                return ds.label + ': ' + formatted;
                            }
                        }
                    }
                },
                scales
            }
        });
    }


    aggregateRowsByDate(rows, period = 'daily') {
        const byDate = new Map();
        // Check if campaign filters are active (to avoid double-counting business metrics)
        const filtersActive = this.selectedCampaigns.size > 0 || this.selectedKeywords.size > 0;
        const campaignFilterActive = this.selectedCampaigns.size > 0;
        
        rows.forEach(r => {
            const rawDate = r.date || r.report_date;
            if (!rawDate) return;
            const base = new Date(rawDate);
            let key;
            if (period === 'monthly') {
                key = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}`;
            } else if (period === 'weekly') {
                const tmp = new Date(base);
                tmp.setHours(0,0,0,0);
                const day = tmp.getDay() || 7; // Monday
                tmp.setDate(tmp.getDate() - (day - 1));
                const startOfYear = new Date(tmp.getFullYear(), 0, 1);
                const diffDays = Math.floor((tmp - startOfYear) / 86400000);
                const wk = Math.floor(diffDays / 7) + 1;
                key = `${tmp.getFullYear()}-W${String(wk).padStart(2,'0')}`;
            } else {
                key = String(rawDate).slice(0, 10);
            }
            if (!byDate.has(key)) {
                byDate.set(key, { 
                    adSpend: 0, 
                    adSales: 0, 
                    totalSales: 0, 
                    clicks: 0, 
                    sessions: 0, 
                    pageViews: 0, 
                    unitsOrdered: 0 
                });
            }
            const agg = byDate.get(key);
            
            // AD metrics: always sum (these are per-ad-row)
            agg.adSpend += Number(r.spend || r.cost || 0);
            agg.adSales += Number(r.sales || r.sales_1d || r.sales7d || 0);
            agg.clicks += Number(r.clicks || 0);
            
            // Business metrics: only when no filters are active
            if (!campaignFilterActive && r.hasBizData) {
                agg.totalSales += Number(r.totalSales || 0);
                agg.sessions += Number(r.sessions || 0);
                agg.pageViews += Number(r.pageViews || 0);
                agg.unitsOrdered += Number(r.unitsOrdered || 0);
            }
            // When campaign filter is active, business metrics stay at 0
        });
        
        const labels = Array.from(byDate.keys()).sort();
        const adSpend = labels.map(d => byDate.get(d).adSpend);
        const adSales = labels.map(d => byDate.get(d).adSales);
        const totalSales = labels.map(d => byDate.get(d).totalSales);
        const acos = labels.map(d => {
            const spend = byDate.get(d).adSpend;
            const sales = byDate.get(d).adSales;
            return sales > 0 ? (spend / sales) * 100 : 0;
        });
        const tcos = labels.map(d => {
            const spend = byDate.get(d).adSpend;
            const sales = byDate.get(d).totalSales;
            return sales > 0 ? (spend / sales) * 100 : 0;
        });
        const sessions = labels.map(d => byDate.get(d).sessions);
        const pageViews = labels.map(d => byDate.get(d).pageViews);
        const unitsOrdered = labels.map(d => byDate.get(d).unitsOrdered);
        const conversionRate = labels.map(d => {
            const sess = byDate.get(d).sessions;
            const units = byDate.get(d).unitsOrdered;
            return sess > 0 ? (units / sess) * 100 : 0;
        });
        
        return { labels, adSpend, adSales, totalSales, acos, tcos, sessions, pageViews, unitsOrdered, conversionRate };
    }


    async populateFilters() {
        // Fetch ALL campaigns from backend (not just current date range)
        const campaigns = new Set();
        const keywords = new Set();
        
        try {
            const base = this.getApiBase();
            // Fetch all campaigns from the database
            const res = await fetch(`${base}/api/analytics?getAllCampaigns=true`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.rows)) {
                    data.rows.forEach(r => {
                        if (r.campaignName) campaigns.add(r.campaignName);
                        if (r.keywords) keywords.add(r.keywords);
                    });
                }
            }
        } catch (err) {
            console.warn('Failed to fetch all campaigns, using current data:', err);
        }
        
        // Fallback: Also collect campaigns and keywords from currently loaded data
        this.dataA.rows.forEach(r => {
            if (r.campaignName) campaigns.add(r.campaignName);
            if (r.keywords) keywords.add(r.keywords);
        });
        this.dataB.rows.forEach(r => {
            if (r.campaignName) campaigns.add(r.campaignName);
            if (r.keywords) keywords.add(r.keywords);
        });

        const campaignFilter = document.getElementById('campaignFilter');
        const keywordFilter = document.getElementById('keywordFilter');

        if (!campaignFilter || !keywordFilter) return;

        // Render custom multi-selects with tags + live filter input and tick checkboxes
        // Campaign filter: show tags/chips with campaign names
        this.renderMultiSelect('campaignFilter', Array.from(campaigns).sort(), Array.from(this.selectedCampaigns), 'Filter Campaigns...', (vals) => {
            this.selectedCampaigns = new Set(vals);
            this.applyFilters();
        }, { open: false, query: '' }, true); // true = show tags
        
        // Keyword filter: show only count in placeholder (no tags)
        this.renderMultiSelect('keywordFilter', Array.from(keywords).sort(), Array.from(this.selectedKeywords), 'Filter Keywords...', (vals) => {
            this.selectedKeywords = new Set(vals);
            this.applyFilters();
        }, { open: false, query: '' }, false); // false = show count only
    }

    applyFilters() {
        // Filter data for both ranges
        this.filteredRowsA = this.getFilteredRowsForRange(this.dataA.rows);
        this.filteredRowsB = this.getFilteredRowsForRange(this.dataB.rows);
        
        // Recalculate KPIs from filtered data
        this.recalculateKpisFromFiltered();
        
        // Update chart with filtered data
        this.buildChart();
        
        this.refreshDaySelector();
    }

    getFilteredRowsForRange(rows) {
        let filtered = [...rows];
        
        if (this.selectedCampaigns.size > 0) {
            filtered = filtered.filter(r => this.selectedCampaigns.has(r.campaignName || ''));
        }
        
        if (this.selectedKeywords.size > 0) {
            filtered = filtered.filter(r => this.selectedKeywords.has(r.keywords || ''));
        }
        
        // After filtering, ensure first row of each date has hasBizData flag
        const datesSeen = new Set();
        filtered = filtered.map(row => {
            const date = String(row.date || row.report_date || '').slice(0, 10);
            if (!datesSeen.has(date)) {
                datesSeen.add(date);
                // First row of this date gets the flag, regardless of whether values are > 0
                return { ...row, hasBizData: true };
            }
            return { ...row, hasBizData: false };
        });
        
        return filtered;
    }

    recalculateKpisFromFiltered() {
        // Check if any filters are active
        const filtersActive = this.selectedCampaigns.size > 0 || this.selectedKeywords.size > 0;
        const campaignFilterActive = this.selectedCampaigns.size > 0;
        
        // Calculate KPIs from filtered data
        const calculateKpis = (rows) => {
            if (!rows || rows.length === 0) {
                return {
                    adSpend: 0,
                    adSales: 0,
                    totalSales: 0,
                    acos: 0,
                    tcos: 0,
                    roas: 0,
                    adClicks: 0,
                    avgCpc: 0,
                    sessions: 0,
                    pageViews: 0,
                    unitsOrdered: 0,
                    avgSessionsPerDay: 0,
                    conversionRate: 0
                };
            }

            // AD metrics: sum across ALL filtered rows (across all days in range)
            const adSpend = rows.reduce((sum, r) => sum + Number(r.spend || r.cost || 0), 0);
            const adSales = rows.reduce((sum, r) => sum + Number(r.adSales || r.sales || r.sales_1d || 0), 0);
            const adClicks = rows.reduce((sum, r) => sum + Number(r.clicks || 0), 0);
            
            // Business metrics calculation
            let totalSales = 0, sessions = 0, pageViews = 0, unitsOrdered = 0, dayCount = 1;
            
            if (!filtersActive) {
                // No filters: use RAW business data directly (same as business reports page)
                // This ensures we get the exact same totals as business reports, regardless of ad data
                const rawBizData = rows === this.filteredRowsA ? (this.rawBizDataA || []) : (this.rawBizDataB || []);
                
                // Sum ALL business rows for the date range (exactly like business reports does)
                rawBizData.forEach(row => {
                    totalSales += Number(row.ordered_product_sales || row.totalSales || 0);
                    sessions += Number(row.sessions || 0);
                    pageViews += Number(row.page_views || row.pageViews || 0);
                    unitsOrdered += Number(row.units_ordered || row.unitsOrdered || 0);
                });
                
                // Count unique dates in raw business data
                const uniqueDates = new Set(rawBizData.map(r => String(r.date || '').slice(0, 10)).filter(d => d));
                dayCount = uniqueDates.size || 1;
            } else if (campaignFilterActive) {
                // Campaign filter active: Business metrics not available
                // Just show ad metrics when filtering by campaign
                totalSales = 0;
                sessions = 0;
                pageViews = 0;
                unitsOrdered = 0;
                dayCount = 1;
            }
            // If keyword filter is active but no campaign filter, business metrics remain 0
            // (keywords don't map to products, only campaigns do)

            return {
                adSpend,
                adSales,
                totalSales,
                acos: adSales > 0 ? (adSpend / adSales) * 100 : 0,
                tcos: totalSales > 0 ? (adSpend / totalSales) * 100 : 0,
                roas: adSpend > 0 ? adSales / adSpend : 0,
                adClicks,
                avgCpc: adClicks > 0 ? adSpend / adClicks : 0,
                sessions,
                pageViews,
                unitsOrdered,
                avgSessionsPerDay: sessions / dayCount,
                conversionRate: sessions > 0 ? (unitsOrdered / sessions) * 100 : 0
            };
        };

        this.dataA.kpis = calculateKpis(this.filteredRowsA);
        this.dataB.kpis = calculateKpis(this.filteredRowsB);
        
        this.renderKpis();
    }

    calculateAcos(spend, sales) {
        spend = Number(spend || 0);
        sales = Number(sales || 0);
        if (sales <= 0) return 0;
        return (spend / sales) * 100;
    }

    calculateRoas(spend, sales) {
        spend = Number(spend || 0);
        sales = Number(sales || 0);
        if (spend <= 0) return 0;
        return sales / spend;
    }

    calculateCpc(spend, clicks) {
        spend = Number(spend || 0);
        clicks = Number(clicks || 0);
        if (clicks <= 0) return 0;
        return spend / clicks;
    }

    calculateCtr(clicks, impressions) {
        clicks = Number(clicks || 0);
        impressions = Number(impressions || 0);
        if (impressions <= 0) return 0;
        return (clicks / impressions) * 100;
    }


    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    renderMultiSelect(targetId, items, selectedValues, placeholder, onChange, initialState = { open: false, query: '' }, showTags = false) {
        const anchor = document.getElementById(targetId);
        if (!anchor) return;
        // Hide native control
        anchor.style.display = 'none';
        const containerId = `${targetId}-ms`;
        let container = document.getElementById(containerId);
        
        // Preserve query state from existing input (if any)
        let existingQuery = '';
        if (container) {
            const existingInput = container.querySelector('.ms-input');
            if (existingInput) existingQuery = existingInput.value || '';
        }
        
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'ms-container';
            anchor.parentNode.insertBefore(container, anchor.nextSibling);
        }

        // Always rebuild structure to update options list
        container.innerHTML = `
            <div class="ms-control">
                <div class="ms-tags"></div>
                <input class="ms-input" placeholder="${this.escapeHtml(placeholder)}" />
            </div>
            <div class="ms-dropdown" style="display:none"></div>
        `;

        const input = container.querySelector('.ms-input');
        const tagsEl = container.querySelector('.ms-tags');
        const dropdown = container.querySelector('.ms-dropdown');
        
        // Set initial tags container visibility based on showTags parameter
        if (tagsEl) {
            if (!showTags) {
                tagsEl.style.display = 'none';
                tagsEl.style.visibility = 'hidden';
                tagsEl.style.height = '0';
                tagsEl.style.width = '0';
                tagsEl.style.overflow = 'hidden';
            } else {
                tagsEl.style.display = 'flex';
                tagsEl.style.visibility = 'visible';
                tagsEl.style.height = 'auto';
                tagsEl.style.width = 'auto';
                tagsEl.style.overflow = 'visible';
                tagsEl.style.flexWrap = 'wrap';
                tagsEl.style.gap = '4px';
                tagsEl.style.alignItems = 'center';
                tagsEl.style.padding = '2px 4px';
            }
        }

        // Filter to only include items that are in the current items list
        const itemsSet = new Set(items || []);
        const finalSelectedValues = (selectedValues || []).filter(v => itemsSet.has(v));
        
        const state = {
            selected: new Set(finalSelectedValues.filter(Boolean)),
            query: initialState.query || existingQuery || ''
        };

        const updateInputPlaceholder = () => {
            const count = state.selected.size;
            if (showTags) {
                input.placeholder = placeholder;
            } else {
                if (count > 0) {
                    input.placeholder = `${count} selected`;
                } else {
                    input.placeholder = placeholder;
                }
            }
        };

        const syncTags = () => {
            if (showTags) {
                if (tagsEl) {
                    tagsEl.innerHTML = '';
                    state.selected.forEach(val => {
                        const tag = document.createElement('span');
                        tag.className = 'ms-tag';
                        tag.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: #e3f2fd; color: #1976d2; border-radius: 12px; font-size: 12px; margin: 2px;';
                        tag.innerHTML = `${this.escapeHtml(val)}<button type="button" class="ms-remove" aria-label="Remove" style="background: none; border: none; color: #1976d2; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 4px; margin-left: 4px;">×</button>`;
                        
                        const removeBtn = tag.querySelector('.ms-remove');
                        removeBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            state.selected.delete(val);
                            syncTags();
                            syncOptions();
                            updateInputPlaceholder();
                            onChange(Array.from(state.selected));
                        });
                        
                        tagsEl.appendChild(tag);
                    });
                    tagsEl.style.display = state.selected.size > 0 ? 'flex' : 'none';
                }
            } else {
                if (tagsEl) {
                    tagsEl.innerHTML = '';
                    tagsEl.style.display = 'none';
                    tagsEl.style.visibility = 'hidden';
                    tagsEl.style.height = '0';
                    tagsEl.style.width = '0';
                    tagsEl.style.overflow = 'hidden';
                }
            }
            updateInputPlaceholder();
        };

        const addOption = (val, isSelected, isSelectedNotMatching) => {
            const option = document.createElement('div');
            option.className = 'ms-option';
            option.dataset.value = val;
            
            const id = `ms-opt-${targetId}-${Math.random().toString(36).slice(2)}`;
            const checked = isSelected ? 'checked' : '';
            const notMatchingStyle = isSelectedNotMatching ? 'opacity: 0.7; font-style: italic; color: #666;' : '';
            const notMatchingLabel = isSelectedNotMatching ? '<span style="font-size: 12px; color: #999; margin-left: auto;">(selected)</span>' : '';
            
            option.innerHTML = `
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 8px;">
                    <input type="checkbox" id="${id}" ${checked} />
                    <span style="${notMatchingStyle}">${this.escapeHtml(val)}</span>
                    ${notMatchingLabel}
                </label>
            `;
            
            const cb = option.querySelector('input[type="checkbox"]');
            cb.addEventListener('change', (e) => {
                if (cb.checked) {
                    state.selected.add(val);
                } else {
                    state.selected.delete(val);
                }
                input.value = '';
                syncTags();
                syncOptions();
                updateInputPlaceholder();
                onChange(Array.from(state.selected));
                dropdown.style.display = 'block';
                input.focus();
            });
            
            dropdown.appendChild(option);
        };

        const syncOptions = () => {
            const q = state.query.toLowerCase();
            dropdown.innerHTML = '';
            
            // Add "All Items" option at top
            const allOption = document.createElement('div');
            allOption.className = 'ms-option';
            allOption.textContent = 'All Items';
            allOption.style.padding = '6px 8px';
            allOption.style.cursor = 'pointer';
            allOption.addEventListener('mousedown', (e) => {
                e.preventDefault();
                state.selected.clear();
                input.value = '';
                syncTags();
                syncOptions();
                updateInputPlaceholder();
                onChange(Array.from(state.selected));
            });
            dropdown.appendChild(allOption);
            
            // Add separator if there are selected items
            if (state.selected.size > 0) {
                const separator = document.createElement('div');
                separator.className = 'ms-option-separator';
                separator.style.height = '1px';
                separator.style.backgroundColor = '#e0e0e0';
                separator.style.margin = '4px 0';
                dropdown.appendChild(separator);
            }
            
            // Get all items
            const allItems = Array.from(items || []);
            
            // If no search term, show all items with selected ones at top
            if (!q || q.trim() === '') {
                const selectedItems = Array.from(state.selected);
                const otherItems = allItems.filter(item => !state.selected.has(item));
                const orderedItems = [...selectedItems, ...otherItems];
                
                orderedItems.forEach(item => {
                    addOption(item, state.selected.has(item), false);
                });
            } else {
                // Filter items based on search term
                const filteredItems = allItems.filter(item => 
                    item.toLowerCase().includes(q)
                );
                
                // Always show selected items at the top, even if they don't match search
                const selectedItems = Array.from(state.selected);
                const selectedInSearch = selectedItems.filter(item => 
                    item.toLowerCase().includes(q)
                );
                const selectedNotInSearch = selectedItems.filter(item => 
                    !item.toLowerCase().includes(q)
                );
                
                // Combine: selected items (matching search) + other matching items + selected items (not matching search)
                const orderedItems = [
                    ...selectedInSearch,
                    ...filteredItems.filter(item => !state.selected.has(item)),
                    ...selectedNotInSearch
                ];
                
                orderedItems.forEach(item => {
                    const isSelected = state.selected.has(item);
                    const isSelectedNotMatching = isSelected && !item.toLowerCase().includes(q);
                    addOption(item, isSelected, isSelectedNotMatching);
                });
                
                // Show "No results" if no matches
                if (filteredItems.length === 0 && selectedInSearch.length === 0) {
                    const noResults = document.createElement('div');
                    noResults.className = 'ms-option';
                    noResults.textContent = 'No matching items found';
                    noResults.style.color = '#999';
                    noResults.style.cursor = 'default';
                    noResults.style.padding = '6px 8px';
                    dropdown.appendChild(noResults);
                }
            }
            
            // Add "Clear All" option at bottom if there are selections
            if (state.selected.size > 0) {
                const clearAllOption = document.createElement('div');
                clearAllOption.className = 'ms-option';
                clearAllOption.textContent = 'Clear All';
                clearAllOption.style.color = '#e74c3c';
                clearAllOption.style.fontWeight = '500';
                clearAllOption.style.padding = '6px 8px';
                clearAllOption.style.cursor = 'pointer';
                clearAllOption.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    state.selected.clear();
                    input.value = '';
                    syncTags();
                    syncOptions();
                    updateInputPlaceholder();
                    onChange(Array.from(state.selected));
                });
                dropdown.appendChild(clearAllOption);
            }
        };

        // Input focus/click events - show dropdown
        input.addEventListener('focus', () => {
            input.value = '';
            dropdown.style.display = 'block';
            updateInputPlaceholder();
            syncOptions();
        });
        
        input.addEventListener('click', () => {
            input.value = '';
            dropdown.style.display = 'block';
            updateInputPlaceholder();
            syncOptions();
        });
        
        // Enter or Escape clears only the search text
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                input.value = '';
                state.query = '';
                dropdown.style.display = 'block';
                syncOptions();
            }
        });
        
        // Input search - show dropdown when user types
        input.addEventListener('input', (e) => {
            state.query = e.target.value.trim();
            dropdown.style.display = 'block';
            syncOptions();
        });
        
        // Blur handling with delay to allow clicks inside dropdown
        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (!dropdown.contains(document.activeElement) && 
                    !dropdown.matches(':hover')) {
                    dropdown.style.display = 'none';
                    input.value = '';
                    updateInputPlaceholder();
                }
            }, 200);
        });
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        syncTags();
        input.value = state.query || '';
        syncOptions();
        updateInputPlaceholder();
        
        if (initialState.open) {
            dropdown.style.display = 'block';
            input.focus();
        }
    }

    refreshDaySelector() {
        this.updateDaySeries();
        this.renderDaySelector();
        this.renderDayInsights();
    }

    updateDaySeries() {
        const datesA = this.generateDateRangeArray(this.rangeA?.startStr, this.rangeA?.endStr);
        const datesB = this.generateDateRangeArray(this.rangeB?.startStr, this.rangeB?.endStr);
        const dayCount = Math.max(datesA.length, datesB.length);
        const mapA = this.groupRowsByDate(this.filteredRowsA);
        const mapB = this.groupRowsByDate(this.filteredRowsB);

        // Sequential comparison: 1st date of A vs 1st date of B, 2nd vs 2nd, etc.
        const series = [];
        for (let i = 0; i < dayCount; i++) {
            const dateA = datesA[i] || null;
            const dateB = datesB[i] || null;
            const rowsA = dateA ? (mapA[dateA] || []) : [];
            const rowsB = dateB ? (mapB[dateB] || []) : [];

            series.push({
                dateA,
                dateB,
                metricsA: this.calculateMetricsFromRows(rowsA),
                metricsB: this.calculateMetricsFromRows(rowsB)
            });
        }

        this.daySeries = series;
        if (this.selectedDayIndex >= series.length) {
            this.selectedDayIndex = Math.max(0, series.length - 1);
        }
    }

    renderDaySelector() {
        // Day selector pills removed - chart now shows all days directly
        const container = document.getElementById('daySelectorPills');
        if (container) {
            container.innerHTML = '';
        }
    }

    renderDayInsights() {
        // Insight cards removed - all data shown in chart tooltip
    }

    toMetricLabel(key) {
        const map = {
            totalSales: 'Total Sales',
            adSpend: 'Ad Spend',
            adSales: 'Ad Sales',
            roas: 'ROAS'
        };
        return map[key] || key;
    }

    generateDateRangeArray(start, end) {
        if (!start || !end) return [];
        const startDate = this.parseYmd(start);
        const endDate = this.parseYmd(end);
        if (isNaN(startDate) || isNaN(endDate)) return [];
        const dates = [];
        const cursor = new Date(startDate);
        while (cursor <= endDate) {
            dates.push(this.toInputDate(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        return dates;
    }

    groupRowsByDate(rows) {
        return rows.reduce((acc, row) => {
            const key = this.normalizeRowDate(row);
            if (!key) return acc;
            if (!acc[key]) acc[key] = [];
            acc[key].push(row);
            return acc;
        }, {});
    }

    normalizeRowDate(row) {
        const raw = row.date || row.report_date;
        if (!raw) return null;
        // Extract date string directly (YYYY-MM-DD format)
        const dateStr = String(raw).slice(0, 10);
        // Validate format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
        return dateStr;
    }

    calculateMetricsFromRows(rows) {
        if (!rows || rows.length === 0) {
            return { 
                adSpend: 0, totalSales: 0, adSales: 0, roas: 0, acos: 0, tcos: 0,
                sessions: 0, pageViews: 0, unitsOrdered: 0, conversionRate: 0,
                adClicks: 0, avgCPC: 0, avgSessionsPerDay: 0
            };
        }
        
        // AD metrics: sum across all rows (multiple campaigns/keywords per day)
        const adSpend = rows.reduce((sum, r) => sum + Number(r.spend || r.cost || 0), 0);
        const adSales = rows.reduce((sum, r) => sum + Number(r.adSales || r.sales || r.sales_1d || 0), 0);
        const adClicks = rows.reduce((sum, r) => sum + Number(r.clicks || 0), 0);
        
        // Business metrics calculation
        let totalSales = 0, sessions = 0, pageViews = 0, unitsOrdered = 0;
        
        const campaignFilterActive = this.selectedCampaigns.size > 0;
        
        if (!campaignFilterActive) {
            // No campaign filter: use hasBizData flag to avoid double counting
            // Since all rows for a date have the same business data but only first has the flag,
            // this ensures we count each day's business metrics exactly once
            totalSales = rows.reduce((sum, r) => sum + (r.hasBizData ? Number(r.totalSales || r.ordered_product_sales || 0) : 0), 0);
            sessions = rows.reduce((sum, r) => sum + (r.hasBizData ? Number(r.sessions || 0) : 0), 0);
            pageViews = rows.reduce((sum, r) => sum + (r.hasBizData ? Number(r.pageViews || r.page_views || 0) : 0), 0);
            unitsOrdered = rows.reduce((sum, r) => sum + (r.hasBizData ? Number(r.unitsOrdered || r.units_ordered || 0) : 0), 0);
        } else {
            // Campaign filter active: aggregate business metrics by SKU to avoid double counting
            // Since campaigns are mapped to products by SKU, we aggregate by SKU
            const bizBySku = new Map();
            
            rows.forEach(row => {
                const sku = String(row.sku || '').trim();
                
                // Only include rows that have a mapped SKU (campaign-to-product mapping)
                // Include all rows with SKU (both proper matches and fallback matches)
                if (sku && sku !== '' && sku !== 'null') {
                    if (!bizBySku.has(sku)) {
                        bizBySku.set(sku, {
                            totalSales: 0,
                            sessions: 0,
                            pageViews: 0,
                            unitsOrdered: 0
                        });
                    }
                    
                    const bizData = bizBySku.get(sku);
                    // Use the business data from the row (already merged in mergeAdAndBusinessData)
                    // These values are already from the matched product, so we sum them per SKU
                    bizData.totalSales += Number(row.totalSales || 0);
                    bizData.sessions += Number(row.sessions || 0);
                    bizData.pageViews += Number(row.pageViews || row.page_views || 0);
                    bizData.unitsOrdered += Number(row.unitsOrdered || row.units_ordered || 0);
                }
            });
            
            // Sum up all unique SKUs
            bizBySku.forEach(bizData => {
                totalSales += bizData.totalSales;
                sessions += bizData.sessions;
                pageViews += bizData.pageViews;
                unitsOrdered += bizData.unitsOrdered;
            });
        }
        
        const roas = adSpend > 0 ? adSales / adSpend : 0;
        const acos = adSales > 0 ? (adSpend / adSales) * 100 : 0;
        const tcos = totalSales > 0 ? (adSpend / totalSales) * 100 : 0;
        const conversionRate = sessions > 0 ? (unitsOrdered / sessions) * 100 : 0;
        const avgCPC = adClicks > 0 ? adSpend / adClicks : 0;
        
        // avgSessionsPerDay: This function is called per day, so just use sessions as-is
        const avgSessionsPerDay = sessions;
        
        return { 
            adSpend, adSales, totalSales, roas, acos, tcos,
            sessions, pageViews, unitsOrdered, conversionRate,
            adClicks, avgCPC, avgSessionsPerDay
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Ensure SheetJS is available for export (loaded globally on index page; for this page we expect same pattern)
    window.comparisonReportInstance = new ComparisonReport();
});


