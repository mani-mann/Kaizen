<?php
/**
 * Plugin Name: Custom Resource Manager
 * Version: 1.0
 * Author: hardik
 */

add_action('admin_menu', function () {
    add_menu_page(
        'Resource Manager',
        'Resource Manager',
        'manage_options',
        'custom-resource-manager',
        'srm_render_admin_page',
        'dashicons-download',
        100
    );
    
    // Add submenu for managing resources
    add_submenu_page(
        'custom-resource-manager',
        'Previous Resources',
        'Previous Resources',
        'manage_options',
        'manage-resources',
        'srm_render_manage_page'
    );
});

function srm_render_admin_page() {
    ?>
    <div class="wrap">
        <h1>Upload and Generate Resource Link</h1>
        <form id="srm-form">
            <label for="srm-title">Resource Title:</label><br>
            <input type="text" id="srm-title" name="title"><br><br>

            <label>Choose File from Media Library:</label><br>
            <button type="button" id="srm-select-media" class="button">Select File</button>
            <input type="hidden" id="srm-media-url" name="media_url">
            <p id="srm-media-preview"></p>

            <br>
            <label>Choose Thumbnail Image:</label><br>
            <button type="button" id="srm-select-thumbnail" class="button">Select Thumbnail</button>
            <input type="hidden" id="srm-thumbnail-url" name="thumbnail_url">
            <p id="srm-thumbnail-preview"></p>

            <br>
            <button type="submit" class="button button-primary">Generate Link</button>
        </form>

        <div id="srm-result" style="margin-top: 20px;"></div>
    </div>
    <?php
    wp_enqueue_media();
    wp_enqueue_script('srm-admin-js', plugin_dir_url(__FILE__) . 'admin-ui.js', ['jquery'], filemtime(plugin_dir_path(__FILE__) . 'admin-ui.js'), true);
}

function srm_render_manage_page() {
    ?>
    <div class="wrap">
        <h1>Manage Resources</h1>
        
        <div style="margin: 20px 0;">
            <input type="text" id="srm-search" placeholder="Search by title or URL..." style="width: 300px; padding: 5px;">
        </div>
        
        <table class="wp-list-table widefat fixed striped" id="srm-resources-table">
            <thead>
                <tr>
                    <th>Resource ID</th>
                    <th>Title</th>
                    <th>Media URL</th>
                    <th>Thumbnail</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="srm-table-body">
                <!-- Content will be loaded via AJAX -->
            </tbody>
        </table>
        
        <div id="srm-no-results" style="display: none; padding: 20px; text-align: center;">
            No resources found.
        </div>
    </div>
    
    <!-- Delete Confirmation Modal -->
    <div id="srm-delete-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 5px; max-width: 400px;">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this resource? This action cannot be undone.</p>
            <p><strong>Title:</strong> <span id="delete-resource-title"></span></p>
            <div style="text-align: right; margin-top: 20px;">
                <button type="button" class="button" id="cancel-delete">Cancel</button>
                <button type="button" class="button button-primary" id="confirm-delete" style="margin-left: 10px;">Delete</button>
            </div>
        </div>
    </div>
    <?php
    
    wp_enqueue_script('srm-manage-js', plugin_dir_url(__FILE__) . 'manage-resources.js', ['jquery'], filemtime(plugin_dir_path(__FILE__) . 'manage-resources.js'), true);
    wp_localize_script('srm-manage-js', 'srm_ajax', array(
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('srm_nonce')
    ));
}

add_action('wp_ajax_srm_save_resource', function () {
    $new_resource = $_POST['resource'];

    $resources = get_option('srm_resources', []);
    $resources = array_merge($resources, $new_resource);

    update_option('srm_resources', $resources);

    wp_send_json_success('Resource saved');
});

// AJAX handler to get all resources
add_action('wp_ajax_srm_get_resources', function () {
    check_ajax_referer('srm_nonce', 'nonce');
    
    $resources = get_option('srm_resources', []);
    wp_send_json_success($resources);
});

// AJAX handler to delete a resource
add_action('wp_ajax_srm_delete_resource', function () {
    check_ajax_referer('srm_nonce', 'nonce');
    
    $resource_id = sanitize_text_field($_POST['resource_id']);
    
    $resources = get_option('srm_resources', []);
    
    if (isset($resources[$resource_id])) {
        unset($resources[$resource_id]);
        update_option('srm_resources', $resources);
        wp_send_json_success('Resource deleted successfully');
    } else {
        wp_send_json_error('Resource not found');
    }
});

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_script(
        'srm-public-handler',
        plugin_dir_url(__FILE__) . 'public-resource-handler.js',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'public-resource-handler.js'),
        true
    );
    wp_enqueue_style(
        'srm-public-style',
        plugin_dir_url(__FILE__) . 'public-style.css'
    );
});
?>