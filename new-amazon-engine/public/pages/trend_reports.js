// Trend Reports JavaScript
// Comprehensive trend analysis and performance insights

const GLOBAL_DATE_RANGE_STORAGE_KEY = 'global_date_range';
const GLOBAL_DATE_RANGE_WINDOW_PREFIX = '__GLOBAL_DATE_RANGE__=';

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
        this.selectedNames = new Set(); // multi-select names
        
        // Separate selections per category (like metrics)
        this.selectedNamesByCategory = {
            'products': new Set(),
            'campaigns': new Set(), 
            'search-terms': new Set()
        };
        
        // Campaign filter for search-terms tab
        this.selectedCampaigns = new Set(); // multi-select campaigns
        this.selectedCampaignsByCategory = {
            'products': new Set(),
            'campaigns': new Set(), 
            'search-terms': new Set()
        };
        this.currentPage = 1;
        this.itemsPerPage = Number(localStorage.getItem('trend_rows_per_page') || 20);
        this.sortColumn = 'date';
        this.selectedMetrics = []; // No default selection
        // Keep metric selections separate per category/tab
        this.selectedMetricsByCategory = {
            products: [],
            campaigns: [],
            'search-terms': []
        };
        // Date order for table headers (asc/desc)
        this.dateOrder = 'desc';
        this.sortDirection = 'desc';
        this.currentMonth = undefined;
        this.currentYear = undefined;
        this.debounceTimer = null;
        this.isLoadingData = false;
        this.hasManualDateSelection = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeDatePicker();
        this.initializePeriodDropdown();
        this.setupMobileMenu();
        // Ensure correct metric visibility per category
        this.updateMetricOptionsVisibility();

        // Inject date order toggle in table controls (left to pagination)
        try {
            const controls = document.querySelector('.table-controls');
            if (controls && !document.getElementById('dateOrderToggle')) {
                const btn = document.createElement('button');
                btn.id = 'dateOrderToggle';
                btn.className = 'action-btn';
                btn.title = 'Toggle date order (ascending/descending)';
                btn.innerHTML = '<span class="material-icons">swap_vert</span><span>Dates: New → Old</span>';
                btn.style.marginRight = 'auto'; // push to left
                btn.addEventListener('click', () => {
                    this.dateOrder = this.dateOrder === 'desc' ? 'asc' : 'desc';
                    const label = this.dateOrder === 'desc' ? 'Dates: New → Old' : 'Dates: Old → New';
                    btn.innerHTML = '<span class="material-icons">swap_vert</span><span>' + label + '</span>';
                    this.renderTable();
                });
                // place before results count
                controls.insertBefore(btn, controls.firstChild);
            }
        } catch (_) {}
        
        // Ensure DOM is fully ready before loading data and setting up dropdowns
        setTimeout(() => {
            // Set initial campaign filter visibility
            const campaignFilterContainer = document.getElementById('campaignFilterContainer');
            if (campaignFilterContainer) {
                if (this.currentCategory === 'search-terms') {
                    campaignFilterContainer.style.display = 'flex';
                } else {
                    campaignFilterContainer.style.display = 'none';
                }
            }
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

        // Name filter functionality (multi-select)
        // Name filter functionality (multi-select)
        this.setupNameFilter();
        
        // Campaign filter functionality (multi-select) - only for search-terms tab
        this.setupCampaignFilter();

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => {
            this.previousPage();
        });
        document.getElementById('nextPage').addEventListener('click', () => {
            this.nextPage();
        });
        // Rows-per-page selector
        const pageSizeSelect = document.getElementById('trendPageSizeSelect');
        if (pageSizeSelect) {
            const allowed = [10, 30, 50, 100, 200, 500];
            if (pageSizeSelect.options.length !== allowed.length) {
                pageSizeSelect.innerHTML = allowed.map(v => `<option value="${v}">${v}</option>`).join('');
            }
            if (!allowed.includes(this.itemsPerPage)) {
                this.itemsPerPage = 20;
            }
            pageSizeSelect.value = String(this.itemsPerPage);
            pageSizeSelect.addEventListener('change', (e) => {
                const val = Number(e.target.value);
                if (!Number.isFinite(val)) return;
                this.itemsPerPage = val;
                localStorage.setItem('trend_rows_per_page', String(val));
                this.currentPage = 1;
                this.renderTable();
                this.updatePaginationSummary();
            });
        }

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
                    
                    // Add close button functionality
                    const closeBtn = document.createElement('button');
                    closeBtn.innerHTML = '✕';
                    closeBtn.style.cssText = `
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        width: 40px;
                        height: 40px;
                        background: rgba(0, 0, 0, 0.7);
                        color: white;
                        border: none;
                        border-radius: 50%;
                        font-size: 18px;
                        font-weight: bold;
                        cursor: pointer;
                        z-index: 10000;
                        transition: background-color 0.2s ease;
                    `;
                    closeBtn.addEventListener('click', () => {
                        this.exitFullscreen();
                    });
                    closeBtn.addEventListener('mouseenter', () => {
                        closeBtn.style.background = 'rgba(0, 0, 0, 0.9)';
                    });
                    closeBtn.addEventListener('mouseleave', () => {
                        closeBtn.style.background = 'rgba(0, 0, 0, 0.7)';
                    });
                    chartSection.appendChild(closeBtn);
                    
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
                    if (this.trendChart) { 
                        setTimeout(() => {
                            this.trendChart.resize();
                            // Ensure chart maintains proper aspect ratio in fullscreen
                            this.trendChart.options.maintainAspectRatio = false;
                            // Add padding to ensure axes are visible
                            this.trendChart.options.layout = {
                                padding: {
                                    top: 20,
                                    right: 20,
                                    bottom: 40,
                                    left: 40
                                }
                            };
                            this.trendChart.update();
                        }, 100); 
                    }
                } catch (_) {}
            });
        }

        // Exit fullscreen handler
        document.addEventListener('fullscreenchange', () => {
            const chartContainer = document.querySelector('.charts-section .chart-container');
            if (!document.fullscreenElement && chartContainer) {
                this.exitFullscreen();
            }
        });

        // Handle close button click (mobile fullscreen)
        document.addEventListener('click', (e) => {
            // Only handle clicks on the close button or outside chart area
            if (e.target.matches('.chart-fullscreen-active::before') || 
                (e.target.parentElement && e.target.parentElement.classList.contains('chart-fullscreen-active'))) {
                const chartContainer = document.querySelector('.charts-section .chart-container');
                if (chartContainer && chartContainer.classList.contains('chart-fullscreen-active')) {
                    // Exit fullscreen
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    }
                }
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

        // Reuse stored/query range if available; otherwise default to last 30 days
        const queryRange = this.getDateRangeFromQuery();
        const storedRange = this.loadGlobalDateRangeFromStorage();
        if (queryRange) {
            this.currentDateRange = queryRange;
            this.hasManualDateSelection = true;
            this.persistGlobalDateRange();
        } else if (storedRange && storedRange.manualSelection) {
            this.currentDateRange = storedRange;
            this.hasManualDateSelection = true;
        } else {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            this.currentDateRange = { start: startDate, end: endDate };
            this.hasManualDateSelection = false;
        }
        this.updateDateDisplay();
        this.updateNavLinksWithDateRange();
        this.syncUrlDateParams();

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
        this.hasManualDateSelection = true;
        this.persistGlobalDateRange();
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
            this.hasManualDateSelection = true;
            this.persistGlobalDateRange();
            
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
        // Preserve which category we are leaving so we can save its selections
        const previousCategory = this.currentCategory;
        // Now switch the current category
        this.currentCategory = category;
        
        // Update active tab
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // Reset pagination and filters when switching categories
        this.currentPage = 1;
        this.selectedName = '';
        
        // Save current selections before switching
        if (this.selectedNames && this.selectedNames.size > 0 && previousCategory) {
            this.selectedNamesByCategory[previousCategory] = new Set(this.selectedNames);
        }
        
        // Save campaign selections before switching (for search-terms)
        if (this.selectedCampaigns && this.selectedCampaigns.size > 0 && previousCategory) {
            this.selectedCampaignsByCategory[previousCategory] = new Set(this.selectedCampaigns);
        }
        
        // Load selections for the new category
        this.selectedNames = new Set(this.selectedNamesByCategory[category] || []);
        this.selectedCampaigns = new Set(this.selectedCampaignsByCategory[category] || []);
        
        // Show/hide campaign filter based on category
        const campaignFilterContainer = document.getElementById('campaignFilterContainer');
        if (campaignFilterContainer) {
            if (category === 'search-terms') {
                campaignFilterContainer.style.display = 'flex';
            } else {
                campaignFilterContainer.style.display = 'none';
            }
        }
        
        const nameInputEl = document.getElementById('nameFilterInput');
        if (nameInputEl) nameInputEl.value = '';
        
        const campaignInputEl = document.getElementById('campaignFilterInput');
        if (campaignInputEl) campaignInputEl.value = '';
        
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
            if (category === 'search-terms') {
                this.updateCampaignFilter();
            }
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
            if (this.currentCategory === 'search-terms') {
                this.updateCampaignFilter();
            }
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
            
            // Debug: Log the data fetching parameters
            console.log('🔍 Fetching trend data with params:', {
                category: this.currentCategory,
                timePeriod: this.currentTimePeriod,
                dateRange: this.currentDateRange,
                selectedNames: this.selectedNames ? Array.from(this.selectedNames) : null
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

            // If accessing through ngrok, use the ngrok URL for backend
            let apiBase = '';
            if (location.hostname.includes('ngrok-free.app') || location.hostname.includes('ngrok.io')) {
                apiBase = `${location.protocol}//${location.hostname}`;
            } else if (location.port === '5000' || (location.hostname === 'localhost' && location.port === '')) {
                apiBase = '';
            } else {
                apiBase = window.location.origin.includes('localhost') ? 'http://localhost:5000' : '';
            }
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
                        // For products, totalSales is the same as sales (no organic sales data)
                        const totalSales = sales;
                        const tcos = totalSales > 0 ? (spend / totalSales) * 100 : 0;
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
                        // Always recalculate ACOS from actual spend and sales values
                        const acos = sales > 0 ? (spend / sales) * 100 : 0;
                        
                        // Debug: Log individual row ACOS calculation
                        if (spend > 0 && sales > 0) {
                            console.log(`🔍 Individual Row ACOS Debug - ${r.name}:`, {
                                spend: spend,
                                sales: sales,
                                calculatedAcos: acos,
                                formula: `(${spend} / ${sales}) * 100`,
                                date: r.date
                            });
                        }
                        // For campaigns and search-terms, don't show TCOS in individual rows
                        const tcos = 0;
                        const roas = spend > 0 ? sales / spend : 0;
                        return {
                        date: r.date,
                        category: result.category,
                        name: r.name,
                        displayName: r.name,
                            campaignName: r.campaign_name || r.campaignName || '',
                            spend,
                            sales,
                            clicks,
                            cpc,
                            roas,
                            ctr: Number(r.ctr || 0),
                            acos,
                            tcos,
                        sessions: Number(r.sessions || 0),
                        totalSales: Number(r.totalSales || 0),
                        pageviews: Number(r.page_views || r.pageviews || 0),
                        conversionRate: Number(r.conversionRate || 0)
                        };
                    });

                    // Enrich with business totals by date for Total Sales and Sessions
                    try {
                        const bdParams = new URLSearchParams();
                        if (this.currentDateRange.start && this.currentDateRange.end) {
                            bdParams.append('start', this.formatLocalDate(this.currentDateRange.start));
                            bdParams.append('end', this.formatLocalDate(this.currentDateRange.end));
                        }
                        const bdRes = await fetch(`${apiBase}/api/business-data?${bdParams.toString()}`);
                        if (bdRes.ok) {
                            const bdJson = await bdRes.json();
                            const byDate = {};
                            (bdJson.data || []).forEach(row => {
                                const key = this.normalizeDateKey(row.date);
                                if (!byDate[key]) byDate[key] = { totalSales: 0, sessions: 0 };
                                byDate[key].totalSales += Number(row.ordered_product_sales || 0);
                                byDate[key].sessions += Number(row.sessions || 0);
                            });
                            normalized = normalized.map(r => {
                                const key = this.normalizeDateKey(r.date);
                                const add = byDate[key] || { totalSales: 0, sessions: r.sessions || 0 };
                                const totalSales = add.totalSales;
                                // IMPORTANT: For search-terms, do NOT assign business sessions to
                                // every individual row, otherwise later aggregations will multiply
                                // the value by the number of terms. Keep sessions on individuals 0,
                                // and inject a single DAILY TOTAL row carrying per-day sessions.
                                const sessions = (result.category === 'search-terms') ? (r.sessions || 0) : (add.sessions || r.sessions);
                                // For search-terms, don't show TCOS in individual rows
                                const tcos = 0;
                                return { ...r, totalSales, sessions, tcos };
                            });
                        }
                    } catch (_) { /* silent */ }

                    // For search-terms, additionally enrich with pageviews when available
                    if (result.category === 'search-terms') {
                        try {
                            const bdParams = new URLSearchParams();
                            if (this.currentDateRange.start && this.currentDateRange.end) {
                                bdParams.append('start', this.formatLocalDate(this.currentDateRange.start));
                                bdParams.append('end', this.formatLocalDate(this.currentDateRange.end));
                            }
                            const bdRes = await fetch(`${apiBase}/api/business-data?${bdParams.toString()}`);
                            if (bdRes.ok) {
                                const bdJson = await bdRes.json();
                                const byDate = {};
                                (bdJson.data || []).forEach(row => {
                                    const key = this.normalizeDateKey(row.date);
                                    if (!byDate[key]) byDate[key] = { sessions: 0, pageviews: 0 };
                                    byDate[key].sessions += Number(row.sessions || 0);
                                    byDate[key].pageviews += Number(row.page_views || 0);
                                });
                                const additions = Object.entries(byDate).map(([key, totals]) => ({
                                    date: key,
                                    category: 'search-terms',
                                    name: '📊 DAILY TOTAL',
                                    displayName: '📊 DAILY TOTAL',
                                    spend: 0,
                                    sales: 0,
                                    clicks: 0,
                                    cpc: 0,
                                    roas: 0,
                                    ctr: 0,
                                    acos: 0,
                                    tcos: 0,
                                    sessions: totals.sessions,
                                    pageviews: totals.pageviews,
                                    conversionRate: 0
                                }));
                                if (additions.length > 0) {
                                    normalized = normalized.concat(additions);
                                }
                            }
                        } catch (_) { /* silent */ }
                    }
                }
                this.currentData = normalized;
                this.filteredData = [...normalized];
                
                // Debug: Log data after processing
                console.log(`🔍 Data Processing Debug - ${result.category}:`, {
                    originalData: result.data.length,
                    processedData: normalized.length,
                    sampleProcessed: normalized.slice(0, 3).map(item => ({ 
                        name: item.name, 
                        category: item.category, 
                        spend: item.spend, 
                        sales: item.sales 
                    }))
                });
                
                return; // Success
            } else {
                console.log(`🔍 No Data Debug - ${result.category}:`, {
                    hasData: !!result.data,
                    dataLength: result.data ? result.data.length : 0,
                    result: result
                });
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
        
        // Debug: Log date filtering
        console.log(`🔍 Date Filter Debug:`, {
            startKey: startKey,
            endKey: endKey,
            todayKey: todayKey,
            dataLength: data.length,
            sampleDates: data.slice(0, 3).map(item => ({ 
                name: item.name, 
                date: item.date, 
                formattedDate: this.formatLocalDate(new Date(item.date))
            }))
        });
        
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
                manualSelection: !!parsed.manualSelection
            };
        } catch (err) {
            console.warn('Global date range load failed (trend reports):', err);
            return null;
        }
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
            console.warn('Global date range localStorage save failed (trend reports):', err);
        }
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                sessionStorage.setItem(GLOBAL_DATE_RANGE_STORAGE_KEY, json);
            }
        } catch (err) {
            console.warn('Global date range sessionStorage save failed (trend reports):', err);
        }
        try {
            if (typeof window !== 'undefined') {
                window.name = `${GLOBAL_DATE_RANGE_WINDOW_PREFIX}${json}`;
            }
        } catch (err) {
            console.warn('Global date range window.name save failed (trend reports):', err);
        }
    }

    persistGlobalDateRange() {
        if (!this.hasManualDateSelection) return;
        if (!this.currentDateRange?.start || !this.currentDateRange?.end) return;
        const payload = {
            startMs: this.currentDateRange.start.getTime(),
            endMs: this.currentDateRange.end.getTime(),
            startStr: this.formatLocalDate(this.currentDateRange.start),
            endStr: this.formatLocalDate(this.currentDateRange.end),
            savedAt: Date.now(),
            manualSelection: true
        };
        this.persistGlobalDateRangeRaw(payload);
        this.updateNavLinksWithDateRange();
        this.syncUrlDateParams();
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
                end: endDate
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
            // ignore
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

    syncUrlDateParams() {
        if (!this.hasManualDateSelection) return;
        try {
            if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;
            if (!this.currentDateRange?.start || !this.currentDateRange?.end) return;
            const start = this.formatLocalDate(this.currentDateRange.start);
            const end = this.formatLocalDate(this.currentDateRange.end);
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
        if (!this.currentDateRange?.start || !this.currentDateRange?.end) return;
        const start = this.formatLocalDate(this.currentDateRange.start);
        const end = this.formatLocalDate(this.currentDateRange.end);
        const links = typeof document !== 'undefined' ? document.querySelectorAll('.nav-item[href]') : [];
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || link.hasAttribute('data-section')) return;
            try {
                // Use current page URL as base so relative links keep the /pages/ prefix when present
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
                // ignore
            }
        });
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
        
        // Apply name filter to chart data (same as table) - FILTER HAS PRIORITY
        let data = this.currentData.filter(item => item.category === this.currentCategory);
        
        // Apply name filter if multi-select has items; keep DAILY TOTAL rows
        if (this.selectedNames && this.selectedNames.size > 0) {
            console.log('🔍 Chart: Applying name filter for campaigns:', {
                selectedNames: Array.from(this.selectedNames),
                dataBeforeFilter: data.length,
                sampleData: data.slice(0, 3).map(item => ({ name: item.name, spend: item.spend, sales: item.sales }))
            });
            
            data = data.filter(item => {
                const nm = (item.displayName || item.name) || '';
                const isTotal = nm.includes('📊') || nm.toLowerCase().includes('daily total') || nm.toLowerCase().includes('total');
                return isTotal || this.selectedNames.has(nm);
            });
            
            console.log('🔍 Chart: After name filter:', {
                dataAfterFilter: data.length,
                sampleData: data.slice(0, 3).map(item => ({ name: item.name, spend: item.spend, sales: item.sales }))
            });
        } else if (this.selectedName) {
            data = data.filter(item => (item.displayName || item.name) === this.selectedName);
        }
        
        // Apply campaign filter for search-terms tab
        if (this.currentCategory === 'search-terms' && this.selectedCampaigns && this.selectedCampaigns.size > 0) {
            data = data.filter(item => {
                const nm = (item.displayName || item.name) || '';
                const isTotal = nm.includes('📊') || nm.toLowerCase().includes('daily total') || nm.toLowerCase().includes('total');
                if (isTotal) return true; // Keep DAILY TOTAL rows
                const campaignName = item.campaignName || item.campaign_name || '';
                return campaignName && this.selectedCampaigns.has(campaignName);
            });
        }
        
        // If filter is applied, use ALL data for that filter (ignore date range)
        // Only apply date range if NO filter is selected
        const hasFilterApplied = (this.selectedNames && this.selectedNames.size > 0) || this.selectedName || (this.currentCategory === 'search-terms' && this.selectedCampaigns && this.selectedCampaigns.size > 0);
        
        // Debug: Log filter status for chart
        console.log('🔍 Chart Filter Priority Debug:', {
            selectedNames: this.selectedNames ? Array.from(this.selectedNames) : null,
            selectedName: this.selectedName,
            hasFilterApplied: hasFilterApplied,
            dateRange: this.currentDateRange,
            dataLengthBefore: data.length
        });
        
        if (!hasFilterApplied) {
            // Apply date range filter only when no filter is applied
            data = this.filterDataByDateRange(data);
            console.log('📅 Chart: Date range applied, data length after:', data.length);
        } else {
            console.log('🎯 Chart: Filter applied, ignoring date range, data length:', data.length);
        }

        // Campaigns: avoid double-counting in the chart when DAILY TOTAL rows
        // are present (backend provides both individuals and totals). If totals
        // exist, drive the chart using ONLY the DAILY TOTAL rows so it matches
        // the table's totals; otherwise, sum individuals as usual.
        // BUT: If specific campaigns are selected, use individual campaign data instead of totals
        if (this.currentCategory === 'campaigns') {
            const hasDailyTotal = data.some(r => String(r.name || '').includes('📊'));
            const hasSelectedCampaigns = this.selectedNames && this.selectedNames.size > 0;
            
            console.log('🔍 Campaigns Chart Logic:', {
                hasDailyTotal,
                hasSelectedCampaigns,
                selectedNames: this.selectedNames ? Array.from(this.selectedNames) : null,
                dataLength: data.length
            });
            
            // Only use DAILY TOTAL rows if no specific campaigns are selected
            if (hasDailyTotal && !hasSelectedCampaigns) {
                data = data.filter(r => String(r.name || '').includes('📊'));
                console.log('📊 Using DAILY TOTAL rows for chart');
            } else if (hasSelectedCampaigns) {
                // Remove DAILY TOTAL rows when specific campaigns are selected
                data = data.filter(r => !String(r.name || '').includes('📊'));
                console.log('🎯 Using individual campaign data for selected campaigns');
            }
        }
        
        // If we're on campaigns and user selected specific names,
        // recompute DAILY TOTAL for the filtered subset so chart reflects selection.
        if (this.currentCategory === 'campaigns' && this.selectedNames && this.selectedNames.size > 0) {
            const totalsByDate = {};
            // Build totals from only non-total rows (selected names already applied above)
            data.forEach(item => {
                const nm = String(item.name || '');
                if (nm.includes('📊')) return; // skip existing totals to avoid double-counting
                const key = this.normalizeDateKey(item.date);
                if (!totalsByDate[key]) {
                    totalsByDate[key] = { spend: 0, sales: 0, clicks: 0, sessions: 0, pageviews: 0, orders: 0, totalSales: 0 };
                }
                totalsByDate[key].spend += Number(item.spend || 0);
                totalsByDate[key].sales += Number(item.sales || 0);
                totalsByDate[key].clicks += Number(item.clicks || 0);
                totalsByDate[key].sessions += Number(item.sessions || 0);
                totalsByDate[key].pageviews += Number(item.pageviews || 0);
                totalsByDate[key].orders += Number(item.orders || 0);
                totalsByDate[key].totalSales += Number(item.totalSales || 0);
            });
            
            // Replace data with recomputed totals
            data = [];
            Object.entries(totalsByDate).forEach(([key, t]) => {
                const cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
                const roas = t.spend > 0 ? t.sales / t.spend : 0;
                const acos = t.sales > 0 ? (t.spend / t.sales) * 100 : 0;
                const tcos = t.totalSales > 0 ? (t.spend / t.totalSales) * 100 : 0;
                const ctr = t.clicks > 0 && t.sessions > 0 ? (t.clicks / t.sessions) * 100 : 0;
                data.push({
                    date: key,
                    category: this.currentCategory,
                    name: '📊 DAILY TOTAL',
                    displayName: '📊 DAILY TOTAL',
                    spend: t.spend,
                    sales: t.sales,
                    clicks: t.clicks,
                    sessions: t.sessions,
                    pageviews: t.pageviews,
                    orders: t.orders,
                    totalSales: t.totalSales,
                    cpc, roas, acos, tcos, ctr
                });
            });
            
            console.log('🎯 Campaigns Chart: Recomputed totals for selected campaigns:', {
                selectedNames: Array.from(this.selectedNames),
                totalDates: Object.keys(totalsByDate).length,
                sampleData: data.slice(0, 3)
            });
        }
        
        // Search-terms: handle DAILY TOTAL vs individual data logic (same as campaigns)
        if (this.currentCategory === 'search-terms') {
            const hasDailyTotal = data.some(r => String(r.name || '').includes('📊'));
            const hasSelectedSearchTerms = this.selectedNames && this.selectedNames.size > 0;
            
            console.log('🔍 Search-terms Chart Logic:', {
                hasDailyTotal,
                hasSelectedSearchTerms,
                selectedNames: this.selectedNames ? Array.from(this.selectedNames) : null,
                dataLength: data.length
            });
            
            // Only use DAILY TOTAL rows if no specific search terms are selected
            if (hasDailyTotal && !hasSelectedSearchTerms) {
                data = data.filter(r => String(r.name || '').includes('📊'));
                console.log('📊 Using DAILY TOTAL rows for search-terms chart');
            } else if (hasSelectedSearchTerms) {
                // Remove DAILY TOTAL rows when specific search terms are selected
                data = data.filter(r => !String(r.name || '').includes('📊'));
                console.log('🎯 Using individual search term data for selected terms');
            }
        }
        
        // If we're on search-terms and user selected specific names,
        // recompute DAILY TOTAL for the filtered subset so chart reflects selection.
        if (this.currentCategory === 'search-terms' && this.selectedNames && this.selectedNames.size > 0) {
            const totalsByDate = {};
            // Build totals from only non-total rows (selected names already applied above)
            data.forEach(item => {
                const nm = String(item.name || '');
                if (nm.includes('📊')) return; // skip existing totals to avoid double-counting
                const key = this.normalizeDateKey(item.date);
                if (!totalsByDate[key]) {
                    totalsByDate[key] = { spend: 0, sales: 0, clicks: 0, sessions: 0, pageviews: 0, orders: 0, totalSales: 0 };
                }
                totalsByDate[key].spend += Number(item.spend || 0);
                totalsByDate[key].sales += Number(item.sales || 0);
                totalsByDate[key].clicks += Number(item.clicks || 0);
                totalsByDate[key].sessions += Number(item.sessions || 0);
                totalsByDate[key].pageviews += Number(item.pageviews || 0);
                totalsByDate[key].orders += Number(item.orders || 0);
                totalsByDate[key].totalSales += Number(item.totalSales || 0);
            });
            
            // Replace data with recomputed totals
            data = [];
            Object.entries(totalsByDate).forEach(([key, t]) => {
                const cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
                const roas = t.spend > 0 ? t.sales / t.spend : 0;
                const acos = t.sales > 0 ? (t.spend / t.sales) * 100 : 0;
                const tcos = t.totalSales > 0 ? (t.spend / t.totalSales) * 100 : 0;
                const ctr = t.clicks > 0 && t.sessions > 0 ? (t.clicks / t.sessions) * 100 : 0;
                data.push({
                    date: key,
                    category: this.currentCategory,
                    name: '📊 DAILY TOTAL',
                    displayName: '📊 DAILY TOTAL',
                    spend: t.spend,
                    sales: t.sales,
                    clicks: t.clicks,
                    sessions: t.sessions,
                    pageviews: t.pageviews,
                    orders: t.orders,
                    totalSales: t.totalSales,
                    cpc, roas, acos, tcos, ctr
                });
            });
            
            console.log('🎯 Search-terms Chart: Recomputed totals for selected search terms:', {
                selectedNames: Array.from(this.selectedNames),
                totalDates: Object.keys(totalsByDate).length,
                sampleData: data.slice(0, 3)
            });
        }
        
        // Always try to show chart - let Chart.js handle empty data
        
        // Group data by time period for each selected metric
        // Constrain allowed metrics per category
        const allowedCampaignMetrics = ['spend','cpc','clicks','sales','sessions','totalSales','roas','acos','tcos'];
        const allowedSearchMetrics = ['spend','cpc','clicks','sales','sessions','totalSales','roas','acos','tcos'];
        if (this.currentCategory === 'campaigns') {
            this.selectedMetrics = this.selectedMetrics.filter(m => allowedCampaignMetrics.includes(m));
        } else if (this.currentCategory === 'search-terms') {
            this.selectedMetrics = this.selectedMetrics.filter(m => allowedSearchMetrics.includes(m));
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
            // Sum standard additive metrics
            if (['spend','sales','clicks','orders','pageviews'].includes(metric)) {
                return group.values.reduce((sum, val) => sum + (Number(val)||0), 0);
            }
            // For account-level daily totals injected per row (totalSales, sessions in campaigns/search-terms),
            // multiple rows share the same value. Use the maximum to avoid multiplying by number of rows.
            if (metric === 'totalSales' || (metric === 'sessions' && this.currentCategory !== 'products')) {
                return group.values.length ? Math.max(...group.values.map(v => Number(v)||0)) : 0;
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
            'sales': (this.currentCategory === 'campaigns' || this.currentCategory === 'search-terms' ? 'Ad Sales' : 'Sales'),
            'orders': 'No of Orders',
            'sessions': 'Sessions',
            'totalSales': 'Total Sales',
            'pageviews': 'Page Views',
            'conversionRate': 'Conversion Rate'
        };
        return labels[metric] || metric;
    }

    updateMetricOptionsVisibility() {
        const ids = [
            'metric-sales','metric-totalSales','metric-spend','metric-orders','metric-sessions','metric-pageviews',
            'metric-cpc','metric-clicks','metric-roas','metric-acos','metric-tcos',
            'metric-searchVolume','metric-searchClicks','metric-conversionRate'
        ];
        const refs = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
        const containers = Object.fromEntries(Object.entries(refs).map(([k, el]) => [k, el ? el.closest('.multi-select-option') : null]));
        const show = (id, visible) => { if (containers[id]) containers[id].style.display = visible ? 'flex' : 'none'; };
        if (this.currentCategory === 'campaigns') {
            // Show campaign-related metrics
            // Only these in dropdown (include ad sales, total sales, sessions)
            show('metric-sales', true);
            show('metric-totalSales', true);
            show('metric-spend', true);
            show('metric-cpc', true);
            show('metric-clicks', true);
            show('metric-roas', true);
            show('metric-acos', true);
            show('metric-tcos', true);
            show('metric-orders', false);
            show('metric-sessions', true);
            show('metric-pageviews', false);
            show('metric-searchVolume', false);
            show('metric-searchClicks', false);
            show('metric-conversionRate', false);

            // Update visible label texts to exact names for Campaigns
            const salesLbl = document.querySelector('label[for="metric-sales"]');
            if (salesLbl) salesLbl.textContent = 'Ad Sales';
            const clicksLbl = document.querySelector('label[for="metric-clicks"]');
            if (clicksLbl) clicksLbl.textContent = 'Ad Clicks';
            const totalSalesLbl = document.querySelector('label[for="metric-totalSales"]');
            if (totalSalesLbl) totalSalesLbl.textContent = 'Total Sales';
            const sessionsLbl = document.querySelector('label[for="metric-sessions"]');
            if (sessionsLbl) sessionsLbl.textContent = 'Sessions';

            // Ensure at least one metric is selected; default to Ad Spend
            const allowed = ['metric-spend','metric-cpc','metric-clicks','metric-sales','metric-sessions','metric-totalSales','metric-roas','metric-acos','metric-tcos'];
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
            // Search terms: show similar metrics as Campaigns (including spend)
            const salesLbl = document.querySelector('label[for="metric-sales"]');
            if (salesLbl) salesLbl.textContent = 'Ad Sales';
            const clicksLbl = document.querySelector('label[for="metric-clicks"]');
            if (clicksLbl) clicksLbl.textContent = 'Ad Clicks';
            const totalSalesLbl = document.querySelector('label[for="metric-totalSales"]');
            if (totalSalesLbl) totalSalesLbl.textContent = 'Total Sales';
            const sessionsLbl = document.querySelector('label[for="metric-sessions"]');
            if (sessionsLbl) sessionsLbl.textContent = 'Sessions';
            show('metric-sales', true);
            show('metric-totalSales', true);
            show('metric-spend', true);
            show('metric-cpc', true);
            show('metric-clicks', true);
            show('metric-roas', true);
            show('metric-acos', true);
            show('metric-tcos', true);
            show('metric-orders', false);
            show('metric-sessions', true);
            show('metric-pageviews', false);
            show('metric-searchVolume', false);
            show('metric-searchClicks', false);
            show('metric-conversionRate', false);
            // Ensure at least one metric is active (default to Ad Clicks)
            const allowed = ['metric-spend','metric-cpc','metric-clicks','metric-sales','metric-sessions','metric-totalSales','metric-roas','metric-acos','metric-tcos'];
            const checkedAllowed = allowed.filter(id => {
                const el = document.getElementById(id);
                return el && el.checked;
            });
            if (checkedAllowed.length === 0) {
                const clicksCb = document.getElementById('metric-clicks');
                if (clicksCb) clicksCb.checked = true;
                this.updateSelectedMetrics();
            }
        } else {
            // Products: limited standard metrics
            const salesLbl = document.querySelector('label[for="metric-sales"]');
            if (salesLbl) salesLbl.textContent = 'Sales';
            show('metric-sales', true);
            show('metric-totalSales', false);
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
            nameFilterInput.closest('.name-filter').classList.add('dropdown-open');
            
            // Hide pagination when dropdown opens
            const paginationControls = document.querySelector('.pagination-controls');
            if (paginationControls) {
                paginationControls.style.display = 'none';
            }
            
            // Preserve current search term when focusing
            const currentSearchTerm = nameFilterInput.value.trim();
            this.filterNameOptions(currentSearchTerm);
        });
        
        // Power-user: Enter or Escape clears only the search text (keeps selections)
        nameFilterInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                // Clear search text but keep selectedNames intact
                nameFilterInput.value = '';
                // Keep dropdown open and show all, with selected items pinned on top
                nameFilterDropdown.style.display = 'block';
                nameFilterInput.closest('.name-filter').classList.add('dropdown-open');
                this.filterNameOptions('');
            }
        });

        nameFilterInput.addEventListener('blur', (e) => {
            // Delay hiding to allow click on dropdown
            setTimeout(() => {
                if (!nameFilterDropdown.contains(document.activeElement) && 
                    !nameFilterDropdown.matches(':hover')) {
                    nameFilterDropdown.style.display = 'none';
                    nameFilterInput.closest('.name-filter').classList.remove('dropdown-open');
                    
                    // Show pagination when dropdown closes
                    const paginationControls = document.querySelector('.pagination-controls');
                    if (paginationControls) {
                        paginationControls.style.display = '';
                    }
                }
            }, 200);
        });
        
        // Input search
        nameFilterInput.addEventListener('input', (e) => {
            nameFilterDropdown.style.display = 'block';
            this.filterNameOptions(e.target.value);
            nameFilterInput.closest('.name-filter').classList.add('dropdown-open');
        });
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!nameFilterInput.contains(e.target) && !nameFilterDropdown.contains(e.target)) {
                nameFilterDropdown.style.display = 'none';
                nameFilterInput.closest('.name-filter').classList.remove('dropdown-open');
                
                // Show pagination when dropdown closes
                const paginationControls = document.querySelector('.pagination-controls');
                if (paginationControls) {
                    paginationControls.style.display = '';
                }
            }
        });
        
    }

    updateNameFilter() {
        const categoryData = this.currentData.filter(item => item.category === this.currentCategory);
        
        // Get unique names with their available dates
        const nameMap = {};
        categoryData.forEach(item => {
            const name = item.displayName || item.name;
            // Do not include total helper rows in selectable names
            if ((name || '').includes('📊') || (name || '').toLowerCase().includes('daily total') || (name || '').toLowerCase().includes('total')) {
                return;
            }
            if (!nameMap[name]) {
                nameMap[name] = new Set();
            }
            nameMap[name].add(item.date);
        });
        
        // Store the name map for filtering
        this.nameMap = nameMap;
        
        // Update the dropdown with all names, preserving current search term
        const nameFilterInput = document.getElementById('nameFilterInput');
        const currentSearchTerm = nameFilterInput ? nameFilterInput.value.trim() : '';
        this.filterNameOptions(currentSearchTerm);
        
        // Update campaign filter if on search-terms tab
        if (this.currentCategory === 'search-terms') {
            this.updateCampaignFilter();
        }
    }

    filterNameOptions(searchTerm) {
        const nameFilterDropdown = document.getElementById('nameFilterDropdown');
        const nameFilterInput = document.getElementById('nameFilterInput');
        
        // Clear existing options and add "All Names" header with Clear button
        const headerDiv = document.createElement('div');
        headerDiv.className = 'filter-header'; // Add class so cleanup doesn't remove it
        headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-primary); background: var(--bg-secondary); font-weight: 600;';
        headerDiv.innerHTML = `
            <span>All Names</span>
            <button id="clearNameFilterBtn" style="background: var(--primary); color: white; border: none; padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 500;">Clear</button>
        `;
        nameFilterDropdown.innerHTML = '';
        nameFilterDropdown.appendChild(headerDiv);
        
        // Add click event for "All Names" - just show all options, don't clear
        headerDiv.querySelector('span').addEventListener('mousedown', (e) => {
            e.preventDefault();
            // Just reset search and show all options, don't clear selections
            nameFilterInput.value = '';
            nameFilterDropdown.style.display = 'block';
            this.filterNameOptions('');
        });
        
        // Add click event for Clear button - actually clear selections
        const clearNameBtn = document.getElementById('clearNameFilterBtn');
        clearNameBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Clear selections for current category only
            this.selectedName = '';
            this.selectedNames.clear();
            this.selectedNamesByCategory[this.currentCategory].clear();
            nameFilterInput.value = '';
            nameFilterDropdown.style.display = 'block';
            this.filterNameOptions('');
            this.currentPage = 1;
            this.updateChart();
            this.renderTable();
        });
        
        // Filter names
        const allNames = Object.keys(this.nameMap || {})
            .filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()));
        
        // Sort: selected names first (keep alphabetical inside groups)
        const selectedFirst = [];
        const unselected = [];
        allNames.forEach(n => {
            if (this.selectedNames && this.selectedNames.has(n)) selectedFirst.push(n); else unselected.push(n);
        });
        selectedFirst.sort();
        unselected.sort();
        const filteredNames = [...selectedFirst, ...unselected];
        
        // Update input placeholder to show selected count
        const selectedCount = this.selectedNames ? this.selectedNames.size : 0;
        if (selectedCount > 0) {
            nameFilterInput.placeholder = `${selectedCount} selected`;
        } else {
            nameFilterInput.placeholder = 'Search names...';
        }
        
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
            
            // Render with a checkbox for multi-select
            const id = `name-opt-${Math.random().toString(36).slice(2)}`;
            option.innerHTML = `
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                    <input type="checkbox" id="${id}">
                    <span>${name} (${dateCount} dates: ${dateText})</span>
                </label>
            `;
            const cb = option.querySelector('input');
            cb.checked = this.selectedNames.has(name);
            option.addEventListener('mousedown', (e) => {
                e.preventDefault(); // keep dropdown
                cb.checked = !cb.checked;
                if (cb.checked) {
                    this.selectedNames.add(name);
                    this.selectedNamesByCategory[this.currentCategory].add(name);
                } else {
                    this.selectedNames.delete(name);
                    this.selectedNamesByCategory[this.currentCategory].delete(name);
                }
                // Preserve current search term in the input (do not clear value)
                const currentSearchTerm = nameFilterInput.value.trim();
                // Only update placeholder count; keep user's typed text intact
                const count = this.selectedNames.size;
                if (count > 0) {
                    nameFilterInput.placeholder = `${count} selected`;
                } else {
                    nameFilterInput.placeholder = 'Search names...';
                }
                this.currentPage = 1;
                this.updateChart();
                this.renderTable();
                // Re-render dropdown so selected items jump to top without reopening
                const previousScroll = nameFilterDropdown.scrollTop;
                this.filterNameOptions(currentSearchTerm);
                nameFilterDropdown.style.display = 'block';
                nameFilterDropdown.scrollTop = previousScroll;
            });

            // Also support direct checkbox click without closing
            cb.addEventListener('click', (e) => {
                e.stopPropagation();
                if (cb.checked) {
                    this.selectedNames.add(name);
                    this.selectedNamesByCategory[this.currentCategory].add(name);
                } else {
                    this.selectedNames.delete(name);
                    this.selectedNamesByCategory[this.currentCategory].delete(name);
                }
                // Preserve current search term in the input (do not clear value)
                const currentSearchTerm = nameFilterInput.value.trim();
                // Only update placeholder count; keep user's typed text intact
                const count = this.selectedNames.size;
                if (count > 0) {
                    nameFilterInput.placeholder = `${count} selected`;
                } else {
                    nameFilterInput.placeholder = 'Search names...';
                }
                this.currentPage = 1;
                this.updateChart();
                this.renderTable();
                const previousScroll = nameFilterDropdown.scrollTop;
                this.filterNameOptions(currentSearchTerm);
                nameFilterDropdown.style.display = 'block';
                nameFilterDropdown.scrollTop = previousScroll;
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
        
        // Final cleanup: remove any non-filter elements that might have been added
        setTimeout(() => {
            const allElements = nameFilterDropdown.querySelectorAll('*');
            allElements.forEach(el => {
                // Preserve filter-header and filter-option elements
                if (!el.classList.contains('filter-option') && !el.classList.contains('filter-header') && !el.closest('.filter-option') && !el.closest('.filter-header')) {
                    el.remove();
                }
            });
            
            // Specifically remove any pagination-related elements
            const paginationElements = nameFilterDropdown.querySelectorAll(
                '.pagination-controls, .page-info, .pagination-btn, .results-count, [class*="pagination"], [class*="page"]'
            );
            paginationElements.forEach(el => el.remove());
            
            // Remove any elements containing pagination text
            const allTextElements = nameFilterDropdown.querySelectorAll('*');
            allTextElements.forEach(el => {
                if (el.textContent && (
                    el.textContent.includes('Page') || 
                    el.textContent.includes('of') || 
                    el.textContent.includes('results') ||
                    el.textContent.includes('Showing')
                )) {
                    if (!el.classList.contains('filter-option')) {
                        el.remove();
                    }
                }
            });
        }, 0);
        
        // Continuous cleanup to prevent pagination from appearing
        const cleanupInterval = setInterval(() => {
            if (nameFilterDropdown.style.display === 'none') {
                clearInterval(cleanupInterval);
                return;
            }
            
            const paginationElements = nameFilterDropdown.querySelectorAll(
                '.pagination-controls, .page-info, .pagination-btn, .results-count, [class*="pagination"], [class*="page"]'
            );
            paginationElements.forEach(el => el.remove());
            
            // Remove any elements containing pagination text
            const allElements = nameFilterDropdown.querySelectorAll('*');
            allElements.forEach(el => {
                if (el.textContent && (
                    el.textContent.includes('Page') || 
                    el.textContent.includes('of') || 
                    el.textContent.includes('results') ||
                    el.textContent.includes('Showing')
                )) {
                    // Preserve filter-header and filter-option elements
                    if (!el.classList.contains('filter-option') && !el.classList.contains('filter-header')) {
                        el.remove();
                    }
                }
            });
        }, 100); // Check every 100ms
    }

    // filterData method removed - using name filter only

    setupCampaignFilter() {
        const campaignFilterInput = document.getElementById('campaignFilterInput');
        const campaignFilterDropdown = document.getElementById('campaignFilterDropdown');
        
        if (!campaignFilterInput || !campaignFilterDropdown) return;
        
        // Input focus/blur events
        campaignFilterInput.addEventListener('focus', () => {
            campaignFilterDropdown.style.display = 'block';
            campaignFilterInput.closest('.name-filter').classList.add('dropdown-open');
            
            // Hide pagination when dropdown opens
            const paginationControls = document.querySelector('.pagination-controls');
            if (paginationControls) {
                paginationControls.style.display = 'none';
            }
            
            // Preserve current search term when focusing
            const currentSearchTerm = campaignFilterInput.value.trim();
            this.filterCampaignOptions(currentSearchTerm);
        });
        
        // Power-user: Enter or Escape clears only the search text (keeps selections)
        campaignFilterInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                // Clear search text but keep selectedCampaigns intact
                campaignFilterInput.value = '';
                // Keep dropdown open and show all, with selected items pinned on top
                campaignFilterDropdown.style.display = 'block';
                campaignFilterInput.closest('.name-filter').classList.add('dropdown-open');
                this.filterCampaignOptions('');
            }
        });

        campaignFilterInput.addEventListener('blur', (e) => {
            // Delay hiding to allow click on dropdown
            setTimeout(() => {
                if (!campaignFilterDropdown.contains(document.activeElement) && 
                    !campaignFilterDropdown.matches(':hover')) {
                    campaignFilterDropdown.style.display = 'none';
                    campaignFilterInput.closest('.name-filter').classList.remove('dropdown-open');
                    
                    // Show pagination when dropdown closes
                    const paginationControls = document.querySelector('.pagination-controls');
                    if (paginationControls) {
                        paginationControls.style.display = '';
                    }
                }
            }, 200);
        });
        
        // Input search
        campaignFilterInput.addEventListener('input', (e) => {
            campaignFilterDropdown.style.display = 'block';
            this.filterCampaignOptions(e.target.value);
            campaignFilterInput.closest('.name-filter').classList.add('dropdown-open');
        });
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!campaignFilterInput.contains(e.target) && !campaignFilterDropdown.contains(e.target)) {
                campaignFilterDropdown.style.display = 'none';
                campaignFilterInput.closest('.name-filter').classList.remove('dropdown-open');
                
                // Show pagination when dropdown closes
                const paginationControls = document.querySelector('.pagination-controls');
                if (paginationControls) {
                    paginationControls.style.display = '';
                }
            }
        });
    }

    updateCampaignFilter() {
        // Only update if we're on search-terms tab
        if (this.currentCategory !== 'search-terms') return;
        
        const categoryData = this.currentData.filter(item => item.category === this.currentCategory);
        
        // Get unique campaign names
        const campaignMap = {};
        categoryData.forEach(item => {
            const campaignName = item.campaignName || item.campaign_name || '';
            if (!campaignName) return;
            // Do not include total helper rows
            const name = item.displayName || item.name;
            if ((name || '').includes('📊') || (name || '').toLowerCase().includes('daily total') || (name || '').toLowerCase().includes('total')) {
                return;
            }
            if (!campaignMap[campaignName]) {
                campaignMap[campaignName] = new Set();
            }
            campaignMap[campaignName].add(item.date);
        });
        
        // Store the campaign map for filtering
        this.campaignMap = campaignMap;
        
        // Update the dropdown with all campaigns, preserving current search term
        const campaignFilterInput = document.getElementById('campaignFilterInput');
        const currentSearchTerm = campaignFilterInput ? campaignFilterInput.value.trim() : '';
        this.filterCampaignOptions(currentSearchTerm);
    }

    filterCampaignOptions(searchTerm) {
        // Only work on search-terms tab
        if (this.currentCategory !== 'search-terms') return;
        
        const campaignFilterDropdown = document.getElementById('campaignFilterDropdown');
        const campaignFilterInput = document.getElementById('campaignFilterInput');
        
        if (!campaignFilterDropdown || !campaignFilterInput) return;
        
        // Clear existing options and add "All Campaigns" header with Clear button
        const headerDiv = document.createElement('div');
        headerDiv.className = 'filter-header'; // Add class so cleanup doesn't remove it
        headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-primary); background: var(--bg-secondary); font-weight: 600;';
        headerDiv.innerHTML = `
            <span>All Campaigns</span>
            <button id="clearCampaignFilterBtn" style="background: var(--primary); color: white; border: none; padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 500;">Clear</button>
        `;
        campaignFilterDropdown.innerHTML = '';
        campaignFilterDropdown.appendChild(headerDiv);
        
        // Add click event for "All Campaigns" - just show all options, don't clear
        headerDiv.querySelector('span').addEventListener('mousedown', (e) => {
            e.preventDefault();
            // Just reset search and show all options, don't clear selections
            campaignFilterInput.value = '';
            campaignFilterDropdown.style.display = 'block';
            this.filterCampaignOptions('');
        });
        
        // Add click event for Clear button - actually clear selections
        const clearCampaignBtn = document.getElementById('clearCampaignFilterBtn');
        clearCampaignBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Clear selections for current category only
            this.selectedCampaigns.clear();
            this.selectedCampaignsByCategory[this.currentCategory].clear();
            campaignFilterInput.value = '';
            campaignFilterDropdown.style.display = 'block';
            this.filterCampaignOptions('');
            this.currentPage = 1;
            this.updateChart();
            this.renderTable();
        });
        
        // Filter campaigns
        const allCampaigns = Object.keys(this.campaignMap || {})
            .filter(campaign => campaign.toLowerCase().includes(searchTerm.toLowerCase()));
        
        // Sort: selected campaigns first (keep alphabetical inside groups)
        const selectedFirst = [];
        const unselected = [];
        allCampaigns.forEach(c => {
            if (this.selectedCampaigns && this.selectedCampaigns.has(c)) selectedFirst.push(c); else unselected.push(c);
        });
        selectedFirst.sort();
        unselected.sort();
        const filteredCampaigns = [...selectedFirst, ...unselected];
        
        // Update input placeholder to show selected count
        const selectedCount = this.selectedCampaigns ? this.selectedCampaigns.size : 0;
        if (selectedCount > 0) {
            campaignFilterInput.placeholder = `${selectedCount} selected`;
        } else {
            campaignFilterInput.placeholder = 'Filter campaigns...';
        }
        
        filteredCampaigns.forEach(campaign => {
            const dates = Array.from(this.campaignMap[campaign]).sort();
            const dateCount = dates.length;
            const option = document.createElement('div');
            option.className = 'filter-option';
            option.dataset.value = campaign;
            
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
            
            // Render with a checkbox for multi-select
            const id = `campaign-opt-${Math.random().toString(36).slice(2)}`;
            option.innerHTML = `
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                    <input type="checkbox" id="${id}">
                    <span>${campaign} (${dateCount} dates: ${dateText})</span>
                </label>
            `;
            const cb = option.querySelector('input');
            cb.checked = this.selectedCampaigns.has(campaign);
            option.addEventListener('mousedown', (e) => {
                e.preventDefault(); // keep dropdown
                cb.checked = !cb.checked;
                if (cb.checked) {
                    this.selectedCampaigns.add(campaign);
                    this.selectedCampaignsByCategory[this.currentCategory].add(campaign);
                } else {
                    this.selectedCampaigns.delete(campaign);
                    this.selectedCampaignsByCategory[this.currentCategory].delete(campaign);
                }
                // Preserve current search term in the input
                const currentSearchTerm = campaignFilterInput.value.trim();
                const count = this.selectedCampaigns.size;
                if (count > 0) {
                    campaignFilterInput.placeholder = `${count} selected`;
                } else {
                    campaignFilterInput.placeholder = 'Filter campaigns...';
                }
                this.currentPage = 1;
                this.updateChart();
                this.renderTable();
                // Re-render dropdown so selected items jump to top without reopening
                const previousScroll = campaignFilterDropdown.scrollTop;
                this.filterCampaignOptions(currentSearchTerm);
                campaignFilterDropdown.style.display = 'block';
                campaignFilterDropdown.scrollTop = previousScroll;
            });

            // Also support direct checkbox click without closing
            cb.addEventListener('click', (e) => {
                e.stopPropagation();
                if (cb.checked) {
                    this.selectedCampaigns.add(campaign);
                    this.selectedCampaignsByCategory[this.currentCategory].add(campaign);
                } else {
                    this.selectedCampaigns.delete(campaign);
                    this.selectedCampaignsByCategory[this.currentCategory].delete(campaign);
                }
                // Preserve current search term in the input
                const currentSearchTerm = campaignFilterInput.value.trim();
                const count = this.selectedCampaigns.size;
                if (count > 0) {
                    campaignFilterInput.placeholder = `${count} selected`;
                } else {
                    campaignFilterInput.placeholder = 'Filter campaigns...';
                }
                this.currentPage = 1;
                this.updateChart();
                this.renderTable();
                const previousScroll = campaignFilterDropdown.scrollTop;
                this.filterCampaignOptions(currentSearchTerm);
                campaignFilterDropdown.style.display = 'block';
                campaignFilterDropdown.scrollTop = previousScroll;
            });
            
            campaignFilterDropdown.appendChild(option);
        });
        
        // Show "No results" if no matches
        if (filteredCampaigns.length === 0 && searchTerm) {
            const noResults = document.createElement('div');
            noResults.className = 'filter-option';
            noResults.textContent = 'No matching campaigns found';
            noResults.style.color = 'var(--text-muted)';
            noResults.style.cursor = 'default';
            campaignFilterDropdown.appendChild(noResults);
        }
    }

    sortTable(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        this.renderTable();
    }

    updateSortIcons() {
        // Reset all sort icons
        document.querySelectorAll('.sortable .material-icons').forEach(icon => {
            icon.textContent = 'keyboard_arrow_down';
            icon.style.opacity = '0.5';
        });
        
        // Highlight current sort column
        if (this.sortColumn) {
            const currentHeader = document.querySelector(`[data-sort="${this.sortColumn}"]`);
            if (currentHeader) {
                const icon = currentHeader.querySelector('.material-icons');
                if (icon) {
                    icon.textContent = this.sortDirection === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
                    icon.style.opacity = '1';
                }
            }
        }
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
                    sales: 0,
                    sessions: 0,
                    pageviews: 0,
                    clicks: 0,
                    impressions: 0,
                    orders: 0,
                    cpc: 0,
                    ctr: 0,
                    conversionRate: 0,
                    count: 0
                };
            }
            
            // Sum values for aggregation
            groups[key].spend += item.spend;
            groups[key].sales += item.sales;
            groups[key].sessions += item.sessions;
            groups[key].pageviews += item.pageviews;
            
            // Sum clicks for CPC calculation
            groups[key].clicks += item.clicks || 0;
            groups[key].impressions += item.impressions || 0;
            groups[key].orders += item.orders || 0;
            
            // Average values for rates (except ACOS/TCOS which should be calculated from totals)
            groups[key].cpc += item.cpc;
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
            
            // Calculate ACOS and TCOS from totals (not averages)
            const acos = group.sales > 0 ? (group.spend / group.sales) * 100 : 0;
            const tcos = group.sales > 0 ? (group.spend / group.sales) * 100 : 0;
            const cpc = group.clicks > 0 ? group.spend / group.clicks : 0;
            const ctr = group.impressions > 0 ? (group.clicks / group.impressions) * 100 : 0;
            const conversionRate = group.sessions > 0 ? (group.orders / group.sessions) * 100 : 0;
            
            return {
                dateLabel: dateLabel,
                category: group.category,
                name: group.name,
                spend: Math.round(group.spend),
                cpc: Math.round(cpc * 100) / 100,
                sales: Math.round(group.sales),
                acos: Math.round(acos * 100) / 100,
                tcos: Math.round(tcos * 100) / 100,
                ctr: Math.round(ctr * 100) / 100,
                sessions: Math.round(group.sessions),
                pageviews: Math.round(group.pageviews),
                conversionRate: Math.round(conversionRate * 100) / 100
            };
        });
    }

    renderTable() {
        const tbody = document.getElementById('tableBody');
        const theadRow = document.getElementById('tableHeaderRow');
        const tableEl = document.querySelector('.data-table');
        if (tableEl) {
            tableEl.classList.remove('category-products', 'category-campaigns', 'category-search-terms');
            tableEl.classList.add(`category-${this.currentCategory}`);
        }
        
        // Get individual records
        let data = this.currentData.filter(item => item.category === this.currentCategory);
        
        // Debug: Log data before processing
        console.log(`🔍 Table Data Debug - ${this.currentCategory}:`, {
            totalData: this.currentData.length,
            filteredData: data.length,
            sampleData: data.slice(0, 3).map(item => ({ name: item.name, spend: item.spend, sales: item.sales })),
            allCategories: [...new Set(this.currentData.map(item => item.category))],
            currentCategory: this.currentCategory
        });
        
        // Apply name filter if multi-select has items; keep DAILY TOTAL rows
        if (this.selectedNames && this.selectedNames.size > 0) {
            data = data.filter(item => {
                const nm = (item.displayName || item.name) || '';
                const isTotal = nm.includes('📊') || nm.toLowerCase().includes('daily total') || nm.toLowerCase().includes('total');
                return isTotal || this.selectedNames.has(nm);
            });
        } else if (this.selectedName) {
            data = data.filter(item => (item.displayName || item.name) === this.selectedName);
        }
        
        // Apply campaign filter for search-terms tab
        if (this.currentCategory === 'search-terms' && this.selectedCampaigns && this.selectedCampaigns.size > 0) {
            data = data.filter(item => {
                const nm = (item.displayName || item.name) || '';
                const isTotal = nm.includes('📊') || nm.toLowerCase().includes('daily total') || nm.toLowerCase().includes('total');
                if (isTotal) return true; // Keep DAILY TOTAL rows
                const campaignName = item.campaignName || item.campaign_name || '';
                return campaignName && this.selectedCampaigns.has(campaignName);
            });
        }
        
        // If filter is applied, use ALL data for that filter (ignore date range)
        // Only apply date range if NO filter is selected
        const hasFilterApplied = (this.selectedNames && this.selectedNames.size > 0) || this.selectedName || (this.currentCategory === 'search-terms' && this.selectedCampaigns && this.selectedCampaigns.size > 0);
        
        // Debug: Log filter status for table
        console.log('🔍 Table Filter Priority Debug:', {
            selectedNames: this.selectedNames ? Array.from(this.selectedNames) : null,
            selectedName: this.selectedName,
            hasFilterApplied: hasFilterApplied,
            dateRange: this.currentDateRange,
            dataLengthBefore: data.length
        });
        
        if (!hasFilterApplied) {
            // Apply date range filter only when no filter is applied
            data = this.filterDataByDateRange(data);
            console.log('📅 Table: Date range applied, data length after:', data.length);
        } else {
            console.log('🎯 Table: Filter applied, ignoring date range, data length:', data.length);
        }
        
        // Debug: Log data after filtering
        console.log(`🔍 After Filter - ${this.currentCategory}:`, {
            filteredData: data.length,
            sampleData: data.slice(0, 3).map(item => ({ name: item.name, date: item.date, spend: item.spend, sales: item.sales }))
        });

        // If we're on campaigns and user selected specific names,
        // recompute DAILY TOTAL for the filtered subset so totals reflect selection.
        if (this.currentCategory === 'campaigns' && this.selectedNames && this.selectedNames.size > 0) {
            const totalsByDate = {};
            // Build totals from only non-total rows (selected names already applied above)
            data.forEach(item => {
                const nm = String(item.name || '');
                if (nm.includes('📊')) return; // skip existing totals to avoid double-counting
                const key = this.normalizeDateKey(item.date);
                if (!totalsByDate[key]) {
                    totalsByDate[key] = { spend: 0, sales: 0, clicks: 0 };
                }
                totalsByDate[key].spend += Number(item.spend || 0);
                totalsByDate[key].sales += Number(item.sales || 0);
                totalsByDate[key].clicks += Number(item.clicks || 0);
            });
            // Remove any pre-existing DAILY TOTAL rows
            data = data.filter(r => !String(r.name || '').includes('📊'));
            Object.entries(totalsByDate).forEach(([key, t]) => {
                const cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
                const roas = t.spend > 0 ? t.sales / t.spend : 0;
                const acos = t.sales > 0 ? (t.spend / t.sales) * 100 : 0;
                const tcos = t.totalSales > 0 ? (t.spend / t.totalSales) * 100 : 0;
                
                // Debug: Log campaigns daily total ACOS/TCOS calculation
                if (t.spend > 0 && t.sales > 0) {
                    console.log(`🔍 Campaigns Daily Total ACOS Debug (${key}):`, {
                        spend: t.spend,
                        sales: t.sales,
                        calculatedAcos: acos,
                        formula: `(${t.spend} / ${t.sales}) * 100`,
                        rawData: data.filter(item => this.normalizeDateKey(item.date) === key && !String(item.name || '').includes('📊'))
                    });
                }
                if (t.spend > 0 && t.totalSales > 0) {
                    console.log(`🔍 Campaigns Daily Total TCOS Debug (${key}):`, {
                        spend: t.spend,
                        totalSales: t.totalSales,
                        calculatedTcos: tcos,
                        formula: `(${t.spend} / ${t.totalSales}) * 100`,
                        rawData: data.filter(item => this.normalizeDateKey(item.date) === key && !String(item.name || '').includes('📊'))
                    });
                }
                data.push({
                    date: key,
                    category: 'campaigns',
                    name: '📊 DAILY TOTAL',
                    displayName: '📊 DAILY TOTAL',
                    spend: t.spend,
                    sales: t.sales,
                    clicks: t.clicks,
                    cpc, roas, acos, tcos
                });
            });
        }

        // If we're on search-terms, recompute DAILY TOTAL from items for spend/sales/clicks
        // but pull Sessions/Pageviews from the pre-existing business totals rows so they are not zero.
        if (this.currentCategory === 'search-terms') {
            const totalsByDate = {};
            const businessTotalsByDate = {};
            // Capture business sessions/pageviews from existing DAILY TOTAL rows
            data.forEach(item => {
                const nm = String(item.name || '');
                const key = this.normalizeDateKey(item.date);
                if (nm.includes('📊')) {
                    businessTotalsByDate[key] = {
                        sessions: Number(item.sessions || 0),
                        pageviews: Number(item.pageviews || 0)
                    };
                }
            });
            // Build totals from only non-total rows (selected names already applied above)
            data.forEach(item => {
                const nm = String(item.name || '');
                if (nm.includes('📊')) return; // skip existing totals to avoid double-counting
                const key = this.normalizeDateKey(item.date);
                if (!totalsByDate[key]) {
                    totalsByDate[key] = { spend: 0, sales: 0, clicks: 0, sessions: 0, pageviews: 0, orders: 0, totalSales: 0 };
                }
                totalsByDate[key].spend += Number(item.spend || 0);
                totalsByDate[key].sales += Number(item.sales || 0);
                totalsByDate[key].clicks += Number(item.clicks || 0);
                totalsByDate[key].orders += Number(item.orders || 0);
                // Use per-day Total Sales from business totals: take the maximum per date to avoid duplicates across terms
                const dayTotalSales = Number(item.totalSales || 0);
                const existingTotal = Number(totalsByDate[key].totalSales || 0);
                totalsByDate[key].totalSales = Math.max(existingTotal, dayTotalSales);
            });
            // Remove any pre-existing DAILY TOTAL rows
            data = data.filter(r => !String(r.name || '').includes('📊'));
            Object.entries(totalsByDate).forEach(([key, t]) => {
                const biz = businessTotalsByDate[key] || { sessions: 0, pageviews: 0 };
                const sessions = biz.sessions;
                const pageviews = biz.pageviews;
                const cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
                const roas = t.spend > 0 ? t.sales / t.spend : 0;
                const acos = t.sales > 0 ? (t.spend / t.sales) * 100 : 0;
                const tcos = t.totalSales > 0 ? (t.spend / t.totalSales) * 100 : 0;
                const ctr = sessions > 0 ? (t.clicks / sessions) * 100 : 0;
                
                // Debug: Log search terms daily total ACOS calculation
                if (t.spend > 0 && t.sales > 0) {
                    console.log(`🔍 Search Terms Daily Total ACOS Debug (${key}):`, {
                        spend: t.spend,
                        sales: t.sales,
                        calculatedAcos: acos,
                        formula: `(${t.spend} / ${t.sales}) * 100`
                    });
                }
                data.push({
                    date: key,
                    category: 'search-terms',
                    name: '📊 DAILY TOTAL',
                    displayName: '📊 DAILY TOTAL',
                    spend: t.spend,
                    sales: t.sales,
                    clicks: t.clicks,
                    sessions,
                    pageviews,
                    orders: t.orders,
                    totalSales: t.totalSales,
                    cpc, roas, acos, tcos, ctr
                });
            });
        }
        
        
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
        let sortedData = withTotals.sort((a, b) => {
            if (this.sortColumn === 'name') {
                const an = a.name.toLowerCase();
                const bn = b.name.toLowerCase();
                return this.sortDirection === 'asc' ? (an > bn ? 1 : -1) : (an < bn ? 1 : -1);
            }
            
            // Total column sorting
            if (this.sortColumn === 'total') {
                // Choose totals based on category preference
                // Products: Sales totals; Campaigns/Search-terms: Ad Spend totals
                const aTotal = (this.currentCategory === 'products')
                    ? Number(a.__totalSales || 0)
                    : Number(a.__totalSpend || 0);
                const bTotal = (this.currentCategory === 'products')
                    ? Number(b.__totalSales || 0)
                    : Number(b.__totalSpend || 0);
                return this.sortDirection === 'asc' ? (aTotal - bTotal) : (bTotal - aTotal);
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

        // Ensure DAILY TOTAL rows always stay on top for all categories
        {
            const isTotalName = (nm) => {
                const s = String(nm || '');
                return s.includes('📊') || s.toLowerCase().includes('daily total');
            };
            const totalsFirst = [];
            const others = [];
            sortedData.forEach(g => { (isTotalName(g.name) ? totalsFirst : others).push(g); });
            sortedData = [...totalsFirst, ...others];
        }
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = sortedData.slice(startIndex, endIndex);
        
        // For search-terms, build mapping of term -> set of campaign names (excluding DAILY TOTAL)
        let campaignsByTerm = new Map();
        if (this.currentCategory === 'search-terms') {
            data.forEach(item => {
                const nm = (item.displayName || item.name) || '';
                const isTotal = String(item.name || '').includes('📊') || String(item.name || '').toLowerCase().includes('daily total');
                if (isTotal) return;
                const c = item.campaignName || item.campaign_name || '';
                if (!c) return;
                if (!campaignsByTerm.has(nm)) campaignsByTerm.set(nm, new Set());
                campaignsByTerm.get(nm).add(String(c));
            });
        }

        // Render dynamic header (name + optional campaign + metric + date columns)
        const nameHeader = this.currentCategory === 'campaigns' ? 'Campaign Name' : (this.currentCategory === 'search-terms' ? 'Search Term' : 'Product Name');
        theadRow.innerHTML = `
            <th class="sortable" data-sort="name">
                <span>${nameHeader}</span>
                <span class="material-icons">keyboard_arrow_down</span>
            </th>
            ${this.currentCategory === 'search-terms' ? '<th class="campaign-col"><span>Campaign Name</span></th>' : ''}
            ${this.currentCategory === 'search-terms' ? '<th><span>Metric</span></th>' : ''}
            ${this.currentCategory !== 'search-terms' ? '<th><span>Metric</span></th>' : ''}
            <th class="total-col sortable" data-sort="total"><span>Total</span><span class="material-icons">keyboard_arrow_down</span></th>
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
            // Define metrics based on current category
            let allMetrics;
            if (this.currentCategory === 'search-terms') {
                // Search Terms tab - include totalSales
                allMetrics = [
                { key: 'spend', label: 'Ad Spend', data: product.spendByKey, format: 'currency' },
                { key: 'cpc', label: 'AVG. CPC', data: product.cpcByKey, format: 'currency' },
                { key: 'clicks', label: 'Ad Clicks', data: product.clicksByKey, format: 'number' },
                { key: 'roas', label: 'ROAS', data: product.roasByKey, format: 'number' },
                { key: 'acos', label: 'ACOS', data: product.acosByKey, format: 'percentage' },
                { key: 'tcos', label: 'TCOS', data: product.tcosByKey, format: 'percentage' },
                    { key: 'sales', label: 'Ad Sales', data: product.salesByKey, format: 'currency' },
                    { key: 'totalSales', label: 'Total Sales', data: product.totalSalesByKey, format: 'currency' },
                { key: 'orders', label: 'No of Orders', data: product.ordersByKey, format: 'number' },
                { key: 'sessions', label: 'Sessions', data: product.sessionsByKey, format: 'number' },
                { key: 'pageviews', label: 'Page Views', data: product.pageviewsByKey, format: 'number' },
                { key: 'conversionRate', label: 'Conversion Rate', data: product.conversionRateByKey, format: 'percentage' }
            ];
            } else {
                // Products and Campaigns tabs - original metrics without totalSales
                allMetrics = [
                { key: 'spend', label: 'Ad Spend', data: product.spendByKey, format: 'currency' },
                { key: 'cpc', label: 'AVG. CPC', data: product.cpcByKey, format: 'currency' },
                { key: 'clicks', label: 'Ad Clicks', data: product.clicksByKey, format: 'number' },
                { key: 'roas', label: 'ROAS', data: product.roasByKey, format: 'number' },
                { key: 'acos', label: 'ACOS', data: product.acosByKey, format: 'percentage' },
                { key: 'tcos', label: 'TCOS', data: product.tcosByKey, format: 'percentage' },
                { key: 'sales', label: (this.currentCategory === 'campaigns' ? 'Ad Sales' : 'Sales'), data: product.salesByKey, format: 'currency' },
                // Expose Total Sales metric in Campaigns table (will be 0 unless provided)
                { key: 'totalSales', label: 'Total Sales', data: product.totalSalesByKey, format: 'currency' },
                { key: 'orders', label: 'No of Orders', data: product.ordersByKey, format: 'number' },
                { key: 'sessions', label: 'Sessions', data: product.sessionsByKey, format: 'number' },
                { key: 'pageviews', label: 'Page Views', data: product.pageviewsByKey, format: 'number' },
                { key: 'conversionRate', label: 'Conversion Rate', data: product.conversionRateByKey, format: 'percentage' }
            ];
            }
            
            // Filter to only show selected metrics (read current checkbox state directly)
            const checkboxes = document.querySelectorAll('#chartMetricOptions input[type="checkbox"]:checked');
            const currentSelectedMetrics = Array.from(checkboxes).map(cb => cb.id.replace('metric-', ''));
            let metricRows = allMetrics.filter(metric => currentSelectedMetrics.includes(metric.key));
            
            // Sort metric rows by date column if date sorting is active
            if (this.sortColumn && this.sortColumn.startsWith('date-')) {
                const dateLabel = this.sortColumn.replace('date-', '');
                metricRows = metricRows.sort((a, b) => {
                    // Choose sorting metric based on category
                    let aValue, bValue;
                    if (this.currentCategory === 'products') {
                        // Products: Sort by Sales values
                        aValue = Number(a.data?.[dateLabel] || 0);
                        bValue = Number(b.data?.[dateLabel] || 0);
                    } else {
                        // Campaigns & Search Terms: Sort by Ad Spend values
                        aValue = Number(a.data?.[dateLabel] || 0);
                        bValue = Number(b.data?.[dateLabel] || 0);
                    }
                    
                    if (this.sortDirection === 'asc') {
                        return aValue - bValue;
                    } else {
                        return bValue - aValue;
                    }
                });
            }
            
            // Debug: Log table metrics
            console.log('📊 Table metrics:', {
                checkedBoxes: currentSelectedMetrics,
                tableMetrics: metricRows.map(m => m.label),
                totalMetrics: metricRows.length
            });
            
            
            return metricRows.map((metric, index) => {
                const nmRow = String(product.name || '');
                const isTotalRowCheck = nmRow.includes('📊') || nmRow.toLowerCase().includes('daily total');
                // Campaigns: suppress Total Sales rows for individual campaigns entirely
                if (this.currentCategory === 'campaigns' && metric.key === 'totalSales' && !isTotalRowCheck) {
                    return '';
                }
                // Search terms: suppress Total Sales rows for individual search terms as well
                if (this.currentCategory === 'search-terms' && metric.key === 'totalSales' && !isTotalRowCheck) {
                    return '';
                }
                // Suppress Sessions rows for individuals in campaigns and search-terms
                if ((this.currentCategory === 'campaigns' || this.currentCategory === 'search-terms')
                    && metric.key === 'sessions' && !isTotalRowCheck) {
                    return '';
                }
                // Suppress TCOS rows for individuals in campaigns and search-terms (only show in daily totals)
                if ((this.currentCategory === 'campaigns' || this.currentCategory === 'search-terms')
                    && metric.key === 'tcos' && !isTotalRowCheck) {
                    return '';
                }
                let runningTotal = 0;
                let avgCount = 0; // for AVG/percent-like metrics
                const cells = buckets.keys.map(key => {
                    let val = metric.data[key] || 0;

                    // For search-terms: individual rows should not display
                    // account-level totals. Only DAILY TOTAL row shows per-day
                    // Total Sales and Sessions from business data.
                    if (this.currentCategory === 'search-terms') {
                        if (!isTotalRowCheck && (metric.key === 'totalSales' || metric.key === 'sessions')) {
                            val = 0;
                        }
                    }
                    // For campaigns: Total Sales is an account-level value.
                    // Hide it for individual campaign rows by showing a dash
                    // instead of 0 to avoid confusion.
                    if (this.currentCategory === 'campaigns' && metric.key === 'totalSales' && !isTotalRowCheck) {
                        // already suppressed above; keep safe-return
                        return '';
                    }
                    if (this.currentCategory === 'search-terms' && metric.key === 'totalSales' && !isTotalRowCheck) {
                        return '';
                    }
                    if ((this.currentCategory === 'campaigns' || this.currentCategory === 'search-terms')
                        && metric.key === 'sessions' && !isTotalRowCheck) {
                        return '';
                    }
                    
                    let formattedVal;
                    if (metric.format === 'currency') {
                        formattedVal = `₹${this.formatNumber(val)}`;
                        runningTotal += Number(val || 0);
                    } else if (metric.format === 'percentage') {
                        formattedVal = `${this.formatPercentage(val, 1)}%`;
                        if (val !== null && val !== undefined) { runningTotal += Number(val || 0); avgCount += 1; }
                    } else {
                        formattedVal = this.formatNumber(val);
                        runningTotal += Number(val || 0);
                        if (metric.key === 'cpc' || metric.key === 'roas' || metric.key === 'acos' || metric.key === 'tcos' || metric.key === 'ctr' || metric.key === 'conversionRate') {
                            avgCount += 1;
                        }
                    }
                    return `<td>${formattedVal}</td>`;
                }).join('');
                
                // Compute total value cell (sum for currency/number; average for percent/decimal metrics)
                let totalCell = '';
                // Special rule: AVG. CPC total = (sum Ad Spend) / (sum Ad Clicks)
                if (metric.key === 'cpc') {
                    const sumSpend = buckets.keys.reduce((s, k) => s + Number(product.spendByKey[k] || 0), 0);
                    const sumClicks = buckets.keys.reduce((s, k) => s + Number(product.clicksByKey[k] || 0), 0);
                    const totalCpc = sumClicks > 0 ? (sumSpend / sumClicks) : 0;
                    totalCell = `<td class="total-col">₹${Number(totalCpc || 0).toFixed(2)}</td>`;
                } else if (metric.format === 'currency') {
                    totalCell = `<td class="total-col">₹${this.formatNumber(runningTotal)}</td>`;
                } else if (metric.format === 'percentage' || metric.key === 'roas' || metric.key === 'conversionRate') {
                    // For ACOS/TCOS, calculate from total spend and sales (not average percentages)
                    if (metric.key === 'acos' || metric.key === 'tcos') {
                        const totalSpend = buckets.keys.reduce((s, k) => s + Number(product.spendByKey[k] || 0), 0);
                        
                        if (metric.key === 'acos') {
                            const totalSales = buckets.keys.reduce((s, k) => s + Number(product.salesByKey[k] || 0), 0);
                            const calculatedAcos = totalSales > 0 ? (totalSpend / totalSales) * 100 : 0;
                            
                            // Debug: Log total column ACOS calculation
                            if (totalSpend > 0 && totalSales > 0) {
                                console.log(`🔍 Total Column ACOS Debug - ${product.name}:`, {
                                    totalSpend: totalSpend,
                                    totalSales: totalSales,
                                    calculatedAcos: calculatedAcos,
                                    formula: `(${totalSpend} / ${totalSales}) * 100`,
                                    spendByKey: product.spendByKey,
                                    salesByKey: product.salesByKey
                                });
                            }
                            
                            totalCell = `<td class="total-col">${this.formatPercentage(calculatedAcos, 1)}%</td>`;
                        } else if (metric.key === 'tcos') {
                            const totalSalesForTcos = buckets.keys.reduce((s, k) => s + Number(product.totalSalesByKey[k] || 0), 0);
                            const calculatedTcos = totalSalesForTcos > 0 ? (totalSpend / totalSalesForTcos) * 100 : 0;
                            
                            // Debug: Log total column TCOS calculation
                            if (totalSpend > 0 && totalSalesForTcos > 0) {
                                console.log(`🔍 Total Column TCOS Debug - ${product.name}:`, {
                                    totalSpend: totalSpend,
                                    totalSalesForTcos: totalSalesForTcos,
                                    calculatedTcos: calculatedTcos,
                                    formula: `(${totalSpend} / ${totalSalesForTcos}) * 100`,
                                    spendByKey: product.spendByKey,
                                    totalSalesByKey: product.totalSalesByKey
                                });
                            }
                            
                            totalCell = `<td class="total-col">${this.formatPercentage(calculatedTcos, 1)}%</td>`;
                        }
                    } else {
                        // For other percentages, use average
                        const avg = avgCount > 0 ? (runningTotal / avgCount) : 0;
                        if (metric.format === 'percentage') {
                            totalCell = `<td class="total-col">${this.formatPercentage(avg, 1)}%</td>`;
                        } else {
                            totalCell = `<td class="total-col">${this.formatNumber(Number(avg || 0))}</td>`;
                        }
                    }
                } else {
                    totalCell = `<td class="total-col">${this.formatNumber(runningTotal)}</td>`;
                }
                
                const productNameCell = `<td style="font-weight: 600;">${product.name}</td>`;
                const campaignNamesCell = (this.currentCategory === 'search-terms') ? (() => {
                    if (isTotalRowCheck) return '<td>—</td>';
                    // Prefer grouped campaigns collected during aggregation
                    const groupedSet = product.campaigns instanceof Set ? product.campaigns : null;
                    const set = groupedSet && groupedSet.size > 0 ? groupedSet : campaignsByTerm.get(product.name);
                    if (!set || set.size === 0) return '<td class="campaign-col">—</td>';
                    const list = Array.from(set).sort().join(' | ');
                    return `<td class="campaign-col">${list}</td>`;
                })() : '';
                
                // Check if this is a total row (contains "DAILY TOTAL" or "📊")
                const isTotalRow = isTotalRowCheck;
                const rowClass = isTotalRow ? 'total-row' : '';
                
                return `
                    <tr class="${rowClass}">
                        ${productNameCell}
                        ${campaignNamesCell}
                        <td style="font-weight: 500; background: #f8f9fa;">${metric.label}</td>
                        ${totalCell}
                        ${cells}
                    </tr>
                `;
            }).join('');
        }).join('');
        
        this.updatePagination(sortedData.length);
        this.updateResultsCount(sortedData.length);
        
        // Re-attach sort event listeners for date columns
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', (e) => {
                this.sortTable(e.currentTarget.dataset.sort);
            });
        });
        
        // Update sort icons
        this.updateSortIcons();
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
        let keys = Array.from(keySet).sort();
        if (this.dateOrder === 'desc') keys = keys.reverse();
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
                    totalSalesByKey: {},
                    clicksByKey: {},
                    sessionsByKey: {},
                    pageviewsByKey: {},
                    ordersByKey: {},
                    cpcByKey: {},
                    acosByKey: {},
                    tcosByKey: {},
                    ctrByKey: {},
                    conversionRateByKey: {},
                    roasByKey: {},
                    // For search-terms, track all related campaign names
                    campaigns: new Set()
                };
            }
            
            // Aggregate all metrics by date key
            const currentSpend = groups[name].spendByKey[key] || 0;
            const currentSales = groups[name].salesByKey[key] || 0;
            const itemSpend = item.spend || 0;
            const itemSales = item.sales || 0;
            
            groups[name].spendByKey[key] = currentSpend + itemSpend;
            groups[name].salesByKey[key] = currentSales + itemSales;
            
            // Debug: Log data aggregation for ACOS calculation
            if (itemSpend > 0 || itemSales > 0) {
                console.log(`🔍 Data Aggregation Debug - ${name} (${key}):`, {
                    itemSpend: itemSpend,
                    itemSales: itemSales,
                    currentSpend: currentSpend,
                    currentSales: currentSales,
                    newSpend: groups[name].spendByKey[key],
                    newSales: groups[name].salesByKey[key],
                    calculatedAcos: groups[name].salesByKey[key] > 0 ? (groups[name].spendByKey[key] / groups[name].salesByKey[key]) * 100 : 0
                });
            }
            // Prevent duplicating per-day Total Sales across rows. For search-terms and
            // campaigns, only the DAILY TOTAL row should contribute totalSales for a date;
            // individual rows must not accumulate account-level totals.
            if (this.currentCategory === 'search-terms' || this.currentCategory === 'campaigns') {
                const nm = String(item.name || '');
                const isDailyTotal = nm.includes('📊') || nm.toLowerCase().includes('daily total');
                if (isDailyTotal) {
                    const existing = groups[name].totalSalesByKey[key] || 0;
                    const next = Number(item.totalSales || 0);
                    groups[name].totalSalesByKey[key] = Math.max(existing, next);
                }
                // For non-total rows, do not add item.totalSales to avoid showing
                // large account-level totals on individual terms.
            } else {
                groups[name].totalSalesByKey[key] = (groups[name].totalSalesByKey[key] || 0) + (item.totalSales || 0);
            }
            groups[name].clicksByKey[key] = (groups[name].clicksByKey[key] || 0) + (item.clicks || 0);
            groups[name].sessionsByKey[key] = (groups[name].sessionsByKey[key] || 0) + (item.sessions || 0);
            groups[name].pageviewsByKey[key] = (groups[name].pageviewsByKey[key] || 0) + (item.pageviews || 0);
            groups[name].ordersByKey[key] = (groups[name].ordersByKey[key] || 0) + (item.orders || 0);
            
            // AVG. CPC should be computed from aggregated spend/clicks for the date
            if (this.currentCategory === 'campaigns' || this.currentCategory === 'search-terms') {
                const spendTotal = groups[name].spendByKey[key] || 0;
                const clicksTotal = groups[name].clicksByKey[key] || 0;
                groups[name].cpcByKey[key] = clicksTotal > 0 ? spendTotal / clicksTotal : 0;
            } else {
            groups[name].cpcByKey[key] = (groups[name].cpcByKey[key] || 0) + (item.cpc || 0);
            }

            // Collect campaign names for search-terms so UI/export can show them
            if (this.currentCategory === 'search-terms') {
                const cn = item.campaignName || item.campaign_name;
                if (cn) {
                    groups[name].campaigns.add(String(cn));
                }
            }
            // Calculate ACOS and TCOS from aggregated spend and sales (not by adding individual values)
            const aggSpend = groups[name].spendByKey[key] || 0;
            const aggSales = groups[name].salesByKey[key] || 0;
            const calculatedAcos = aggSales > 0 ? (aggSpend / aggSales) * 100 : 0;
            groups[name].acosByKey[key] = calculatedAcos;
            // For TCOS, use totalSales instead of sales
            const aggTotalSales = groups[name].totalSalesByKey[key] || 0;
            const calculatedTcos = aggTotalSales > 0 ? (aggSpend / aggTotalSales) * 100 : 0;
            groups[name].tcosByKey[key] = calculatedTcos;
            
            // Debug: Log ACOS calculation for troubleshooting
            if (aggSpend > 0 && aggSales > 0) {
                console.log(`🔍 ACOS Debug - ${name} (${key}):`, {
                    spend: aggSpend,
                    sales: aggSales,
                    calculatedAcos: calculatedAcos,
                    formula: `(${aggSpend} / ${aggSales}) * 100`,
                    category: this.currentCategory,
                    spendByKey: groups[name].spendByKey,
                    salesByKey: groups[name].salesByKey
                });
            }
            groups[name].ctrByKey[key] = (groups[name].ctrByKey[key] || 0) + (item.ctr || 0);
            groups[name].conversionRateByKey[key] = (groups[name].conversionRateByKey[key] || 0) + (item.conversionRate || 0);
            // Maintain ROAS per key from aggregated spend/sales
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
        
        // Apply name filter if multi-select has items; keep DAILY TOTAL rows
        if (this.selectedNames && this.selectedNames.size > 0) {
            data = data.filter(item => {
                const nm = (item.displayName || item.name) || '';
                const isTotal = nm.includes('📊') || nm.toLowerCase().includes('daily total') || nm.toLowerCase().includes('total');
                return isTotal || this.selectedNames.has(nm);
            });
        } else if (this.selectedName) {
            data = data.filter(item => (item.displayName || item.name) === this.selectedName);
        }
        
        // Apply campaign filter for search-terms tab
        if (this.currentCategory === 'search-terms' && this.selectedCampaigns && this.selectedCampaigns.size > 0) {
            data = data.filter(item => {
                const nm = (item.displayName || item.name) || '';
                const isTotal = nm.includes('📊') || nm.toLowerCase().includes('daily total') || nm.toLowerCase().includes('total');
                if (isTotal) return true; // Keep DAILY TOTAL rows
                const campaignName = item.campaignName || item.campaign_name || '';
                return campaignName && this.selectedCampaigns.has(campaignName);
            });
        }
        
        // If filter is applied, use ALL data for that filter (ignore date range)
        // Only apply date range if NO filter is selected
        const hasFilterApplied = (this.selectedNames && this.selectedNames.size > 0) || this.selectedName || (this.currentCategory === 'search-terms' && this.selectedCampaigns && this.selectedCampaigns.size > 0);
        if (!hasFilterApplied) {
            // Apply date range filter only when no filter is applied
            data = this.filterDataByDateRange(data);
        }
        const buckets = this.buildDateBuckets(data);
        const groupedData = this.groupDataByProductForPivot(data, buckets);
        const totalPages = Math.ceil(groupedData.length / this.itemsPerPage) || 1;
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderTable();
        }
    }

    exportData(format) {
        try {
            // Build a pivoted dataset exactly like the table (current tab + filters)
            const pivot = this.buildPivotDataset();
            
            // Debug: Log export data
            console.log(`🔍 Export Debug - ${format.toUpperCase()}:`, {
                category: this.currentCategory,
                headersCount: pivot.headers.length,
                rowsCount: pivot.rows.length,
                sampleHeaders: pivot.headers.slice(0, 5),
                sampleRows: pivot.rows.slice(0, 2)
            });
            
            if (!pivot || !pivot.headers || !pivot.rows) {
                console.error('❌ Export Error: Invalid pivot data');
                alert('No data available for export. Please ensure you have data loaded.');
                return;
            }
            
            if (format === 'csv') {
                this.downloadCSVPivot(pivot.headers, pivot.rows);
            } else if (format === 'excel') {
                this.downloadExcelPivot(pivot.headers, pivot.rows);
            }
        } catch (error) {
            console.error('❌ Export Error:', error);
            alert('Export failed. Please check the console for details.');
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
        a.download = this.generateExportFilename('.csv');
        a.click();
        window.URL.revokeObjectURL(url);
    }

    downloadExcel(data) {
        if (!data || data.length === 0) return;
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Trend Reports');
        const ab = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.generateExportFilename('.xlsx');
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // ------- PIVOT EXPORT (matches table) -------
    buildPivotDataset() {
        // Prepare the same data used by the table
        let data = this.currentData.filter(item => item.category === this.currentCategory);
        
        // Debug: Log export filter status
        console.log('🔍 Export Filter Debug:', {
            category: this.currentCategory,
            selectedNames: this.selectedNames ? Array.from(this.selectedNames) : null,
            selectedName: this.selectedName,
            dataBeforeFilter: data.length
        });
        
        // Name filter like table (keeps DAILY TOTAL rows regardless)
        if (this.selectedNames && this.selectedNames.size > 0) {
            data = data.filter(item => {
                const nm = (item.displayName || item.name) || '';
                const isTotal = nm.includes('📊') || nm.toLowerCase().includes('daily total') || nm.toLowerCase().includes('total');
                return isTotal || this.selectedNames.has(nm);
            });
        } else if (this.selectedName) {
            data = data.filter(item => (item.displayName || item.name) === this.selectedName);
        }
        
        // Apply campaign filter for search-terms tab
        if (this.currentCategory === 'search-terms' && this.selectedCampaigns && this.selectedCampaigns.size > 0) {
            data = data.filter(item => {
                const nm = (item.displayName || item.name) || '';
                const isTotal = nm.includes('📊') || nm.toLowerCase().includes('daily total') || nm.toLowerCase().includes('total');
                if (isTotal) return true; // Keep DAILY TOTAL rows
                const campaignName = item.campaignName || item.campaign_name || '';
                return campaignName && this.selectedCampaigns.has(campaignName);
            });
        }
        
        // If filter is applied, use ALL data for that filter (ignore date range)
        // Only apply date range if NO filter is selected
        const hasFilterApplied = (this.selectedNames && this.selectedNames.size > 0) || this.selectedName || (this.currentCategory === 'search-terms' && this.selectedCampaigns && this.selectedCampaigns.size > 0);
        if (!hasFilterApplied) {
            // Apply date range filter only when no filter is applied
            data = this.filterDataByDateRange(data);
            console.log('📅 Export: Date range applied, data length after:', data.length);
        } else {
            console.log('🎯 Export: Filter applied, ignoring date range, data length:', data.length);
        }
        // Always ensure DAILY TOTAL rows exist for search-terms in exports
        if (this.currentCategory === 'search-terms') {
            const bizByDate = {};
            data.forEach(item => {
                const nm = String(item.name || '');
                if (nm.includes('📊')) {
                    const k = this.normalizeDateKey(item.date);
                    bizByDate[k] = {
                        sessions: Number(item.sessions || 0),
                        pageviews: Number(item.pageviews || 0)
                    };
                }
            });
            // Strip any existing DAILY TOTAL rows to avoid dupes
            const withoutTotals = data.filter(r => !String(r.name || '').includes('📊'));
            const totalsByDate = {};
            withoutTotals.forEach(item => {
                const key = this.normalizeDateKey(item.date);
                if (!totalsByDate[key]) {
                    totalsByDate[key] = { spend: 0, sales: 0, clicks: 0, orders: 0, totalSales: 0 };
                }
                totalsByDate[key].spend += Number(item.spend || 0);
                totalsByDate[key].sales += Number(item.sales || 0);
                totalsByDate[key].clicks += Number(item.clicks || 0);
                totalsByDate[key].orders += Number(item.orders || 0);
                // totalSales holds business total sales per day; keep max in case of dupes
                totalsByDate[key].totalSales = Math.max(
                    totalsByDate[key].totalSales || 0,
                    Number(item.totalSales || 0)
                );
            });
            // Rebuild data with recomputed DAILY TOTAL rows
            data = withoutTotals;
            Object.entries(totalsByDate).forEach(([key, t]) => {
                const biz = bizByDate[key] || { sessions: 0, pageviews: 0 };
                const cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
                const roas = t.spend > 0 ? t.sales / t.spend : 0;
                const acos = t.sales > 0 ? (t.spend / t.sales) * 100 : 0;
                const tcos = t.totalSales > 0 ? (t.spend / t.totalSales) * 100 : 0;
                const ctr = biz.sessions > 0 ? (t.clicks / biz.sessions) * 100 : 0;
                data.push({
                    date: key,
                    category: this.currentCategory,
                    name: '📊 DAILY TOTAL',
                    displayName: '📊 DAILY TOTAL',
                    spend: t.spend,
                    sales: t.sales,
                    clicks: t.clicks,
                    sessions: biz.sessions,
                    pageviews: biz.pageviews,
                    orders: t.orders,
                    totalSales: t.totalSales,
                    cpc, roas, acos, tcos, ctr
                });
            });
        } else if (this.currentCategory === 'campaigns' && this.selectedNames && this.selectedNames.size > 0) {
            const totalsByDate = {};
            data.forEach(item => {
                const nm = String(item.name || '');
                if (nm.includes('📊')) return;
                const key = this.normalizeDateKey(item.date);
                if (!totalsByDate[key]) {
                    if (this.currentCategory === 'search-terms') {
                        totalsByDate[key] = { spend: 0, sales: 0, clicks: 0, sessions: 0, pageviews: 0, orders: 0, totalSales: 0 };
                    } else {
                        totalsByDate[key] = { spend: 0, sales: 0, clicks: 0 };
                    }
                }
                totalsByDate[key].spend += Number(item.spend || 0);
                totalsByDate[key].sales += Number(item.sales || 0);
                totalsByDate[key].clicks += Number(item.clicks || 0);
                if (this.currentCategory === 'search-terms') {
                    totalsByDate[key].sessions += Number(item.sessions || 0);
                    totalsByDate[key].pageviews += Number(item.pageviews || 0);
                    totalsByDate[key].orders += Number(item.orders || 0);
                    // Use per-day Total Sales from business totals: take the maximum per date to avoid duplicates across terms
                    const dayTotalSales = Number(item.totalSales || 0);
                    const existingTotal = Number(totalsByDate[key].totalSales || 0);
                    totalsByDate[key].totalSales = Math.max(existingTotal, dayTotalSales);
                }
            });
            data = data.filter(r => !String(r.name || '').includes('📊'));
            Object.entries(totalsByDate).forEach(([key, t]) => {
                const cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
                const roas = t.spend > 0 ? t.sales / t.spend : 0;
                const acos = t.sales > 0 ? (t.spend / t.sales) * 100 : 0;
                if (this.currentCategory === 'search-terms') {
                    const tcos = t.totalSales > 0 ? (t.spend / t.totalSales) * 100 : 0;
                    const ctr = t.sessions > 0 ? (t.clicks / t.sessions) * 100 : 0;
                    data.push({ 
                        date: key, 
                        category: this.currentCategory, 
                        name: '📊 DAILY TOTAL', 
                        displayName: '📊 DAILY TOTAL', 
                        spend: t.spend, 
                        sales: t.sales, 
                        clicks: t.clicks, 
                        sessions: t.sessions,
                        pageviews: t.pageviews,
                        orders: t.orders,
                        totalSales: t.totalSales,
                        cpc, roas, acos, tcos, ctr 
                    });
                } else {
                    data.push({ 
                        date: key, 
                        category: this.currentCategory, 
                        name: '📊 DAILY TOTAL', 
                        displayName: '📊 DAILY TOTAL', 
                        spend: t.spend, 
                        sales: t.sales, 
                        clicks: t.clicks, 
                        cpc, roas, acos, tcos: 0 
                    });
                }
            });
        }

        const buckets = this.buildDateBuckets(data);
        let grouped = this.groupDataByProductForPivot(data, buckets);

        // Ensure DAILY TOTAL group appears on top in exports (for campaigns and search-terms)
        if (this.currentCategory === 'campaigns' || this.currentCategory === 'search-terms') {
        const isTotalName = (nm) => {
            const s = String(nm || '');
            return s.includes('📊') || s.toLowerCase().includes('daily total');
        };
        const totalsFirst = [];
        const others = [];
        grouped.forEach(g => {
            if (isTotalName(g.name)) totalsFirst.push(g); else others.push(g);
        });
        grouped = [...totalsFirst, ...others];
        }

        // Create export structure based on current category
        const nameHeader = this.currentCategory === 'campaigns' ? 'Campaign Name' : (this.currentCategory === 'search-terms' ? 'Search Term' : 'Product Name');
        
        console.log('🔍 Export Debug - Current Category:', this.currentCategory);
        console.log('🔍 Export Debug - Grouped Data Count:', grouped.length);
        console.log('🔍 Export Debug - Sample Grouped Data:', grouped.slice(0, 2).map(g => ({ name: g.name, hasSpendData: !!g.spendByKey })));
        
        let headers, rows;
        
        if (this.currentCategory === 'products') {
            // Products tab - create date-based pivot structure (same as table display)
            const allMetrics = [
                { key: 'spend', label: 'Ad Spend', format: 'currency' },
                { key: 'cpc', label: 'AVG. CPC', format: 'currency' },
                { key: 'clicks', label: 'Ad Clicks', format: 'number' },
                { key: 'roas', label: 'ROAS', format: 'decimal2' },
                { key: 'acos', label: 'ACOS', format: 'percent' },
                { key: 'tcos', label: 'TCOS', format: 'percent' },
                { key: 'sales', label: 'Sales', format: 'currency' },
                { key: 'orders', label: 'No of Orders', format: 'number' },
                { key: 'sessions', label: 'Sessions', format: 'number' },
                { key: 'pageviews', label: 'Page Views', format: 'number' },
                { key: 'conversionRate', label: 'Conversion Rate', format: 'percent' }
            ];
            
            // Filter to only show selected metrics
            const checkboxes = document.querySelectorAll('#chartMetricOptions input[type="checkbox"]:checked');
            const currentSelectedMetrics = Array.from(checkboxes).map(cb => cb.id.replace('metric-', ''));
            const selectedMetrics = currentSelectedMetrics.length > 0 ? 
                allMetrics.filter(m => currentSelectedMetrics.includes(m.key)) : allMetrics;
            
            // Headers: Product Name + Metric + Total + Date columns
            headers = [nameHeader, 'Metric', 'Total', ...buckets.labels];
            rows = [];
            
            // Create rows like table display: each product has multiple rows (one per metric)
            grouped.forEach(product => {
                selectedMetrics.forEach(metric => {
                    const row = [product.name, metric.label]; // Product name + metric name
                    
                    // Compute Total for this metric to match table
                    const sumByKeys = (getter) => buckets.keys.reduce((acc, k) => acc + Number(getter(k) || 0), 0);
                    let totalValue = 0;
                    if (metric.key === 'cpc') {
                        const totalSpend = sumByKeys(k => product.spendByKey[k]);
                        const totalClicks = sumByKeys(k => product.clicksByKey[k]);
                        totalValue = totalClicks > 0 ? totalSpend / totalClicks : 0;
                        row.push({ v: totalValue, format: 'currency' });
                    } else if (metric.format === 'currency') {
                        totalValue = sumByKeys(k => (product[`${metric.key}ByKey`][k] || 0));
                        row.push({ v: totalValue, format: 'currency' });
                    } else if (metric.format === 'percent') {
                        // For ACOS/TCOS, calculate from total spend and sales (not average percentages)
                        if (metric.key === 'acos' || metric.key === 'tcos') {
                            // Get the total spend and sales from the same data source as displayed values
                            const totalSpend = sumByKeys(k => product.spendByKey[k]);
                            
                            if (metric.key === 'acos') {
                                const totalSales = sumByKeys(k => product.salesByKey[k]);
                                totalValue = totalSales > 0 ? (totalSpend / totalSales) * 100 : 0;
                            } else if (metric.key === 'tcos') {
                                const totalSalesForTcos = sumByKeys(k => product.totalSalesByKey[k]);
                                totalValue = totalSalesForTcos > 0 ? (totalSpend / totalSalesForTcos) * 100 : 0;
                            }
                            
                            // Force recalculation to ensure we're using the right values
                            if (metric.key === 'acos') {
                                console.log(`🔍 Pivot ACOS Calculation - ${product.name}:`, {
                                    totalSpend: totalSpend,
                                    totalSales: totalSales,
                                    calculatedAcos: totalValue,
                                    formula: `(${totalSpend} / ${totalSales}) * 100`,
                                    spendByKey: product.spendByKey,
                                    salesByKey: product.salesByKey
                                });
                            } else if (metric.key === 'tcos') {
                                console.log(`🔍 Pivot TCOS Calculation - ${product.name}:`, {
                                    totalSpend: totalSpend,
                                    totalSalesForTcos: totalSalesForTcos,
                                    calculatedTcos: totalValue,
                                    formula: `(${totalSpend} / ${totalSalesForTcos}) * 100`,
                                    spendByKey: product.spendByKey,
                                    totalSalesByKey: product.totalSalesByKey
                                });
                            }
                            
                            // If the calculation is wrong, force it to use the correct formula
                            if (metric.key === 'acos' && totalSpend > 0 && totalSales > 0) {
                                const correctAcos = (totalSpend / totalSales) * 100;
                                if (Math.abs(totalValue - correctAcos) > 0.01) {
                                    console.log(`🔍 ACOS Mismatch Detected! Using correct calculation:`, {
                                        originalValue: totalValue,
                                        correctValue: correctAcos,
                                        difference: Math.abs(totalValue - correctAcos)
                                    });
                                    totalValue = correctAcos;
                                }
                            } else if (metric.key === 'tcos' && totalSpend > 0 && totalSalesForTcos > 0) {
                                const correctTcos = (totalSpend / totalSalesForTcos) * 100;
                                if (Math.abs(totalValue - correctTcos) > 0.01) {
                                    console.log(`🔍 TCOS Mismatch Detected! Using correct calculation:`, {
                                        originalValue: totalValue,
                                        correctValue: correctTcos,
                                        difference: Math.abs(totalValue - correctTcos)
                                    });
                                    totalValue = correctTcos;
                                }
                            }
                        } else {
                            // For other percentages, average the values
                            let acc = 0, count = 0;
                            buckets.keys.forEach(k => { acc += Number((product[`${metric.key}ByKey`][k]) || 0); count += 1; });
                            totalValue = count > 0 ? acc / count : 0;
                        }
                        row.push({ v: totalValue, format: 'percent' });
                    } else if (metric.format === 'decimal2') {
                        totalValue = sumByKeys(k => product[`${metric.key}ByKey`][k] || 0);
                        row.push({ v: totalValue, format: 'decimal2' });
                    } else { 
                        totalValue = sumByKeys(k => product[`${metric.key}ByKey`][k] || 0);
                        row.push({ v: totalValue, format: 'number' });
                    }

                    // Add values for each date
                    buckets.keys.forEach(key => {
                        const val = product[`${metric.key}ByKey`][key] || 0;
                        if (metric.format === 'currency') {
                            row.push({ v: val, format: 'currency' });
                        } else if (metric.format === 'percent') {
                            row.push({ v: val, format: 'percent' });
                        } else if (metric.format === 'decimal2') {
                            row.push({ v: val, format: 'decimal2' });
                        } else {
                            row.push({ v: val, format: 'number' });
                        }
                    });
                    
            rows.push(row);
                });
            });
            
        } else if (this.currentCategory === 'search-terms') {
            // Search Terms tab - use EXACT same data processing as table display
            console.log('🔍 Search Terms Export - Using same data as table display');
            
            // Use the same data processing as the table
            const groupedData = this.groupDataByProductForPivot(data, buckets);
            
            // Compute totals per product to prioritize rows with data (same as table)
            const withTotals = groupedData.map(g => {
                const sum = (obj = {}) => Object.values(obj || {}).reduce((s, v) => s + (Number(v) || 0), 0);
                const totalSales = sum(g.salesByKey);
                const totalSpend = sum(g.spendByKey);
                const totalSessions = sum(g.sessionsByKey);
                const totalPageviews = sum(g.pageviewsByKey);
                return { ...g, __totalSales: totalSales, __totalSpend: totalSpend, __totalSessions: totalSessions, __totalPageviews: totalPageviews };
            });

            // Sort: products with data first (same as table)
            const sortedData = withTotals.sort((a, b) => {
                if (this.sortColumn === 'name') {
                    const an = a.name.toLowerCase();
                    const bn = b.name.toLowerCase();
                    return this.sortDirection === 'asc' ? (an > bn ? 1 : -1) : (an < bn ? 1 : -1);
                }
                
                
                const aKey = a.__totalSales || a.__totalSpend || 0;
                const bKey = b.__totalSales || b.__totalSpend || 0;
                if (bKey !== aKey) return bKey - aKey;
                if (b.__totalSessions !== a.__totalSessions) return b.__totalSessions - a.__totalSessions;
                if (b.__totalPageviews !== a.__totalPageviews) return b.__totalPageviews - a.__totalPageviews;
                return a.name.localeCompare(b.name);
            });

            // Ensure DAILY TOTAL appears first in exports (as requested)
            const isTotalName = (nm) => {
                const s = String(nm || '');
                return s.includes('📊') || s.toLowerCase().includes('daily total');
            };
            const totalsFirst = [];
            const others = [];
            sortedData.forEach(g => { (isTotalName(g.name) ? totalsFirst : others).push(g); });
            const orderedData = [...totalsFirst, ...others];
            
            const allMetrics = [
                { key: 'spend', label: 'Ad Spend', format: 'currency' },
                { key: 'cpc', label: 'AVG. CPC', format: 'currency' },
                { key: 'clicks', label: 'Ad Clicks', format: 'number' },
                { key: 'roas', label: 'ROAS', format: 'decimal2' },
                { key: 'acos', label: 'ACOS', format: 'percent' },
                { key: 'tcos', label: 'TCOS', format: 'percent' },
                { key: 'sales', label: 'Ad Sales', format: 'currency' },
                { key: 'totalSales', label: 'Total Sales', format: 'currency' },
                { key: 'orders', label: 'No of Orders', format: 'number' },
                { key: 'sessions', label: 'Sessions', format: 'number' },
                { key: 'pageviews', label: 'Page Views', format: 'number' },
                { key: 'conversionRate', label: 'Conversion Rate', format: 'percent' }
            ];
            
            // Filter to only show selected metrics (same as table)
            const checkboxes = document.querySelectorAll('#chartMetricOptions input[type="checkbox"]:checked');
            const currentSelectedMetrics = Array.from(checkboxes).map(cb => cb.id.replace('metric-', ''));
            const selectedMetrics = currentSelectedMetrics.length > 0 ? 
                allMetrics.filter(m => currentSelectedMetrics.includes(m.key)) : allMetrics;
            
            console.log('📊 Search Terms Export Debug:', {
                category: this.currentCategory,
                checkedBoxes: currentSelectedMetrics,
                selectedMetrics: selectedMetrics.map(m => m.label),
                totalMetrics: selectedMetrics.length,
                bucketsCount: buckets.labels.length,
                sortedDataCount: sortedData.length,
                firstItem: sortedData[0] ? sortedData[0].name : 'none'
            });
            
            // Headers: Search Term + Campaign Name + Metric + Total + Date columns
            headers = [nameHeader, 'Campaign Name', 'Metric', 'Total', ...buckets.labels];
            rows = [];
            
            // Build term -> campaign set for export (exclude DAILY TOTAL)
            const termToCampaigns = new Map();
            data.forEach(item => {
                if (String(item.name || '').includes('📊')) return;
                const term = (item.displayName || item.name) || '';
                const c = item.campaignName || item.campaign_name || '';
                if (!c) return;
                if (!termToCampaigns.has(term)) termToCampaigns.set(term, new Set());
                termToCampaigns.get(term).add(String(c));
            });

            // Create rows like table display: each search term has multiple rows (one per metric)
            orderedData.forEach(product => {
                selectedMetrics.forEach(metric => {
                    const nm = String(product.name || '');
                    const isTotal = nm.includes('📊') || nm.toLowerCase().includes('daily total');
                    if (metric.key === 'totalSales' && !isTotal) {
                        return; // suppress individual Total Sales rows in export
                    }
                    if (metric.key === 'sessions' && !isTotal) {
                        return; // suppress individual Sessions rows in export
                    }
                    if (metric.key === 'tcos' && !isTotal) {
                        return; // suppress individual TCOS rows in export
                    }
                    const campaignList = isTotal ? '—' : (termToCampaigns.get(product.name) ? Array.from(termToCampaigns.get(product.name)).sort().join(' | ') : '—');
                    const row = [product.name, campaignList, metric.label]; // term + campaigns + metric
                    // Add Total column
                    const sumByKeys = (getter) => buckets.keys.reduce((acc, k) => acc + Number(getter(k) || 0), 0);
                    let totalValue = 0;
                    if (metric.key === 'cpc') {
                        const totalSpend = sumByKeys(k => product.spendByKey[k]);
                        const totalClicks = sumByKeys(k => product.clicksByKey[k]);
                        totalValue = totalClicks > 0 ? totalSpend / totalClicks : 0;
                        row.push({ v: totalValue, format: 'currency' });
                    } else if (metric.format === 'currency') {
                        totalValue = sumByKeys(k => (product[`${metric.key}ByKey`][k] || 0));
                        row.push({ v: totalValue, format: 'currency' });
                    } else if (metric.format === 'percent') {
                        // For ACOS/TCOS totals in export, mirror table logic
                        if (metric.key === 'acos') {
                            const totalSpend = sumByKeys(k => product.spendByKey[k]);
                            const totalSales = sumByKeys(k => product.salesByKey[k]);
                            totalValue = totalSales > 0 ? (totalSpend / totalSales) * 100 : 0;
                        } else if (metric.key === 'tcos') {
                            const totalSpend = sumByKeys(k => product.spendByKey[k]);
                            const totalSalesForTcos = sumByKeys(k => product.totalSalesByKey[k]);
                            totalValue = totalSalesForTcos > 0 ? (totalSpend / totalSalesForTcos) * 100 : 0;
                        } else {
                            let acc = 0, count = 0;
                            buckets.keys.forEach(k => { acc += Number((product[`${metric.key}ByKey`][k]) || 0); count += 1; });
                            totalValue = count > 0 ? acc / count : 0;
                        }
                        row.push({ v: totalValue, format: 'percent' });
                    } else if (metric.format === 'decimal2') {
                        totalValue = sumByKeys(k => product[`${metric.key}ByKey`][k] || 0);
                        row.push({ v: totalValue, format: 'decimal2' });
                    } else {
                        totalValue = sumByKeys(k => product[`${metric.key}ByKey`][k] || 0);
                        row.push({ v: totalValue, format: 'number' });
                    }
                    // Date columns
                    buckets.keys.forEach(key => {
                        let keyed = product[`${metric.key}ByKey`] || {};
                        let val = keyed[key] || 0;
                        if (metric.key === 'totalSales') {
                            const nm2 = String(product.name || '');
                            const isTotal2 = nm2.includes('📊') || nm2.toLowerCase().includes('daily total');
                            if (!isTotal2) val = null;
                        }
                        if (val === null || val === undefined) {
                            row.push('—');
                        } else if (metric.format === 'currency') {
                            row.push({ v: val, format: 'currency' });
                        } else if (metric.format === 'percent') {
                            row.push({ v: val, format: 'percent' });
                        } else if (metric.format === 'decimal2') {
                            row.push({ v: val, format: 'decimal2' });
                        } else {
                            row.push({ v: val, format: 'number' });
                        }
                    });
                    rows.push(row);
                });
            });
            
            console.log('📊 Search Terms Export Result:', {
                headers: headers.slice(0, 5), // Show first 5 headers
                rowsCount: rows.length,
                sampleRow: rows[0] ? rows[0].slice(0, 5) : null // Show first 5 columns of first row
            });
            
        } else {
            // Campaigns tab - create date-based pivot structure (same as table display)
            const allMetrics = [
                { key: 'spend', label: 'Ad Spend', format: 'currency' },
                { key: 'cpc', label: 'AVG. CPC', format: 'currency' },
                { key: 'clicks', label: 'Ad Clicks', format: 'number' },
                { key: 'roas', label: 'ROAS', format: 'decimal2' },
                { key: 'acos', label: 'ACOS', format: 'percent' },
                { key: 'tcos', label: 'TCOS', format: 'percent' },
                { key: 'sales', label: 'Ad Sales', format: 'currency' },
                { key: 'totalSales', label: 'Total Sales', format: 'currency' },
                { key: 'orders', label: 'No of Orders', format: 'number' },
                { key: 'sessions', label: 'Sessions', format: 'number' },
                { key: 'pageviews', label: 'Page Views', format: 'number' },
                { key: 'conversionRate', label: 'Conversion Rate', format: 'percent' }
            ];

            // Filter to only show selected metrics (same as table)
            const checkboxes = document.querySelectorAll('#chartMetricOptions input[type="checkbox"]:checked');
            const currentSelectedMetrics = Array.from(checkboxes).map(cb => cb.id.replace('metric-', ''));
            const selectedMetrics = currentSelectedMetrics.length > 0 ? 
                allMetrics.filter(m => currentSelectedMetrics.includes(m.key)) : allMetrics;

            // Headers: Campaign Name + Metric + Total + Date columns
            headers = [nameHeader, 'Metric', 'Total', ...buckets.labels];
            rows = [];

            // Create rows like table display: each campaign has multiple rows (one per metric)
        grouped.forEach(product => {
                selectedMetrics.forEach(metric => {
                    const nm = String(product.name || '');
                    const isTotal = nm.includes('📊') || nm.toLowerCase().includes('daily total');
                    // Suppress Total Sales rows for individual campaigns in export
                    if (metric.key === 'totalSales' && !isTotal) {
                        return; // skip adding this metric row for this campaign
                    }
                    // Suppress Sessions rows for individual campaigns in export
                    if (metric.key === 'sessions' && !isTotal) {
                        return;
                    }
                    // Suppress TCOS rows for individual campaigns in export
                    if (metric.key === 'tcos' && !isTotal) {
                        return;
                    }
                    const row = [product.name, metric.label];
                    // Compute Total column to match table
                    const sumByKeys = (getter) => buckets.keys.reduce((acc, k) => acc + Number(getter(k) || 0), 0);
                    let totalValue = 0;
                    if (metric.key === 'cpc') {
                        const totalSpend = sumByKeys(k => product.spendByKey[k]);
                        const totalClicks = sumByKeys(k => product.clicksByKey[k]);
                        totalValue = totalClicks > 0 ? totalSpend / totalClicks : 0;
                        row.push({ v: totalValue, format: 'currency' });
                    } else if (metric.format === 'currency') {
                        totalValue = sumByKeys(k => (product[`${metric.key}ByKey`][k] || 0));
                        row.push({ v: totalValue, format: 'currency' });
                    } else if (metric.format === 'percent') {
                        // For ACOS/TCOS, calculate from total spend and sales to mirror table totals
                        if (metric.key === 'acos') {
                            const totalSpend = sumByKeys(k => product.spendByKey[k]);
                            const totalSales = sumByKeys(k => product.salesByKey[k]);
                            totalValue = totalSales > 0 ? (totalSpend / totalSales) * 100 : 0;
                        } else if (metric.key === 'tcos') {
                            const totalSpend = sumByKeys(k => product.spendByKey[k]);
                            const totalSalesForTcos = sumByKeys(k => product.totalSalesByKey[k]);
                            totalValue = totalSalesForTcos > 0 ? (totalSpend / totalSalesForTcos) * 100 : 0;
                        } else {
                            let acc = 0, count = 0;
                            buckets.keys.forEach(k => { acc += Number((product[`${metric.key}ByKey`][k]) || 0); count += 1; });
                            totalValue = count > 0 ? acc / count : 0;
                        }
                        row.push({ v: totalValue, format: 'percent' });
                    } else if (metric.format === 'decimal2') {
                        totalValue = sumByKeys(k => product[`${metric.key}ByKey`][k] || 0);
                        row.push({ v: totalValue, format: 'decimal2' });
                    } else {
                        totalValue = sumByKeys(k => product[`${metric.key}ByKey`][k] || 0);
                        row.push({ v: totalValue, format: 'number' });
                    }
                    buckets.keys.forEach(key => {
                        let keyed = product[`${metric.key}ByKey`] || {};
                        let val = keyed[key] || 0;
                        // For Campaigns export: Total Sales only on DAILY TOTAL; blank for individuals
                        if (metric.key === 'totalSales') {
                            const nm2 = String(product.name || '');
                            const isTotal2 = nm2.includes('📊') || nm2.toLowerCase().includes('daily total');
                            if (!isTotal2) val = null;
                        }
                        if (val === null || val === undefined) {
                            row.push('—');
                        } else if (metric.format === 'currency') {
                            row.push({ v: val, format: 'currency' });
                        } else if (metric.format === 'percent') {
                            row.push({ v: val, format: 'percent' });
                        } else if (metric.format === 'decimal2') {
                            row.push({ v: val, format: 'decimal2' });
                        } else {
                            row.push({ v: val, format: 'number' });
                        }
                    });
                    rows.push(row);
                });
            });
        }

        return { headers, rows };
    }

    generateExportFilename(extension) {
        // Base filename parts
        const parts = ['trend-pivot'];
        
        // Add category/tab name
        const categoryNames = {
            'products': 'products',
            'campaigns': 'campaigns',
            'search-terms': 'search-terms'
        };
        parts.push(categoryNames[this.currentCategory] || this.currentCategory);
        
        // Add date range if available
        if (this.currentDateRange && this.currentDateRange.start && this.currentDateRange.end) {
            const startStr = this.formatLocalDate(this.currentDateRange.start);
            const endStr = this.formatLocalDate(this.currentDateRange.end);
            parts.push(`${startStr}-to-${endStr}`);
        } else {
            // Use today's date as fallback
            parts.push(new Date().toISOString().split('T')[0]);
        }
        
        // Add time period
        if (this.currentTimePeriod) {
            parts.push(this.currentTimePeriod);
        }
        
        // Add selected names if any
        if (this.selectedNames && this.selectedNames.size > 0) {
            const nameList = Array.from(this.selectedNames).slice(0, 3).map(n => {
                // Clean name for filename (remove special chars, limit length)
                return n.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
            }).join('-');
            if (nameList) {
                parts.push(`names-${nameList}`);
                if (this.selectedNames.size > 3) {
                    parts.push(`+${this.selectedNames.size - 3}more`);
                }
            }
        }
        
        // Add selected campaigns if any (search-terms tab)
        if (this.currentCategory === 'search-terms' && this.selectedCampaigns && this.selectedCampaigns.size > 0) {
            const campaignList = Array.from(this.selectedCampaigns).slice(0, 2).map(c => {
                // Clean campaign name for filename
                return c.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
            }).join('-');
            if (campaignList) {
                parts.push(`campaigns-${campaignList}`);
                if (this.selectedCampaigns.size > 2) {
                    parts.push(`+${this.selectedCampaigns.size - 2}more`);
                }
            }
        }
        
        // Add timestamp for uniqueness (HH-MM-SS)
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
        parts.push(timeStr);
        
        // Join parts and add extension
        return parts.join('-') + extension;
    }

	downloadCSVPivot(headers, rows) {
		const flat = [headers.join(',')];
		rows.forEach(r => {
			const first = r[0]; // Always show the name, don't check for previous
			const line = [first, ...r.slice(1)].map(c => {
				if (typeof c === 'object') {
					if (c.format === 'currency') return `\"₹${(Number(c.v||0)).toFixed(2)}\"`;
					if (c.format === 'percent') return `\"${(Number(c.v||0)).toFixed(2)}%\"`;
					if (c.format === 'decimal2') return `\"${(Number(c.v||0)).toFixed(2)}\"`;
					return `\"${Number(c.v||0)}\"`;
				}
				return `\"${c}\"`;
			}).join(',');
			flat.push(line);
		});
		const blob = new Blob([flat.join('\n')], { type: 'text/csv' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = this.generateExportFilename('.csv');
		a.click();
		window.URL.revokeObjectURL(url);
	}

	downloadExcelPivot(headers, rows) {
        // Convert pivot headers/rows to array of objects
        const data = rows.map(r => Object.fromEntries(headers.map((h, i) => [h, typeof r[i] === 'object' ? r[i].v : r[i]])));
        const ws = XLSX.utils.json_to_sheet(data, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Trend Pivot');
        const ab = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
		a.download = this.generateExportFilename('.xlsx');
        a.click();
        window.URL.revokeObjectURL(url);
    }

    showChartNoData() {
        // Don't replace the canvas - just show empty chart
    }

    exitFullscreen() {
        const chartContainer = document.querySelector('.charts-section .chart-container');
        if (chartContainer) {
            chartContainer.classList.remove('chart-fullscreen-active');
            chartContainer.classList.remove('use-rotate-fallback');
            
            // Remove close button if it exists
            const closeBtn = chartContainer.querySelector('button[style*="position: absolute"]');
            if (closeBtn) {
                closeBtn.remove();
            }
            
            if (this.trendChart) { 
                setTimeout(() => {
                    this.trendChart.resize();
                    // Restore proper aspect ratio when exiting fullscreen
                    this.trendChart.options.maintainAspectRatio = false;
                    // Reset layout padding to normal
                    this.trendChart.options.layout = {
                        padding: {
                            top: 10,
                            right: 10,
                            bottom: 20,
                            left: 20
                        }
                    };
                    this.trendChart.update();
                }, 100); 
            }
            if (screen.orientation && screen.orientation.unlock) { 
                try { screen.orientation.unlock(); } catch(_) {} 
            }
        }
    }
}

// Initialize the Trend Reports when DOM is loaded
let trendReports;
document.addEventListener('DOMContentLoaded', function() {
    trendReports = new TrendReports();
});
