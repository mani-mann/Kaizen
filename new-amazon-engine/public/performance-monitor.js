/**
 * Performance Monitoring Utility
 * Tracks and reports performance metrics
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.marks = {};
    }
    
    // Start timing a operation
    start(label) {
        this.marks[label] = performance.now();
    }
    
    // End timing and log duration
    end(label) {
        if (!this.marks[label]) {
            console.warn(`No start mark found for: ${label}`);
            return;
        }
        
        const duration = performance.now() - this.marks[label];
        this.metrics[label] = duration;
        
        if (duration > 100) {
            console.warn(`⚠️ Slow operation: ${label} took ${duration.toFixed(2)}ms`);
        } else {
            console.log(`✅ ${label}: ${duration.toFixed(2)}ms`);
        }
        
        delete this.marks[label];
        return duration;
    }
    
    // Measure async operations
    async measure(label, asyncFn) {
        this.start(label);
        try {
            const result = await asyncFn();
            this.end(label);
            return result;
        } catch (error) {
            this.end(label);
            throw error;
        }
    }
    
    // Get performance metrics
    getMetrics() {
        // Get navigation timing
        if (performance.timing) {
            const timing = performance.timing;
            return {
                ...this.metrics,
                domLoading: timing.domLoading - timing.navigationStart,
                domInteractive: timing.domInteractive - timing.navigationStart,
                domComplete: timing.domComplete - timing.navigationStart,
                loadComplete: timing.loadEventEnd - timing.navigationStart
            };
        }
        return this.metrics;
    }
    
    // Report performance to console
    report() {
        console.group('📊 Performance Metrics');
        const metrics = this.getMetrics();
        
        Object.entries(metrics).forEach(([key, value]) => {
            const formatted = typeof value === 'number' ? `${value.toFixed(2)}ms` : value;
            console.log(`${key}: ${formatted}`);
        });
        
        console.groupEnd();
    }
    
    // Monitor Core Web Vitals
    monitorWebVitals() {
        // Largest Contentful Paint (LCP)
        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    console.log(`📊 LCP: ${lastEntry.renderTime || lastEntry.loadTime}ms`);
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                
                // First Input Delay (FID)
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry) => {
                        console.log(`📊 FID: ${entry.processingStart - entry.startTime}ms`);
                    });
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
                
                // Cumulative Layout Shift (CLS)
                let clsScore = 0;
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            clsScore += entry.value;
                            console.log(`📊 CLS: ${clsScore.toFixed(4)}`);
                        }
                    }
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
                
            } catch (e) {
                console.warn('Performance monitoring not fully supported', e);
            }
        }
    }
}

// Create global instance
window.perfMonitor = new PerformanceMonitor();

// Auto-monitor web vitals in production
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.perfMonitor.monitorWebVitals();
    });
} else {
    window.perfMonitor.monitorWebVitals();
}

