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
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.sortColumn = 'date';
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
                    
                    // Update chart
                    this.updateChart();
                });
            });
        }

        // Chart metric selector
        document.getElementById('chartMetric').addEventListener('change', (e) => {
            this.updateChart();
        });

        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterData(e.target.value);
        });

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

    confirmDateRange() {
        if (this.currentDateRange.start && this.currentDateRange.end) {
            this.updateDateDisplay();
            this.updateChart();
            document.getElementById('datePickerDropdown').style.display = 'none';
            document.getElementById('dateFilter').classList.remove('open');
        }
    }

    switchCategory(category) {
        this.currentCategory = category;
        
        // Update active tab
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        this.updateChart();
    }

    loadInitialData() {
        // Generate sample data for demonstration
        this.generateSampleData();
        this.updateChart();
        this.renderTable();
    }

    generateSampleData() {
        const categories = ['products', 'campaigns', 'search-terms'];
        const metrics = ['spend', 'cpc', 'sales', 'acos', 'tcos', 'ctr', 'sessions', 'pageviews', 'conversionRate'];
        const data = [];
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90); // Last 90 days
        
        for (let i = 0; i < 90; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            categories.forEach(category => {
                const baseValue = Math.random() * 1000 + 100;
                const record = {
                    date: date.toISOString().split('T')[0],
                    category: category,
                    spend: Math.round(baseValue * (0.5 + Math.random())),
                    cpc: Math.round((baseValue * 0.1) * (0.8 + Math.random() * 0.4) * 100) / 100,
                    sales: Math.round(baseValue * (1.5 + Math.random())),
                    acos: Math.round((baseValue * 0.3) * (0.7 + Math.random() * 0.6) * 100) / 100,
                    tcos: Math.round((baseValue * 0.4) * (0.6 + Math.random() * 0.8) * 100) / 100,
                    ctr: Math.round((baseValue * 0.2) * (0.5 + Math.random() * 1.0) * 100) / 100,
                    sessions: Math.round(baseValue * (2 + Math.random() * 3)),
                    pageviews: Math.round(baseValue * (3 + Math.random() * 5)),
                    conversionRate: Math.round((2 + Math.random() * 8) * 100) / 100 // 2-10% conversion rate
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

    updateChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;
        
        const selectedMetric = document.getElementById('chartMetric').value;
        const categoryData = this.currentData.filter(item => item.category === this.currentCategory);
        const dateFilteredData = this.filterDataByDateRange(categoryData);
        
        // Group data by time period
        const groupedData = this.groupDataByTimePeriod(dateFilteredData, selectedMetric);
        
        // Debug: Log data points
        console.log(`Chart data for ${selectedMetric}:`, {
            totalDataPoints: dateFilteredData.length,
            groupedLabels: groupedData.labels.length,
            groupedValues: groupedData.values.length,
            labels: groupedData.labels,
            values: groupedData.values
        });
        
        // Ensure we have at least 2 data points for a line
        if (groupedData.labels.length < 2) {
            console.warn('Not enough data points for line chart, using all data');
            const allData = this.currentData.filter(item => item.category === this.currentCategory);
            const allGroupedData = this.groupDataByTimePeriod(allData, selectedMetric);
            groupedData.labels = allGroupedData.labels;
            groupedData.values = allGroupedData.values;
        }
        
        if (this.trendChart) {
            this.trendChart.destroy();
        }
        
        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: groupedData.labels,
                datasets: [{
                    label: selectedMetric.toUpperCase(),
                    data: groupedData.values,
                    borderColor: '#39c258',
                    backgroundColor: 'rgba(57, 194, 88, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#39c258',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    showLine: true,
                    spanGaps: true,
                    stepped: false
                }]
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
                    key = item.date;
                    break;
                case 'weekly':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    key = weekStart.toISOString().split('T')[0];
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
                const date = new Date(key);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
        });
        
        const values = sortedKeys.map(key => {
            const group = groups[key];
            if (metric === 'spend' || metric === 'sales' || metric === 'sessions' || metric === 'pageviews') {
                return group.values.reduce((sum, val) => sum + val, 0);
            } else {
                return group.values.reduce((sum, val) => sum + val, 0) / group.count;
            }
        });
        
        return { labels, values };
    }

    filterData(searchTerm) {
        if (!searchTerm) {
            this.filteredData = [...this.currentData];
        } else {
            this.filteredData = this.currentData.filter(item => 
                item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.date.includes(searchTerm)
            );
        }
        
        this.currentPage = 1;
        this.renderTable();
    }

    sortTable(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        this.filteredData.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];
            
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            if (this.sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
        
        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('tableBody');
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredData.slice(startIndex, endIndex);
        
        tbody.innerHTML = pageData.map(item => `
            <tr>
                <td>${new Date(item.date).toLocaleDateString()}</td>
                <td>${item.category.replace('-', ' ').toUpperCase()}</td>
                <td>₹${this.formatNumber(item.spend)}</td>
                <td>₹${item.cpc}</td>
                <td>₹${this.formatNumber(item.sales)}</td>
                <td>${item.acos}%</td>
                <td>${item.tcos}%</td>
                <td>₹${item.ctr}</td>
                <td>${this.formatNumber(item.sessions)}</td>
                <td>${this.formatNumber(item.pageviews)}</td>
                <td>${item.conversionRate}%</td>
            </tr>
        `).join('');
        
        this.updatePagination();
        this.updateResultsCount();
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        const currentPageElement = document.getElementById('currentPage');
        const totalPagesElement = document.getElementById('totalPages');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        currentPageElement.textContent = this.currentPage;
        totalPagesElement.textContent = totalPages;
        
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages;
    }

    updateResultsCount() {
        const resultsCount = document.getElementById('resultsCount');
        resultsCount.textContent = `${this.filteredData.length} results`;
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTable();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
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
