jQuery(document).ready(function($) {
    let allResources = {};
    let resourceToDelete = '';

    // Load resources on page load
    loadResources();

    // Search functionality
    $('#srm-search').on('keyup', function() {
        const searchTerm = $(this).val().toLowerCase();
        filterResources(searchTerm);
    });

    // Delete modal handlers
    $('#cancel-delete').on('click', function() {
        $('#srm-delete-modal').hide();
        resourceToDelete = '';
    });

    $('#confirm-delete').on('click', function() {
        if (resourceToDelete) {
            deleteResource(resourceToDelete);
        }
    });

    // Close modal when clicking outside
    $('#srm-delete-modal').on('click', function(e) {
        if (e.target === this) {
            $(this).hide();
            resourceToDelete = '';
        }
    });

    function loadResources() {
        $.post(srm_ajax.ajax_url, {
            action: 'srm_get_resources',
            nonce: srm_ajax.nonce
        }, function(response) {
            if (response.success) {
                allResources = response.data;
                displayResources(allResources);
            } else {
                console.error('Failed to load resources');
            }
        });
    }

    function displayResources(resources) {
        const tbody = $('#srm-table-body');
        tbody.empty();

        if (Object.keys(resources).length === 0) {
            $('#srm-no-results').show();
            $('#srm-resources-table').hide();
            return;
        }

        $('#srm-no-results').hide();
        $('#srm-resources-table').show();

        $.each(resources, function(resourceId, data) {
            const thumbnailHtml = data.thumbnail_url ? 
                `<img src="${data.thumbnail_url}" style="max-width: 50px; max-height: 50px; border: 1px solid #ddd;">` : 
                'No thumbnail';
            
            // Generate the HTML code for this resource
            const htmlCode = data.thumbnail_url ? 
                `<div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin: 20px 0;">
    <img src="${data.thumbnail_url}" alt="${data.title}" data-resource-id="${resourceId}" class="resource-thumbnail resource-link" style="max-width: 300px; max-height: 300px; border: 3px solid #0073aa; border-radius: 10px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
    <div class="resource-caption resource-link" data-resource-id="${resourceId}" style="margin-top: 15px; font-size: 18px; color: #333; cursor: pointer; text-decoration: underline;">
        Click here to get the resource
    </div>
</div>` :
                `<a href="#" data-resource-id="${resourceId}" class="resource-link">${data.title}</a>`;
                
            const row = `
                <tr data-resource-id="${resourceId}">
                    <td style="font-family: monospace; font-size: 12px;">${resourceId}</td>
                    <td>${escapeHtml(data.title)}</td>
                    <td>
                        <a href="${data.media_url}" target="_blank" style="word-break: break-all;">
                            ${escapeHtml(data.media_url)}
                        </a>
                    </td>
                    <td>${thumbnailHtml}</td>
                    <td>
                        <button type="button" class="button button-small copy-html" 
                                style="margin-right: 5px;">
                            Copy HTML
                        </button>
                        <button type="button" class="button button-small delete-resource" 
                                data-resource-id="${resourceId}" 
                                data-title="${escapeHtml(data.title)}">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
            tbody.append(row);
            
            // Store the HTML code separately for this row
            tbody.find(`tr[data-resource-id="${resourceId}"]`).data('html-code', htmlCode);
        });

        // Attach delete handlers
        $('.delete-resource').on('click', function() {
            resourceToDelete = $(this).data('resource-id');
            const title = $(this).data('title');
            
            $('#delete-resource-title').text(title);
            $('#srm-delete-modal').show();
        });

        // Attach copy HTML handlers
        $('.copy-html').on('click', function() {
            const row = $(this).closest('tr');
            const htmlCode = row.data('html-code');
            
            // Create temporary textarea to copy text
            const tempTextarea = $('<textarea>');
            $('body').append(tempTextarea);
            tempTextarea.val(htmlCode).select();
            
            try {
                document.execCommand('copy');
                
                // Show success feedback
                const button = $(this);
                const originalText = button.text();
                button.text('Copied!').prop('disabled', true);
                
                setTimeout(function() {
                    button.text(originalText).prop('disabled', false);
                }, 1500);
                
            } catch (err) {
                // Fallback: show the HTML in an alert for manual copy
                alert('Copy failed. Please copy this HTML manually:\n\n' + htmlCode);
            }
            
            tempTextarea.remove();
        });
    }

    function filterResources(searchTerm) {
        if (!searchTerm) {
            displayResources(allResources);
            return;
        }

        const filtered = {};
        $.each(allResources, function(resourceId, data) {
            const titleMatch = data.title.toLowerCase().includes(searchTerm);
            const urlMatch = data.media_url.toLowerCase().includes(searchTerm);
            
            if (titleMatch || urlMatch) {
                filtered[resourceId] = data;
            }
        });

        displayResources(filtered);
    }

    function deleteResource(resourceId) {
        $.post(srm_ajax.ajax_url, {
            action: 'srm_delete_resource',
            resource_id: resourceId,
            nonce: srm_ajax.nonce
        }, function(response) {
            if (response.success) {
                // Remove from local data
                delete allResources[resourceId];
                
                // Refresh display
                const searchTerm = $('#srm-search').val().toLowerCase();
                filterResources(searchTerm);
                
                // Hide modal
                $('#srm-delete-modal').hide();
                resourceToDelete = '';
                
                // Show success message
                $('<div class="notice notice-success is-dismissible"><p>Resource deleted successfully!</p></div>')
                    .insertAfter('.wrap h1')
                    .delay(3000)
                    .fadeOut();
            } else {
                alert('Error deleting resource: ' + (response.data || 'Unknown error'));
            }
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});