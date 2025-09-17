// Trend Reports JavaScript
// Comprehensive trend analysis and performance insights

class TrendReports {
    constructor() {
        this.currentCategory = 'products';
        this.currentTimePeriod = 'daily';
        this.currentDateRange = { start: null, end: null };
        this.trendChart = null;
        this.currentData = [];
        this.filteredData = [];
        this.groupedTableData = [];
        this.selectedName = '';
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.sortColumn = 'date';
        this.selectedMetrics = []; // No default selection
        // Keep metric selections separate per category/tab
        this.selectedMetricsByCategory = {
            products: [],
            campaigns: [],
            'search-terms': []
        };
        this.sortDirection = 'desc';
        this.currentMonth = undefined;
        this.currentYear = undefined;
        this.debounceTimer = null;
        this.isLoadingData = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeDatePicker();
        this.initializePeriodDropdown();
        this.setupMobileMenu();
        // Ensure correct metric visibility per category
        this.updateMetricOptionsVisibility();
        
        // Ensure DOM is fully ready before loading data and setting up dropdowns
        setTimeout(() => {
            this.loadInitialData();
        }, 100);
        
        // Initial data is already loaded above, no need for duplicate call
    }

    setupEventListeners() {
        // Category tabs
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchCategory(e.currentTarget.dataset.category);
            });
        });

        // Time period selector
        const periodToggle = document.getElementById('periodToggle');
        const periodDropdown = document.getElementById('periodDropdown');
        
        if (periodToggle && periodDropdown) {
            periodToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = periodDropdown.style.display === 'block';
                periodDropdown.style.display = isOpen ? 'none' : 'block';
                periodToggle.classList.toggle('open', !isOpen);
            });

            // Period dropdown buttons
            document.querySelectorAll('.period-dropdown button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const period = e.target.dataset.period;
                    this.currentTimePeriod = period;
                    document.getElementById('periodDisplay').textContent = e.target.textContent;
                    
                    // Update active state
                    document.querySelectorAll('.period-dropdown button').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    // Close dropdown
                    periodDropdown.style.display = 'none';
                    periodToggle.classList.remove('open');
                    
                    // Reset pagination
                    this.currentPage = 1;
                    
                    // Update name filter and chart
                    this.updateNameFilter();
                    this.updateChart();
                    this.renderTable();
                });
            });
        }

        // Multi-select metric dropdown
        this.setupMultiSelectDropdown();
        
        // Add a global fallback click handler for the metric dropdown
        document.addEventListener('click', (e) => {
            if (e.target.closest('#chartMetricToggle')) {
                const dropdown = document.getElementById('chartMetricDropdown');
                if (dropdown) {
                    dropdown.classList.toggle('open');
                }
            }
        });

        // Search functionality removed - using name filter only

        // Name filter functionality
        this.setupNameFilter();

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => {
            this.previousPage();
        });
        document.getElementById('nextPage').addEventListener('click', () => {
            this.nextPage();
        });

        // Export buttons
        document.getElementById('exportExcel').addEventListener('click', () => {
            this.exportData('excel');
        });
        document.getElementById('exportCSV').addEventListener('click', () => {
            this.exportData('csv');
        });

        // Mobile fullscreen rotate button (mirror keyword page)
        const fsBtn = document.getElementById('trendChartRotateFullscreen');
        if (fsBtn) {
            fsBtn.addEventListener('click', async () => {
                try {
                    const chartSection = document.querySelector('.charts-section .chart-container');
                    if (!chartSection) return;
                    chartSection.classList.add('chart-fullscreen-active');
                    if (chartSection.requestFullscreen) {
                        await chartSection.requestFullscreen({ navigationUI: 'hide' });
                    } else if (document.documentElement.requestFullscreen) {
                        await document.documentElement.requestFullscreen();
                    }
                    let locked = false;
                    if (screen.orientation && screen.orientation.lock) {
                        try { await screen.orientation.lock('landscape'); locked = true; } catch(_) { locked = false; }
                    }
                    if (!locked) { chartSection.classList.add('use-rotate-fallback'); } else { chartSection.classList.remove('use-rotate-fallback'); }
                    if (this.trendChart) { setTimeout(() => this.trendChart.resize(), 100); }
                } catch (_) {}
            });
        }

        // Exit fullscreen handler
        document.addEventListener('fullscreenchange', () => {
            const chartContainer = document.querySelector('.charts-section .chart-container');
            if (!document.fullscreenElement && chartContainer) {
                chartContainer.classList.remove('chart-fullscreen-active');
                chartContainer.classList.remove('use-rotate-fallback');
                if (this.trendChart) { setTimeout(() => this.trendChart.resize(), 100); }
                if (screen.orientation && screen.orientation.unlock) { try { screen.orientation.unlock(); } catch(_) {} }
            }
        });

        // Table sorting
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', (e) => {
                this.sortTable(e.currentTarget.dataset.sort);
            });
        });
    }

    setupMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');

        if (mobileMenuBtn && sidebar) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });

            // Close sidebar when clicking outside
            document.addEventListener('click', (e) => {
                if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            });
        }
    }

    initializeDatePicker() {
        const dateFilter = document.getElementById('dateFilter');
        const presetToggle = document.getElementById('presetToggle');
        const presetDropdown = document.getElementById('presetDropdown');
        const datePickerDropdown = document.getElementById('datePickerDropdown');

        // Set default date range to last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        this.currentDateRange = { start: startDate, end: endDate };
        this.updateDateDisplay();

        // Preset toggle
        presetToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const isOpen = presetDropdown.style.display === 'block';
            presetDropdown.style.display = isOpen ? 'none' : 'block';
            
            // Close calendar if it's open
            datePickerDropdown.style.display = 'none';
            dateFilter.classList.remove('open');
        });

        // Preset buttons
        document.querySelectorAll('.preset-dropdown button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const preset = e.target.dataset.preset;
                this.setPresetDateRange(preset);
                presetDropdown.style.display = 'none';
                
                // Update button text to show selected preset
                const presetText = e.target.textContent.trim();
                presetToggle.textContent = `${presetText} ▾`;
            });
        });

        // Date picker toggle
        dateFilter.addEventListener('click', (e) => {
            // Don't open calendar if clicking on preset toggle
            if (e.target.closest('#presetToggle') || e.target.closest('#presetDropdown')) {
                return;
            }
            e.stopPropagation();
            this.toggleDatePicker();
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            // Don't close if clicking on date picker elements
            if (datePickerDropdown.contains(e.target) || dateFilter.contains(e.target)) {
                return;
            }
            
            // Don't close if clicking on period dropdown elements
            const periodToggle = document.getElementById('periodToggle');
            const periodDropdown = document.getElementById('periodDropdown');
            if (periodToggle && periodDropdown && 
                (periodToggle.contains(e.target) || periodDropdown.contains(e.target))) {
                return;
            }
            
            presetDropdown.style.display = 'none';
            datePickerDropdown.style.display = 'none';
            dateFilter.classList.remove('open');
            
            // Close period dropdown
            if (periodDropdown) {
                periodDropdown.style.display = 'none';
                if (periodToggle) {
                    periodToggle.classList.remove('open');
                }
            }
        });
    }

    initializePeriodDropdown() {
        // Set initial active state and display text
        const periodButtons = document.querySelectorAll('.period-dropdown button');
        const periodDisplay = document.getElementById('periodDisplay');
        
        periodButtons.forEach(btn => {
            if (btn.dataset.period === this.currentTimePeriod) {
                btn.classList.add('active');
                // Set the display text to match the default selection
                if (periodDisplay) {
                    periodDisplay.textContent = btn.textContent;
                }
            }
        });
    }

    setPresetDateRange(preset) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        let start, end;
        
        switch (preset) {
            case 'yesterday':
                start = end = new Date(today);
                start.setDate(start.getDate() - 1);
                break;
            case 'last7':
                start = new Date(today);
                start.setDate(start.getDate() - 7);
                end = today;
                break;
            case 'thisWeek':
                start = new Date(today);
                start.setDate(start.getDate() - today.getDay());
                end = today;
                break;
            case 'lastWeek':
                start = new Date(today);
                start.setDate(start.getDate() - today.getDay() - 7);
                end = new Date(today);
                end.setDate(end.getDate() - today.getDay() - 1);
                break;
            case 'last30':
                start = new Date(today);
                start.setDate(start.getDate() - 30);
                end = today;
                break;
            case 'thisMonth':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = today;
                break;
            case 'lastMonth':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'ytd':
                start = new Date(today.getFullYear(), 0, 1);
                end = today;
                break;
            case 'lifetime':
                start = new Date(2020, 0, 1);
                end = today;
                break;
        }
        
        this.currentDateRange = { start, end };
        this.updateDateDisplay();
        this.updateChart();
    }

    updateDateDisplay() {
        const display = document.getElementById('dateRangeDisplay');
        if (this.currentDateRange.start && this.currentDateRange.end) {
            const startStr = this.currentDateRange.start.toLocaleDateString();
            const endStr = this.currentDateRange.end.toLocaleDateString();
            display.textContent = `${startStr} - ${endStr}`;
        }
    }

    toggleDatePicker() {
        const datePickerDropdown = document.getElementById('datePickerDropdown');
        const dateFilter = document.getElementById('dateFilter');
        
        if (datePickerDropdown.style.display === 'none' || !datePickerDropdown.style.display) {
            this.renderCalendar();
            datePickerDropdown.style.display = 'block';
            dateFilter.classList.add('open');
        } else {
            datePickerDropdown.style.display = 'none';
            dateFilter.classList.remove('open');
        }
    }

    renderCalendar() {
        const datePickerDropdown = document.getElementById('datePickerDropdown');
        const now = new Date();
        const currentMonth = this.currentMonth !== undefined ? this.currentMonth : now.getMonth();
        const currentYear = this.currentYear !== undefined ? this.currentYear : now.getFullYear();
        
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        const calendarHTML = `
            <div class="range-calendar">
                <div class="range-calendar-header">
                    <div class="range-calendar-nav">
                        <button class="range-calendar-btn" onclick="event.stopPropagation(); trendReports.previousMonth()">
                            <span class="material-icons">chevron_left</span>
                        </button>
                        <button class="range-calendar-btn" onclick="event.stopPropagation(); trendReports.nextMonth()">
                            <span class="material-icons">chevron_right</span>
                        </button>
                    </div>
                    <div class="range-calendar-month">${monthNames[currentMonth]} ${currentYear}</div>
                    <div class="range-calendar-nav">
                        <button class="range-calendar-btn" onclick="event.stopPropagation(); this.parentElement.parentElement.parentElement.style.display='none'">
                            <span class="material-icons">close</span>
                        </button>
                    </div>
                </div>
                <div class="range-calendar-weekdays">
                    <div class="range-calendar-weekday">Sun</div>
                    <div class="range-calendar-weekday">Mon</div>
                    <div class="range-calendar-weekday">Tue</div>
                    <div class="range-calendar-weekday">Wed</div>
                    <div class="range-calendar-weekday">Thu</div>
                    <div class="range-calendar-weekday">Fri</div>
                    <div class="range-calendar-weekday">Sat</div>
                </div>
                <div class="range-calendar-grid" id="calendarGrid">
                    ${this.generateCalendarDays(currentYear, currentMonth)}
                </div>
                <div class="range-calendar-footer">
                    <div class="range-calendar-summary" id="dateRangeSummary">
                        Select date range
                    </div>
                    <button class="range-calendar-confirm" onclick="event.stopPropagation(); trendReports.confirmDateRange()">
                        Apply Range
                    </button>
                </div>
            </div>
        `;
        
        datePickerDropdown.innerHTML = calendarHTML;
    }

    generateCalendarDays(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        let html = '';
        const today = new Date();
        
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const isCurrentMonth = date.getMonth() === month;
            const isToday = date.toDateString() === today.toDateString();
            const isSelected = this.isDateInRange(date);
            
            let classes = 'range-calendar-day';
            if (!isCurrentMonth) classes += ' disabled';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' in-range';
            if (this.currentDateRange.start && date.toDateString() === this.currentDateRange.start.toDateString()) {
                classes += ' start';
            }
            if (this.currentDateRange.end && date.toDateString() === this.currentDateRange.end.toDateString()) {
                classes += ' end';
            }
            
            html += `<div class="${classes}" onclick="event.stopPropagation(); trendReports.selectDate(${date.getTime()})" onmouseenter="trendReports.previewDateRange(${date.getTime()})" onmouseleave="trendReports.clearPreview()">${date.getDate()}</div>`;
        }
        
        return html;
    }

    isDateInRange(date) {
        if (!this.currentDateRange.start || !this.currentDateRange.end) return false;
        return date >= this.currentDateRange.start && date <= this.currentDateRange.end;
    }

    selectDate(timestamp) {
        const date = new Date(timestamp);
        
        if (!this.currentDateRange.start || this.currentDateRange.end) {
            // Start new selection
            this.currentDateRange = { start: date, end: null };
        } else {
            // Complete selection
            if (date < this.currentDateRange.start) {
                this.currentDateRange = { start: date, end: this.currentDateRange.start };
            } else {
                this.currentDateRange.end = date;
            }
        }
        
        this.renderCalendar();
        this.updateDateRangeSummary();
    }

    previousMonth() {
        if (this.currentMonth === undefined) {
            const now = new Date();
            this.currentMonth = now.getMonth();
            this.currentYear = now.getFullYear();
        }
        
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        
        this.renderCalendar();
    }

    nextMonth() {
        if (this.currentMonth === undefined) {
            const now = new Date();
            this.currentMonth = now.getMonth();
            this.currentYear = now.getFullYear();
        }
        
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        
        this.renderCalendar();
    }

    previewDateRange(timestamp) {
        const hoverDate = new Date(timestamp);
        
        // Only show preview if we have a start date but no end date
        if (this.currentDateRange.start && !this.currentDateRange.end) {
            const calendarDays = document.querySelectorAll('.range-calendar-day');
            
            calendarDays.forEach(day => {
                const dayTimestamp = parseInt(day.getAttribute('onclick').match(/\d+/)[0]);
                const dayDate = new Date(dayTimestamp);
                
                // Remove existing preview classes
                day.classList.remove('preview-in-range', 'preview-end');
                
                // Add preview classes
                if (dayDate >= this.currentDateRange.start && dayDate <= hoverDate) {
                    day.classList.add('preview-in-range');
                }
                if (dayDate.toDateString() === hoverDate.toDateString()) {
                    day.classList.add('preview-end');
                }
            });
        } else if (!this.currentDateRange.start) {
            // Show hover effect even when no start date is selected
            const calendarDays = document.querySelectorAll('.range-calendar-day');
            
            calendarDays.forEach(day => {
                const dayTimestamp = parseInt(day.getAttribute('onclick').match(/\d+/)[0]);
                const dayDate = new Date(dayTimestamp);
                
                // Remove existing preview classes
                day.classList.remove('preview-in-range', 'preview-end');
                
                // Add preview end class for hovered date
                if (dayDate.toDateString() === hoverDate.toDateString()) {
                    day.classList.add('preview-end');
                }
            });
        }
    }

    clearPreview() {
        const calendarDays = document.querySelectorAll('.range-calendar-day');
        calendarDays.forEach(day => {
            day.classList.remove('preview-in-range', 'preview-end');
        });
    }

    updateDateRangeSummary() {
        const summary = document.getElementById('dateRangeSummary');
        if (this.currentDateRange.start && this.currentDateRange.end) {
            const days = Math.ceil((this.currentDateRange.end - this.currentDateRange.start) / (1000 * 60 * 60 * 24)) + 1;
            summary.textContent = `${days} days selected`;
        } else if (this.currentDateRange.start) {
            summary.textContent = 'Select end date';
        } else {
            summary.textContent = 'Select date range';
        }
    }

    async confirmDateRange() {
        if (this.currentDateRange.start && this.currentDateRange.end) {
            this.updateDateDisplay();
            
            try {
                // Fetch new data with the selected date range
                await this.fetchDataFromDatabase();
                this.updateChart();
                this.renderTable();
            } catch (error) {
                // Show empty data if fetch fails
                this.currentData = [];
                this.filteredData = [];
                this.currentPage = 1;
                this.updateChart();
                this.renderTable();
            }
            
            document.getElementById('datePickerDropdown').style.display = 'none';
            document.getElementById('dateFilter').classList.remove('open');
        }
    }

    async switchCategory(category) {
        this.currentCategory = category;
        
        // Update active tab
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // Reset pagination and filters when switching categories
        this.currentPage = 1;
        this.selectedName = '';
        document.getElementById('nameFilterInput').value = '';
        
        // Restore per-category metric selections or set defaults
        let saved = this.selectedMetricsByCategory[this.currentCategory] || [];
        
        // If no saved selections, set default based on category
        if (saved.length === 0) {
            if (this.currentCategory === 'products') {
                saved = ['sales'];
            } else if (this.currentCategory === 'campaigns') {
                saved = ['spend'];
            } else if (this.currentCategory === 'search-terms') {
                saved = ['sessions'];
            }
            // Save the default selection
            this.selectedMetricsByCategory[this.currentCategory] = [...saved];
        }
        
        // Update checkboxes to reflect saved selection
            document.querySelectorAll('#chartMetricOptions input[type="checkbox"]').forEach(cb => {
            const key = cb.id.replace('metric-', '');
            cb.checked = saved.includes(key);
            });
        this.selectedMetrics = [...saved];
        // Update visibility for metrics per category
        this.updateMetricOptionsVisibility();
        // Update the dropdown display text
            this.updateSelectedMetrics();
        
        try {
            // Fetch new data for the selected category
            await this.fetchDataFromDatabase();
            this.updateNameFilter();
            this.updateChart();
            this.renderTable();
        } catch (error) {
            // Show empty data if fetch fails
            this.currentData = [];
            this.filteredData = [];
            this.currentPage = 1;
            this.updateChart();
            this.renderTable();
        }
    }

    async loadInitialData() {
        // Prevent multiple simultaneous calls
        if (this.isLoadingData) {
            return;
        }
        
        this.isLoadingData = true;
        try {
            // Set default metric selection for first load only
            if (this.selectedMetrics.length === 0) {
                if (this.currentCategory === 'products') {
                    this.selectedMetrics = ['sales'];
                } else if (this.currentCategory === 'campaigns') {
                    this.selectedMetrics = ['spend'];
                } else if (this.currentCategory === 'search-terms') {
                    // Use clicks for search-terms by default (sessions/pageviews not provided here)
                    this.selectedMetrics = ['clicks'];
                }
                
                // Save the selection for this category
                this.selectedMetricsByCategory[this.currentCategory] = [...this.selectedMetrics];
                
                // Update checkboxes to reflect the default selection
                setTimeout(() => {
                    this.selectedMetrics.forEach(metric => {
                        const checkbox = document.getElementById(`metric-${metric}`);
                        if (checkbox) {
                            checkbox.checked = true;
                        }
                    });
                    // Update the UI display text directly
                    const textElement = document.getElementById('chartMetricText');
                    if (this.selectedMetrics.length === 1) {
                        textElement.textContent = this.getMetricLabel(this.selectedMetrics[0]);
                    } else {
                        textElement.textContent = `${this.selectedMetrics.length} Metrics Selected`;
                    }
                }, 100); // Small delay to ensure DOM is ready
            }
            
            // Fetch real data from database
            await this.fetchDataFromDatabase();
            this.updateNameFilter();
            this.updateChart();
            this.renderTable();
        } catch (error) {
            // No fallback - just show empty data
            this.currentData = [];
            this.filteredData = [];
            this.currentPage = 1;
            this.updateChart();
            this.renderTable();
        } finally {
            this.isLoadingData = false;
        }
    }

    async fetchDataFromDatabase() {
        try {
            // Build query parameters
            const params = new URLSearchParams({
                category: this.currentCategory,
                timePeriod: this.currentTimePeriod
            });

            // Add date range if selected
            if (this.currentDateRange.start && this.currentDateRange.end) {
                params.append('start', this.formatLocalDate(this.currentDateRange.start));
                params.append('end', this.formatLocalDate(this.currentDateRange.end));
            }

            // For campaigns, always request both individual and aggregated data
            if (this.currentCategory === 'campaigns') {
                params.append('aggregate', 'date');
            }

            const apiBase = (location.port === '5000' || location.hostname !== '127.0.0.1') ? '' : 'http://localhost:5000';
            const apiUrl = `${apiBase}/api/trend-reports?${params.toString()}`;
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.data && result.data.length > 0) {
                let normalized = result.data.map(r => ({ ...r }));

                if (result.category === 'products') {
                    // Map backend fields to unified metric names
                    const skuMap = await this.fetchProductSkuMap(apiBase);
                    normalized = normalized.map(r => {
                        const spend = Number(r.total_spend || r.spend || 0);
                        const clicks = Number(r.total_clicks || r.clicks || 0);
                        const impressions = Number(r.total_impressions || r.impressions || 0);
                        const sales = Number(r.ordered_product_sales || r.sales || 0);
                        const sessions = Number(r.sessions || 0);
                        const pageviews = Number(r.page_views || r.pageviews || 0);
                        const orders = Number(r.units_ordered || 0);
                        
                        const cpc = clicks > 0 ? spend / clicks : 0;
                        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                        const acos = sales > 0 ? (spend / sales) * 100 : 0;
                        const tcos = acos; // If separate definition needed, adjust here
                        const conversionRate = sessions > 0 ? (orders / sessions) * 100 : 0;

                        const preferredSku = (r.sku && String(r.sku).trim()) ? r.sku : (skuMap[r.name] || null);
                        const displayName = preferredSku || r.name;

                        return {
                            date: r.date,
                            category: 'products',
                            name: r.name,
                            displayName,
                            spend,
                            sales,
                            sessions,
                            pageviews,
                            orders,
                            cpc,
                            ctr,
                            acos,
                            tcos,
                            conversionRate
                        };
                    });

                    // Merge Business totals for any dates that are missing or zero in products
                    try {
                        const bdParams = new URLSearchParams();
                        if (this.currentDateRange.start && this.currentDateRange.end) {
                            bdParams.append('start', this.formatLocalDate(this.currentDateRange.start));
                            bdParams.append('end', this.formatLocalDate(this.currentDateRange.end));
                        }
                        const bdRes = await fetch(`${apiBase}/api/business-data?${bdParams.toString()}`);
                        if (bdRes.ok) {
                            const bdJson = await bdRes.json();
                            const productTotalsByDate = {};
                            normalized.forEach(r => {
                                const key = this.normalizeDateKey(r.date);
                                if (!productTotalsByDate[key]) productTotalsByDate[key] = { sales: 0, sessions: 0, pageviews: 0, orders: 0 };
                                productTotalsByDate[key].sales += Number(r.sales) || 0;
                                productTotalsByDate[key].sessions += Number(r.sessions) || 0;
                                productTotalsByDate[key].pageviews += Number(r.pageviews) || 0;
                                productTotalsByDate[key].orders += Number(r.orders) || 0;
                            });

                            // Aggregate business rows by date
                            const bizByDate = {};
                            (bdJson.data || []).forEach(row => {
                                const key = this.normalizeDateKey(row.date);
                                if (!bizByDate[key]) bizByDate[key] = { sales: 0, sessions: 0, pageviews: 0, orders: 0 };
                                bizByDate[key].sales += Number(row.ordered_product_sales || 0);
                                bizByDate[key].sessions += Number(row.sessions || 0);
                                bizByDate[key].pageviews += Number(row.page_views || 0);
                                bizByDate[key].orders += Number(row.units_ordered || 0);
                            });

                            const additions = [];
                            Object.entries(bizByDate).forEach(([key, totals]) => {
                                const have = productTotalsByDate[key] || { sales: 0, sessions: 0, pageviews: 0, orders: 0 };
                                // If any metric is missing (all zero), inject business totals for that date
                                const missingAll = (have.sales + have.sessions + have.pageviews + have.orders) === 0;
                                if (missingAll && (totals.sales + totals.sessions + totals.pageviews + totals.orders) > 0) {
                                    const conv = totals.sessions > 0 ? (totals.orders / totals.sessions) * 100 : 0;
                                    additions.push({
                                        date: key,
                                        category: 'products',
                                        name: '📊 DAILY TOTAL',
                                        displayName: '📊 DAILY TOTAL',
                                        spend: 0,
                                        sales: totals.sales,
                                        sessions: totals.sessions,
                                        pageviews: totals.pageviews,
                                        orders: totals.orders,
                                        cpc: 0,
                                        ctr: 0,
                                        acos: 0,
                                        tcos: 0,
                                        conversionRate: conv
                                    });
                                }
                            });
                            if (additions.length > 0) {
                                normalized = normalized.concat(additions);
                            }
                        }
                    } catch (_) { /* silent */ }
                } else {
                    // Fallback mapping for other categories (campaigns/search-terms)
                    normalized = normalized.map(r => {
                        const spend = Number(r.spend || r.cost || 0);
                        const sales = Number(r.sales || 0);
                        const clicks = Number(r.clicks || r.total_clicks || 0);
                        const cpc = Number(r.cpc || (clicks > 0 ? spend / clicks : 0));
                        const acos = Number(r.acos || (sales > 0 ? (spend / sales) * 100 : 0));
                        const tcos = Number(r.tcos || 0);
                        const roas = spend > 0 ? sales / spend : 0;
                        return {
                        date: r.date,
                        category: result.category,
                        name: r.name,
                        displayName: r.name,
                            spend,
                            sales,
                            clicks,
                            cpc,
                            roas,
                            ctr: Number(r.ctr || 0),
                            acos,
                            tcos,
                        sessions: Number(r.sessions || 0),
                        pageviews: Number(r.page_views || r.pageviews || 0),
                        conversionRate: Number(r.conversionRate || 0)
                        };
                    });
                }
                this.currentData = normalized;
                this.filteredData = [...normalized];
                return; // Success
            } else {
                this.currentData = [];
                this.filteredData = [];
                return; // Return empty data instead of throwing error
            }
            
        } catch (error) {
            throw error; // Re-throw to trigger fallback
        }
    }

    async fetchProductSkuMap(apiBase) {
        try {
            const params = new URLSearchParams();
            if (this.currentDateRange.start && this.currentDateRange.end) {
                params.append('start', this.formatLocalDate(this.currentDateRange.start));
                params.append('end', this.formatLocalDate(this.currentDateRange.end));
            }
            const url = `${apiBase}/api/business-data?${params.toString()}`;
            const res = await fetch(url);
            if (!res.ok) return {};
            const json = await res.json();
            const map = {};
            (json.data || []).forEach(row => {
                if (row.parent_asin && row.sku) {
                    map[row.parent_asin] = row.sku;
                }
            });
            return map;
        } catch (_) {
            return {};
        }
    }

    generateSampleData() {
        const productNames = [
            'iPhone 15 Pro', 'Samsung Galaxy S24', 'MacBook Pro M3', 'Dell XPS 13', 'iPad Air',
            'Sony WH-1000XM5', 'AirPods Pro', 'Nintendo Switch', 'PlayStation 5', 'Xbox Series X',
            'Canon EOS R5', 'Nikon Z7', 'GoPro Hero 12', 'DJI Mini 4', 'Fitbit Versa 4'
        ];
        
        const campaignNames = [
            'Summer Sale Campaign', 'Black Friday Ads', 'Holiday Special', 'New Year Launch',
            'Back to School', 'Tech Tuesday', 'Weekend Flash Sale', 'Prime Day Deals',
            'Mother\'s Day Special', 'Father\'s Day Gift', 'Valentine\'s Offer', 'Easter Sale',
            'Memorial Day Weekend', 'Labor Day Special', 'Cyber Monday Blitz'
        ];
        
        const searchTerms = [
            'wireless headphones', 'laptop deals', 'smartphone cases', 'gaming mouse',
            'bluetooth speaker', 'fitness tracker', 'camera lens', 'tablet stand',
            'phone charger', 'laptop bag', 'wireless earbuds', 'mechanical keyboard',
            'monitor stand', 'webcam', 'microphone', 'graphics card', 'RAM memory',
            'SSD storage', 'power bank', 'cable organizer'
        ];
        
        const data = [];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90); // Last 90 days
        
        for (let i = 0; i < 90; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            // Generate products data
            productNames.forEach(productName => {
                const baseValue = Math.random() * 1000 + 100;
                const record = {
                    date: date.toISOString().split('T')[0],
                    category: 'products',
                    name: productName,
                    spend: Math.round(baseValue * (0.5 + Math.random())),
                    cpc: Math.round((baseValue * 0.1) * (0.8 + Math.random() * 0.4) * 100) / 100,
                    sales: Math.round(baseValue * (1.5 + Math.random())),
                    acos: Math.round((baseValue * 0.3) * (0.7 + Math.random() * 0.6) * 100) / 100,
                    tcos: Math.round((baseValue * 0.4) * (0.6 + Math.random() * 0.8) * 100) / 100,
                    ctr: Math.round((baseValue * 0.2) * (0.5 + Math.random() * 1.0) * 100) / 100,
                    sessions: Math.round(baseValue * (2 + Math.random() * 3)),
                    pageviews: Math.round(baseValue * (3 + Math.random() * 5)),
                    conversionRate: Math.round((2 + Math.random() * 8) * 100) / 100
                };
                data.push(record);
            });
            
            // Generate campaigns data
            campaignNames.forEach(campaignName => {
                const baseValue = Math.random() * 800 + 200;
                const record = {
                    date: date.toISOString().split('T')[0],
                    category: 'campaigns',
                    name: campaignName,
                    spend: Math.round(baseValue * (0.6 + Math.random())),
                    cpc: Math.round((baseValue * 0.12) * (0.7 + Math.random() * 0.5) * 100) / 100,
                    sales: Math.round(baseValue * (1.8 + Math.random())),
                    acos: Math.round((baseValue * 0.25) * (0.8 + Math.random() * 0.7) * 100) / 100,
                    tcos: Math.round((baseValue * 0.35) * (0.7 + Math.random() * 0.9) * 100) / 100,
                    ctr: Math.round((baseValue * 0.18) * (0.6 + Math.random() * 1.2) * 100) / 100,
                    sessions: Math.round(baseValue * (2.5 + Math.random() * 4)),
                    pageviews: Math.round(baseValue * (3.5 + Math.random() * 6)),
                    conversionRate: Math.round((3 + Math.random() * 9) * 100) / 100
                };
                data.push(record);
            });
            
            // Generate search terms data
            searchTerms.forEach(searchTerm => {
                const baseValue = Math.random() * 600 + 150;
                const record = {
                    date: date.toISOString().split('T')[0],
                    category: 'search-terms',
                    name: searchTerm,
                    spend: Math.round(baseValue * (0.4 + Math.random())),
                    cpc: Math.round((baseValue * 0.08) * (0.9 + Math.random() * 0.3) * 100) / 100,
                    sales: Math.round(baseValue * (1.2 + Math.random())),
                    acos: Math.round((baseValue * 0.2) * (0.6 + Math.random() * 0.8) * 100) / 100,
                    tcos: Math.round((baseValue * 0.3) * (0.5 + Math.random() * 1.0) * 100) / 100,
                    ctr: Math.round((baseValue * 0.15) * (0.4 + Math.random() * 1.5) * 100) / 100,
                    sessions: Math.round(baseValue * (1.8 + Math.random() * 2.5)),
                    pageviews: Math.round(baseValue * (2.5 + Math.random() * 4)),
                    conversionRate: Math.round((1.5 + Math.random() * 7) * 100) / 100
                };
                data.push(record);
            });
        }
        
        this.currentData = data;
        this.filteredData = [...data];
    }


    filterDataByDateRange(data) {
        if (!this.currentDateRange.start || !this.currentDateRange.end) return data;

        // Compare using local date-only keys to avoid timezone shifts (e.g., 'YYYY-MM-DD')
        const startKey = this.formatLocalDate(this.currentDateRange.start);
        let endKey = this.formatLocalDate(this.currentDateRange.end);
        const todayKey = this.formatLocalDate(new Date());
        // If range ends today, we exclude today's (partial) data by capping to yesterday
        if (endKey === todayKey) {
            const endDate = new Date(this.currentDateRange.end.getFullYear(), this.currentDateRange.end.getMonth(), this.currentDateRange.end.getDate() - 1);
            endKey = this.formatLocalDate(endDate);
        }
        
        return data.filter(item => {
            const itemKey = this.normalizeDateKey(item.date);
            return itemKey >= startKey && itemKey <= endKey;
        });
    }


    formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) return '0';
        
        // Round to 2 decimal places first to avoid floating point issues
        const rounded = Math.round(num * 100) / 100;
        
        if (rounded >= 1000000) {
            return (rounded / 1000000).toFixed(1) + 'M';
        } else if (rounded >= 1000) {
            return (rounded / 1000).toFixed(1) + 'K';
        } else if (rounded % 1 === 0) {
            // Show whole numbers without decimals
            return rounded.toString();
        } else {
            // Show up to 2 decimal places, removing trailing zeros
            return rounded.toFixed(2).replace(/\.?0+$/, '');
        }
    }

    formatPercentage(num, decimals = 2) {
        const n = Number(num) || 0;
        // Round to avoid floating point issues
        const rounded = Math.round(n * 100) / 100;
        
        if (rounded % 1 === 0) {
            // Show whole numbers without decimals
            return rounded.toString();
        } else {
            // Show up to 2 decimal places, removing trailing zeros
            return rounded.toFixed(decimals).replace(/\.?0+$/, '');
        }
    }

    formatLocalDate(dateObj) {
        const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    normalizeDateKey(raw) {
        if (!raw) return '';
        // If already YYYY-MM-DD, return as-is
        if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            return raw;
        }
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return String(raw);
        // Build local date key to avoid timezone shifts
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    updateChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;
        
        // Always destroy existing chart first to prevent canvas reuse errors
        if (this.trendChart) {
            this.trendChart.destroy();
            this.trendChart = null;
        }
        
        // Use the same data that's being used for the table
        let data = this.currentData.filter(item => item.category === this.currentCategory);
        
        // Apply name filter if selected (same as table)
        if (this.selectedName) {
            data = data.filter(item => (item.displayName || item.name) === this.selectedName);
        }
        
        // Apply date range filter (same as table)
        data = this.filterDataByDateRange(data);
        
        // Always try to show chart - let Chart.js handle empty data
        
        // Group data by time period for each selected metric
        // If on Campaigns, constrain to only the six allowed metrics
        const allowedCampaignMetrics = ['spend','cpc','clicks','roas','acos','tcos'];
        if (this.currentCategory === 'campaigns') {
            this.selectedMetrics = this.selectedMetrics.filter(m => allowedCampaignMetrics.includes(m));
        }

        const datasets = this.selectedMetrics.map((metric, index) => {
            const groupedData = this.groupDataByTimePeriod(data, metric);
            // Use brand colors with fallback to professional colors
            const colors = ['#80d5be', '#1d5a55', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981'];
            const color = colors[index % colors.length];
            
            return {
                label: this.getMetricLabel(metric),
                data: groupedData.values,
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 3,
                fill: false,
                tension: 0.4,
                pointBackgroundColor: color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
                showLine: true,
                spanGaps: true,
                stepped: false,
                pointStyle: 'circle',
                capBezierPoints: true,
                cubicInterpolationMode: 'monotone'
            };
        });
        
        // Handle case when no metrics are selected
        if (this.selectedMetrics.length === 0) {
            // Show empty chart with message
            this.trendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: []
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    scales: {
                        y: { beginAtZero: true },
                        x: { grid: { display: false } }
                    }
                }
            });
            return;
        }
        
        // Use labels from first metric (they should all be the same)
        const firstMetricData = this.groupDataByTimePeriod(data, this.selectedMetrics[0]);
        
        
        // Ensure we have at least 2 data points for a line
        if (firstMetricData.labels.length < 2 && this.selectedMetrics.length > 0) {
            const allData = this.currentData.filter(item => item.category === this.currentCategory);
            const allGroupedData = this.groupDataByTimePeriod(allData, this.selectedMetrics[0]);
            firstMetricData.labels = allGroupedData.labels;
            // Update datasets with new data
            datasets.forEach((dataset, index) => {
                const metric = this.selectedMetrics[index];
                const newGroupedData = this.groupDataByTimePeriod(allData, metric);
                dataset.data = newGroupedData.values;
            });
        }
        
        if (this.trendChart) {
            this.trendChart.destroy();
        }
        
        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: firstMetricData.labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 750,
                    easing: 'easeInOutQuart'
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                elements: {
                    line: {
                        tension: 0.4,
                        borderWidth: 3,
                        borderCapStyle: 'round',
                        borderJoinStyle: 'round'
                    },
                    point: {
                        radius: 3,
                        hoverRadius: 6,
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#80d5be',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                const value = context.parsed.y;
                                const metric = context.dataset.label;
                                if (metric.includes('Sales') || metric.includes('Spend') || metric.includes('CPC') || metric.includes('CPR')) {
                                    return `${metric}: ₹${value.toFixed(2)}`;
                                } else if (metric.includes('ACOS') || metric.includes('TCOS')) {
                                    return `${metric}: ${value.toFixed(2)}%`;
                                } else if (metric.includes('ROAS') || metric.includes('CTR') || metric.includes('Conversion Rate')) {
                                    return `${metric}: ${value.toFixed(2)}`;
                                } else {
                                    return `${metric}: ${Math.round(value).toLocaleString()}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            callback: function(value) {
                                if (value >= 1000000) {
                                    return (value / 1000000).toFixed(1) + 'M';
                                } else if (value >= 1000) {
                                    return (value / 1000).toFixed(1) + 'K';
                                }
                                return value.toString();
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    groupDataByTimePeriod(data, metric) {
        const groups = {};
        
        data.forEach(item => {
            let key;
            const date = new Date(item.date);
            
            switch (this.currentTimePeriod) {
                case 'daily':
                    key = this.normalizeDateKey(item.date);
                    break;
                case 'weekly':
                    const weekStart = new Date(date);
                    const delta = (weekStart.getDay() + 6) % 7; // Monday-start week (Mon=0..Sun=6)
                    weekStart.setDate(weekStart.getDate() - delta);
                    key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
                    break;
                case 'monthly':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
            }
            
            if (!groups[key]) {
                groups[key] = { values: [], count: 0, dateRange: key };
            }
            groups[key].values.push(item[metric]);
            groups[key].count++;
        });
        
        // Build sorted keys; for daily with date range, include all dates in range
        let sortedKeys = Object.keys(groups).sort();
        if (this.currentTimePeriod === 'daily' && this.currentDateRange.start && this.currentDateRange.end) {
            const expected = [];
            const c = new Date(this.currentDateRange.start.getFullYear(), this.currentDateRange.start.getMonth(), this.currentDateRange.start.getDate());
            let e = new Date(this.currentDateRange.end.getFullYear(), this.currentDateRange.end.getMonth(), this.currentDateRange.end.getDate());
            // Exclude today's partial day from labels
            const todayKey = this.formatLocalDate(new Date());
            if (this.formatLocalDate(e) === todayKey) {
                e.setDate(e.getDate() - 1);
            }
            while (c <= e) {
                expected.push(`${c.getFullYear()}-${String(c.getMonth()+1).padStart(2,'0')}-${String(c.getDate()).padStart(2,'0')}`);
                c.setDate(c.getDate()+1);
            }
            sortedKeys = expected;
        }
        const labels = sortedKeys.map(key => {
            if (this.currentTimePeriod === 'weekly') {
                const date = new Date(key);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else if (this.currentTimePeriod === 'monthly') {
                const [year, month] = key.split('-');
                const date = new Date(year, month - 1, 1);
                return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            } else {
                const [y, m, d] = key.split('-').map(Number);
                const date = new Date(y, m - 1, d);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
        });
        
        const values = sortedKeys.map(key => {
            const group = groups[key] || { values: [], count: 0 };
            if (['spend','sales','sessions','pageviews','orders','clicks'].includes(metric)) {
                return group.values.reduce((sum, val) => sum + (Number(val)||0), 0);
            }
            if (metric === 'roas') {
                // Estimate ROAS via available fields when we grouped by value only
                // Fallback to averaged value
                return group.count > 0 ? (group.values.reduce((s,v)=>s+(Number(v)||0),0)/group.count) : 0;
            }
            return group.count > 0 ? (group.values.reduce((sum, val) => sum + (Number(val)||0), 0) / group.count) : 0;
        });
        
        // Remove only the latest consecutive zero values (data not updated yet)
        let filteredLabels = labels;
        let filteredValues = values;
        
        // Find the last non-zero value index
        let lastNonZeroIndex = -1;
        for (let i = values.length - 1; i >= 0; i--) {
            if (values[i] > 0) {
                lastNonZeroIndex = i;
                break;
            }
        }
        
        // If we found a non-zero value, trim everything after it
        if (lastNonZeroIndex >= 0) {
            filteredLabels = labels.slice(0, lastNonZeroIndex + 1);
            filteredValues = values.slice(0, lastNonZeroIndex + 1);
        }
        
        return { labels: filteredLabels, values: filteredValues };
    }

    setupMultiSelectDropdown() {
        const toggle = document.getElementById('chartMetricToggle');
        const options = document.getElementById('chartMetricOptions');
        const dropdown = document.getElementById('chartMetricDropdown');
        
        
        if (!toggle || !options || !dropdown) {
            return;
        }
        
        // Simple, reliable click handler
        toggle.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle the dropdown using CSS classes
            dropdown.classList.toggle('open');
        };
        
        // Handle checkbox changes
        options.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                this.updateSelectedMetrics();
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
        
        // Initialize checkboxes from saved selection for current category
        const saved = this.selectedMetricsByCategory[this.currentCategory] || [];
        document.querySelectorAll('#chartMetricOptions input[type="checkbox"]').forEach(cb => {
            cb.checked = saved.includes(cb.id.replace('metric-', ''));
        });
        this.updateSelectedMetrics();
    }
    
    updateSelectedMetrics() {
        const checkboxes = document.querySelectorAll('#chartMetricOptions input[type="checkbox"]:checked');
        const previousMetrics = [...this.selectedMetrics];
        this.selectedMetrics = Array.from(checkboxes).map(cb => cb.id.replace('metric-', ''));
        
        
        // Persist selection per current category
        this.selectedMetricsByCategory[this.currentCategory] = [...this.selectedMetrics];
        
        // Update display text
        const textElement = document.getElementById('chartMetricText');
        if (this.selectedMetrics.length === 0) {
            textElement.textContent = 'Select Metrics';
        } else if (this.selectedMetrics.length === 1) {
            textElement.textContent = this.getMetricLabel(this.selectedMetrics[0]);
        } else {
            textElement.textContent = `${this.selectedMetrics.length} Metrics Selected`;
        }
        
        // Update chart and table
        this.updateChart();
        this.renderTable();
    }
    
    getMetricLabel(metric) {
        const labels = {
            'spend': 'Ad Spend',
            'cpc': 'AVG. CPC',
            'clicks': 'Ad Clicks',
            'roas': 'ROAS',
            'acos': 'ACOS',
            'tcos': 'TCOS',
            'sales': 'Sales',
            'orders': 'No of Orders',
            'sessions': 'Sessions',
            'pageviews': 'Page Views',
            'conversionRate': 'Conversion Rate'
        };
        return labels[metric] || metric;
    }

    updateMetricOptionsVisibility() {
        const ids = [
            'metric-sales','metric-spend','metric-orders','metric-sessions','metric-pageviews',
            'metric-cpc','metric-clicks','metric-roas','metric-acos','metric-tcos',
            'metric-searchVolume','metric-searchClicks','metric-conversionRate'
        ];
        const refs = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
        const containers = Object.fromEntries(Object.entries(refs).map(([k, el]) => [k, el ? el.closest('.multi-select-option') : null]));
        const show = (id, visible) => { if (containers[id]) containers[id].style.display = visible ? 'flex' : 'none'; };
        if (this.currentCategory === 'campaigns') {
            // Show campaign-related metrics
            // Only these six in dropdown
            show('metric-sales', false);
            show('metric-spend', true);
            show('metric-cpc', true);
            show('metric-clicks', true);
            show('metric-roas', true);
            show('metric-acos', true);
            show('metric-tcos', true);
            show('metric-orders', false);
            show('metric-sessions', false);
            show('metric-pageviews', false);
            show('metric-searchVolume', false);
            show('metric-searchClicks', false);
            show('metric-conversionRate', false);

            // Ensure at least one metric is selected; default to Ad Spend
            const allowed = ['metric-spend','metric-cpc','metric-clicks','metric-roas','metric-acos','metric-tcos'];
            const checkedAllowed = allowed.filter(id => {
                const el = document.getElementById(id);
                return el && el.checked;
            });
            if (checkedAllowed.length === 0) {
                const spendCb = document.getElementById('metric-spend');
                if (spendCb) spendCb.checked = true;
                this.updateSelectedMetrics();
            }
        } else if (this.currentCategory === 'search-terms') {
            // Search terms: show clicks (most consistently available)
            show('metric-sales', false);
            show('metric-spend', false);
            show('metric-orders', false);
            show('metric-sessions', false);
            show('metric-pageviews', false);
            show('metric-cpc', false);
            show('metric-clicks', true);
            show('metric-roas', false);
            show('metric-acos', false);
            show('metric-tcos', false);
            show('metric-searchVolume', false);
            show('metric-searchClicks', false);
            show('metric-conversionRate', false);
            // Ensure at least one metric is active
            const clicksCb = document.getElementById('metric-clicks');
            if (clicksCb && !clicksCb.checked) {
                clicksCb.checked = true;
                this.updateSelectedMetrics();
            }
        } else {
            // Products: limited standard metrics
            show('metric-sales', true);
            show('metric-spend', false);
            show('metric-orders', true);
            show('metric-sessions', true);
            show('metric-pageviews', true);
            show('metric-cpc', false);
            show('metric-clicks', false);
            show('metric-roas', false);
            show('metric-acos', false);
            show('metric-tcos', false);
            show('metric-searchVolume', false);
            show('metric-searchClicks', false);
            show('metric-conversionRate', true);
        }
    }

    setupNameFilter() {
        const nameFilterInput = document.getElementById('nameFilterInput');
        const nameFilterDropdown = document.getElementById('nameFilterDropdown');
        
        // Input focus/blur events
        nameFilterInput.addEventListener('focus', () => {
            nameFilterDropdown.style.display = 'block';
            this.filterNameOptions('');
        });
        
        nameFilterInput.addEventListener('blur', (e) => {
            // Delay hiding to allow click on dropdown
            setTimeout(() => {
                if (!nameFilterDropdown.contains(document.activeElement) && 
                    !nameFilterDropdown.matches(':hover')) {
                    nameFilterDropdown.style.display = 'none';
                }
            }, 200);
        });
        
        // Input search
        nameFilterInput.addEventListener('input', (e) => {
            this.filterNameOptions(e.target.value);
            nameFilterDropdown.style.display = 'block';
        });
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!nameFilterInput.contains(e.target) && !nameFilterDropdown.contains(e.target)) {
                nameFilterDropdown.style.display = 'none';
            }
        });
    }

    updateNameFilter() {
        const categoryData = this.currentData.filter(item => item.category === this.currentCategory);
        
        // Get unique names with their available dates
        const nameMap = {};
        categoryData.forEach(item => {
            const name = item.displayName || item.name;
            if (!nameMap[name]) {
                nameMap[name] = new Set();
            }
            nameMap[name].add(item.date);
        });
        
        // Store the name map for filtering
        this.nameMap = nameMap;
        
        // Update the dropdown with all names
        this.filterNameOptions('');
    }

    filterNameOptions(searchTerm) {
        const nameFilterDropdown = document.getElementById('nameFilterDropdown');
        const nameFilterInput = document.getElementById('nameFilterInput');
        
        // Clear existing options except "All Names"
        nameFilterDropdown.innerHTML = '<div class="filter-option" data-value="">All Names</div>';
        
        // Add click event for "All Names" option
        const allNamesOption = nameFilterDropdown.querySelector('.filter-option');
        allNamesOption.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.selectedName = '';
            nameFilterInput.value = '';
            nameFilterDropdown.style.display = 'none';
            this.currentPage = 1;
            this.renderTable();
        });
        
        // Filter and add options
        const filteredNames = Object.keys(this.nameMap || {})
            .filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort();
        
        filteredNames.forEach(name => {
            const dates = Array.from(this.nameMap[name]).sort();
            const dateCount = dates.length;
            const option = document.createElement('div');
            option.className = 'filter-option';
            option.dataset.value = name;
            
            // Format dates based on time period
            let dateText = '';
            if (this.currentTimePeriod === 'daily') {
                dateText = dates.slice(0, 5).map(d => new Date(d).getDate()).join(', ');
                if (dates.length > 5) dateText += `... (+${dates.length - 5} more)`;
            } else if (this.currentTimePeriod === 'weekly') {
                dateText = dates.slice(0, 3).map(d => {
                    const date = new Date(d);
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    return `Week of ${weekStart.getDate()}`;
                }).join(', ');
                if (dates.length > 3) dateText += `... (+${dates.length - 3} more)`;
            } else if (this.currentTimePeriod === 'monthly') {
                dateText = dates.slice(0, 3).map(d => {
                    const date = new Date(d);
                    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                }).join(', ');
                if (dates.length > 3) dateText += `... (+${dates.length - 3} more)`;
            }
            
            option.textContent = `${name} (${dateCount} dates: ${dateText})`;
            
            // Add click event
            option.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent input blur
                this.selectedName = option.dataset.value;
                nameFilterInput.value = this.selectedName || '';
                nameFilterDropdown.style.display = 'none';
                this.currentPage = 1;
                this.renderTable();
            });
            
            nameFilterDropdown.appendChild(option);
        });
        
        // Show "No results" if no matches
        if (filteredNames.length === 0 && searchTerm) {
            const noResults = document.createElement('div');
            noResults.className = 'filter-option';
            noResults.textContent = 'No matching names found';
            noResults.style.color = 'var(--text-muted)';
            noResults.style.cursor = 'default';
            nameFilterDropdown.appendChild(noResults);
        }
    }

    // filterData method removed - using name filter only

    sortTable(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        this.renderTable();
    }

    getGroupedTableData() {
        let categoryData = this.currentData.filter(item => item.category === this.currentCategory);
        
        // Apply search filter if search term exists
        if (this.searchTerm) {
            categoryData = categoryData.filter(item => 
                item.category.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                item.date.includes(this.searchTerm) ||
                item.name.toLowerCase().includes(this.searchTerm.toLowerCase())
            );
        }
        
        const groups = {};
        
        categoryData.forEach(item => {
            let dateKey;
            const date = new Date(item.date);
            
            switch (this.currentTimePeriod) {
                case 'daily':
                    dateKey = item.date;
                    break;
                case 'weekly':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    dateKey = weekStart.toISOString().split('T')[0];
                    break;
                case 'monthly':
                    dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
            }
            
            // Create unique key combining date and name
            const key = `${dateKey}_${item.name}`;
            
            if (!groups[key]) {
                groups[key] = {
                    dateKey: dateKey,
                    category: item.category,
                    name: item.name,
                    spend: 0,
                    cpc: 0,
                    sales: 0,
                    acos: 0,
                    tcos: 0,
                    ctr: 0,
                    sessions: 0,
                    pageviews: 0,
                    conversionRate: 0,
                    count: 0
                };
            }
            
            // Sum values for aggregation
            groups[key].spend += item.spend;
            groups[key].sales += item.sales;
            groups[key].sessions += item.sessions;
            groups[key].pageviews += item.pageviews;
            
            // Average values for rates
            groups[key].cpc += item.cpc;
            groups[key].acos += item.acos;
            groups[key].tcos += item.tcos;
            groups[key].ctr += item.ctr;
            groups[key].conversionRate += item.conversionRate;
            groups[key].count++;
        });
        
        // Calculate averages and format labels
        const sortedKeys = Object.keys(groups).sort();
        return sortedKeys.map(key => {
            const group = groups[key];
            const date = new Date(group.dateKey);
            
            let dateLabel;
            if (this.currentTimePeriod === 'weekly') {
                const weekEnd = new Date(date);
                weekEnd.setDate(date.getDate() + 6);
                dateLabel = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            } else if (this.currentTimePeriod === 'monthly') {
                dateLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            } else {
                dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }
            
            return {
                dateLabel: dateLabel,
                category: group.category,
                name: group.name,
                spend: Math.round(group.spend),
                cpc: Math.round((group.cpc / group.count) * 100) / 100,
                sales: Math.round(group.sales),
                acos: Math.round((group.acos / group.count) * 100) / 100,
                tcos: Math.round((group.tcos / group.count) * 100) / 100,
                ctr: Math.round((group.ctr / group.count) * 100) / 100,
                sessions: Math.round(group.sessions),
                pageviews: Math.round(group.pageviews),
                conversionRate: Math.round((group.conversionRate / group.count) * 100) / 100
            };
        });
    }

    renderTable() {
        const tbody = document.getElementById('tableBody');
        const theadRow = document.getElementById('tableHeaderRow');
        
        // Get individual records
        let data = this.currentData.filter(item => item.category === this.currentCategory);
        
        // Apply name filter if selected
        if (this.selectedName) {
            data = data.filter(item => (item.displayName || item.name) === this.selectedName);
        }
        
        // Apply date range filter
        data = this.filterDataByDateRange(data);
        
        
        // Build date buckets based on currentTimePeriod
        const buckets = this.buildDateBuckets(data);
        
        // Group data by product name
        const groupedData = this.groupDataByProductForPivot(data, buckets);
        
        // Compute totals per product to prioritize rows with data
        const withTotals = groupedData.map(g => {
            const sum = (obj = {}) => Object.values(obj || {}).reduce((s, v) => s + (Number(v) || 0), 0);
            const totalSales = sum(g.salesByKey);
            const totalSpend = sum(g.spendByKey);
            const totalSessions = sum(g.sessionsByKey);
            const totalPageviews = sum(g.pageviewsByKey);
            return { ...g, __totalSales: totalSales, __totalSpend: totalSpend, __totalSessions: totalSessions, __totalPageviews: totalPageviews };
        });

        // Sort: products with data first (by sales desc, then spend), keep name sort when explicitly selected
        const sortedData = withTotals.sort((a, b) => {
            if (this.sortColumn === 'name') {
                const an = a.name.toLowerCase();
                const bn = b.name.toLowerCase();
                return this.sortDirection === 'asc' ? (an > bn ? 1 : -1) : (an < bn ? 1 : -1);
            }
            const aKey = a.__totalSales || a.__totalSpend || 0;
            const bKey = b.__totalSales || b.__totalSpend || 0;
            // Descending by default so non-zero first
            if (bKey !== aKey) return bKey - aKey;
            // Tie-breakers
            if (b.__totalSessions !== a.__totalSessions) return b.__totalSessions - a.__totalSessions;
            if (b.__totalPageviews !== a.__totalPageviews) return b.__totalPageviews - a.__totalPageviews;
            return a.name.localeCompare(b.name);
        });
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = sortedData.slice(startIndex, endIndex);
        
        // Render dynamic header (name + metric + date columns)
        theadRow.innerHTML = `
            <th class="sortable" data-sort="name">
                <span>Product Name</span>
                <span class="material-icons">keyboard_arrow_down</span>
            </th>
            <th>
                <span>Metric</span>
            </th>
            ${buckets.labels.map(lbl => `<th><span>${lbl}</span></th>`).join('')}
        `;
        
        // Handle case when no metrics are selected
        if (this.selectedMetrics.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${buckets.labels.length + 1}" style="text-align: center; padding: 20px; color: #666;">
                        Please select at least one metric to view data
                    </td>
                </tr>
            `;
            return;
        }
        
        // Render rows with only selected metrics for each product
        tbody.innerHTML = pageData.map(product => {
            const allMetrics = [
                { key: 'spend', label: 'Ad Spend', data: product.spendByKey, format: 'currency' },
                { key: 'cpc', label: 'AVG. CPC', data: product.cpcByKey, format: 'currency' },
                { key: 'clicks', label: 'Ad Clicks', data: product.clicksByKey, format: 'number' },
                { key: 'roas', label: 'ROAS', data: product.roasByKey, format: 'number' },
                { key: 'acos', label: 'ACOS', data: product.acosByKey, format: 'percentage' },
                { key: 'tcos', label: 'TCOS', data: product.tcosByKey, format: 'percentage' },
                { key: 'sales', label: 'Sales', data: product.salesByKey, format: 'currency' },
                { key: 'orders', label: 'No of Orders', data: product.ordersByKey, format: 'number' },
                { key: 'sessions', label: 'Sessions', data: product.sessionsByKey, format: 'number' },
                { key: 'pageviews', label: 'Page Views', data: product.pageviewsByKey, format: 'number' },
                { key: 'conversionRate', label: 'Conversion Rate', data: product.conversionRateByKey, format: 'percentage' }
            ];
            
            // Filter to only show selected metrics
            const metricRows = allMetrics.filter(metric => this.selectedMetrics.includes(metric.key));
            
            
            return metricRows.map((metric, index) => {
                const cells = buckets.keys.map(key => {
                    const val = metric.data[key] || 0;
                    
                    
                    let formattedVal;
                    if (metric.format === 'currency') {
                        formattedVal = `₹${this.formatNumber(val)}`;
                    } else if (metric.format === 'percentage') {
                        formattedVal = `${this.formatPercentage(val, 1)}%`;
                    } else {
                        formattedVal = this.formatNumber(val);
                    }
                    return `<td>${formattedVal}</td>`;
                }).join('');
                
                const productNameCell = index === 0 ? `<td rowspan="${metricRows.length}" style="vertical-align: top; font-weight: 600;">${product.name}</td>` : '';
                
                // Check if this is a total row (contains "DAILY TOTAL" or "📊")
                const isTotalRow = product.name.includes('📊') || product.name.includes('DAILY TOTAL') || product.name.includes('Total');
                const rowClass = isTotalRow ? 'total-row' : '';
                
                return `
                    <tr class="${rowClass}">
                        ${productNameCell}
                        <td style="font-weight: 500; background: #f8f9fa;">${metric.label}</td>
                        ${cells}
                    </tr>
                `;
            }).join('');
        }).join('');
        
        this.updatePagination(sortedData.length);
        this.updateResultsCount(sortedData.length);
    }

    buildDateBuckets(data) {
        // Determine all date bucket keys and display labels from filtered data based on currentTimePeriod
        const keySet = new Set();
        const keyToLabel = {};
        const add = (key, label) => { keySet.add(key); if (!keyToLabel[key]) keyToLabel[key] = label; };
        const pushDaily = (rawDateStr) => {
            // Normalize to YYYY-MM-DD to keep keys consistent
            const key = this.normalizeDateKey(rawDateStr);
            const [y, m, d] = (key || '').split('-').map(Number);
            const dateObj = Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d)
                ? new Date(y, m - 1, d)
                : null;
            const label = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : (key || '');
            add(key, label || '');
        };
        const pushWeekly = (d) => { 
            const start = new Date(d); 
            const delta = (start.getDay() + 6) % 7; // Monday-start week
            start.setDate(start.getDate() - delta); 
            const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`; 
            add(key, `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`); 
        };
        const pushMonthly = (d) => { const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; add(key, d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })); };
        
        if (this.currentTimePeriod === 'daily' && this.currentDateRange.start && this.currentDateRange.end) {
            // DAILY: Build buckets for EVERY day in selected range so table shows continuous dates
            const start = new Date(this.currentDateRange.start.getFullYear(), this.currentDateRange.start.getMonth(), this.currentDateRange.start.getDate());
            let end = new Date(this.currentDateRange.end.getFullYear(), this.currentDateRange.end.getMonth(), this.currentDateRange.end.getDate());
            // Exclude today's partial data
            const todayKey = this.formatLocalDate(new Date());
            if (this.formatLocalDate(end) === todayKey) {
                end.setDate(end.getDate() - 1);
            }
            const cursor = new Date(start);
            while (cursor <= end) {
                pushDaily(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`);
                cursor.setDate(cursor.getDate() + 1);
            }
        } else {
            data.forEach(item => {
                if (this.currentTimePeriod === 'weekly') {
                    const d = new Date(item.date);
                    pushWeekly(d);
                } else if (this.currentTimePeriod === 'monthly') {
                    const d = new Date(item.date);
                    pushMonthly(d);
                } else {
                    pushDaily(item.date);
                }
            });
        }
        const keys = Array.from(keySet).sort().reverse();
        const labels = keys.map(k => keyToLabel[k] || k);
        return { keys, labels };
    }

    groupDataByProductForPivot(data, buckets) {
        const groups = {};
        
        data.forEach(item => {
            const name = item.displayName || item.name;
            const date = new Date(item.date);
            let key;
            if (this.currentTimePeriod === 'weekly') { 
                const start = new Date(date); 
                const delta = (start.getDay() + 6) % 7; // Monday-start week
                start.setDate(start.getDate() - delta); 
                key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`; 
            }
            else if (this.currentTimePeriod === 'monthly') { key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
            else { key = this.normalizeDateKey(item.date); }
            
            if (!groups[name]) {
                groups[name] = {
                    name: name,
                    spendByKey: {},
                    salesByKey: {},
                    clicksByKey: {},
                    sessionsByKey: {},
                    pageviewsByKey: {},
                    ordersByKey: {},
                    cpcByKey: {},
                    acosByKey: {},
                    tcosByKey: {},
                    ctrByKey: {},
                    conversionRateByKey: {},
                    roasByKey: {}
                };
            }
            
            // Aggregate all metrics by date key
            groups[name].spendByKey[key] = (groups[name].spendByKey[key] || 0) + (item.spend || 0);
            groups[name].salesByKey[key] = (groups[name].salesByKey[key] || 0) + (item.sales || 0);
            groups[name].clicksByKey[key] = (groups[name].clicksByKey[key] || 0) + (item.clicks || 0);
            groups[name].sessionsByKey[key] = (groups[name].sessionsByKey[key] || 0) + (item.sessions || 0);
            groups[name].pageviewsByKey[key] = (groups[name].pageviewsByKey[key] || 0) + (item.pageviews || 0);
            groups[name].ordersByKey[key] = (groups[name].ordersByKey[key] || 0) + (item.orders || 0);
            
            groups[name].cpcByKey[key] = (groups[name].cpcByKey[key] || 0) + (item.cpc || 0);
            groups[name].acosByKey[key] = (groups[name].acosByKey[key] || 0) + (item.acos || 0);
            groups[name].tcosByKey[key] = (groups[name].tcosByKey[key] || 0) + (item.tcos || 0);
            groups[name].ctrByKey[key] = (groups[name].ctrByKey[key] || 0) + (item.ctr || 0);
            groups[name].conversionRateByKey[key] = (groups[name].conversionRateByKey[key] || 0) + (item.conversionRate || 0);
            // Maintain ROAS per key from aggregated spend/sales
            const aggSpend = groups[name].spendByKey[key] || 0;
            const aggSales = groups[name].salesByKey[key] || 0;
            groups[name].roasByKey[key] = aggSpend > 0 ? aggSales / aggSpend : 0;
        });
        
        return Object.values(groups);
    }

    updatePagination(totalRecords) {
        const totalPages = Math.ceil(totalRecords / this.itemsPerPage);
        const currentPageElement = document.getElementById('currentPage');
        const totalPagesElement = document.getElementById('totalPages');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        currentPageElement.textContent = this.currentPage;
        totalPagesElement.textContent = totalPages;
        
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages;
    }
    
    updateResultsCount(totalRecords) {
        const resultsCount = document.getElementById('resultsCount');
        const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.itemsPerPage, totalRecords);
        resultsCount.textContent = `Showing ${startIndex}-${endIndex} of ${totalRecords} results`;
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTable();
        }
    }

    nextPage() {
        // Recompute grouped length to paginate correctly
        let data = this.currentData.filter(item => item.category === this.currentCategory);
        if (this.selectedName) {
            data = data.filter(item => (item.displayName || item.name) === this.selectedName);
        }
        data = this.filterDataByDateRange(data);
        const buckets = this.buildDateBuckets(data);
        const groupedData = this.groupDataByProductForPivot(data, buckets);
        const totalPages = Math.ceil(groupedData.length / this.itemsPerPage) || 1;
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderTable();
        }
    }

    exportData(format) {
        const data = this.filteredData.map(item => ({
            Date: new Date(item.date).toLocaleDateString(),
            Category: item.category.replace('-', ' ').toUpperCase(),
            Spend: `₹${this.formatNumber(item.spend)}`,
            CPC: `₹${item.cpc}`,
            Sales: `₹${this.formatNumber(item.sales)}`,
            ACOS: `${item.acos}%`,
            TCOS: `${item.tcos}%`,
            CPR: `₹${item.cpr}`,
            Sessions: this.formatNumber(item.sessions),
            'Page Views': this.formatNumber(item.pageviews)
        }));
        
        if (format === 'csv') {
            this.downloadCSV(data);
        } else if (format === 'excel') {
            this.downloadExcel(data);
        }
    }

    downloadCSV(data) {
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trend-reports-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    downloadExcel(data) {
        // Simple Excel export using CSV format with .xlsx extension
        this.downloadCSV(data);
    }

    showChartNoData() {
        // Don't replace the canvas - just show empty chart
    }
}

// Initialize the Trend Reports when DOM is loaded
let trendReports;
document.addEventListener('DOMContentLoaded', function() {
    trendReports = new TrendReports();
});
