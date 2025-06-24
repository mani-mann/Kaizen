jQuery(document).ready(function($) {
    let file_frame;
    let thumbnail_frame;
    let selectedFileName = '';

    // Media file selector
    $('#srm-select-media').on('click', function(e) {
        e.preventDefault();

        // If already open
        if (file_frame) {
            file_frame.open();
            return;
        }

        // Create the media frame.
        file_frame = wp.media({
            title: 'Select a File',
            button: {
                text: 'Use this file'
            },
            multiple: false
        });

        file_frame.on('select', function() {
            const attachment = file_frame.state().get('selection').first().toJSON();
            $('#srm-media-url').val(attachment.url);
            $('#srm-media-preview').text('Selected: ' + attachment.url);

            // Extract and store the file name (without extension optional)
            selectedFileName = attachment.title || attachment.filename;
        });

        file_frame.open();
    });

    // Thumbnail selector
    $('#srm-select-thumbnail').on('click', function(e) {
        e.preventDefault();

        // If already open
        if (thumbnail_frame) {
            thumbnail_frame.open();
            return;
        }

        // Create the media frame for thumbnail
        thumbnail_frame = wp.media({
            title: 'Select Thumbnail Image',
            button: {
                text: 'Use this image'
            },
            multiple: false,
            library: {
                type: 'image'
            }
        });

        thumbnail_frame.on('select', function() {
            const attachment = thumbnail_frame.state().get('selection').first().toJSON();
            $('#srm-thumbnail-url').val(attachment.url);
            
            // Show thumbnail preview
            $('#srm-thumbnail-preview').html(`
                <strong>Selected thumbnail:</strong><br>
                <img src="${attachment.url}" style="max-width: 150px; max-height: 150px; border: 1px solid #ddd; padding: 5px;">
            `);
        });

        thumbnail_frame.open();
    });

    $('#srm-form').on('submit', function(e) {
        e.preventDefault();

        let title = $('#srm-title').val().trim();
        const mediaUrl = $('#srm-media-url').val();
        const thumbnailUrl = $('#srm-thumbnail-url').val();

        if (!mediaUrl) {
            alert('Please select a media file.');
            return;
        }

        if (!thumbnailUrl) {
            alert('Please select a thumbnail image.');
            return;
        }

        // If title is empty, use file name
        if (!title && selectedFileName) {
            title = selectedFileName;
        }

        const resourceId = 'res_' + Math.random().toString(36).substring(2, 10);
        const stored = {
            [resourceId]: {
                title: title,
                media_url: mediaUrl,
                thumbnail_url: thumbnailUrl
            }
        };

        // Generate the HTML snippet
        const htmlSnippet = `<div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin: 20px 0;">
    <img src="${thumbnailUrl}" alt="${title}" data-resource-id="${resourceId}" class="resource-thumbnail resource-link" style="max-width: 300px; max-height: 300px; border: 3px solid #0073aa; border-radius: 10px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
    <div class="resource-caption resource-link" data-resource-id="${resourceId}" style="margin-top: 15px; font-size: 18px; color: #333; cursor: pointer; text-decoration: underline;">
        Click here to get the resource
    </div>
</div>`;

        // Save to DB via Ajax
        $.post(ajaxurl, {
            action: 'srm_save_resource',
            resource: stored
        }, function(response) {
            $('#srm-result').html(`
                <strong>Generated HTML Code:</strong><br>
                <textarea readonly style="width: 100%; height: 150px; font-family: monospace; font-size: 12px;" onclick="this.select();">${htmlSnippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                <br><br>
                <strong>Preview:</strong><br>
                <div style="border: 1px solid #ddd; padding: 20px; background: #f9f9f9;">
                    ${htmlSnippet}
                </div>
            `);
        });
    });
});