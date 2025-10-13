/**
 * Configuration file for Amazon Analytics Dashboard
 * 
 * This file centralizes all API endpoints and configuration
 * to avoid hardcoding URLs throughout the application
 */

window.APP_CONFIG = {
    // API Configuration
    api: {
        // Development API base URL
        development: 'http://localhost:5000',
        
        // Production API base URL (set this when deploying)
        production: '', // Will be set via environment variables
        
        // Get current API base URL based on environment
        getBaseUrl: function() {
            // Check if we're in development (localhost)
            if (window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('localhost')) {
                return this.development;
            }
            
            // Check if we're on a specific port (development)
            if (window.location.port === '5500' || 
                window.location.port === '3000' ||
                window.location.port === '8080') {
                return this.development;
            }
            
            // Production - use same origin or configured production URL
            return this.production || window.location.origin;
        }
    },
    
    // Feature flags
    features: {
        debugMode: false, // Set to true for development
        enablePerformanceMonitoring: true,
        enableErrorTracking: true
    },
    
    // Default settings
    defaults: {
        dateRange: {
            start: '2024-01-01',
            end: new Date().toISOString().split('T')[0]
        },
        pagination: {
            pageSize: 50,
            maxPageSize: 1000
        },
        cache: {
            ttl: 5 * 60 * 1000 // 5 minutes in milliseconds
        }
    },
    
    // External services
    external: {
        // Google Fonts
        googleFonts: 'https://fonts.googleapis.com',
        
        // Chart.js CDN
        chartJs: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
        
        // SheetJS CDN
        sheetJs: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    }
};

/**
 * Utility function to get API endpoint
 * @param {string} endpoint - API endpoint path (e.g., '/api/analytics')
 * @returns {string} Full API URL
 */
window.getApiUrl = function(endpoint) {
    const baseUrl = window.APP_CONFIG.api.getBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    
    if (baseUrl === window.location.origin) {
        // Same origin - use relative URL
        return cleanEndpoint;
    } else {
        // Different origin - use full URL
        return baseUrl + cleanEndpoint;
    }
};

/**
 * Utility function to check if we're in development mode
 * @returns {boolean} True if in development mode
 */
window.isDevelopment = function() {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('localhost');
};

// Export for Node.js environments (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.APP_CONFIG;
}
