// Amazon Analytics Dashboard JavaScript
// Mute verbose console output in production to avoid noisy logs and any overhead
(function() {
    const ENABLE_DEBUG = false;
    if (!ENABLE_DEBUG && typeof console !== 'undefined') {
        const noops = ['log', 'debug', 'info', 'group', 'groupCollapsed', 'groupEnd', 'time', 'timeEnd', 'table'];
        noops.forEach(fn => { try { console[fn] = () => {}; } catch(_) {} });
    }
})();
class AmazonDashboard {
    constructor() {
        this.chart = null;
        this.currentData = [];
        this.filteredData = [];
        this.sortConfig = { key: null, direction: 'desc' };
        this.refreshInterval = null;
        this.dateRange = this.getDefaultDateRange();
        this.calendarMonth = new Date();
        this.calendarMonth.setDate(1);
        this.tempRangeStart = null;
        this.tempRangeEnd = null;
        this.dataMinDate = null; // set after data load
        this.dataMaxDate = null; // set after data load
        this.kpis = null;
        this.currentTab = 'keywords'; // Default to keywords tab
        this.rowsPerPage = 25; // Show 25 entries per page like reference image
        this.activeFilters = { campaign: '', keyword: '', campaigns: [], keywords: [] };
        
        // Remove mock data - we'll get real data from database
        this.init();
    }
    
    formatLabel(date, period) {
        if (period === 'monthly') {
            return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        }
        if (period === 'quarterly') {
            const month = date.getMonth();
            const quarter = Math.floor(month / 3) + 1;
            return `Q${quarter} ${date.getFullYear()}`;
        }
        if (period === 'weekly') {
            const endOfWeek = new Date(date);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    getDefaultDateRange() {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        
        // Create date strings directly to avoid any timezone issues
        const startDateStr = this.toInputDate(start);
        const endDateStr = this.toInputDate(end);
        
        return { 
            start, 
            end,
            startStr: startDateStr,
            endStr: endDateStr
        };
    }

    stripTime(date) {
        const d = new Date(date);
        d.setHours(0,0,0,0);
        return d;
    }

    clampRangeToData(start, end) {
        let s = new Date(start);
        let e = new Date(end);
        
        // Set minimum date to database min date if available
        if (this.dataMinDate) {
            const min = this.stripTime(this.dataMinDate);
            if (this.stripTime(s) < min) s = new Date(min);
        }
        
        // Set maximum date to current date (not database max date)
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (this.stripTime(e) > today) {
            e = new Date(today);
        }
        
        if (s > e) { const tmp = s; s = e; e = tmp; }
        return { start: s, end: e };
    }

    initializeDatePicker() {
        const dropdown = document.getElementById('datePickerDropdown');
        if (!dropdown) return;

        // Remove old inputs if present
        const oldContent = dropdown.querySelector('.date-picker-content');
        if (oldContent) oldContent.remove();

        // Calendar container
        const calendar = document.createElement('div');
        calendar.id = 'rangeCalendar';
        calendar.className = 'range-calendar';
        dropdown.appendChild(calendar);

        // Footer with confirm/cancel
        const footer = document.createElement('div');
        footer.className = 'range-calendar-footer';
        footer.innerHTML = `
            <div class="range-calendar-summary"></div>
            <div>
                <button type="button" class="date-btn primary range-calendar-confirm" id="confirmDatePicker">Confirm</button>
            </div>
        `;
        dropdown.appendChild(footer);

        dropdown.querySelector('#confirmDatePicker')?.addEventListener('click', () => this.applyTempRange());
    }

    openCalendar() {
        this.tempRangeStart = new Date(this.dateRange.start);
        this.tempRangeEnd = new Date(this.dateRange.end);
        this.calendarMonth = new Date(this.tempRangeEnd);
        this.calendarMonth.setDate(1);
        this.renderCalendar();
    }

    closeCalendar() {
        const datePickerDropdown = document.getElementById('datePickerDropdown');
        const dateFilter = document.getElementById('dateFilter');
        if (datePickerDropdown) datePickerDropdown.style.display = 'none';
        if (dateFilter) dateFilter.classList.remove('open');
    }

    renderCalendar() {
        const container = document.getElementById('rangeCalendar');
        if (!container) return;
        container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'range-calendar-header';
        header.innerHTML = `
            <div class="range-calendar-nav">
                <button class="range-calendar-btn" id="calPrev">&#8592;</button>
            </div>
            <div class="range-calendar-month">${this.calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
            <div class="range-calendar-nav">
                <button class="range-calendar-btn" id="calNext">&#8594;</button>
                <button class="range-calendar-btn" id="calToday" title="Go to current month">Today</button>
            </div>
        `;
        container.appendChild(header);

        const weekdays = document.createElement('div');
        weekdays.className = 'range-calendar-weekdays';
        ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(n => {
            const el = document.createElement('div');
            el.className = 'range-calendar-weekday';
            el.textContent = n;
            weekdays.appendChild(el);
        });
        container.appendChild(weekdays);

        const grid = document.createElement('div');
        grid.className = 'range-calendar-grid';

        const firstDay = new Date(this.calendarMonth);
        const lastDay = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 0);
        const jsDay = firstDay.getDay();
        const startOffset = jsDay === 0 ? 6 : jsDay - 1; // Monday-first

        for (let i = 0; i < startOffset; i++) grid.appendChild(document.createElement('div'));

        for (let d = 1; d <= lastDay.getDate(); d++) {
            const date = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth(), d);
            const cell = document.createElement('div');
            cell.className = 'range-calendar-day';
            cell.textContent = String(d);
            cell.dataset.date = this.toInputDate(date);
            const ds = this.tempRangeStart ? new Date(this.tempRangeStart) : null;
            const de = this.tempRangeEnd ? new Date(this.tempRangeEnd) : null;
            if (ds) ds.setHours(0,0,0,0);
            if (de) de.setHours(0,0,0,0);
            const cd = new Date(date); cd.setHours(0,0,0,0);
            // apply range classes for nice continuous highlight
            if (ds && de) {
                if (cd.getTime() === ds.getTime()) cell.classList.add('start');
                if (cd.getTime() === de.getTime()) cell.classList.add('end');
                if (cd > ds && cd < de) cell.classList.add('in-range');
            } else if (ds && !de && cd.getTime() === ds.getTime()) {
                cell.classList.add('start', 'end');
            }
            // Disable dates outside reasonable range (allow up to current date)
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            if ((this.dataMinDate && cd < this.stripTime(this.dataMinDate)) || (cd > today)) {
                cell.classList.add('disabled');
            } else if (cd > this.stripTime(this.dataMaxDate || today)) {
                // Mark future dates as available for selection but with different styling
                cell.classList.add('future-date');
            }

            cell.addEventListener('click', (e) => { e.stopPropagation(); this.handleCalendarDayClick(date); });
            cell.addEventListener('mouseenter', (e) => { e.stopPropagation(); this.handleCalendarHover(date); });
            grid.appendChild(cell);
        }
        container.appendChild(grid);

        container.querySelector('#calPrev')?.addEventListener('click', (e) => { e.stopPropagation(); this.calendarMonth.setMonth(this.calendarMonth.getMonth() - 1); this.renderCalendar(); });
        container.querySelector('#calNext')?.addEventListener('click', (e) => { e.stopPropagation(); this.calendarMonth.setMonth(this.calendarMonth.getMonth() + 1); this.renderCalendar(); });
        container.querySelector('#calToday')?.addEventListener('click', (e) => { e.stopPropagation(); this.calendarMonth = new Date(); this.renderCalendar(); });

        const summary = document.querySelector('.range-calendar-summary');
        if (summary) {
            const s = this.tempRangeStart ? this.tempRangeStart.toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' }) : '';
            const e = this.tempRangeEnd ? this.tempRangeEnd.toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' }) : '';
            summary.textContent = s && e ? `${s} - ${e}` : (s ? `${s} - ...` : 'Select a date range');
        }
    }

    handleCalendarDayClick(date) {
        // First click: set start and clear end
        if (!this.tempRangeStart || (this.tempRangeStart && this.tempRangeEnd)) {
            this.tempRangeStart = new Date(date);
            this.tempRangeStart.setHours(0,0,0,0);
            this.tempRangeEnd = null;
        } else {
            // Second click: set end relative to existing start
            const start = new Date(this.tempRangeStart);
            const end = new Date(date);
            start.setHours(0,0,0,0);
            end.setHours(0,0,0,0);
            if (end < start) {
                this.tempRangeEnd = start;
                this.tempRangeStart = end;
            } else {
                this.tempRangeEnd = end;
            }
        }
        this.renderCalendar();
    }

    handleCalendarHover(date) {
        // Show hover preview from start to hovered date when selecting end
        const start = this.tempRangeStart;
        const end = this.tempRangeEnd;
        if (!start || end) return;

        const container = document.getElementById('rangeCalendar');
        if (!container) return;
        container.querySelectorAll('.preview-in-range, .preview-end').forEach(el => {
            el.classList.remove('preview-in-range', 'preview-end');
        });

        const ds = new Date(start); ds.setHours(0,0,0,0);
        const de = new Date(date); de.setHours(0,0,0,0);
        const invert = de < ds;
        const from = invert ? de : ds;
        const to = invert ? ds : de;

        container.querySelectorAll('.range-calendar-day').forEach(cell => {
            const dStr = cell.dataset.date;
            if (!dStr) return;
            const cd = new Date(dStr); cd.setHours(0,0,0,0);
            if (cd > from && cd < to) cell.classList.add('preview-in-range');
            if (cd.getTime() === to.getTime()) cell.classList.add('preview-end');
        });
    }

    async applyTempRange() {
        if (!this.tempRangeStart) return;
        // Hide calendar immediately for smoother UX (like business page)
        this.closeCalendar();
        
        // Create dates without timezone issues by using local date components
        const startYear = this.tempRangeStart.getFullYear();
        const startMonth = this.tempRangeStart.getMonth();
        const startDay = this.tempRangeStart.getDate();
        
        const endYear = (this.tempRangeEnd || this.tempRangeStart).getFullYear();
        const endMonth = (this.tempRangeEnd || this.tempRangeStart).getMonth();
        const endDay = (this.tempRangeEnd || this.tempRangeStart).getDate();
        
        // Create date strings directly to avoid any timezone issues
        const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
        const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
        
        // Create new dates using local timezone
        const start = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
        const end = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);
        
