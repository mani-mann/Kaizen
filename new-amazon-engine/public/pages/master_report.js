// Master Report JavaScript
// This page is independent of the global date range.
// If it's opened with ?start=...&end=... in the URL, strip those params
// and ensure the sidebar link for this page never carries date query params.
(function cleanMasterReportUrl() {
    try {
        const path = window.location.pathname || '';
        const isMasterPage =
            path.endsWith('/pages/master_report.html') ||
            path.endsWith('master_report.html');
        
        if (!isMasterPage) return;

        // 1) Clean the current URL so it is always /pages/master_report.html
        if (window.location.search) {
            const cleanUrl = path + window.location.hash;
            // Use a real redirect once so the address bar definitely loses ?start=&end=
            // and any bookmarked URL becomes the clean version for this page.
            window.location.replace(cleanUrl);
            return;
        }

        // 2) Clean this page's nav link so future clicks don't add ?start=&end=
        try {
            const links = document.querySelectorAll('.nav-item[href]');
            links.forEach(link => {
                const href = link.getAttribute('href') || '';
                if (href.includes('master_report.html')) {
                    link.setAttribute('href', 'master_report.html');
                }
            });
        } catch (_) {
            // ignore DOM issues
        }
    } catch (e) {
        console.warn('MasterReport: unable to clean URL params', e);
    }
})();

class MasterReport {
    constructor() {
        this.data = null;
        this.filteredData = [];
        this.sortConfig = { key: null, direction: 'asc' };
        this.searchTerm = '';
        this.selectedAsin = '';
        this.showOnlyWithCompetitors = false;
        this.isMobile = window.innerWidth <= 768;
        
        this.init();
    }
    
    async init() {
        this.bindEvents();
        this.handleResize();
        await this.loadData();
        this.updateLastUpdateTime();
    }
    
