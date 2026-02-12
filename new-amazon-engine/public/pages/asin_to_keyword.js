/**
 * ASIN to Keyword - Helium 10 Cerebro Integration
 * Fully self-sufficient - auto-refreshes tokens using stored session cookies
 * Marketplace: Amazon India (A21TJRUUN4KGV)
 */

// API Configuration
const API_BASE = window.location.origin;

// State Management
let currentJobId = null;
let asins = [];
let isProcessing = false;

// DOM Elements
const elements = {
    // Status
    sessionIndicator: document.getElementById('sessionIndicator'),
    statusSection: document.getElementById('statusSection'),
    sessionStatusCard: document.getElementById('sessionStatusCard'),
    statusIcon: document.getElementById('statusIcon'),
    statusTitle: document.getElementById('statusTitle'),
    statusMessage: document.getElementById('statusMessage'),

    // Upload
    uploadSection: document.getElementById('uploadSection'),
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    uploadInfo: document.getElementById('uploadInfo'),
    fileName: document.getElementById('fileName'),
    asinCount: document.getElementById('asinCount'),
    clearFileBtn: document.getElementById('clearFileBtn'),

    // Processing
    processingSection: document.getElementById('processingSection'),
    startProcessingBtn: document.getElementById('startProcessingBtn'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    progressPercent: document.getElementById('progressPercent'),
    asinTableBody: document.getElementById('asinTableBody'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
    initializeEventListeners();
    await initializeSession();
});

function initializeEventListeners() {
    // File upload
    elements.uploadZone.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.clearFileBtn.addEventListener('click', clearFile);

    // Drag and drop
    elements.uploadZone.addEventListener('dragover', handleDragOver);
    elements.uploadZone.addEventListener('dragleave', handleDragLeave);
    elements.uploadZone.addEventListener('drop', handleDrop);

    // Processing controls
    elements.startProcessingBtn.addEventListener('click', startProcessing);
    elements.downloadAllBtn.addEventListener('click', downloadAll);
}

// ==================== SESSION MANAGEMENT (AUTO) ====================

async function initializeSession() {
    updateStatusCard('loading', 'Connecting to Helium 10...', 'Verifying session and tokens');

    try {
        // First check current status
        const statusResponse = await fetch(`${API_BASE}/api/h10/status`);
        const status = await statusResponse.json();

        if (status.hasSession) {
            // Session exists, check if tokens are valid
            if (status.isExpired) {
                // Tokens expired, try to refresh them
                updateStatusCard('loading', 'Tokens Expired', 'Attempting to refresh tokens...');

                const refreshResponse = await fetch(`${API_BASE}/api/h10/refresh`, { method: 'POST' });
                const refreshData = await refreshResponse.json();

                if (refreshData.success) {
                    updateStatusCard('connected', 'Ready', 'Connected to Helium 10 (Amazon India)');
                    updateSessionIndicator(true);
                } else {
                    // Cannot refresh - tokens need to be updated
                    const expiryMsg = status.tokenExpiredAt 
                        ? `Token expired on ${new Date(status.tokenExpiredAt).toLocaleString()}. `
                        : '';
                    updateStatusCard('error', 'Token Expired', 
                        expiryMsg + 'Please update H10_AUTHORIZATION_TOKEN and H10_PACVUE_TOKEN in backend/.env file or contact admin.');
                    updateSessionIndicator(false);
                }
            } else if (!status.hasValidTokens) {
                // Tokens exist but might be invalid, try to refresh
                updateStatusCard('loading', 'Refreshing tokens...', 'Session valid, refreshing API tokens');

                const refreshResponse = await fetch(`${API_BASE}/api/h10/refresh`, { method: 'POST' });
                const refreshData = await refreshResponse.json();

                if (refreshData.success) {
                    updateStatusCard('connected', 'Ready', 'Connected to Helium 10 (Amazon India)');
                    updateSessionIndicator(true);
                } else {
                    // Session might have expired (30 days)
                    updateStatusCard('error', 'Session Expired', 'Please contact admin to refresh session cookies');
                    updateSessionIndicator(false);
                }
            } else {
                // Everything is good
                const expiryMsg = status.tokenExpiry 
                    ? ` (expires ${new Date(status.tokenExpiry).toLocaleString()})`
                    : '';
                updateStatusCard('connected', 'Ready', `Connected to Helium 10 (Amazon India)${expiryMsg}`);
                updateSessionIndicator(true);
            }
        } else {
            // No session at all
            updateStatusCard('error', 'Not Configured', 'Session cookies not found. Please contact admin.');
            updateSessionIndicator(false);
        }
    } catch (error) {
        console.error('Session initialization error:', error);
        updateStatusCard('error', 'Connection Error', 'Could not connect to server');
        updateSessionIndicator(false);
    }
}

function updateStatusCard(state, title, message) {
    const card = elements.sessionStatusCard;
    const icon = elements.statusIcon;

    // Remove all state classes
    card.classList.remove('connected', 'disconnected', 'loading');

    // Set new state
    card.classList.add(state === 'connected' ? 'connected' : state === 'error' ? 'disconnected' : 'loading');

    // Update icon
    if (state === 'connected') {
        icon.textContent = 'check_circle';
    } else if (state === 'error') {
        icon.textContent = 'error';
    } else {
        icon.textContent = 'sync';
    }

    elements.statusTitle.textContent = title;
    elements.statusMessage.textContent = message;
}

function updateSessionIndicator(connected) {
    const dot = elements.sessionIndicator.querySelector('.session-dot');
    const text = elements.sessionIndicator.querySelector('span:last-child');

    if (connected) {
        dot.classList.remove('disconnected');
        dot.classList.add('connected');
        text.textContent = 'Connected';
    } else {
        dot.classList.remove('connected');
        dot.classList.add('disconnected');
        text.textContent = 'Disconnected';
    }
}

// ==================== FILE UPLOAD ====================

function handleDragOver(e) {
    e.preventDefault();
    elements.uploadZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

async function processFile(file) {
    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
        showToast('Please upload an Excel file (.xlsx or .xls)', 'error');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('file', file);

        showToast('Uploading file...', 'info');

        const response = await fetch(`${API_BASE}/api/cerebro/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            currentJobId = data.jobId;
            asins = data.asins;

            // Update UI
            elements.uploadInfo.style.display = 'flex';
            elements.fileName.textContent = file.name;
            elements.asinCount.textContent = `${data.totalAsins} ASINs found`;

            // Show processing section
            elements.processingSection.style.display = 'block';

            // Populate ASIN table
            populateAsinTable(data.asins);

            showToast(`Found ${data.totalAsins} ASINs to process`, 'success');
        } else {
            showToast(data.error || 'Failed to process file', 'error');
        }
    } catch (error) {
        console.error('Error uploading file:', error);
        showToast('Error uploading file', 'error');
    }
}

function clearFile() {
    currentJobId = null;
    asins = [];
    elements.fileInput.value = '';
    elements.uploadInfo.style.display = 'none';
    elements.processingSection.style.display = 'none';
    elements.asinTableBody.innerHTML = '';
    resetProgress();
}

// ==================== ASIN TABLE ====================

function populateAsinTable(asinList) {
    elements.asinTableBody.innerHTML = '';

    asinList.forEach((asin, index) => {
        const row = document.createElement('tr');
        row.id = `row-${asin}`;
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${asin}</strong></td>
            <td id="title-${asin}">—</td>
            <td id="keywords-${asin}">—</td>
            <td id="status-${asin}">
                <div class="status-badge pending">
                    <span class="material-icons">hourglass_empty</span>
                    Pending
                </div>
            </td>
            <td id="actions-${asin}">
                <div class="action-buttons">
                    <button class="btn-download" disabled onclick="downloadAsin('${asin}')">
                        <span class="material-icons">download</span>
                        Download
                    </button>
                </div>
            </td>
        `;
        elements.asinTableBody.appendChild(row);
    });
}

function updateAsinRow(asin, status) {
    const titleCell = document.getElementById(`title-${asin}`);
    const keywordsCell = document.getElementById(`keywords-${asin}`);
    const statusCell = document.getElementById(`status-${asin}`);
    const actionsCell = document.getElementById(`actions-${asin}`);

    if (!statusCell) return;

    // Update title
    if (status.productTitle) {
        titleCell.textContent = status.productTitle.substring(0, 50) + (status.productTitle.length > 50 ? '...' : '');
        titleCell.title = status.productTitle;
    }

    // Update keywords count
    if (status.totalKeywords > 0) {
        keywordsCell.textContent = status.totalKeywords.toLocaleString();
    }

    // Update status badge
    let statusHtml = '';
    switch (status.status) {
        case 'pending':
            statusHtml = `
                <div class="status-badge pending">
                    <span class="material-icons">hourglass_empty</span>
                    Pending
                </div>
            `;
            break;
        case 'processing':
            statusHtml = `
                <div class="status-badge processing">
                    <span class="material-icons">sync</span>
                    ${status.message || 'Processing...'}
                </div>
                <div class="progress-mini">
                    <div class="progress-mini-fill" style="width: ${status.progress}%"></div>
                </div>
            `;
            break;
        case 'completed':
            statusHtml = `
                <div class="status-badge completed">
                    <span class="material-icons">check_circle</span>
                    Completed
                </div>
            `;
            break;
        case 'error':
            const errorMsg = status.error || status.message || 'Error';
            statusHtml = `
                <div class="status-badge error" title="${errorMsg}">
                    <span class="material-icons">error</span>
                    Failed
                </div>
                ${errorMsg ? `<div class="error-message" style="margin-top: 4px; font-size: 11px; color: #d32f2f; max-width: 300px; word-wrap: break-word;">${errorMsg}</div>` : ''}
            `;
            break;
    }
    statusCell.innerHTML = statusHtml;

    // Update download button
    if (status.status === 'completed' && status.totalKeywords > 0) {
        actionsCell.innerHTML = `
            <div class="action-buttons">
                <button class="btn-download" onclick="downloadAsin('${asin}')">
                    <span class="material-icons">download</span>
                    Download
                </button>
            </div>
        `;
    }
}

// ==================== PROCESSING ====================

async function startProcessing() {
    if (!currentJobId || asins.length === 0) {
        showToast('Please upload a file first', 'error');
        return;
    }

    // Check session before starting
    const statusResponse = await fetch(`${API_BASE}/api/h10/status`);
    const status = await statusResponse.json();

    if (!status.hasSession) {
        showToast('Session not available. Please contact admin.', 'error');
        return;
    }

    isProcessing = true;
    elements.startProcessingBtn.disabled = true;
    elements.startProcessingBtn.innerHTML = '<span class="material-icons">sync</span> Processing...';

    showToast('Starting processing...', 'info');

    // Process ASINs one by one
    for (let i = 0; i < asins.length; i++) {
        if (!isProcessing) break;

        const asin = asins[i];
        await processAsin(asin, i);

        // Update overall progress
        updateOverallProgress(i + 1, asins.length);

        // Small delay between ASINs to avoid rate limiting
        if (i < asins.length - 1) {
            await sleep(1000);
        }
    }

    isProcessing = false;
    elements.startProcessingBtn.disabled = false;
    elements.startProcessingBtn.innerHTML = '<span class="material-icons">play_arrow</span> Start Processing';

    // Enable download all button
    elements.downloadAllBtn.disabled = false;

    showToast('Processing complete!', 'success');
}

async function processAsin(asin, index) {
    // Update row to show processing
    updateAsinRow(asin, {
        status: 'processing',
        progress: 10,
        message: 'Starting...'
    });

    try {
        const response = await fetch(`${API_BASE}/api/cerebro/job/${currentJobId}/process/${asin}?wait=5`, {
            method: 'POST'
        });

        // Check if response is ok before parsing JSON
        if (!response.ok) {
            // Try to get error message from response
            let errorMessage = `Server error: ${response.status} ${response.statusText}`;
            let shouldReload = false;
            
            try {
                const errorData = await response.json();
                
                // Extract error message from various possible locations
                // Backend returns: { success: false, error: userMessage, status: {...}, details: ... }
                errorMessage = errorData.error || 
                              errorData.message || 
                              (errorData.status && errorData.status.error) ||
                              (errorData.status && errorData.status.message) ||
                              errorData.details || 
                              errorMessage;
                
                // If error is still an object, try to stringify it for display
                if (typeof errorMessage === 'object' && errorMessage !== null) {
                    errorMessage = JSON.stringify(errorMessage);
                }
                
                // Ensure errorMessage is a string
                errorMessage = String(errorMessage || 'Unknown error');
                
                // Check if it's a job not found error (404)
                if (response.status === 404 && (errorData.code === 'JOB_NOT_FOUND' || errorMessage.includes('Job not found'))) {
                    errorMessage = 'Job expired (server was restarted). Please upload your file again.';
                    shouldReload = true;
                }
                
                console.error(`[${asin}] Backend error response:`, errorData);
                console.error(`[${asin}] Extracted error message:`, errorMessage);
            } catch (e) {
                // If JSON parsing fails, try to get text
                try {
                    const errorText = await response.text();
                    errorMessage = errorText || errorMessage;
                    console.error(`[${asin}] Backend error (text):`, errorText);
                } catch (textError) {
                    console.error(`[${asin}] Failed to parse error response:`, e, textError);
                }
            }
            
            // Update the row with error status
            updateAsinRow(asin, {
                status: 'error',
                error: errorMessage,
                message: errorMessage
            });
            
            // Show error toast for visibility
            if (errorMessage.includes('Not enough uses') || 
                errorMessage.includes('no remaining uses') || 
                errorMessage.includes('subscription') ||
                errorMessage.includes('payment method')) {
                showToast('⚠️ Helium 10 subscription issue: ' + errorMessage, 'error');
            } else {
                showToast(`Failed to process ${asin}: ${errorMessage}`, 'error');
            }
            
            // If job not found, show a toast suggesting to re-upload
            if (shouldReload) {
                showToast('Job expired. Please upload your file again.', 'error');
                // Optionally clear the current job
                currentJobId = null;
                asins = [];
            }
            
            return;
        }

        const data = await response.json();

        if (data.success) {
            updateAsinRow(asin, data.status);
        } else {
            const errorMsg = data.error || 'Unknown error';
            updateAsinRow(asin, {
                status: 'error',
                error: errorMsg,
                message: errorMsg
            });
            
            // Show error toast
            if (errorMsg.includes('Not enough uses') || errorMsg.includes('no remaining uses') || errorMsg.includes('subscription')) {
                showToast('⚠️ Helium 10 subscription issue: ' + errorMsg, 'error');
            } else {
                showToast(`Failed to process ${asin}: ${errorMsg}`, 'error');
            }
        }
    } catch (error) {
        console.error(`Error processing ${asin}:`, error);
        console.error('Full error object:', error);
        updateAsinRow(asin, {
            status: 'error',
            error: error.message || 'Network or parsing error',
            message: error.message || 'Network or parsing error'
        });
    }
}

function updateOverallProgress(completed, total) {
    const percent = Math.round((completed / total) * 100);
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = `${completed} / ${total} ASINs processed`;
    elements.progressPercent.textContent = `${percent}%`;
}

function resetProgress() {
    elements.progressFill.style.width = '0%';
    elements.progressText.textContent = '0 / 0 ASINs processed';
    elements.progressPercent.textContent = '0%';
    elements.downloadAllBtn.disabled = true;
}

// ==================== DOWNLOAD ====================

async function downloadAsin(asin) {
    if (!currentJobId) {
        showToast('No active job', 'error');
        return;
    }

    try {
        showToast(`Downloading keywords for ${asin}...`, 'info');

        const response = await fetch(`${API_BASE}/api/cerebro/job/${currentJobId}/download/${asin}`);

        if (!response.ok) {
            throw new Error('Download failed');
        }

        // Get the blob and create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `IN_AMAZON_cerebro_${asin}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Download started!', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showToast('Download failed', 'error');
    }
}

async function downloadAll() {
    if (!currentJobId) {
        showToast('No active job. Please upload your file again.', 'error');
        return;
    }

    try {
        showToast('Preparing download...', 'info');

        const response = await fetch(`${API_BASE}/api/cerebro/job/${currentJobId}/download-all`);
        
        if (!response.ok) {
            if (response.status === 404) {
                let errorMessage = 'Job not found';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    errorMessage = await response.text() || errorMessage;
                }
                showToast('Job expired (server was restarted). Please upload your file again.', 'error');
                // Clear the job
                currentJobId = null;
                asins = [];
                // Hide processing section and show upload section
                elements.processingSection.style.display = 'none';
                elements.uploadSection.style.display = 'block';
                return;
            }
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        // Get the blob and create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `IN_AMAZON_cerebro_all_keywords_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Download started!', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showToast(error.message || 'Download failed', 'error');
    }
}

// Make downloadAsin available globally
window.downloadAsin = downloadAsin;

// ==================== UTILITIES ====================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'error') icon = 'error';
    if (type === 'warning') icon = 'warning';

    toast.innerHTML = `
        <span class="material-icons">${icon}</span>
        <span>${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    // Keep subscription errors visible longer (8 seconds instead of 4)
    const duration = (type === 'error' && (message.includes('subscription') || message.includes('Not enough uses'))) ? 8000 : 4000;

    // Remove after duration
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