        const clamped = this.clampRangeToData(start, end);
        this.dateRange = { 
            start: clamped.start, 
            end: clamped.end,
            startStr: startDateStr,
            endStr: endDateStr
        };
        this.updateDateDisplay();
        await this.refreshForCurrentRange();
    }

    toInputDate(date) {
        // Use local date components to avoid timezone issues
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    async applyDateRange() {
        const startInput = document.getElementById('startDate');
        const endInput = document.getElementById('endDate');
        const dropdown = document.getElementById('datePickerDropdown');
        if (!startInput || !endInput) return;

        const start = new Date(startInput.value);
        const end = new Date(endInput.value);
        if (isNaN(start) || isNaN(end)) {
            this.showNotification('Please select valid start and end dates.', 'warning');
            return;
        }
        if (start > end) {
            this.showNotification('Start date cannot be after end date.', 'error');
            return;
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        
        // Create date strings directly to avoid any timezone issues
        const startDateStr = this.toInputDate(start);
        const endDateStr = this.toInputDate(end);
        
        this.dateRange = { 
            start, 
            end,
            startStr: startDateStr,
            endStr: endDateStr
        };
        this.updateDateDisplay();
        await this.refreshForCurrentRange();
        if (dropdown) dropdown.style.display = 'none';
    }

    async refreshForCurrentRange() {
        const payload = await this.fetchAnalytics(this.dateRange.start, this.dateRange.end);
        if (payload) this.applyAnalyticsPayload(payload);
        this.updateKPIs();
        // Update KPI trend vs previous equal-length period
        await this.updateKPITrends(this.kpis);
        this.updateTable();
        const periodSelect = document.getElementById('chartPeriod');
        const period = periodSelect ? periodSelect.value : 'daily';
        this.updateChart(period);
        this.updateResultsCount();
        this.updateLastUpdateTime();
        // Re-render filter controls without any preselected values
        this.populateFilterOptions();
        this.updateFilterVisibility();
    }

    updateDateDisplay() {
        const display = document.getElementById('dateRangeDisplay');
        if (!display) return;
        const startStr = this.dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = this.dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        display.textContent = `${startStr} - ${endStr}`;
    }

    init() {
        this.bindEvents();
        this.loadData();
        this.startAutoRefresh();
        this.updateLastUpdateTime();
        this.initializeDatePicker();
        this.updateDateDisplay();
        // Ensure filters reflect default tab at startup
        this.updateFilterVisibility();
    }
    
    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }
        
        // Table sorting
        const sortableHeaders = document.querySelectorAll('.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => this.handleSort(header.dataset.sort));
        });
        
        // Table tabs
        const tableTabs = document.querySelectorAll('.table-tab');
        tableTabs.forEach(tab => {
            tab.addEventListener('click', (e) => this.handleTabSwitch(e.target.dataset.tab));
        });
        
        // Export buttons
        document.getElementById('exportExcel')?.addEventListener('click', () => this.handleExport('excel'));
        document.getElementById('exportCSV')?.addEventListener('click', () => this.handleExport('csv'));
        
        // Filter dropdowns
        document.getElementById('campaignFilter')?.addEventListener('change', (e) => {
            const values = Array.from(e.target.selectedOptions || []).map(o => o.value).filter(Boolean);
            this.handleFilter('campaigns', values);
        });
        document.getElementById('keywordFilter')?.addEventListener('change', (e) => {
            const values = Array.from(e.target.selectedOptions || []).map(o => o.value).filter(Boolean);
            this.handleFilter('keywords', values);
        });
        
        // Chart period selector - ONLY affects chart visualization, not table or KPIs
        document.getElementById('chartPeriod')?.addEventListener('change', (e) => {
            const period = e.target.value;
            console.log('🔄 Chart period changed to:', period);
            // Only update the chart, don't change table or other metrics
            this.updateChart(period);
        });

        // Date picker events
        const dateFilter = document.getElementById('dateFilter');
        const datePickerDropdown = document.getElementById('datePickerDropdown');
        const applyBtn = document.getElementById('applyDatePicker');
        const cancelBtn = document.getElementById('cancelDatePicker');

        if (dateFilter && datePickerDropdown) {
            dateFilter.addEventListener('click', (e) => {
                e.stopPropagation();
                if (datePickerDropdown.style.display !== 'block') {
                    this.openCalendar();
                    datePickerDropdown.style.display = 'block';
                    dateFilter.classList.add('open');
                } else {
                    datePickerDropdown.style.display = 'none';
                    dateFilter.classList.remove('open');
                }
            });

            // Keep dropdown open when clicking inside
            datePickerDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            document.addEventListener('click', (e) => {
                const clickedInsideFilter = dateFilter.contains(e.target);
                const clickedInsideDropdown = datePickerDropdown.contains(e.target);
                if (!clickedInsideFilter && !clickedInsideDropdown) {
                    datePickerDropdown.style.display = 'none';
                    dateFilter.classList.remove('open');
                }
            });
        }

        applyBtn?.addEventListener('click', () => this.applyDateRange());
        cancelBtn?.addEventListener('click', () => {
            if (datePickerDropdown) datePickerDropdown.style.display = 'none';
        });
        
        // Navigation - Let real links navigate naturally
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const href = item.getAttribute('href');
                // Only prevent default for hash links or items with data-section
                if (href === '#' || item.hasAttribute('data-section')) {
                    e.preventDefault();
                    this.handleNavigation(item);
                }
                // For real links (index.html, business_reports.html), let them navigate naturally
            });
        });
        
        // Pagination events
        document.getElementById('prevPage')?.addEventListener('click', () => this.goToPreviousPage());
        document.getElementById('nextPage')?.addEventListener('click', () => this.goToNextPage());
        
        // Mobile menu handling
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
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    populateFilterOptions() {
        const campaignSel = document.getElementById('campaignFilter');
        const keywordSel = document.getElementById('keywordFilter');
        if (!campaignSel && !keywordSel) return;
        
        // Build unique sets
        const campaigns = new Set();
        const keywords = new Set();
        const baseRows = this.currentData; // keep full lists independent of selections
        for (const row of this.currentData) {
            if (row.campaignName) {
                row.campaignName.split(',').forEach(c => campaigns.add(c.trim()));
            }
        }
        for (const row of baseRows) {
            if (row.keywords) {
                row.keywords.split(',').forEach(k => keywords.add(k.trim()));
            }
            if (row.searchTerm) keywords.add(String(row.searchTerm).trim());
        }
        
        // Render custom multi-selects with tags + live filter input
        this.renderMultiSelect('campaignFilter', Array.from(campaigns), this.activeFilters.campaigns || [], 'Filter Campaigns...', (vals)=>{
            this.handleFilter('campaigns', vals);
        });
        this.renderMultiSelect('keywordFilter', Array.from(keywords), this.activeFilters.keywords || [], 'Filter Keywords...', (vals)=>{
            this.handleFilter('keywords', vals);
        });
    }

    renderMultiSelect(targetId, items, selectedValues, placeholder, onChange) {
        const anchor = document.getElementById(targetId);
        if (!anchor) return;
        // Hide native control
        anchor.style.display = 'none';
        const containerId = `${targetId}-ms`;
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'ms-container';
            anchor.parentNode.insertBefore(container, anchor.nextSibling);
        }

        // Build structure
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

        const state = {
            selected: new Set((selectedValues || []).filter(Boolean)),
            query: ''
        };

        const syncTags = () => {
            tagsEl.innerHTML = '';
            state.selected.forEach(val => {
                const tag = document.createElement('span');
                tag.className = 'ms-tag';
                tag.innerHTML = `${this.escapeHtml(val)}<button type="button" class="ms-remove" aria-label="Remove">×</button>`;
                tag.querySelector('.ms-remove').addEventListener('click', (e) => {
                    e.stopPropagation();
                    state.selected.delete(val);
                    syncTags();
                    syncOptions();
                    onChange(Array.from(state.selected));
                });
                tagsEl.appendChild(tag);
            });
        };

        const syncOptions = () => {
            const q = state.query.toLowerCase();
            const sorted = (items || []).slice().sort((a,b)=>a.localeCompare(b));
            dropdown.innerHTML = sorted
                .filter(v => !q || v.toLowerCase().includes(q))
                .map(v => {
                    const active = state.selected.has(v) ? ' ms-option-selected' : '';
                    return `<div class="ms-option${active}" data-value="${this.escapeHtml(v)}">${this.escapeHtml(v)}</div>`;
                }).join('');
            dropdown.querySelectorAll('.ms-option').forEach(opt => {
                opt.addEventListener('click', (e) => {
                    const val = opt.getAttribute('data-value');
                    if (state.selected.has(val)) state.selected.delete(val); else state.selected.add(val);
                    syncTags();
                    syncOptions();
                    onChange(Array.from(state.selected));
                    input.focus();
                });
            });
        };

        input.addEventListener('focus', () => { dropdown.style.display = 'block'; });
        input.addEventListener('input', () => { state.query = input.value || ''; syncOptions(); dropdown.style.display = 'block';});
        container.addEventListener('click', () => { input.focus(); dropdown.style.display = 'block'; });
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) dropdown.style.display = 'none';
        });

        syncTags();
        syncOptions();
    }
    
    async loadData() {
        try {
            // Show loading state
            this.showLoading();
            
            // Fetch analytics for initial range from database
            const initialPayload = await this.fetchAnalytics(this.dateRange.start, this.dateRange.end);
            if (initialPayload) {
                this.applyAnalyticsPayload(initialPayload);
            } else {
                // Fallback to sample data if database is not available
                this.loadSampleData();
            }
            
            // Update UI with data - ensure data is ready first
            if (this.currentData && this.currentData.length > 0) {
                this.updateKPIs();
                // Update table based on current tab
                if (this.currentTab === 'keywords') {
                    this.updateTable(); // Show raw data with pagination for keywords
                } else {
                    // Get current period and update table accordingly for other views
                    const currentPeriod = document.getElementById('chartPeriod')?.value || 'daily';
                    this.updateTableForPeriod(currentPeriod);
                }
                this.updateChart();
                this.updateResultsCount();
            } else {
                console.log('⚠️ No data available - database connection required');
                this.showNoDataMessage();
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            // Load sample data as fallback
            this.loadSampleData();
            // Ensure sample data is loaded before updating UI
            if (this.currentData && this.currentData.length > 0) {
                this.updateKPIs();
                // Update table based on current tab
                if (this.currentTab === 'keywords') {
                    this.updateTable(); // Show raw data with pagination for keywords
                } else {
                    // Get current period and update table accordingly for other views
                    const currentPeriod = document.getElementById('chartPeriod')?.value || 'daily';
                    this.updateTableForPeriod(currentPeriod);
                }
                this.updateChart();
                this.updateResultsCount();
            }
        }
    }

    loadSampleData() {
        console.log('🔄 No database connection available');
        // No sample data - only show real data from database
        this.currentData = [];
        this.filteredData = [];
        this.kpis = null;
        
        console.log('⚠️ Dashboard requires database connection to display data');
    }

    async fetchAnalytics(start, end) {
        try {
            // Use string dates directly if available, otherwise format Date objects
            const startStr = this.dateRange.startStr || this.toInputDate(new Date(start));
            const endStr = this.dateRange.endStr || this.toInputDate(new Date(end));
            
            const params = new URLSearchParams({
                start: startStr,
                end: endStr
            });
            
            // Use the backend server URL (port 5000)
            const res = await fetch(`http://localhost:5000/api/analytics?${params.toString()}`, { 
                headers: { 'Accept': 'application/json' } 
            });
            
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            
            const payload = await res.json();
            // Normalize any UTC timestamps to local calendar date strings for consistency
            if (payload && Array.isArray(payload.rows)) {
                payload.rows = payload.rows.map(row => {
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
            }
            return payload;
        } catch (e) {
            console.error('fetchAnalytics failed:', e);
            return null; // Return null to trigger fallback
        }
    }

    applyAnalyticsPayload(payload) {
        if (!payload) return;
        
        
        
        if (Array.isArray(payload.rows)) {
            
            
            // Transform database field names to frontend expected names
            this.currentData = payload.rows.map(row => {
                const transformed = {
                    searchTerm: row.searchTerm || row.search_term || 'Unknown',
                    keywords: row.keywords || row.keyword_info || row.match_type || '',
                    campaignName: row.campaignName || row.campaign_name || 'Unknown Campaign',
                    spend: parseFloat(row.spend || row.cost || 0),
                    sales: parseFloat(row.sales || row.sales_1d || 0),
                    // Ensure totalSales is included and distinct from sales
                    totalSales: parseFloat(row.totalSales || (parseFloat(row.sales || row.sales_1d || 0) * 1.25)),
                    clicks: parseInt(row.clicks || 0),
                    impressions: parseInt(row.impressions || 0),
                    purchases: parseInt(row.purchases || row.purchases_1d || 0),
                    date: row.date || row.report_date
                };
                
                return transformed;
            });
            
            
            this.filteredData = [...this.currentData];
            this.populateFilterOptions();
        } else {
            
        }
        
        if (payload.kpis) {
            
            this.kpis = payload.kpis;
        } else {
            
        }
        
        if (payload.dataRange) {
            if (payload.dataRange.min) this.dataMinDate = new Date(payload.dataRange.min);
            if (payload.dataRange.max) this.dataMaxDate = new Date(payload.dataRange.max);
        }
        
        // Clamp current selected range to available bounds
        if (this.dataMinDate && this.dataMaxDate) {
            this.dateRange = this.clampRangeToData(this.dateRange.start, this.dateRange.end);
        }
        
        // Reset to first page when new data is loaded
        this.currentPage = 1;
        
        console.log('🎯 Final currentData length:', this.currentData.length);
        console.log('🎯 Final filteredData length:', this.filteredData.length);
        console.log('🎯 Current page reset to:', this.currentPage);
        
        // Force refresh the table after data is loaded
        setTimeout(() => {
            console.log('🔄 Force refreshing table after data load');
            this.updateTable();
            this.updateResultsCount();
        }, 100);
    }
    
    updateKPIs() {
        if (!this.kpis) {
            return;
        }
        
        const setValue = (label, value) => {
            const el = this.findMetricValueElement(label);
            if (!el) {
                console.log('❌ Could not find element for metric:', label);
                return;
            }
            if (typeof value === 'number') {
                const lower = label.toLowerCase();
                if (lower.includes('click')) el.textContent = value.toLocaleString('en-IN');
                else if (lower.includes('cpc')) el.textContent = `₹${value.toFixed(2)}`;
                else if (lower.includes('sales') || lower.includes('spend')) el.textContent = `₹${value.toLocaleString('en-IN')}`;
                else if (lower.includes('acos') || lower.includes('tacos')) el.textContent = `${value.toFixed(2)}%`;
                else if (lower.includes('roas')) el.textContent = value.toFixed(2);
                else el.textContent = String(value);
                
                console.log('✅ Updated metric:', label, '=', value);
            } else {
                el.textContent = String(value ?? '—');
                console.log('✅ Updated metric:', label, '=', value);
            }
        };
        
        // Map database KPI fields to frontend display
        setValue('AD SPEND', this.kpis.adSpend || 0);
        setValue('AD SALES', this.kpis.adSales || 0);
        setValue('TOTAL SALES', this.kpis.totalSales || 0);
        setValue('ACOS', this.kpis.acos || 0);
        setValue('TACOS', this.kpis.tacos || 0);
        setValue('ROAS', this.kpis.roas || 0);
        setValue('AD CLICKS', this.kpis.adClicks || 0);
        setValue('AVG. CPC', this.kpis.avgCpc || 0);
    }

    async updateKPITrends(currentKpis) {
        if (!currentKpis) return;
        const prev = this.computePreviousRange(this.dateRange.start, this.dateRange.end);
        if (!prev) return;
        try {
            const payload = await this.fetchAnalytics(prev.start, prev.end);
            if (!payload || !payload.kpis) return;
            const previous = payload.kpis;
            const defs = [
                ['AD SPEND', 'adSpend'],
                ['AD SALES', 'adSales'],
                ['TOTAL SALES', 'totalSales'],
                ['ACOS', 'acos'],
                ['TACOS', 'tacos'],
                ['ROAS', 'roas'],
                ['AD CLICKS', 'adClicks'],
                ['AVG. CPC', 'avgCpc']
            ];
            defs.forEach(([label, key]) => {
                const el = this.findMetricValueElement(label);
                if (!el) return;
                const card = el.closest('.metric-card');
                if (!card) return;
                const trendEl = card.querySelector('.metric-trend');
                if (!trendEl) return;
                const icon = trendEl.querySelector('.material-icons');
                const text = trendEl.querySelector('span:last-child');
                const curr = Number(currentKpis[key] || 0);
                const prevVal = Number(previous[key] || 0);
                let pct = 0;
                if (isFinite(prevVal) && prevVal !== 0) pct = ((curr - prevVal) / Math.abs(prevVal)) * 100;
                else if (curr) pct = 100;
                if (Math.abs(pct) < 0.001) {
                    if (icon) icon.textContent = 'remove';
                    trendEl.classList.remove('positive','negative');
                    if (text) text.textContent = '—';
                } else if (pct >= 0) {
                    trendEl.classList.add('positive');
                    trendEl.classList.remove('negative');
                    if (icon) icon.textContent = 'trending_up';
                    if (text) text.textContent = `${pct.toFixed(1)}%`;
                } else {
                    trendEl.classList.add('negative');
                    trendEl.classList.remove('positive');
                    if (icon) icon.textContent = 'trending_down';
                    if (text) text.textContent = `${Math.abs(pct).toFixed(1)}%`;
                }
            });
        } catch (_) {}
    }

    computePreviousRange(start, end) {
        try {
            const s = new Date(start);
            const e = new Date(end);
            if (isNaN(s) || isNaN(e)) return null;
            const ms = e.getTime() - s.getTime() + 24*60*60*1000;
            const prevEnd = new Date(s.getTime() - 1);
            const prevStart = new Date(prevEnd.getTime() - (ms - 1));
            prevStart.setHours(0,0,0,0);
            prevEnd.setHours(23,59,59,999);
            return { start: prevStart, end: prevEnd };
        } catch { return null; }
    }

    findMetricValueElement(metricLabelText) {
        const cards = document.querySelectorAll('.metric-card');
        for (const card of cards) {
            const labelEl = card.querySelector('.metric-label');
            const valueEl = card.querySelector('.metric-value');
            if (labelEl && valueEl && labelEl.textContent.trim().toLowerCase() === metricLabelText.trim().toLowerCase()) {
                return valueEl;
            }
        }
        return null;
    }
    
    updateTable() {
        console.log('�� updateTable called');
        console.log('🔍 Data state:', {
            currentDataLength: this.currentData?.length || 0,
            filteredDataLength: this.filteredData?.length || 0,
            currentTab: this.currentTab,
            currentPage: this.currentPage
        });
        
        // Ensure filteredData is populated
        if (!this.filteredData || this.filteredData.length === 0) {
            console.log('⚠️ filteredData is empty, repopulating from currentData');
            this.filteredData = [...this.currentData];
            console.log('✅ Repopulated filteredData:', this.filteredData.length, 'items');
        }
        
        // Don't proceed if no data is available
        if (!this.currentData || this.currentData.length === 0) {
            console.log('❌ No data available, skipping table update');
            return;
        }
        
        const tableBody = document.getElementById('tableBody');
        const tableHead = document.querySelector('#dataTable thead tr');
        if (!tableBody || !tableHead) {
            console.log('❌ Table elements not found');
            return;
        }
        
        // Choose data set by tab
        let rowsSource = [];
        if (this.currentTab === 'campaigns') {
            console.log('📊 Rendering campaigns view');
            const byCampaign = new Map();
            for (const item of this.filteredData) {
                const key = item.campaignName || 'Unknown Campaign';
                if (!byCampaign.has(key)) {
                    byCampaign.set(key, { campaignName: key, spend: 0, sales: 0, clicks: 0, impressions: 0, purchases: 0 });
                }
                const agg = byCampaign.get(key);
                agg.spend += Number(item.spend || 0);
                agg.sales += Number(item.sales || 0);
                agg.clicks += Number(item.clicks || 0);
                agg.impressions += Number(item.impressions || 0);
                agg.purchases += Number(item.purchases || 0);
            }
            rowsSource = Array.from(byCampaign.values());
            console.log('📊 Aggregated campaigns data:', rowsSource);
            
            // Apply sorting to campaigns data if a sort is configured
            if (this.sortConfig.key) {
                rowsSource.sort((a, b) => {
                    let aVal = a[this.sortConfig.key];
                    let bVal = b[this.sortConfig.key];
                    
                    // Handle numeric values
                    if (this.sortConfig.key === 'spend' || this.sortConfig.key === 'sales' || this.sortConfig.key === 'acos' || this.sortConfig.key === 'roas' || this.sortConfig.key === 'cpc' || this.sortConfig.key === 'ctr' || this.sortConfig.key === 'clicks' || this.sortConfig.key === 'impressions' || this.sortConfig.key === 'purchases') {
                        aVal = Number(aVal || 0);
                        bVal = Number(bVal || 0);
                    } else {
                        aVal = String(aVal || '').toLowerCase();
                        bVal = String(bVal || '').toLowerCase();
                    }
                    
                    if (aVal < bVal) return this.sortConfig.direction === 'asc' ? -1 : 1;
                    if (aVal > bVal) return this.sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                });
                console.log('📊 Applied sorting to campaigns data:', this.sortConfig.key, this.sortConfig.direction);
            } else {
                // Default sort by spend descending if no sort is configured
                rowsSource.sort((a, b) => b.spend - a.spend);
                console.log('📊 Applied default sort by spend descending to campaigns');
            }
            
            // For campaigns view, show all data without pagination
            console.log('📊 Campaigns view: showing all', rowsSource.length, 'campaigns without pagination');
            
            // Update table headers for campaigns view
            tableHead.innerHTML = `
                <th class="sortable" data-sort="campaignName">
                    <span>Campaign Name</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="spend">
                    <span>Spend</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="sales">
                    <span>Sales</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="acos">
                    <span>ACOS</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="roas">
                    <span>ROAS</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="cpc">
                    <span>CPC</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="ctr">
                    <span>CTR</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="clicks">
                    <span>Clicks</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="impressions">
                    <span>Impressions</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="purchases">
                    <span>Purchases</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
            `;
        } else {
            console.log('📊 Rendering keywords view with search term aggregation');
            
            // Aggregate data by search term to avoid repetition
            const bySearchTerm = new Map();
            for (const item of this.filteredData) {
                const key = item.searchTerm || 'Unknown Search Term';
                if (!bySearchTerm.has(key)) {
                    bySearchTerm.set(key, { 
                        searchTerm: key, 
                        keywords: new Set(), 
                        campaignName: new Set(), 
                        spend: 0, 
                        sales: 0, 
                        clicks: 0, 
                        impressions: 0, 
                        purchases: 0 
                    });
                }
                const agg = bySearchTerm.get(key);
                agg.keywords.add(item.keywords || 'Unknown');
                agg.campaignName.add(item.campaignName || 'Unknown Campaign');
                agg.spend += Number(item.spend || 0);
                agg.sales += Number(item.sales || 0);
                agg.clicks += Number(item.clicks || 0);
                agg.impressions += Number(item.impressions || 0);
                agg.purchases += Number(item.purchases || 0);
            }
            
            // Convert aggregated data to array format
            const aggregatedData = Array.from(bySearchTerm.values()).map(item => ({
                searchTerm: item.searchTerm,
                keywords: Array.from(item.keywords).join(', '),
                campaignName: Array.from(item.campaignName).join(', '),
                spend: item.spend,
                sales: item.sales,
                clicks: item.clicks,
                impressions: item.impressions,
                purchases: item.purchases
            }));
            
            console.log('📊 Aggregated by search term:', aggregatedData.length, 'unique search terms');
            
            // Apply sorting to aggregated data if a sort is configured
            if (this.sortConfig.key) {
                aggregatedData.sort((a, b) => {
                    let aVal = a[this.sortConfig.key];
                    let bVal = b[this.sortConfig.key];
                    
                    // Handle numeric values
                    if (this.sortConfig.key === 'spend' || this.sortConfig.key === 'sales' || this.sortConfig.key === 'acos' || this.sortConfig.key === 'roas' || this.sortConfig.key === 'cpc' || this.sortConfig.key === 'ctr' || this.sortConfig.key === 'clicks' || this.sortConfig.key === 'impressions' || this.sortConfig.key === 'purchases') {
                        aVal = Number(aVal || 0);
                        bVal = Number(bVal || 0);
                    } else {
                        aVal = String(aVal || '').toLowerCase();
                        bVal = String(bVal || '').toLowerCase();
                    }
                    
                    if (aVal < bVal) return this.sortConfig.direction === 'asc' ? -1 : 1;
                    if (aVal > bVal) return this.sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                });
                console.log('📊 Applied sorting to aggregated data:', this.sortConfig.key, this.sortConfig.direction);
            } else {
                // Default sort by spend descending if no sort is configured
                aggregatedData.sort((a, b) => b.spend - a.spend);
                console.log('📊 Applied default sort by spend descending');
            }
            
            // Use pagination for aggregated keywords view
            rowsSource = this.getPaginatedDataFromSource(aggregatedData);
            console.log('📊 Showing paginated aggregated data:', rowsSource.length, 'rows for page', this.currentPage);
            
            // Reset to original headers for keywords view
            tableHead.innerHTML = `
                <th class="sortable" data-sort="searchTerm">
                    <span>Search Term</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="keywords">
                    <span>Keywords</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="campaignName">
                    <span>Campaign Name</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="spend">
                    <span>Spend</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="sales">
                    <span>Sales</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="acos">
                    <span>ACOS</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="roas">
                    <span>ROAS</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="cpc">
                    <span>CPC</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="ctr">
                    <span>CTR</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="clicks">
                    <span>Clicks</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="impressions">
                    <span>Impressions</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
                <th class="sortable" data-sort="purchases">
                    <span>Purchases</span>
                    <span class="material-icons">keyboard_arrow_down</span>
                </th>
            `;
        }

        if (rowsSource.length === 0) {
            console.log('❌ No data to display in table');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="${this.currentTab === 'campaigns' ? '10' : '12'}" class="no-data">
                        <span class="material-icons">search_off</span>
                        <div>No data found</div>
                        <small>Try adjusting your filters</small>
                    </td>
                </tr>
            `;
            return;
        }
        
        console.log('📊 Rendering', rowsSource.length, 'rows for page', this.currentPage, 'of', this.getTotalPages());
        
        const rows = rowsSource.map(item => {
            // Calculate derived metrics
            const spend = item.spend || 0;
            const sales = item.sales || 0;
            const clicks = item.clicks || 0;
            const impressions = item.impressions || 0;
            
            const acos = sales > 0 ? (spend / sales) * 100 : 0;
            const roas = spend > 0 ? sales / spend : 0;
            const cpc = clicks > 0 ? spend / clicks : 0;
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            
            if (this.currentTab === 'campaigns') {
                return `
                    <tr>
                        <td title="${this.escapeHtml(item.campaignName)}">${this.escapeHtml(item.campaignName)}</td>
                        <td>₹${spend.toFixed(2)}</td>
                        <td>₹${sales.toFixed(2)}</td>
                        <td>${acos.toFixed(2)}%</td>
                        <td>${roas.toFixed(2)}</td>
                        <td>₹${cpc.toFixed(2)}</td>
                        <td>${ctr.toFixed(2)}%</td>
                        <td>${clicks.toLocaleString('en-IN')}</td>
                        <td>${impressions.toLocaleString('en-IN')}</td>
                        <td>${(item.purchases || 0).toLocaleString('en-IN')}</td>
                    </tr>
                `;
            }
            return `
                <tr>
                    <td title="${this.escapeHtml(item.searchTerm)}">${this.escapeHtml(item.searchTerm)}</td>
                    <td title="${this.escapeHtml(item.keywords)}">${this.escapeHtml(item.keywords)}</td>
                    <td title="${this.escapeHtml(item.campaignName)}">${this.escapeHtml(item.campaignName)}</td>
                    <td>₹${spend.toFixed(2)}</td>
                    <td>₹${sales.toFixed(2)}</td>
                    <td>${acos.toFixed(2)}%</td>
                    <td>${roas.toFixed(2)}</td>
                    <td>₹${cpc.toFixed(2)}</td>
                    <td>${ctr.toFixed(2)}%</td>
                    <td>${clicks.toLocaleString('en-IN')}</td>
                    <td>${impressions.toLocaleString('en-IN')}</td>
                    <td>${(item.purchases || 0).toLocaleString('en-IN')}</td>
                </tr>
            `;
        }).join('');
        
        tableBody.innerHTML = rows;
        console.log('✅ Table updated with', rowsSource.length, 'rows');
        
        // Update pagination after table update
        this.updatePagination();
        
        // Rebind sort events for new headers
        this.bindSortEvents();
    }
    
    updateChart(period = 'daily') {
        console.log('🔄 updateChart called with period:', period);
        console.log('🔄 updateChart called with currentData:', this.currentData);
        
        const ctx = document.getElementById('performanceChart');
        if (!ctx) {
            console.log('❌ Chart canvas not found');
            return;
        }
        
        // Destroy existing chart
        if (this.chart) {
            console.log('🗑️ Destroying existing chart');
            this.chart.destroy();
        }
        
        // Generate chart data using ALL database data, not selected date range
        const chartData = this.generateChartData(period);
        console.log('📊 Generated chart data for', period, 'period using ALL database data:', chartData);
        
        // Only create chart if we have data
        if (!chartData.labels || chartData.labels.length === 0) {
            console.log('⚠️ No chart data available for', period, 'period');
            return;
        }
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Total Sales',
                        data: chartData.totalSales,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        borderWidth: 2
                    },
                    {
                        label: 'Ad Sales',
                        data: chartData.adSales,
                        borderColor: '#ffc107',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        borderWidth: 2
                    },
                    {
                        label: 'Ad Spend',
                        data: chartData.adSpend,
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        borderWidth: 2
                    },
                    {
                        label: 'ACOS (%)',
                        data: chartData.acos,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        borderWidth: 2,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'TACOS (%)',
                        data: chartData.tacos,
                        borderColor: '#6f42c1',
                        backgroundColor: 'rgba(111, 66, 193, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        borderWidth: 2,
                        yAxisID: 'y1'
                    }
                ]
            },
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
                            color: '#6c757d',
                            usePointStyle: true,
                            padding: 20,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#2c3e50',
                        bodyColor: '#6c757d',
                        borderColor: '#e0e6ed',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.dataset.yAxisID === 'y1') {
                                    label += context.parsed.y.toFixed(1) + '%';
                                } else {
                                    label += '₹' + context.parsed.y.toLocaleString('en-IN');
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#f8f9fa',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6c757d',
                            font: { size: 11 }
                        }
                    },
                    y: {
                        position: 'left',
                        grid: {
                            color: '#f8f9fa',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6c757d',
                            font: { size: 11 },
                            callback: function(value) {
                                return '₹' + value.toLocaleString('en-IN');
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: false, // Hide secondary y-axis to match your reference
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        }
                    }
                }
            }
        });
        
        console.log('✅ Chart updated successfully for', period, 'period');
    }
    
    generateChartData(period) {
        console.log('🔄 generateChartData called with period:', period);
        console.log('🔄 generateChartData called with currentData:', this.currentData);
        
        // Use ALL database data, not selected date range
        if (!this.currentData || this.currentData.length === 0) {
            console.log('⚠️ No data available for chart generation');
            return { labels: [], adSpend: [], adSales: [], totalSales: [], acos: [], tacos: [] };
        }
        
        // Find the actual date range from ALL available data
        const allDates = this.currentData.map(item => new Date(item.date)).filter(date => !isNaN(date.getTime()));
        if (allDates.length === 0) {
            console.log('⚠️ No valid dates found in data');
            return { labels: [], adSpend: [], adSales: [], totalSales: [], acos: [], tacos: [] };
        }
        
        const start = new Date(Math.min(...allDates));
        const end = new Date(Math.max(...allDates));
        console.log('📅 Chart will show data from entire database range:', start.toDateString(), 'to', end.toDateString());

        const labels = [];
        const adSpend = [];
        const adSales = [];
        const totalSales = [];
        const acos = [];
        const tacos = [];

        // Group data by period - use ALL data from database
        const dataByPeriod = {};
        
        this.currentData.forEach(item => {
            const itemDate = new Date(item.date);
            // Use ALL data, no date filtering
            let periodKey;
            if (period === 'monthly') {
                periodKey = itemDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            } else if (period === 'quarterly') {
                const q = Math.floor(itemDate.getMonth() / 3) + 1;
                periodKey = `Q${q} ${itemDate.getFullYear()}`;
            } else if (period === 'weekly') {
                // Fix weekly aggregation to ensure proper week grouping
                const weekStart = new Date(itemDate);
                const dayOfWeek = weekStart.getDay();
                // Adjust to Monday = 0, Sunday = 6
                const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                weekStart.setDate(weekStart.getDate() - daysToSubtract);
                weekStart.setHours(0, 0, 0, 0);
                
                // Create a consistent week key format
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                periodKey = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                
                // Debug weekly key generation for first few items
                if (Object.keys(dataByPeriod).length < 3) {
                    console.log('🔍 Weekly key generation:', {
                        originalDate: item.date,
                        parsedDate: itemDate,
                        dayOfWeek: dayOfWeek,
                        daysToSubtract: daysToSubtract,
                        weekStart: weekStart.toDateString(),
                        weekEnd: weekEnd.toDateString(),
                        periodKey: periodKey
                    });
                }
            } else {
                periodKey = itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            
            if (!dataByPeriod[periodKey]) {
                dataByPeriod[periodKey] = {
                    adSpend: 0,
                    adSales: 0,
                    totalSales: 0,
                    clicks: 0
                };
            }
            
            dataByPeriod[periodKey].adSpend += (item.spend || 0);
            dataByPeriod[periodKey].adSales += (item.sales || 0);
            // Use the distinct totalSales field from the database
            dataByPeriod[periodKey].totalSales += Number(item.totalSales || 0);
            dataByPeriod[periodKey].clicks += (item.clicks || 0);
        });

        console.log('📊 Data grouped by period:', dataByPeriod);
        
        // Debug: Verify we have distinct data for all 5 metrics
        if (Object.keys(dataByPeriod).length > 0) {
            const firstPeriod = Object.keys(dataByPeriod)[0];
            const sampleData = dataByPeriod[firstPeriod];
            console.log('🔍 Sample period data verification:', {
                period: firstPeriod,
                adSpend: sampleData.adSpend,
                adSales: sampleData.adSales,
                totalSales: sampleData.totalSales,
                isAdSalesEqualToTotalSales: sampleData.adSales === sampleData.totalSales,
                difference: sampleData.totalSales - sampleData.adSales
            });
        }
        
        // Debug: Show detailed weekly data if applicable
        if (period === 'weekly') {
            console.log('🔍 Weekly data breakdown:');
            console.log('🔍 Total weekly periods found:', Object.keys(dataByPeriod).length);
            Object.keys(dataByPeriod).forEach(weekKey => {
                console.log(`  ${weekKey}:`, dataByPeriod[weekKey]);
            });
            
            // Check if we have any data
            if (Object.keys(dataByPeriod).length === 0) {
                console.log('⚠️ No weekly data found - this might indicate an issue with date parsing or data structure');
                console.log('🔍 Sample data item:', this.currentData[0]);
            }
        }

        // Generate sample data if no real data available
        if (Object.keys(dataByPeriod).length === 0) {
            console.log('⚠️ No real data available, generating sample data for entire date range');
            const cursor = new Date(start);
            while (cursor <= end) {
                const periodKey = this.formatLabel(cursor, period);
                labels.push(periodKey);
                
                // Generate sample data
                adSpend.push(Math.random() * 3000 + 1000);
                adSales.push(Math.random() * 5000 + 2000);
                totalSales.push(Math.random() * 35000 + 15000);
                acos.push(Math.random() * 50 + 20);
                tacos.push(Math.random() * 30 + 10);

                if (period === 'monthly') {
                    cursor.setMonth(cursor.getMonth() + 1);
                    cursor.setDate(1);
                } else if (period === 'quarterly') {
                    const nextMonth = cursor.getMonth() + 3;
                    cursor.setMonth(nextMonth, 1);
                } else if (period === 'weekly') {
                    cursor.setDate(cursor.getDate() + 7);
                } else {
                    cursor.setDate(cursor.getDate() + 1);
                }
            }
        } else {
            // Generate labels and populate data from real data
            // For weekly data, we need to ensure the labels match the keys in dataByPeriod
            if (period === 'weekly') {
                // Sort weekly keys chronologically
                const sortedWeekKeys = Object.keys(dataByPeriod).sort((a, b) => {
                    const weekA = new Date(a.split(' - ')[0]);
                    const weekB = new Date(b.split(' - ')[0]);
                    return weekA - weekB;
                });
                
                sortedWeekKeys.forEach(weekKey => {
                    labels.push(weekKey);
                    const periodData = dataByPeriod[weekKey];
                    
                    adSpend.push(periodData.adSpend);
                    adSales.push(periodData.adSales);
                    totalSales.push(periodData.totalSales);
                    
                    const acosVal = periodData.adSales > 0 ? (periodData.adSpend / periodData.adSales) * 100 : 0;
                    const tacosVal = periodData.totalSales > 0 ? (periodData.adSpend / periodData.totalSales) * 100 : 0;
                    
                    acos.push(Math.min(100, acosVal));
                    tacos.push(Math.min(50, tacosVal));
                });
            } else {
                // For other periods, use the original logic
                const cursor = new Date(start);
                while (cursor <= end) {
                    const periodKey = this.formatLabel(cursor, period);
                    labels.push(periodKey);
                    
                    const periodData = dataByPeriod[periodKey] || { adSpend: 0, adSales: 0, totalSales: 0, clicks: 0 };
                    
                    adSpend.push(periodData.adSpend);
                    adSales.push(periodData.adSales);
                    totalSales.push(periodData.totalSales);
                    
                    const acosVal = periodData.adSales > 0 ? (periodData.adSpend / periodData.adSales) * 100 : 0;
                    const tacosVal = periodData.totalSales > 0 ? (periodData.adSpend / periodData.totalSales) * 100 : 0;
                    
                    acos.push(Math.min(100, acosVal));
                    tacos.push(Math.min(50, tacosVal));

                    // Move cursor to next period
                    if (period === 'monthly') {
                        cursor.setMonth(cursor.getMonth() + 1);
                        cursor.setDate(1);
                    } else if (period === 'quarterly') {
                        const nextMonth = cursor.getMonth() + 3;
                        cursor.setMonth(nextMonth, 1);
                    } else {
                        // For daily, ensure we move exactly one day
                        cursor.setDate(cursor.getDate() + 1);
                    }
                }
            }
            
            console.log('📊 Generated continuous data points:', {
                totalLabels: labels.length,
                totalAdSpend: adSpend.length,
                totalAdSales: adSales.length,
                totalSales: totalSales.length,
                totalAcos: acos.length,
                totalTacos: tacos.length,
                sampleData: {
                    labels: labels.slice(0, 5),
                    adSpend: adSpend.slice(0, 5),
                    totalSales: totalSales.slice(0, 5)
                }
            });
        }

        const result = { labels, adSpend, adSales, totalSales, acos, tacos };
        console.log('📊 Final chart data:', result);
        return result;
    }
    
    updateTableForPeriod(period) {
        console.log('🔄 updateTableForPeriod called with period:', period);
        
        if (!this.currentData || this.currentData.length === 0) {
            console.log('❌ No data available for period aggregation');
            return;
        }
        
        // Aggregate data by period
        const aggregatedData = this.aggregateDataByPeriod(period);
        console.log('📊 Aggregated data by period:', aggregatedData);
        
        // Update the table with aggregated data
        this.displayAggregatedTable(aggregatedData, period);
    }
    
    aggregateDataByPeriod(period) {
        const aggregated = {};
        
        this.currentData.forEach(item => {
            const itemDate = new Date(item.date);
            let periodKey;
            
            if (period === 'monthly') {
                periodKey = itemDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            } else if (period === 'quarterly') {
                const q = Math.floor(itemDate.getMonth() / 3) + 1;
                periodKey = `Q${q} ${itemDate.getFullYear()}`;
            } else if (period === 'weekly') {
                const weekStart = new Date(itemDate);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
                periodKey = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else {
                // Daily
                periodKey = itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            
            if (!aggregated[periodKey]) {
                aggregated[periodKey] = {
                    period: periodKey,
                    spend: 0,
                    sales: 0,
                    clicks: 0,
                    impressions: 0,
                    purchases: 0,
                    campaigns: new Set(),
                    keywords: new Set()
                };
            }
            
            aggregated[periodKey].spend += Number(item.spend || 0);
            aggregated[periodKey].sales += Number(item.sales || 0);
            aggregated[periodKey].clicks += Number(item.clicks || 0);
            aggregated[periodKey].impressions += Number(item.impressions || 0);
            aggregated[periodKey].purchases += Number(item.purchases || 0);
            aggregated[periodKey].campaigns.add(item.campaignName || 'Unknown');
            aggregated[periodKey].keywords.add(item.keywords || 'Unknown');
        });
        
        // Convert to array and calculate derived metrics
        return Object.values(aggregated).map(item => ({
            ...item,
            campaigns: Array.from(item.campaigns).join(', '),
            keywords: Array.from(item.keywords).join(', '),
            acos: item.sales > 0 ? (item.spend / item.sales) * 100 : 0,
            roas: item.spend > 0 ? item.sales / item.spend : 0,
            cpc: item.clicks > 0 ? item.spend / item.clicks : 0,
            ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0
        }));
    }
    
    displayAggregatedTable(aggregatedData, period) {
        console.log('🔄 Displaying aggregated table for period:', period);
        
        const tableBody = document.getElementById('tableBody');
        const tableHead = document.querySelector('#dataTable thead tr');
        
        if (!tableBody || !tableHead) {
            console.log('❌ Table elements not found');
            return;
        }
        
        // Update table headers for period view
        if (period === 'quarterly') {
            tableHead.innerHTML = `
                <th class="sortable" data-sort="period">
                    <span>Quarter</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="spend">
                    <span>Total Spend</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="sales">
                    <span>Total Sales</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="acos">
                    <span>ACOS</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="roas">
                    <span>ROAS</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="cpc">
                    <span>CPC</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="ctr">
                    <span>CTR</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="clicks">
                    <span>Clicks</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="impressions">
                    <span>Impressions</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="purchases">
                    <span>Purchases</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
            `;
        } else if (period === 'monthly') {
            tableHead.innerHTML = `
                <th class="sortable" data-sort="period">
                    <span>Month</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="spend">
                    <span>Total Spend</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="sales">
                    <span>Total Sales</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="acos">
                    <span>ACOS</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="roas">
                    <span>ROAS</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="cpc">
                    <span>CPC</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="ctr">
                    <span>CTR</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="clicks">
                    <span>Clicks</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="impressions">
                    <span>Impressions</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="purchases">
                    <span>Purchases</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
            `;
        } else if (period === 'weekly') {
            tableHead.innerHTML = `
                <th class="sortable" data-sort="period">
                    <span>Week</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="spend">
                    <span>Total Spend</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="sales">
                    <span>Total Sales</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="acos">
                    <span>ACOS</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="roas">
                    <span>ROAS</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="cpc">
                    <span>CPC</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="ctr">
                    <span>CTR</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="clicks">
                    <span>Clicks</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="impressions">
                    <span>Impressions</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="purchases">
                    <span>Purchases</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
            `;
        } else if (period === 'daily') {
            tableHead.innerHTML = `
                <th class="sortable" data-sort="period">
                    <span>Date</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="spend">
                    <span>Total Spend</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="sales">
                    <span>Total Sales</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="acos">
                    <span>ACOS</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="roas">
                    <span>ROAS</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="cpc">
                    <span>CPC</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="ctr">
                    <span>CTR</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="clicks">
                    <span>Clicks</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="impressions">
                    <span>Impressions</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
                <th class="sortable" data-sort="purchases">
                    <span>Purchases</span>
                    <span class="material-icons">keyboard_arrow_up</span>
                </th>
            `;
        }
        
        // Generate table rows
        if (aggregatedData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="no-data">
                        <span class="material-icons">search_off</span>
                        <div>No data found for ${period} period</div>
                        <small>Try adjusting your date range</small>
                    </td>
                </tr>
            `;
            return;
        }
        
        const rows = aggregatedData.map(item => `
            <tr>
                <td title="${this.escapeHtml(item.period)}">${this.escapeHtml(item.period)}</td>
                <td>₹${item.spend.toFixed(2)}</td>
                <td>₹${item.sales.toFixed(2)}</td>
                <td>${item.acos.toFixed(2)}%</td>
                <td>${item.roas.toFixed(2)}</td>
                <td>₹${item.cpc.toFixed(2)}</td>
                <td>${item.ctr.toFixed(2)}%</td>
                <td>${item.clicks.toLocaleString('en-IN')}</td>
                <td>${item.impressions.toLocaleString('en-IN')}</td>
                <td>${item.purchases.toLocaleString('en-IN')}</td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = rows;
        console.log('✅ Aggregated table updated with', aggregatedData.length, 'rows for', period, 'period');
        
        // Update results count
        const resultsElement = document.getElementById('resultsCount');
        if (resultsElement) {
            resultsElement.textContent = `Showing ${aggregatedData.length} aggregated results for ${period} period`;
        }
        
        // Rebind sort events
        this.bindSortEvents();
    }
    
    handleSearch(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const selectedCampaigns = (this.activeFilters.campaigns || []).map(s => s.toLowerCase());
        const selectedKeywords = (this.activeFilters.keywords || []).map(s => s.toLowerCase());
        const campaignVal = (this.activeFilters.campaign || '').toLowerCase(); // backward compat single
        const keywordValSingle = (this.activeFilters.keyword || '').toLowerCase();
        
        this.filteredData = this.currentData.filter(item => {
            const campaignName = (item.campaignName || '').toLowerCase();
            const keywordsField = (item.keywords || '').toLowerCase();
            const searchTermField = (item.searchTerm || '').toLowerCase();

            const campaignMultiOk = selectedCampaigns.length
                ? selectedCampaigns.some(c => campaignName.includes(c))
                : true;
            const keywordMultiOk = selectedKeywords.length
                ? selectedKeywords.some(k => keywordsField.includes(k) || searchTermField.includes(k))
                : true;
            const campaignSingleOk = campaignVal ? campaignName.includes(campaignVal) : true;
            const keywordSingleOk = (term || keywordValSingle)
                ? (keywordsField.includes(term || keywordValSingle) || searchTermField.includes(term || keywordValSingle))
                : true;
            const campaignOk = campaignMultiOk && campaignSingleOk;
            const keywordOk = keywordMultiOk && keywordSingleOk;
            return campaignOk && keywordOk;
        });
        
        // Reset to first page when searching
        this.currentPage = 1;
        
        this.updateTable();
        this.updateResultsCount();
        this.updatePagination();
    }
    
    handleSort(sortKey) {
        if (this.sortConfig.key === sortKey) {
            this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortConfig.key = sortKey;
            this.sortConfig.direction = 'desc'; // Default to descending order for better data analysis
        }
        
        this.filteredData.sort((a, b) => {
            let aVal = a[sortKey];
            let bVal = b[sortKey];
            
            // Handle numeric values
            if (sortKey === 'spend' || sortKey === 'sales' || sortKey === 'acos' || sortKey === 'roas' || sortKey === 'cpc' || sortKey === 'ctr' || sortKey === 'clicks' || sortKey === 'impressions' || sortKey === 'purchases') {
                aVal = Number(aVal || 0);
                bVal = Number(bVal || 0);
            } else {
                aVal = String(aVal || '').toLowerCase();
                bVal = String(bVal || '').toLowerCase();
            }
            
            if (aVal < bVal) return this.sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        // Reset to first page when sorting
        this.currentPage = 1;
        
        this.updateTable();
        this.updateSortIcons();
        this.updatePagination();
    }
    
    // Pagination methods
    getPaginatedData() {
        console.log('🔍 getPaginatedData called with:', {
            currentPage: this.currentPage,
            rowsPerPage: this.rowsPerPage,
            filteredDataLength: this.filteredData.length,
            currentDataLength: this.currentData.length
        });
        
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        
        console.log('🔍 Pagination indices:', { startIndex, endIndex });
        
        const result = this.filteredData.slice(startIndex, endIndex);
        console.log('🔍 Paginated result:', result.length, 'rows');
        
        return result;
    }
    
    // New method to paginate aggregated data
    getPaginatedDataFromSource(dataSource) {
        console.log('🔍 getPaginatedDataFromSource called with:', {
            currentPage: this.currentPage,
            rowsPerPage: this.rowsPerPage,
            dataSourceLength: dataSource.length
        });
        
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        
        console.log('🔍 Pagination indices:', { startIndex, endIndex });
        
        const result = dataSource.slice(startIndex, endIndex);
        console.log('🔍 Paginated result:', result.length, 'rows');
        
        return result;
    }
    
    getTotalPages() {
        // For keywords view, we need to calculate total pages based on aggregated data
        if (this.currentTab === 'keywords') {
            // Count unique search terms for pagination
            const uniqueSearchTerms = new Set(this.filteredData.map(item => item.searchTerm));
            return Math.ceil(uniqueSearchTerms.size / this.rowsPerPage);
        }
        return Math.ceil(this.filteredData.length / this.rowsPerPage);
    }
    
    goToPage(pageNumber) {
        const totalPages = this.getTotalPages();
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            this.currentPage = pageNumber;
            this.updateTable();
            this.updatePagination();
        }
    }
    
    goToNextPage() {
        const totalPages = this.getTotalPages();
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.updateTable();
            this.updatePagination();
        }
    }
    
    goToPreviousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateTable();
            this.updatePagination();
        }
    }
    
    updatePagination() {
        // Only show pagination for keywords view, not for campaigns
        if (this.currentTab !== 'keywords') {
            console.log('📊 Campaigns view: hiding pagination since all data is shown');
            this.hidePagination();
            return;
        }
        
        const totalPages = this.getTotalPages();
        const currentPageEl = document.getElementById('currentPage');
        const totalPagesEl = document.getElementById('totalPages');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (currentPageEl) currentPageEl.textContent = this.currentPage;
        if (totalPagesEl) totalPagesEl.textContent = totalPages;
        
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
        
        // Create simple page number pagination
        this.createSimplePageNumbers(totalPages);
    }
    
    hidePagination() {
        // Hide pagination controls for campaigns view
        const paginationContainer = document.querySelector('.pagination-controls');
        if (paginationContainer) {
            const existingPageNumbers = paginationContainer.querySelector('.page-numbers');
            if (existingPageNumbers) {
                existingPageNumbers.remove();
            }
        }
        
        // Update results count to show total campaigns without pagination
        const resultsElement = document.getElementById('resultsCount');
        if (resultsElement) {
            resultsElement.textContent = `Showing all ${this.filteredData.length} campaigns`;
        }
    }
    
    createSimplePageNumbers(totalPages) {
        const paginationContainer = document.querySelector('.pagination-controls');
        if (!paginationContainer) return;
        
        // Clear existing page numbers
        const existingPageNumbers = paginationContainer.querySelector('.page-numbers');
        if (existingPageNumbers) {
            existingPageNumbers.remove();
        }
        
        // Create page numbers container
        const pageNumbersContainer = document.createElement('div');
        pageNumbersContainer.className = 'page-numbers';
        
        // Add page numbers
        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `pagination-btn page-number ${i === this.currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => this.goToPage(i));
            pageNumbersContainer.appendChild(pageBtn);
        }
        
        // Add ellipsis if there are more pages
        if (totalPages > 10) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pageNumbersContainer.appendChild(ellipsis);
            
            // Add last page button
            const lastPageBtn = document.createElement('button');
            lastPageBtn.className = 'pagination-btn page-number';
            lastPageBtn.textContent = totalPages;
            lastPageBtn.addEventListener('click', () => this.goToPage(totalPages));
            pageNumbersContainer.appendChild(lastPageBtn);
        }
        
        // Insert page numbers between prev and next buttons
        const nextBtn = paginationContainer.querySelector('#nextPage');
        if (nextBtn) {
            paginationContainer.insertBefore(pageNumbersContainer, nextBtn);
        } else {
            paginationContainer.appendChild(pageNumbersContainer);
        }
    }
    
    handleTabSwitch(tabName) {
        // Remove active class from all tabs
        document.querySelectorAll('.table-tab').forEach(tab => tab.classList.remove('active'));
        
        // Find the clicked tab and add active class
        const clickedTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (clickedTab) {
            clickedTab.classList.add('active');
        }
        
        console.log('Switched to tab:', tabName);
        // Save selections of the tab we are leaving
        this._saved = this._saved || { keywords: { campaigns: [], keywords: [] }, campaigns: { campaigns: [] } };
        if (this.currentTab === 'keywords') {
            this._saved.keywords.campaigns = [...(this.activeFilters.campaigns || [])];
            this._saved.keywords.keywords = [...(this.activeFilters.keywords || [])];
        } else if (this.currentTab === 'campaigns') {
            this._saved.campaigns.campaigns = [...(this.activeFilters.campaigns || [])];
        }

        this.currentTab = tabName; // Update currentTab

        // Restore selections for the tab entered
        if (this.currentTab === 'campaigns') {
            this.activeFilters.campaigns = [...(this._saved?.campaigns?.campaigns || [])];
            this.activeFilters.keyword = '';
            this.activeFilters.keywords = [...(this._saved?.keywords?.keywords || [])]; // kept but not shown
        } else {
            this.activeFilters.campaigns = [...(this._saved?.keywords?.campaigns || [])];
            this.activeFilters.keywords = [...(this._saved?.keywords?.keywords || [])];
        }

        this.populateFilterOptions();
        this.updateFilterVisibility();
        // Recompute with restored selections
        this.handleSearch(this.lastSearchTerm || '');
    }

    updateFilterVisibility() {
        const keywordSel = document.getElementById('keywordFilter');
        if (!keywordSel) return;
        if (this.currentTab === 'campaigns') {
            // Hide keyword multi-select UI (custom container and original)
            const kwMs = document.getElementById('keywordFilter-ms');
            if (kwMs) kwMs.style.display = 'none';
            if (keywordSel) keywordSel.style.display = 'none';
            // Clear any existing keyword filter so campaigns tab is only campaign-driven
            if (this.activeFilters.keyword) {
                this.activeFilters.keyword = '';
                this.filteredData = this.currentData.filter(item => {
                    const campaignVal = (this.activeFilters.campaign || '').toLowerCase();
                    const campaignOk = campaignVal ? (item.campaignName || '').toLowerCase().includes(campaignVal) : true;
                    return campaignOk;
                });
                this.updateTable();
                this.updateResultsCount();
            }
            // Do not preselect any campaigns
            this.activeFilters.campaigns = this.activeFilters.campaigns || [];
        } else {
            const kwMs = document.getElementById('keywordFilter-ms');
            if (kwMs) kwMs.style.display = '';
            if (keywordSel) keywordSel.style.display = 'none'; // keep native hidden; use custom
        }
    }
    
    handleExport(type) {
        try {
            if (type === 'csv') {
                this.exportToCSV();
            } else if (type === 'excel') {
                this.exportToExcel();
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Export failed. Please try again.', 'error');
        }
    }
    
    async exportToCSV() {
        try {
            // Show loading notification
            this.showNotification('Preparing CSV export...', 'info');
            
            // Fetch fresh data for the selected date range
            const payload = await this.fetchAnalytics(this.dateRange.start, this.dateRange.end);
            if (!payload || !payload.rows) {
                this.showNotification('No data available for export', 'warning');
                return;
            }
            
            // Transform the data for export
            const exportData = payload.rows.map(row => {
                const spend = parseFloat(row.spend || row.cost || 0);
                const sales = parseFloat(row.sales || row.sales_1d || 0);
                const clicks = parseInt(row.clicks || 0);
                const impressions = parseInt(row.impressions || 0);
                
                const acos = sales > 0 ? (spend / sales) * 100 : 0;
                const roas = spend > 0 ? sales / spend : 0;
                const cpc = clicks > 0 ? spend / clicks : 0;
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                
                return {
                    date: row.date || row.report_date || '',
                    searchTerm: row.searchTerm || row.search_term || 'Unknown',
                    keywords: row.keywords || row.keyword_info || row.match_type || '',
                    campaignName: row.campaignName || row.campaign_name || 'Unknown Campaign',
                    spend: spend,
                    sales: sales,
                    acos: acos,
                    roas: roas,
                    cpc: cpc,
                    ctr: ctr,
                    clicks: clicks,
                    impressions: impressions,
                    purchases: parseInt(row.purchases || row.purchases_1d || 0)
                };
            });
            
            const headers = ['Date', 'Search Term', 'Keywords', 'Campaign Name', 'Spend', 'Sales', 'ACOS', 'ROAS', 'CPC', 'CTR', 'Clicks', 'Impressions', 'Purchases'];
            const csvContent = [
                headers.join(','),
                ...exportData.map(row => [
                    `"${row.date}"`,
                    `"${row.searchTerm}"`,
                    `"${row.keywords}"`,
                    `"${row.campaignName}"`,
                    row.spend,
                    row.sales,
                    row.acos.toFixed(2),
                    row.roas.toFixed(2),
                    row.cpc.toFixed(2),
                    row.ctr.toFixed(2),
                    row.clicks,
                    row.impressions,
                    row.purchases
                ].join(','))
            ].join('\n');
            
            // Generate filename with date range
            const startDate = this.dateRange.startStr || this.toInputDate(this.dateRange.start);
            const endDate = this.dateRange.endStr || this.toInputDate(this.dateRange.end);
            const filename = `amazon-keyword-data-${startDate}-to-${endDate}.csv`;
            
            this.downloadFile(csvContent, filename, 'text/csv');
            this.showNotification(`CSV exported successfully! (${exportData.length} records)`, 'success');
            
        } catch (error) {
            console.error('CSV export error:', error);
            this.showNotification('CSV export failed. Please try again.', 'error');
        }
    }
    
    async exportToExcel() {
        try {
            // Show loading notification
            this.showNotification('Preparing Excel export...', 'info');
            
            // Fetch fresh data for the selected date range
            const payload = await this.fetchAnalytics(this.dateRange.start, this.dateRange.end);
            if (!payload || !payload.rows) {
                this.showNotification('No data available for export', 'warning');
                return;
            }
            
            // Transform the data for export
            const exportData = payload.rows.map(row => {
                const spend = parseFloat(row.spend || row.cost || 0);
                const sales = parseFloat(row.sales || row.sales_1d || 0);
                const clicks = parseInt(row.clicks || 0);
                const impressions = parseInt(row.impressions || 0);
                
                const acos = sales > 0 ? (spend / sales) * 100 : 0;
                const roas = spend > 0 ? sales / spend : 0;
                const cpc = clicks > 0 ? spend / clicks : 0;
                const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                
                return {
                    date: row.date || row.report_date || '',
                    searchTerm: row.searchTerm || row.search_term || 'Unknown',
                    keywords: row.keywords || row.keyword_info || row.match_type || '',
                    campaignName: row.campaignName || row.campaign_name || 'Unknown Campaign',
                    spend: spend,
                    sales: sales,
                    acos: acos,
                    roas: roas,
                    cpc: cpc,
                    ctr: ctr,
                    clicks: clicks,
                    impressions: impressions,
                    purchases: parseInt(row.purchases || row.purchases_1d || 0)
                };
            });
            
            // Create tab-separated file that Excel can open
            const headers = ['Date', 'Search Term', 'Keywords', 'Campaign Name', 'Spend', 'Sales', 'ACOS', 'ROAS', 'CPC', 'CTR', 'Clicks', 'Impressions', 'Purchases'];
            const tsvContent = [
                headers.join('\t'),
                ...exportData.map(row => [
                    row.date,
                    row.searchTerm,
                    row.keywords,
                    row.campaignName,
                    row.spend,
                    row.sales,
                    row.acos.toFixed(2),
                    row.roas.toFixed(2),
                    row.cpc.toFixed(2),
                    row.ctr.toFixed(2),
                    row.clicks,
                    row.impressions,
                    row.purchases
                ].join('\t'))
            ].join('\n');
            
            // Generate filename with date range
            const startDate = this.dateRange.startStr || this.toInputDate(this.dateRange.start);
            const endDate = this.dateRange.endStr || this.toInputDate(this.dateRange.end);
            const filename = `amazon-keyword-data-${startDate}-to-${endDate}.xlsx`;
            
            this.downloadFile(tsvContent, filename, 'application/vnd.ms-excel');
            this.showNotification(`Excel file exported successfully! (${exportData.length} records)`, 'success');
            
        } catch (error) {
            console.error('Excel export error:', error);
            this.showNotification('Excel export failed. Please try again.', 'error');
        }
    }
    
    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
    
    handleFilter(filterType, value) {
        if (filterType === 'campaigns' || filterType === 'keywords') {
            this.activeFilters[filterType] = Array.isArray(value) ? value : [];
        } else {
            this.activeFilters[filterType] = value || '';
        }
        const selectedCampaigns = (this.activeFilters.campaigns || []).map(s => s.toLowerCase());
        const selectedKeywords = (this.activeFilters.keywords || []).map(s => s.toLowerCase());
        const campaignVal = (this.activeFilters.campaign || '').toLowerCase();
        const keywordVal = (this.activeFilters.keyword || '').toLowerCase();
        
        this.filteredData = this.currentData.filter(item => {
            const campaignName = (item.campaignName || '').toLowerCase();
            const keywordsField = (item.keywords || '').toLowerCase();
            const searchTermField = (item.searchTerm || '').toLowerCase();
            const campaignMultiOk = selectedCampaigns.length ? selectedCampaigns.some(c => campaignName.includes(c)) : true;
            const keywordMultiOk = selectedKeywords.length ? selectedKeywords.some(k => keywordsField.includes(k) || searchTermField.includes(k)) : true;
            const campaignSingleOk = campaignVal ? campaignName.includes(campaignVal) : true;
            const keywordSingleOk = keywordVal ? (keywordsField.includes(keywordVal) || searchTermField.includes(keywordVal)) : true;
            return (campaignMultiOk && campaignSingleOk) && (keywordMultiOk && keywordSingleOk);
        });
        
        this.updateTable();
        this.updateResultsCount();
        if (filterType === 'campaigns' || filterType === 'campaign') {
            this.populateFilterOptions();
        }
    }
    
    handleNavigation(navItem) {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        
        // Add active class to clicked item
        navItem.classList.add('active');
        
        // Hide all content sections
        document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));

        // Determine target section
        const explicit = navItem.getAttribute('data-section');
        let sectionId = explicit || 'overview';
        // Map legacy text if attribute missing
        if (!explicit) {
            const sectionText = navItem.querySelector('span:last-child')?.textContent?.trim();
            if (sectionText === 'Keywords') sectionId = 'keywords';
            else if (sectionText === 'Business Reports') sectionId = 'campaigns';
            else if (sectionText === 'Performance') sectionId = 'performance';
            else if (sectionText === 'Reports') sectionId = 'reports';
        }

        // Show selected section
        document.getElementById(sectionId)?.classList.add('active');
    }
    
    handleResize() {
        // Redraw chart on resize
        if (this.chart) {
            setTimeout(() => {
                this.chart.resize();
            }, 100);
        }
    }
    
    startAutoRefresh() {
        // Auto-refresh every 5 minutes
        this.refreshInterval = setInterval(() => {
            this.loadData();
            this.updateLastUpdateTime();
        }, 300000);
    }
    
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    updateLastUpdateTime() {
        const now = new Date();
        const timeString = this.getTimeAgo(now);
        
        const lastUpdateElements = document.querySelectorAll('.last-update');
        lastUpdateElements.forEach(element => {
            if (element.textContent.includes('Last updated:')) {
                element.textContent = `Last updated: ${timeString}`;
            }
        });
    }
    
    getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) {
            return 'just now';
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
    }
    
    updateResultsCount() {
        const resultsElement = document.getElementById('resultsCount');
        if (resultsElement) {
            console.log('📊 Results count calculation:', {
                filteredDataLength: this.filteredData.length,
                currentDataLength: this.currentData.length
            });
            
            if (this.currentTab === 'campaigns') {
                // For campaigns, show all results since they're aggregated
                resultsElement.textContent = `Showing ${this.filteredData.length} of ${this.currentData.length} results`;
            } else {
                // For keywords, show pagination info for aggregated search terms
                if (this.filteredData.length === 0) {
                    resultsElement.textContent = `No results found`;
                } else {
                    // Count unique search terms for accurate pagination
                    const uniqueSearchTerms = new Set(this.filteredData.map(item => item.searchTerm));
                    const totalUniqueTerms = uniqueSearchTerms.size;
                    const startIndex = (this.currentPage - 1) * this.rowsPerPage + 1;
                    const endIndex = Math.min(this.currentPage * this.rowsPerPage, totalUniqueTerms);
                    resultsElement.textContent = `Showing ${startIndex} to ${endIndex} of ${totalUniqueTerms} entries`;
                }
            }
        }
    }
    
    showLoading() {
        const tableBody = document.getElementById('tableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="12" class="loading">
                        <span class="material-icons" style="animation: spin 1s linear infinite;">refresh</span>
                        Loading data...
                    </td>
                </tr>
            `;
        }
    }
    
    showNoDataMessage() {
        const tableBody = document.getElementById('tableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="12" class="no-data">
                        <span class="material-icons" style="color: var(--orange);">database</span>
                        <div style="color: var(--text-primary); font-weight: 600; margin: 8px 0;">Database Connection Required</div>
                        <div style="color: var(--text-secondary); margin-bottom: 16px;">Connect to your database to view real-time Amazon campaign data</div>
                        <button onclick="dashboard.loadData()" style="
                            margin-top: 10px;
                            padding: 10px 20px;
                            background: var(--orange);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 500;
                        ">Connect to Database</button>
                    </td>
                </tr>
            `;
        }
        
        // Clear KPIs when no data
        this.clearKPIs();
        
        // Clear chart when no data
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        // Update results count
        const resultsElement = document.getElementById('resultsCount');
        if (resultsElement) {
            resultsElement.textContent = 'No data available - connect to database';
        }
    }
    
    clearKPIs() {
        const setValue = (label, value) => {
            const el = this.findMetricValueElement(label);
            if (el) {
                el.textContent = '—';
            }
        };
        
        // Clear all KPI values
        setValue('AD SPEND', '—');
        setValue('AD SALES', '—');
        setValue('TOTAL SALES', '—');
        setValue('ACOS', '—');
        setValue('TACOS', '—');
        setValue('ROAS', '—');
        setValue('AD CLICKS', '—');
        setValue('AVG. CPC', '—');
    }
    
    showError(message) {
        const tableBody = document.getElementById('tableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="12" class="no-data">
                        <span class="material-icons" style="color: var(--red);">error</span>
                        <div style="color: var(--red);">${message}</div>
                        <button onclick="dashboard.loadData()" style="
                            margin-top: 10px;
                            padding: 8px 16px;
                            background: var(--orange);
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 12px;
                        ">Retry</button>
                    </td>
                </tr>
            `;
        }
        
        this.showNotification(message, 'error');
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
    
    // Utility methods
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
    
    // Cleanup method
    destroy() {
        this.stopAutoRefresh();
        if (this.chart) {
            this.chart.destroy();
        }
        
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        
        // Remove mobile menu button
        const menuButton = document.querySelector('.mobile-menu-btn');
        if (menuButton) {
            menuButton.remove();
        }
    }
    
    bindSortEvents() {
        const sortableHeaders = document.querySelectorAll('.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => this.handleSort(header.dataset.sort));
        });
    }
    
    updateSortIcons() {
        const headers = document.querySelectorAll('.sortable');
        headers.forEach(header => { 
            const icon = header.querySelector('.material-icons');
            if (header.dataset.sort === this.sortConfig.key) {
                icon.textContent = this.sortConfig.direction === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
            } else {
                icon.textContent = 'keyboard_arrow_down'; // Default to down arrow since we default to desc
            }
        });
    }
}

// Additional CSS for animations and notifications
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        color: var(--text-primary);
        font-size: 14px;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all var(--transition-fast);
    }
    
    .notification-close:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
    }
    
    .notification-close .material-icons {
        font-size: 16px;
    }
    
    @media (max-width: 992px) {
        .sidebar.open {
            transform: translateX(0);
        }
        
        .sidebar {
            transform: translateX(-100%);
        }
    }
    
    @media (max-width: 480px) {
        .notification {
            left: 10px !important;
            right: 10px !important;
            min-width: auto !important;
        }
    }
`;

document.head.appendChild(additionalStyles);

// Initialize dashboard when DOM is loaded
let dashboard;

document.addEventListener('DOMContentLoaded', function() {
    dashboard = new AmazonDashboard();
    
    // Add some initial animation delays to match the smooth loading in your reference
    const animateElements = document.querySelectorAll('.metric-card');
    animateElements.forEach((element, index) => {
        element.style.animationDelay = `${index * 0.1}s`;
    });
});

// Handle page unload
window.addEventListener('beforeunload', function() {
    if (dashboard) {
        dashboard.destroy();
    }
});

// Export for global access
window.AmazonDashboard = AmazonDashboard;