    bindEvents() {
        // Search input
        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.trim();
                this.updateSearchClearButton();
                this.debounceSearch();
            });
        }
        
        if (searchClear) {
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                this.searchTerm = '';
                this.updateSearchClearButton();
                this.filterAndRender();
            });
        }
        
        // ASIN filter
        const asinFilter = document.getElementById('asinFilter');
        if (asinFilter) {
            asinFilter.addEventListener('change', (e) => {
                this.selectedAsin = e.target.value;
                this.filterAndRender();
            });
        }
        
        // Competitor toggle
        const competitorToggle = document.getElementById('competitorToggle');
        if (competitorToggle) {
            competitorToggle.addEventListener('change', (e) => {
                this.showOnlyWithCompetitors = e.target.checked;
                this.filterAndRender();
            });
        }
        
        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadData(true);
            });
        }
        
        // Mobile menu
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebar = document.getElementById('sidebar');
        if (mobileMenuBtn && sidebar) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }
        
        // Detail drawer
        const drawerClose = document.getElementById('drawerClose');
        const drawerOverlay = document.getElementById('drawerOverlay');
        
        if (drawerClose) {
            drawerClose.addEventListener('click', () => this.closeDetailDrawer());
        }
        
        if (drawerOverlay) {
            drawerOverlay.addEventListener('click', () => this.closeDetailDrawer());
        }
        
        // Image modal
        const imageModalClose = document.getElementById('imageModalClose');
        const imageModalOverlay = document.getElementById('imageModalOverlay');
        
        if (imageModalClose) {
            imageModalClose.addEventListener('click', () => this.closeImageModal());
        }
        
        if (imageModalOverlay) {
            imageModalOverlay.addEventListener('click', () => this.closeImageModal());
        }
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDetailDrawer();
                this.closeImageModal();
            }
        });
    }
    
    // Debounced search to avoid too many filter calls
    debounceSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.filterAndRender();
        }, 300);
    }
    
    updateSearchClearButton() {
        const searchClear = document.getElementById('searchClear');
        if (searchClear) {
            searchClear.style.display = this.searchTerm ? 'block' : 'none';
        }
    }
    
    async loadData(forceRefresh = false) {
        try {
            this.showLoadingState();
            
            // Check if we have cached data and it's not a force refresh
            if (this.data && !forceRefresh) {
                this.hideLoadingState();
                this.filterAndRender();
                return;
            }
            
            const response = await fetch('../data/master_report_data.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.data = await response.json();
            this.populateAsinFilter();
            this.updateProductCount();
            this.filterAndRender();
            this.hideLoadingState();
            
        } catch (error) {
            console.error('Error loading master report data:', error);
            this.showErrorState();
        }
    }
    
    populateAsinFilter() {
        const asinFilter = document.getElementById('asinFilter');
        if (!asinFilter || !this.data) return;
        
        // Clear existing options except "All ASINs"
        asinFilter.innerHTML = '<option value="">All ASINs</option>';
        
        // Add options for each ASIN
        this.data.products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.parentAsin;
            option.textContent = product.parentAsin;
            asinFilter.appendChild(option);
        });
    }
    
    updateProductCount() {
        const totalProductCount = document.getElementById('totalProductCount');
        if (totalProductCount && this.data) {
            totalProductCount.textContent = this.data.totalProducts;
        }
    }
    
    filterAndRender() {
        if (!this.data) return;
        
        this.filteredData = this.data.products.filter(product => {
            // Search filter
            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                const matchesSku = product.sku.toLowerCase().includes(searchLower);
                const matchesTitle = product.productTitle.toLowerCase().includes(searchLower);
                const matchesAsin = product.parentAsin.toLowerCase().includes(searchLower);
                
                if (!matchesSku && !matchesTitle && !matchesAsin) {
                    return false;
                }
            }
            
            // ASIN filter
            if (this.selectedAsin && product.parentAsin !== this.selectedAsin) {
                return false;
            }
            
            // Competitor filter
            if (this.showOnlyWithCompetitors && (!product.competitorAsins || product.competitorAsins.length === 0)) {
                return false;
            }
            
            return true;
        });
        
        // Apply sorting
        if (this.sortConfig.key) {
            this.filteredData.sort((a, b) => {
                let aVal = a[this.sortConfig.key];
                let bVal = b[this.sortConfig.key];
                
                // Handle string comparison
                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }
                
                if (aVal < bVal) return this.sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return this.sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        
        this.render();
    }
    
    render() {
        if (this.filteredData.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.hideEmptyState();
        
        if (this.isMobile) {
            this.renderMobileCards();
        } else {
            this.renderDesktopTable();
        }
    }
    
    renderDesktopTable() {
        const desktopTable = document.getElementById('desktopTable');
        const mobileCards = document.getElementById('mobileCards');
        const tableBody = document.getElementById('tableBody');
        
        if (!desktopTable || !tableBody) return;
        
        desktopTable.style.display = 'block';
        mobileCards.style.display = 'none';
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Render rows
        this.filteredData.forEach(product => {
            const row = this.createTableRow(product);
            tableBody.appendChild(row);
        });
        
        // Update sort icons
        this.updateSortIcons();
    }
    
    createTableRow(product) {
        const row = document.createElement('tr');
        row.addEventListener('click', () => this.openDetailDrawer(product));
        
        // Image cell
        const imageCell = document.createElement('td');
        imageCell.className = 'col-image';
        
        // Try to load the image, with fallback to placeholder
        this.createProductImage(product, imageCell);
        
        // SKU cell
        const skuCell = document.createElement('td');
        skuCell.className = 'col-sku';
        const skuLink = document.createElement('a');
        skuLink.href = `https://www.amazon.in/dp/${product.parentAsin}`;
        skuLink.target = '_blank';
        skuLink.className = 'sku-link';
        skuLink.textContent = product.sku;
        skuLink.title = product.sku;
        skuLink.addEventListener('click', (e) => e.stopPropagation());
        skuCell.appendChild(skuLink);
        
        // Title cell
        const titleCell = document.createElement('td');
        titleCell.className = 'col-title';
        const titleDiv = document.createElement('div');
        titleDiv.className = 'product-title';
        titleDiv.textContent = product.productTitle;
        titleDiv.title = product.productTitle;
        titleCell.appendChild(titleDiv);
        
        // ASIN cell
        const asinCell = document.createElement('td');
        asinCell.className = 'col-asin';
        const asinLink = document.createElement('a');
        asinLink.href = `https://www.amazon.in/dp/${product.parentAsin}`;
        asinLink.target = '_blank';
        asinLink.className = 'asin-link';
        asinLink.textContent = product.parentAsin;
        asinLink.title = product.parentAsin;
        asinLink.addEventListener('click', (e) => e.stopPropagation());
        asinCell.appendChild(asinLink);
        
        // Competitors cell
        const competitorsCell = document.createElement('td');
        competitorsCell.className = 'col-competitors';
        const competitorsDiv = this.createCompetitorList(product.competitorAsins);
        competitorsCell.appendChild(competitorsDiv);
        
        row.appendChild(imageCell);
        row.appendChild(skuCell);
        row.appendChild(titleCell);
        row.appendChild(asinCell);
        row.appendChild(competitorsCell);
        
        return row;
    }
    
    createProductImage(product, container) {
        // If we have an image URL, try to load it
        if (product.imageUrl) {
            const img = document.createElement('img');
            img.className = 'product-image';
            img.src = product.imageUrl;
            img.alt = product.productTitle;
            img.title = product.productTitle;
            img.loading = 'lazy';
            
            // On error, fallback to placeholder
            img.addEventListener('error', () => {
                img.remove();
                this.showImagePlaceholder(container, product.parentAsin);
            });
            
            // On click, open image modal
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openImageModal(product.imageUrl, product.productTitle);
            });
            
            container.appendChild(img);
        } else {
            // No image URL, show placeholder
            this.showImagePlaceholder(container, product.parentAsin);
        }
    }
    
    showImagePlaceholder(container, asin) {
        // Create a styled placeholder with ASIN text
        const placeholder = document.createElement('div');
        placeholder.className = 'product-image-placeholder';
        placeholder.innerHTML = `<span class="asin-text">${asin}</span>`;
        placeholder.title = `Image not available for ${asin}`;
        placeholder.addEventListener('click', (e) => {
            e.stopPropagation();
            // Open Amazon product page
            window.open(`https://www.amazon.in/dp/${asin}`, '_blank');
        });
        container.appendChild(placeholder);
    }
    
    createCompetitorList(competitorAsins) {
        const container = document.createElement('div');
        container.className = 'competitor-list';
        
        if (!competitorAsins || competitorAsins.length === 0) {
            const noCompetitors = document.createElement('span');
            noCompetitors.textContent = 'No competitors';
            noCompetitors.style.color = 'var(--text-secondary)';
            noCompetitors.style.fontSize = '12px';
            noCompetitors.style.fontStyle = 'italic';
            container.appendChild(noCompetitors);
            return container;
        }
        
        // Create comma-separated list
        const competitorText = document.createElement('span');
        competitorText.className = 'competitor-text';
        competitorText.textContent = competitorAsins.join(', ');
        competitorText.title = `${competitorAsins.length} competitors: ${competitorAsins.join(', ')}`;
        container.appendChild(competitorText);
        
        return container;
    }
    
    createCompetitorChips(competitorAsins) {
        const container = document.createElement('div');
        container.className = 'competitor-chips';
        
        if (!competitorAsins || competitorAsins.length === 0) {
            const noCompetitors = document.createElement('span');
            noCompetitors.textContent = 'No competitors found';
            noCompetitors.style.color = 'var(--text-secondary)';
            container.appendChild(noCompetitors);
            return container;
        }
        
        // Create clickable chips for detail drawer
        competitorAsins.forEach(asin => {
            const chip = document.createElement('a');
            chip.href = `https://www.amazon.in/dp/${asin}`;
            chip.target = '_blank';
            chip.className = 'competitor-chip';
            chip.textContent = asin;
            chip.title = `View ${asin} on Amazon`;
            container.appendChild(chip);
        });
        
        return container;
    }
    
    renderMobileCards() {
        const desktopTable = document.getElementById('desktopTable');
        const mobileCards = document.getElementById('mobileCards');
        
        if (!mobileCards) return;
        
        desktopTable.style.display = 'none';
        mobileCards.style.display = 'block';
        
        // Clear existing cards
        mobileCards.innerHTML = '';
        
        // Render cards
        this.filteredData.forEach(product => {
            const card = this.createMobileCard(product);
            mobileCards.appendChild(card);
        });
    }
    
    createMobileCard(product) {
        const card = document.createElement('div');
        card.className = 'mobile-card';
        card.addEventListener('click', () => this.openDetailDrawer(product));
        
        const competitorCount = product.competitorAsins ? product.competitorAsins.length : 0;
        
        // Create card structure
        const cardHeader = document.createElement('div');
        cardHeader.className = 'mobile-card-header';
        
        // Image container
        const imageContainer = document.createElement('div');
        imageContainer.className = 'mobile-card-image-container';
        
        // Create image or placeholder for mobile
        if (product.imageUrl) {
            const img = document.createElement('img');
            img.className = 'mobile-card-image';
            img.src = product.imageUrl;
            img.alt = product.productTitle;
            img.loading = 'lazy';
            img.addEventListener('error', () => {
                img.remove();
                const placeholder = document.createElement('div');
                placeholder.className = 'mobile-card-image-placeholder';
                placeholder.innerHTML = `<span class="asin-text">${product.parentAsin}</span>`;
                imageContainer.appendChild(placeholder);
            });
            imageContainer.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'mobile-card-image-placeholder';
            placeholder.innerHTML = `<span class="asin-text">${product.parentAsin}</span>`;
            imageContainer.appendChild(placeholder);
        }
        
        // Info container
        const infoContainer = document.createElement('div');
        infoContainer.className = 'mobile-card-info';
        infoContainer.innerHTML = `
            <div class="mobile-card-title">${this.escapeHtml(product.productTitle)}</div>
            <div class="mobile-card-meta">
                <div class="mobile-card-sku">SKU: ${this.escapeHtml(product.sku)}</div>
                <div class="mobile-card-asin">ASIN: ${this.escapeHtml(product.parentAsin)}</div>
            </div>
        `;
        
        cardHeader.appendChild(imageContainer);
        cardHeader.appendChild(infoContainer);
        
        // Footer
        const cardFooter = document.createElement('div');
        cardFooter.className = 'mobile-card-footer';
        cardFooter.innerHTML = `
            <div class="mobile-card-competitors">${competitorCount} competitor${competitorCount !== 1 ? 's' : ''}</div>
            <span class="material-icons mobile-card-arrow">chevron_right</span>
        `;
        
        card.appendChild(cardHeader);
        card.appendChild(cardFooter);
        
        return card;
    }
    
    handleSort(sortKey) {
        if (this.sortConfig.key === sortKey) {
            this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortConfig.key = sortKey;
            this.sortConfig.direction = 'asc';
        }
        
        this.filterAndRender();
    }
    
    updateSortIcons() {
        const sortableHeaders = document.querySelectorAll('.sortable');
        sortableHeaders.forEach(header => {
            const sortIcon = header.querySelector('.sort-icon');
            if (!sortIcon) return;
            
            header.classList.remove('asc', 'desc');
            
            if (header.dataset.sort === this.sortConfig.key) {
                header.classList.add(this.sortConfig.direction);
                sortIcon.textContent = this.sortConfig.direction === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
            } else {
                sortIcon.textContent = 'keyboard_arrow_down';
            }
            
            // Add click handler if not already added
            if (!header.hasAttribute('data-sort-bound')) {
                header.addEventListener('click', () => this.handleSort(header.dataset.sort));
                header.setAttribute('data-sort-bound', 'true');
            }
        });
    }
    
    openDetailDrawer(product) {
        const drawer = document.getElementById('detailDrawer');
        const drawerTitle = document.getElementById('drawerTitle');
        const drawerImage = document.getElementById('drawerImage');
        const drawerSku = document.getElementById('drawerSku');
        const drawerAsin = document.getElementById('drawerAsin');
        const drawerProductTitle = document.getElementById('drawerProductTitle');
        const drawerCompetitors = document.getElementById('drawerCompetitors');
        
        if (!drawer) return;
        
        // Update drawer content
        if (drawerTitle) drawerTitle.textContent = 'Product Details';
        if (drawerImage) {
            const drawerImageContainer = drawerImage.parentElement;
            
            // Clear the image container
            drawerImageContainer.innerHTML = '';
            
            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'product-image-wrapper';
            
            // Create image or placeholder
            if (product.imageUrl) {
                const img = document.createElement('img');
                img.id = 'drawerImage';
                img.className = 'product-image-large';
                img.src = product.imageUrl;
                img.alt = product.productTitle;
                img.title = product.productTitle;
                img.addEventListener('error', () => {
                    img.remove();
                    const placeholder = document.createElement('div');
                    placeholder.className = 'drawer-image-placeholder';
                    placeholder.innerHTML = `<span class="asin-text-large">${product.parentAsin}</span>`;
                    placeholder.title = `Click to view ${product.parentAsin} on Amazon`;
                    placeholder.addEventListener('click', () => {
                        window.open(`https://www.amazon.in/dp/${product.parentAsin}`, '_blank');
                    });
                    wrapper.appendChild(placeholder);
                });
                img.addEventListener('click', () => {
                    this.openImageModal(product.imageUrl, product.productTitle);
                });
                wrapper.appendChild(img);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'drawer-image-placeholder';
                placeholder.innerHTML = `<span class="asin-text-large">${product.parentAsin}</span>`;
                placeholder.title = `Click to view ${product.parentAsin} on Amazon`;
                placeholder.addEventListener('click', () => {
                    window.open(`https://www.amazon.in/dp/${product.parentAsin}`, '_blank');
                });
                wrapper.appendChild(placeholder);
            }
            
            drawerImageContainer.appendChild(wrapper);
        }
        if (drawerSku) drawerSku.textContent = product.sku;
        if (drawerAsin) {
            drawerAsin.innerHTML = `<a href="https://www.amazon.in/dp/${product.parentAsin}" target="_blank" class="asin-link">${product.parentAsin}</a>`;
        }
        if (drawerProductTitle) drawerProductTitle.textContent = product.productTitle;
        
        // Update competitors
        if (drawerCompetitors) {
            drawerCompetitors.innerHTML = '';
            const competitorChips = this.createCompetitorChips(product.competitorAsins);
            drawerCompetitors.appendChild(competitorChips);
        }
        
        // Show drawer
        drawer.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    
    closeDetailDrawer() {
        const drawer = document.getElementById('detailDrawer');
        if (drawer) {
            drawer.classList.remove('open');
            document.body.style.overflow = '';
        }
    }
    
    openImageModal(imageUrl, altText) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        
        if (!modal || !modalImage) return;
        
        modalImage.src = imageUrl;
        modalImage.alt = altText;
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    
    closeImageModal() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }
    
    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;
        
        // Re-render if mobile state changed
        if (wasMobile !== this.isMobile && this.filteredData.length > 0) {
            this.render();
        }
    }
    
    showLoadingState() {
        const loadingState = document.getElementById('loadingState');
        const errorState = document.getElementById('errorState');
        const emptyState = document.getElementById('emptyState');
        const desktopTable = document.getElementById('desktopTable');
        const mobileCards = document.getElementById('mobileCards');
        
        if (loadingState) loadingState.style.display = 'flex';
        if (errorState) errorState.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        if (desktopTable) desktopTable.style.display = 'none';
        if (mobileCards) mobileCards.style.display = 'none';
    }
    
    hideLoadingState() {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) loadingState.style.display = 'none';
    }
    
    showErrorState() {
        const loadingState = document.getElementById('loadingState');
        const errorState = document.getElementById('errorState');
        const emptyState = document.getElementById('emptyState');
        const desktopTable = document.getElementById('desktopTable');
        const mobileCards = document.getElementById('mobileCards');
        
        if (loadingState) loadingState.style.display = 'none';
        if (errorState) errorState.style.display = 'flex';
        if (emptyState) emptyState.style.display = 'none';
        if (desktopTable) desktopTable.style.display = 'none';
        if (mobileCards) mobileCards.style.display = 'none';
    }
    
    showEmptyState() {
        const loadingState = document.getElementById('loadingState');
        const errorState = document.getElementById('errorState');
        const emptyState = document.getElementById('emptyState');
        const desktopTable = document.getElementById('desktopTable');
        const mobileCards = document.getElementById('mobileCards');
        
        if (loadingState) loadingState.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        if (desktopTable) desktopTable.style.display = 'none';
        if (mobileCards) mobileCards.style.display = 'none';
    }
    
    hideEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = 'none';
    }
    
    updateLastUpdateTime() {
        const lastUpdateTime = document.getElementById('lastUpdateTime');
        if (lastUpdateTime && this.data) {
            const updateDate = new Date(this.data.lastUpdated);
            const now = new Date();
            const diffInMinutes = Math.floor((now - updateDate) / (1000 * 60));
            
            let timeText;
            if (diffInMinutes < 1) {
                timeText = 'just now';
            } else if (diffInMinutes < 60) {
                timeText = `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
            } else {
                const diffInHours = Math.floor(diffInMinutes / 60);
                timeText = `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
            }
            
            lastUpdateTime.textContent = timeText;
        }
    }
    
    // Utility method to escape HTML
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
}

// Initialize the Master Report when DOM is loaded
let masterReport;

document.addEventListener('DOMContentLoaded', function() {
    masterReport = new MasterReport();
});

// Export for global access
window.MasterReport = MasterReport;
