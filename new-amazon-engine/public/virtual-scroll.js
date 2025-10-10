/**
 * Virtual Scrolling Implementation
 * Reduces DOM elements from 19,120 to ~50 for massive performance boost
 * Only renders visible rows in the table
 */

class VirtualScroll {
    constructor(options) {
        this.container = options.container; // Table tbody
        this.items = options.items || []; // All data items
        this.rowHeight = options.rowHeight || 53; // Height of each row
        this.renderRow = options.renderRow; // Function to render a row
        this.bufferSize = options.bufferSize || 5; // Extra rows to render above/below
        
        this.scrollContainer = this.container.closest('.table-wrapper');
        this.visibleStart = 0;
        this.visibleEnd = 0;
        
        this.init();
    }
    
    init() {
        // Create spacer elements
        this.topSpacer = document.createElement('tr');
        this.topSpacer.style.height = '0px';
        this.topSpacer.className = 'virtual-scroll-spacer';
        
        this.bottomSpacer = document.createElement('tr');
        this.bottomSpacer.style.height = '0px';
        this.bottomSpacer.className = 'virtual-scroll-spacer';
        
        // Add scroll listener
        this.scrollContainer.addEventListener('scroll', () => this.onScroll());
        
        // Initial render
        this.render();
    }
    
    setItems(items) {
        this.items = items;
        this.render();
    }
    
    onScroll() {
        requestAnimationFrame(() => this.render());
    }
    
    render() {
        if (!this.items || this.items.length === 0) {
            this.container.innerHTML = '<tr><td colspan="100" style="text-align:center;padding:40px;color:#6c757d;">No data available</td></tr>';
            return;
        }
        
        const scrollTop = this.scrollContainer.scrollTop;
        const containerHeight = this.scrollContainer.clientHeight;
        
        // Calculate visible range
        const start = Math.floor(scrollTop / this.rowHeight);
        const end = Math.ceil((scrollTop + containerHeight) / this.rowHeight);
        
        // Add buffer
        this.visibleStart = Math.max(0, start - this.bufferSize);
        this.visibleEnd = Math.min(this.items.length, end + this.bufferSize);
        
        // Calculate spacer heights
        const topHeight = this.visibleStart * this.rowHeight;
        const bottomHeight = (this.items.length - this.visibleEnd) * this.rowHeight;
        
        // Clear container
        this.container.innerHTML = '';
        
        // Add top spacer
        if (topHeight > 0) {
            this.topSpacer.style.height = `${topHeight}px`;
            this.container.appendChild(this.topSpacer);
        }
        
        // Render visible items
        for (let i = this.visibleStart; i < this.visibleEnd; i++) {
            const row = this.renderRow(this.items[i], i);
            this.container.appendChild(row);
        }
        
        // Add bottom spacer
        if (bottomHeight > 0) {
            this.bottomSpacer.style.height = `${bottomHeight}px`;
            this.container.appendChild(this.bottomSpacer);
        }
    }
    
    destroy() {
        this.scrollContainer.removeEventListener('scroll', this.onScroll);
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualScroll;
}

