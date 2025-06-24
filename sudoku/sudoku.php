<?php
/*
Plugin Name: Sudoku Backend Handler
Description: Handles Sudoku enrollment form submissions via REST API
Version: 1.0
Author: Hardik
*/

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class SudokuBackendHandler {
    
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        add_action('sudoku_send_enrollment_email_hook', array($this, 'send_enrollment_email'), 10, 2);
        register_activation_hook(__FILE__, array($this, 'create_table'));
    }

    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        register_rest_route('sudoku/v1', '/enroll', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_enrollment'),
            'permission_callback' => '__return_true', // Allow public access
            'args' => array(
                'name' => array(
                    'required' => true,
                    'type' => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'email' => array(
                    'required' => true,
                    'type' => 'string',
                    'validate_callback' => array($this, 'validate_email'),
                    'sanitize_callback' => 'sanitize_email',
                ),
                'phone' => array(
                    'required' => false,
                    'type' => 'string',
                    'sanitize_callback' => array($this, 'standardize_phone_number'),
                ),
            ),
        ));
    }

    /**
     * Handle enrollment form submission
     */
    public function handle_enrollment($request) {
        $name = $request->get_param('name');
        $email = $request->get_param('email');
        $phone = $request->get_param('phone');

        if (empty($name) || empty($email)) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Missing name or email'
            ), 400);
        }

        global $wpdb;
        $table_name = $wpdb->prefix . 'enrollments';

        // Ensure table exists
        $this->create_table();

        $inserted = $wpdb->insert($table_name, array(
            'name'  => $name,
            'email' => $email,
            'phone' => $phone,
        ));

        if ($inserted !== false) {
            // Schedule the email to be sent in the background using WP-Cron
            wp_schedule_single_event(time() + 5, 'sudoku_send_enrollment_email_hook', array($name, $email));

            return new WP_REST_Response(array(
                'success' => true,
                'message' => 'Successfully enrolled! A confirmation email will be sent to you shortly.',
                'email_status' => 'scheduled',
                'email_message' => 'Email scheduled for background delivery via external API.',
            ), 200);

        } else {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Failed to enroll due to a database error. Please try again.',
                'email_status' => false,
                'email_message' => 'Email not scheduled due to insertion failure.',
                'debug_info' => 'Database insertion failed: ' . (isset($wpdb->last_error) ? $wpdb->last_error : 'Unknown DB error')
            ), 500);
        }
    }

    /**
     * Send enrollment email via external API
     */
    public function send_enrollment_email($name, $email) {
        $api_endpoint = 'https://kaizen-pq9y.onrender.com/api/email/send-email';
        $email_subject = 'Welcome to Sudoku Enrollments!';

        $body = json_encode(array(
            'email'   => $email,
            'name'    => $name,
            'template' => 'welcome',
            'subject' => $email_subject,
        ));

        $args = array(
            'body'        => $body,
            'headers'     => array(
                'Content-Type' => 'application/json',
            ),
            'method'      => 'POST',
            'timeout'     => 45,
            'sslverify'   => true,
            'data_format' => 'body',
        );

        $response = wp_remote_post($api_endpoint, $args);

        if (is_wp_error($response)) {
            $error_message = $response->get_error_message();
            error_log("Failed to send email via Express server. WP_Error: {$error_message}");
        } else {
            $response_code = wp_remote_retrieve_response_code($response);
            $response_body = wp_remote_retrieve_body($response);

            if ($response_code === 200) {
                error_log("Email API call successful for {$email}. Response: {$response_body}");
            } else {
                error_log("Email API call failed for {$email}. Status: {$response_code}, Body: {$response_body}");
            }
        }
    }

    /**
     * Create enrollments table
     */
    public function create_table() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'enrollments';

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "
            CREATE TABLE IF NOT EXISTS $table_name (
                id INT NOT NULL AUTO_INCREMENT,
                name VARCHAR(100),
                email VARCHAR(100) UNIQUE,
                phone VARCHAR(15) UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            ) $charset_collate;
        ";
        dbDelta($sql);
    }

    /**
     * Validate email
     */
    public function validate_email($email) {
        return is_email($email);
    }

    /**
     * Standardize phone number
     */
    public function standardize_phone_number($phone) {
        if (empty($phone)) return '';
        
        $phone = preg_replace('/\D+/', '', $phone);
        if (preg_match('/^(91|0091)/', $phone)) {
            $phone = preg_replace('/^(91|0091)/', '', $phone);
        }
        $phone = ltrim($phone, '0');
        if (strlen($phone) > 10) {
            $phone = substr($phone, -10);
        }
        return preg_match('/^\d{10}$/', $phone) ? $phone : '';
    }

    /**
     * Get REST API endpoint URL for frontend use
     */
    public static function get_api_endpoint() {
        return rest_url('sudoku/v1/enroll');
    }
}

// Initialize the plugin
new SudokuBackendHandler();

// Helper function to get API endpoint (can be used in frontend)
function sudoku_get_api_endpoint() {
    return SudokuBackendHandler::get_api_endpoint();
}

// Add shortcode to output API endpoint URL for frontend use
add_shortcode('sudoku_api_endpoint', function() {
    return SudokuBackendHandler::get_api_endpoint();
});

// Add action to output API endpoint in head for JavaScript access
add_action('wp_head', function() {
    if (is_page()) { // Only on pages, adjust condition as needed
        echo '<script>window.sudokuApiEndpoint = "' . esc_js(SudokuBackendHandler::get_api_endpoint()) . '";</script>';
    }
});