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
        this.selectedMetrics = ['sales']; // Default to sales
        this.sortDirection = 'desc';
        this.currentMonth = undefined;
        this.currentYear = undefined;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeDatePicker();
        this.initializePeriodDropdown();
        this.loadInitialData();
        this.setupMobileMenu();
        
        // Force load database data after a short delay to ensure everything is ready
        setTimeout(() => {
            console.log('🔄 Force loading database data...');
            this.loadInitialData();
        }, 1000);
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
        // Set initial active state
        const periodButtons = document.querySelectorAll('.period-dropdown button');
        periodButtons.forEach(btn => {
            if (btn.dataset.period === this.currentTimePeriod) {
                btn.classList.add('active');
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
                console.error('Failed to fetch data for date range:', error);
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
        
        try {
            // Fetch new data for the selected category
            await this.fetchDataFromDatabase();
            this.updateNameFilter();
            this.updateChart();
            this.renderTable();
        } catch (error) {
            console.error('Failed to fetch data for category:', category, error);
            // Show empty data if fetch fails
            this.currentData = [];
            this.filteredData = [];
            this.currentPage = 1;
            this.updateChart();
            this.renderTable();
        }
    }

    async loadInitialData() {
        console.log('🚀 Loading initial data...');
        try {
            // Fetch real data from database
            await this.fetchDataFromDatabase();
            console.log('✅ Database data loaded successfully');
            this.updateNameFilter();
            this.updateChart();
            this.renderTable();
        } catch (error) {
            console.error('❌ Failed to load data from database, showing empty page:', error);
            // No fallback - just show empty data
            this.currentData = [];
            this.filteredData = [];
            this.currentPage = 1;
            this.updateChart();
            this.renderTable();
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

            const apiBase = (location.port === '5000' || location.hostname !== '127.0.0.1') ? '' : 'http://localhost:5000';
            const apiUrl = `${apiBase}/api/trend-reports?${params.toString()}`;
            console.log('📊 Fetching data from database:', apiUrl);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📊 Database response received:', {
                hasData: !!result.data,
                dataLength: result.data ? result.data.length : 0,
                category: result.category,
                firstRecord: result.data && result.data.length > 0 ? result.data[0] : null
            });
            
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
                        
                        // Debug: Log first few records to check orders data
                        if (normalized.indexOf(r) < 3) {
                            console.log('🔍 Sample record:', {
                                date: r.date,
                                name: r.name,
                                units_ordered: r.units_ordered,
                                orders: orders,
                                rawRecord: r
                            });
                        }
                        
                        // Debug: Log ALL records with orders > 0
                        if (orders > 0) {
                            console.log('📦 FOUND ORDERS!', {
                                date: r.date,
                                name: r.name,
                                units_ordered: r.units_ordered,
                                orders: orders
                            });
                        }
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
                } else {
                    // Fallback mapping for other categories (campaigns/search-terms)
                    normalized = normalized.map(r => ({
                        date: r.date,
                        category: result.category,
                        name: r.name,
                        displayName: r.name,
                        spend: Number(r.spend || r.cost || 0),
                        sales: Number(r.sales || 0),
                        sessions: Number(r.sessions || 0),
                        pageviews: Number(r.page_views || r.pageviews || 0),
                        cpc: Number(r.cpc || 0),
                        ctr: Number(r.ctr || 0),
                        acos: Number(r.acos || 0),
                        tcos: Number(r.tcos || 0),
                        conversionRate: Number(r.conversionRate || 0)
                    }));
                }
                this.currentData = normalized;
                this.filteredData = [...normalized];
                console.log(`✅ Successfully loaded ${result.data.length} records from database for ${result.category}`);
                console.log('📊 Sample records:', result.data.slice(0, 3));
                return; // Success
            } else {
                console.log('⚠️ No data returned from database');
                this.currentData = [];
                this.filteredData = [];
                return; // Return empty data instead of throwing error
            }
            
        } catch (error) {
            console.error('❌ Error fetching data from database:', error);
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
            console.log('🔗 Fetching SKU map from business endpoint:', url);
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
        
        return data.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= this.currentDateRange.start && itemDate <= this.currentDateRange.end;
        });
    }


    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatPercentage(num, decimals = 1) {
        const n = Number(num) || 0;
        return n.toFixed(decimals);
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
        
        const categoryData = this.currentData.filter(item => item.category === this.currentCategory);
        const dateFilteredData = this.filterDataByDateRange(categoryData);
        
        // Group data by time period for each selected metric
        const datasets = this.selectedMetrics.map((metric, index) => {
            const groupedData = this.groupDataByTimePeriod(dateFilteredData, metric);
            const colors = ['#39c258', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981'];
            const color = colors[index % colors.length];
            
            return {
                label: this.getMetricLabel(metric),
                data: groupedData.values,
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 3,
                fill: false,
                tension: 0.6,
                pointBackgroundColor: color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                showLine: true,
                spanGaps: true,
                stepped: false
            };
        });
        
        // Use labels from first metric (they should all be the same)
        const firstMetricData = this.groupDataByTimePeriod(dateFilteredData, this.selectedMetrics[0] || 'sales');
        
        // Debug: Log data points
        console.log(`Chart data for ${this.selectedMetrics.join(', ')}:`, {
            totalDataPoints: dateFilteredData.length,
            datasets: datasets.length,
            labels: firstMetricData.labels
        });
        
        // Ensure we have at least 2 data points for a line
        if (firstMetricData.labels.length < 2) {
            console.warn('Not enough data points for line chart, using all data');
            const allData = this.currentData.filter(item => item.category === this.currentCategory);
            const allGroupedData = this.groupDataByTimePeriod(allData, this.selectedMetrics[0] || 'sales');
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
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
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
        
        const sortedKeys = Object.keys(groups).sort();
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
            const group = groups[key];
            if (metric === 'spend' || metric === 'sales' || metric === 'sessions' || metric === 'pageviews' || metric === 'orders') {
                return group.values.reduce((sum, val) => sum + val, 0);
            } else {
                return group.values.reduce((sum, val) => sum + val, 0) / group.count;
            }
        });
        
        return { labels, values };
    }

    setupMultiSelectDropdown() {
        const toggle = document.getElementById('chartMetricToggle');
        const options = document.getElementById('chartMetricOptions');
        const dropdown = document.getElementById('chartMetricDropdown');
        
        // Toggle dropdown
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
            options.style.display = dropdown.classList.contains('open') ? 'block' : 'none';
        });
        
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
                options.style.display = 'none';
            }
        });
        
        // Set default selection to Sales
        const salesCheckbox = document.getElementById('metric-sales');
        if (salesCheckbox) {
            salesCheckbox.checked = true;
        }
        this.updateSelectedMetrics();
    }
    
    updateSelectedMetrics() {
        const checkboxes = document.querySelectorAll('#chartMetricOptions input[type="checkbox"]:checked');
        this.selectedMetrics = Array.from(checkboxes).map(cb => cb.id.replace('metric-', ''));
        
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
            'spend': 'Spend',
            'cpc': 'CPC', 
            'sales': 'Sales',
            'orders': 'No of Orders',
            'sessions': 'Sessions',
            'pageviews': 'Page Views',
            'conversionRate': 'Conversion Rate'
        };
        return labels[metric] || metric;
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
            console.log('Selected: All Names');
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
                console.log('Selected name:', this.selectedName);
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
            console.log(`Filtered by name "${this.selectedName}": ${data.length} records`);
        }
        
        // Apply date range filter
        data = this.filterDataByDateRange(data);
        
        console.log(`Total data after filtering: ${data.length} records`);
        
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
        
        // Render rows with only selected metrics for each product
        tbody.innerHTML = pageData.map(product => {
            const allMetrics = [
                { key: 'spend', label: 'Spend', data: product.spendByKey, format: 'currency' },
                { key: 'cpc', label: 'CPC', data: product.cpcByKey, format: 'currency' },
                { key: 'sales', label: 'Sales', data: product.salesByKey, format: 'currency' },
                { key: 'orders', label: 'No of Orders', data: product.ordersByKey, format: 'number' },
                { key: 'sessions', label: 'Sessions', data: product.sessionsByKey, format: 'number' },
                { key: 'pageviews', label: 'Page Views', data: product.pageviewsByKey, format: 'number' },
                { key: 'conversionRate', label: 'Conversion Rate', data: product.conversionRateByKey, format: 'percentage' }
            ];
            
            // Filter to only show selected metrics
            const metricRows = allMetrics.filter(metric => this.selectedMetrics.includes(metric.key));
            
            // Debug: Log what metrics are selected and what will be shown
            if (product === pageData[0]) { // Only log for first product to avoid spam
                console.log('🔍 Table metrics debug:', {
                    selectedMetrics: this.selectedMetrics,
                    allMetrics: allMetrics.map(m => m.key),
                    filteredMetrics: metricRows.map(m => m.key)
                });
            }
            
            return metricRows.map((metric, index) => {
                const cells = buckets.keys.map(key => {
                    const val = metric.data[key] || 0;
                    
                    // Debug: Log orders values in table rendering
                    if (metric.label === 'No of Orders' && val > 0) {
                        console.log('📊 Rendering orders in table:', {
                            product: product.name,
                            key: key,
                            val: val,
                            metricData: metric.data
                        });
                    }
                    
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
                
                return `
                    <tr>
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
            // Build buckets for every day in the selected range
            const start = new Date(this.currentDateRange.start.getFullYear(), this.currentDateRange.start.getMonth(), this.currentDateRange.start.getDate());
            const end = new Date(this.currentDateRange.end.getFullYear(), this.currentDateRange.end.getMonth(), this.currentDateRange.end.getDate());
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                add(key, d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
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
        const keys = Array.from(keySet).sort();
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
                    sessionsByKey: {},
                    pageviewsByKey: {},
                    ordersByKey: {},
                    cpcByKey: {},
                    acosByKey: {},
                    tcosByKey: {},
                    ctrByKey: {},
                    conversionRateByKey: {}
                };
            }
            
            // Aggregate all metrics by date key
            groups[name].spendByKey[key] = (groups[name].spendByKey[key] || 0) + (item.spend || 0);
            groups[name].salesByKey[key] = (groups[name].salesByKey[key] || 0) + (item.sales || 0);
            groups[name].sessionsByKey[key] = (groups[name].sessionsByKey[key] || 0) + (item.sessions || 0);
            groups[name].pageviewsByKey[key] = (groups[name].pageviewsByKey[key] || 0) + (item.pageviews || 0);
            groups[name].ordersByKey[key] = (groups[name].ordersByKey[key] || 0) + (item.orders || 0);
            
            // Debug: Log orders aggregation
            if (item.orders > 0) {
                console.log('🔄 Aggregating orders:', {
                    name: name,
                    date: item.date,
                    key: key,
                    orders: item.orders,
                    totalOrders: groups[name].ordersByKey[key]
                });
            }
            groups[name].cpcByKey[key] = (groups[name].cpcByKey[key] || 0) + (item.cpc || 0);
            groups[name].acosByKey[key] = (groups[name].acosByKey[key] || 0) + (item.acos || 0);
            groups[name].tcosByKey[key] = (groups[name].tcosByKey[key] || 0) + (item.tcos || 0);
            groups[name].ctrByKey[key] = (groups[name].ctrByKey[key] || 0) + (item.ctr || 0);
            groups[name].conversionRateByKey[key] = (groups[name].conversionRateByKey[key] || 0) + (item.conversionRate || 0);
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
}

// Initialize the Trend Reports when DOM is loaded
let trendReports;
document.addEventListener('DOMContentLoaded', function() {
    trendReports = new TrendReports();
});
