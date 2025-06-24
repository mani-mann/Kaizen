<?php
/**
 * Plugin Name: Custom Auth Plugin with JWT
 * Description: Provides login and signup endpoints and returns JWT token.
 * Version: 1.0
 * Author: hardik
 */

require_once(ABSPATH . 'wp-includes/pluggable.php');
require_once(plugin_dir_path(__FILE__) . 'vendor/autoload.php');

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

// Define your secret key (MAKE SURE TO CHANGE THIS TO A STRONG, UNIQUE KEY!)
// For production, consider storing this in wp-config.php or environment variables
if (!defined('CUSTOM_AUTH_JWT_SECRET_KEY')) {
    define('CUSTOM_AUTH_JWT_SECRET_KEY', 'your'); // CHANGE THIS!!!
}

// Enable WP_DEBUG_LOG in wp-config.php for error_log to write to debug.log
// define( 'WP_DEBUG', true );
// define( 'WP_DEBUG_LOG', true );
// define( 'WP_DEBUG_DISPLAY', false );
// @ini_set( 'display_errors', 0 );


add_action('rest_api_init', function () {
    error_log('Custom Auth Plugin: Registering REST routes.');

    register_rest_route('custom-auth/v1', '/register', [
        'methods' => 'POST',
        'callback' => 'custom_register_user',
        'permission_callback' => '__return_true'
    ]);
    error_log('Custom Auth Plugin: /register route registered.');

    register_rest_route('custom-auth/v1', '/login', [
        'methods' => 'POST',
        'callback' => 'custom_login_user',
        'permission_callback' => '__return_true'
    ]);
    error_log('Custom Auth Plugin: /login route registered.');

    register_rest_route('custom-auth/v1', '/profile', [
        'methods' => ['GET', 'POST'], // Allow GET to fetch data, POST to update
        'callback' => 'custom_user_profile',
        'permission_callback' => 'custom_auth_permission_check' // Custom permission check for authenticated users
    ]);
    error_log('Custom Auth Plugin: /profile route registered.');
        register_rest_route('custom-auth/v1', '/resource-click', [
        'methods' => 'POST',
        'callback' => 'handle_secure_resource_click',
        'permission_callback' => 'custom_auth_permission_check'
    ]);
    error_log('Custom Auth Plugin: /resource-click route registered.');
    register_rest_route('custom-auth/v1', '/google-login', [
        'methods' => 'POST',
        'callback' => 'handle_google_login',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('custom-auth/v1', '/verify-token', [
        'methods' => 'POST',
        'callback' => 'handle_verify_token',
        'permission_callback' => 'custom_auth_permission_check',
    ]);
});

/**
 * Custom permission callback to check for authenticated users via JWT.
 */
function custom_auth_permission_check(WP_REST_Request $request) {
    error_log('Custom Auth Plugin: custom_auth_permission_check called.');
    $auth_header = $request->get_header('Authorization');

    if (empty($auth_header)) {
        error_log('Custom Auth Plugin: Authorization header not found.');
        return new WP_Error('jwt_auth_failed', 'Authorization header not found.', ['status' => 401]);
    }

    $header_parts = explode(' ', $auth_header, 2);
    if (count($header_parts) < 2) {
        error_log('Custom Auth Plugin: Invalid Authorization header format - missing space or token.');
        return new WP_Error('jwt_auth_failed', 'Invalid Authorization header format.', ['status' => 401]);
    }

    list($type, $token) = $header_parts;

    if ('Bearer' !== $type || empty($token)) {
        error_log('Custom Auth Plugin: Invalid Authorization header type or empty token. Type: ' . $type . ', Token empty: ' . (empty($token) ? 'true' : 'false'));
        return new WP_Error('jwt_auth_failed', 'Invalid Authorization header format.', ['status' => 401]);
    }

    $secret_key = CUSTOM_AUTH_JWT_SECRET_KEY;
    error_log('Custom Auth Plugin: Attempting to decode token. Token: ' . $token . ', Secret Key Length: ' . strlen($secret_key));

    try {
        $decoded = JWT::decode($token, new Key("your", 'HS256'));
        $request->set_param('user_id', $decoded->user_id);
        $request->set_param('user_email', $decoded->user_email);
        error_log('Custom Auth Plugin: Token decoded successfully for user ID: ' . $decoded->user_id);
        return true;
    } catch (Exception $e) {
        error_log('Custom Auth Plugin ERROR: Token decoding failed: ' . $e->getMessage());
        return new WP_Error('jwt_auth_invalid_token', 'Invalid token: ' . $e->getMessage(), ['status' => 403]);
    }
}


function custom_register_user($request) {
    error_log('Custom Auth Plugin: custom_register_user called.');
    $params = $request->get_json_params();

    if (!isset($params['password']) || !isset($params['email']) || !isset($params['name']) || !isset($params['childsname']) || !isset($params['city']) || !isset($params['phone']) || !isset($params['avatar']) || !isset($params['child_dob'])) {
        error_log('Custom Auth Plugin: Missing parameters for registration.');
        return new WP_Error('missing_parameters', 'All required fields must be provided.', ['status' => 400]);
    }

    $password = sanitize_text_field($params['password']);
    $email = sanitize_email($params['email']);
    $name = sanitize_text_field($params['name']);
    $childsname = sanitize_text_field($params['childsname']);
    $city = sanitize_text_field($params['city']);
    $phone = sanitize_text_field($params['phone']);
    $avatar = esc_url_raw($params['avatar']);
    $child_dob = sanitize_text_field($params['child_dob']);

    error_log('Custom Auth Plugin: Registering user with email: ' . $email);

    // Check if email already exists
    if (email_exists($email)) {
        error_log('Custom Auth Plugin: Registration failed, email already exists: ' . $email);
        return new WP_Error('user_exists', 'Email already exists.', ['status' => 400]);
    }

    // Generate a unique username from email
    $username_base = sanitize_user(current(explode('@', $email)));
    $username = $username_base;
    $i = 0;
    while (username_exists($username)) {
        $username = $username_base . '_' . wp_generate_password(4, false);
        $i++;
        if ($i > 10) {
             error_log('Custom Auth Plugin: Failed to generate unique username after 10 attempts.');
             return new WP_Error('username_generation_failed', 'Could not generate a unique username.', ['status' => 500]);
        }
    }
    error_log('Custom Auth Plugin: Generated username: ' . $username);


    $user_id = wp_create_user($username, $password, $email);
    if (is_wp_error($user_id)) {
        error_log('Custom Auth Plugin ERROR: User creation failed for email ' . $email . ': ' . $user_id->get_error_message());
        return new WP_Error('user_creation_failed', 'User creation failed: ' . $user_id->get_error_message(), ['status' => 500]);
    }
    error_log('Custom Auth Plugin: User created successfully with ID: ' . $user_id);


    update_user_meta($user_id, 'name', $name);
    update_user_meta($user_id, 'childsname', $childsname);
    update_user_meta($user_id, 'city', $city);
    update_user_meta($user_id, 'phone', $phone);
    update_user_meta($user_id, 'avatar', $avatar);
    update_user_meta($user_id, 'child_dob', $child_dob);
    error_log('Custom Auth Plugin: User meta updated for user ID: ' . $user_id);


    // Generate JWT token after registration
    $secret_key = CUSTOM_AUTH_JWT_SECRET_KEY;
    $payload = [
        'iss' => get_site_url(),
        'iat' => time(),
        // 'exp' => time() + (DAY_IN_SECONDS * 7),
        'user_id' => $user_id,
        'user_email' => $email,
    ];
    $jwt = JWT::encode($payload, $secret_key, 'HS256');
    error_log('Custom Auth Plugin: JWT token generated for user ID ' . $user_id . '. Token: ' . substr($jwt, 0, 30) . '...');


    return new WP_REST_Response([
        'message' => 'User registered successfully',
        'token' => $jwt
    ], 200);
}

function custom_login_user($request) {
    error_log('Custom Auth Plugin: custom_login_user called.');
    $params = $request->get_json_params();

    if (!isset($params['email']) || !isset($params['password'])) {
        error_log('Custom Auth Plugin: Missing email or password for login.');
        return new WP_Error('missing_credentials', 'Email and password are required.', ['status' => 400]);
    }

    $email = sanitize_user($params['email']);
    $password = $params['password'];

    error_log('Custom Auth Plugin: Attempting login for email: ' . $email);

    // Get user by email as wp_authenticate primarily uses username
    $user = get_user_by('email', $email);

    if (!$user) {
        error_log('Custom Auth Plugin: Login failed, user not found for email: ' . $email);
        return new WP_Error('invalid_credentials', 'Invalid email or password.', ['status' => 403]);
    }

    // Authenticate using the username
    $authenticated_user = wp_authenticate($user->user_login, $password);

    if (is_wp_error($authenticated_user)) {
        error_log('Custom Auth Plugin ERROR: Authentication failed for user ' . $user->user_login . ': ' . $authenticated_user->get_error_message());
        return new WP_Error('invalid_credentials', 'Invalid email or password.', ['status' => 403]);
    }
    error_log('Custom Auth Plugin: User authenticated successfully: ' . $authenticated_user->user_login . ' (ID: ' . $authenticated_user->ID . ')');

    $secret_key = CUSTOM_AUTH_JWT_SECRET_KEY;
    $payload = [
        'iss' => get_site_url(),
        'iat' => time(),
        // 'exp' => time() + 70000000,
        'user_email' => $email,
        'user_id' => $authenticated_user->ID,
    ];
    $jwt = JWT::encode($payload, $secret_key, 'HS256');
    error_log('Custom Auth Plugin: JWT token generated for login for user ID ' . $authenticated_user->ID . '. Token: ' . $jwt);


    return new WP_REST_Response([
        'token' => $jwt,
        'user_id' => $authenticated_user->ID,
        'email' => $authenticated_user->user_email,
    ], 200);
}


/**
 * Handles fetching and updating user profile data.
 */
function custom_user_profile(WP_REST_Request $request) {
    error_log('Custom Auth Plugin: custom_user_profile called.');
    $user_id = $request->get_param('user_id'); // User ID obtained from JWT in permission_callback

    if (!$user_id) {
        error_log('Custom Auth Plugin ERROR: Profile access failed, user ID not found in token payload.');
        return new WP_Error('unauthorized', 'User ID not found in token.', ['status' => 401]);
    }
    error_log('Custom Auth Plugin: Profile access for user ID: ' . $user_id);

    $user = get_user_by('ID', $user_id);

    if (!$user) {
        error_log('Custom Auth Plugin ERROR: Profile access failed, user with ID ' . $user_id . ' not found in WordPress.');
        return new WP_Error('user_not_found', 'User not found.', ['status' => 404]);
    }

    if ($request->get_method() === 'GET') {
        error_log('Custom Auth Plugin: Fetching profile data for user ID: ' . $user_id);
        // Fetch user data
        $profile_data = [
            'email' => $user->user_email,
            'name' => get_user_meta($user_id, 'name', true),
            'childsname' => get_user_meta($user_id, 'childsname', true),
            'child_dob' => get_user_meta($user_id, 'child_dob', true),
            'city' => get_user_meta($user_id, 'city', true),
            'phone' => get_user_meta($user_id, 'phone', true),
            'avatar' => get_user_meta($user_id, 'avatar', true),
        ];
        error_log('Custom Auth Plugin: Profile data fetched for user ID: ' . $user_id);
        return new WP_REST_Response($profile_data, 200);

    } elseif ($request->get_method() === 'POST') {
        error_log('Custom Auth Plugin: Updating profile data for user ID: ' . $user_id);
        // Update user data
        $params = $request->get_json_params();

        // Update email if provided and different, and ensure it's unique
        if (isset($params['email']) && sanitize_email($params['email']) !== $user->user_email) {
            $new_email = sanitize_email($params['email']);
            error_log('Custom Auth Plugin: Attempting to change email to: ' . $new_email);
            if (email_exists($new_email) && email_exists($new_email) !== $user_id) { // Check if email is used by *another* user
                error_log('Custom Auth Plugin ERROR: Email ' . $new_email . ' already in use by another account.');
                return new WP_Error('email_exists', 'This email is already in use by another account.', ['status' => 400]);
            }
            if (!empty($new_email)) {
                wp_update_user(['ID' => $user_id, 'user_email' => $new_email]);
                error_log('Custom Auth Plugin: Email updated to: ' . $new_email . ' for user ID: ' . $user_id);
            }
        }

        // Update password if provided
        if (isset($params['password']) && !empty($params['password'])) {
            $new_password = sanitize_text_field($params['password']);
            wp_set_password($new_password, $user_id);
            error_log('Custom Auth Plugin: Password updated for user ID: ' . $user_id);
        }

        // Update user meta fields
        if (isset($params['name'])) {
            update_user_meta($user_id, 'name', sanitize_text_field($params['name']));
        }
        if (isset($params['childsname'])) {
            update_user_meta($user_id, 'childsname', sanitize_text_field($params['childsname']));
        }
         if (isset($params['child_dob'])) {
            update_user_meta($user_id, 'child_dob', sanitize_text_field($params['child_dob']));
        }
        if (isset($params['city'])) {
            update_user_meta($user_id, 'city', sanitize_text_field($params['city']));
        }
        if (isset($params['phone'])) {
            update_user_meta($user_id, 'phone', sanitize_text_field($params['phone']));
        }
        if (isset($params['avatar'])) {
            update_user_meta($user_id, 'avatar', esc_url_raw($params['avatar']));
        }
        error_log('Custom Auth Plugin: All specified user meta fields updated for user ID: ' . $user_id);


        return new WP_REST_Response(['message' => 'Profile updated successfully.'], 200);

    }

    error_log('Custom Auth Plugin ERROR: Invalid request method for /profile endpoint.');
    return new WP_Error('invalid_method', 'Invalid request method.', ['status' => 405]);
}   

/**
 * Handles secure resource click by sending media link via email.
 */
function handle_secure_resource_click(WP_REST_Request $request) {
    $user_id = $request->get_param('user_id');
    $email = $request->get_param('user_email');
    $resource_id = sanitize_text_field($request->get_param('resource_id'));

    $debug_log = [];
    $debug_log[] = "[" . date('Y-m-d H:i:s') . "] Resource click by User ID: {$user_id} for Resource ID: {$resource_id}";
    error_log("Resource click by User ID: {$user_id} for Resource ID: {$resource_id}");

    // Validate required parameters
    if (empty($email) || empty($resource_id)) {
        $error_msg = "Missing required parameters: " . 
                    (empty($email) ? "email " : "") . 
                    (empty($resource_id) ? "resource_id" : "");
        $debug_log[] = "[" . date('Y-m-d H:i:s') . "] ERROR: " . $error_msg;
        error_log($error_msg);
        return new WP_REST_Response([
            'status' => 'error', 
            'message' => 'Missing required parameters',
            'details' => $error_msg,
            'debug_log' => $debug_log
        ], 400);
    }

    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $debug_log[] = "[" . date('Y-m-d H:i:s') . "] ERROR: Invalid email format: {$email}";
        error_log("Invalid email format: {$email}");
        return new WP_REST_Response([
            'status' => 'error', 
            'message' => 'Invalid email format',
            'details' => "Email '{$email}' is not valid",
            'debug_log' => $debug_log
        ], 400);
    }

    // Check if resource exists
    $resources = get_option('srm_resources', []);
    if (!isset($resources[$resource_id])) {
        $debug_log[] = "[" . date('Y-m-d H:i:s') . "] ERROR: Resource not found: {$resource_id}";
        error_log("Resource not found: {$resource_id}");
        return new WP_REST_Response([
            'status' => 'error', 
            'message' => 'Resource not found',
            'details' => "Resource ID '{$resource_id}' does not exist",
            'debug_log' => $debug_log
        ], 404);
    }

    $resource = $resources[$resource_id];
    $title = $resource['title'] ?? 'Untitled Resource';
    $media_url = $resource['media_url'] ?? '';

    $debug_log[] = "[" . date('Y-m-d H:i:s') . "] Resource found: '{$title}' with URL: {$media_url}";

    // Validate media URL
    if (empty($media_url) || !filter_var($media_url, FILTER_VALIDATE_URL)) {
        $debug_log[] = "[" . date('Y-m-d H:i:s') . "] ERROR: Invalid or missing media URL for resource: {$resource_id}";
        error_log("Invalid or missing media URL for resource: {$resource_id}");
        return new WP_REST_Response([
            'status' => 'error', 
            'message' => 'Invalid resource URL',
            'details' => "Resource '{$title}' has invalid or missing media URL",
            'debug_log' => $debug_log
        ], 500);
    }

    $debug_log[] = "[" . date('Y-m-d H:i:s') . "] Preparing to send resource '{$title}' to {$email}";
    error_log("Sending resource '{$title}' to {$email}: {$media_url}");

    $payload = [
        'email' => $email,
        'subject' => "Your requested resource: $title",
        'url' => $media_url
    ];

    $api_endpoint = 'https://kaizen-pq9y.onrender.com/api/email/send-email-resource';
    $max_attempts = 3;
    $attempt = 1;
    $last_error = null;
    $response_details = [];

    while ($attempt <= $max_attempts) {
        $debug_log[] = "[" . date('Y-m-d H:i:s') . "] Starting email send attempt {$attempt}/{$max_attempts} to {$email}";
        error_log("Email send attempt {$attempt}/{$max_attempts} to {$email}");
        
        $response = wp_remote_post($api_endpoint, [
            'headers' => [
                'Content-Type' => 'application/json',
                'User-Agent' => 'WordPress/' . get_bloginfo('version') . '; ' . home_url()
            ],
            'body' => json_encode($payload),
            'timeout' => 30, // Increased timeout
            'redirection' => 5,
            'blocking' => true,
            'sslverify' => true
        ]);

        if (is_wp_error($response)) {
            $error_message = $response->get_error_message();
            $error_code = $response->get_error_code();
            $last_error = "WP Error [{$error_code}]: {$error_message}";
            
            $debug_log[] = "[" . date('Y-m-d H:i:s') . "] Email send failed (attempt {$attempt}): {$last_error}";
            error_log("Email send failed (attempt {$attempt}): {$last_error}");
            $response_details[] = "Attempt {$attempt}: {$last_error}";
            
            // Wait before retry (exponential backoff)
            if ($attempt < $max_attempts) {
                $sleep_time = pow(2, $attempt - 1);
                $debug_log[] = "[" . date('Y-m-d H:i:s') . "] Waiting {$sleep_time} seconds before retry";
                sleep($sleep_time); // 1s, 2s, 4s delays
            }
        } else {
            $response_code = wp_remote_retrieve_response_code($response);
            $response_body = wp_remote_retrieve_body($response);
            
            $debug_log[] = "[" . date('Y-m-d H:i:s') . "] Received HTTP response code: {$response_code}";
            
            if ($response_code >= 200 && $response_code < 300) {
                $debug_log[] = "[" . date('Y-m-d H:i:s') . "] SUCCESS: Email sent to {$email} successfully on attempt {$attempt}";
                error_log("Email sent to {$email} successfully on attempt {$attempt}");
                return new WP_REST_Response([
                    'status' => 'success', 
                    'message' => 'Email sent successfully',
                    'details' => [
                        'attempts' => $attempt,
                        'response_code' => $response_code,
                        'sent_to' => $email,
                        'resource' => $title
                    ],
                    'debug_log' => $debug_log
                ], 200);
            } else {
                // Parse API response for error details
                $api_response = json_decode($response_body, true);
                $api_error = $api_response['message'] ?? $api_response['error'] ?? 'Unknown API error';
                
                $last_error = "HTTP {$response_code}: {$api_error}";
                $debug_log[] = "[" . date('Y-m-d H:i:s') . "] Email API returned error (attempt {$attempt}): {$last_error}";
                $debug_log[] = "[" . date('Y-m-d H:i:s') . "] API Response Body: " . substr($response_body, 0, 200) . (strlen($response_body) > 200 ? '...' : '');
                error_log("Email API returned error (attempt {$attempt}): {$last_error}");
                $response_details[] = "Attempt {$attempt}: {$last_error}";
                
                // Don't retry on client errors (4xx), only server errors (5xx)
                if ($response_code >= 400 && $response_code < 500) {
                    $debug_log[] = "[" . date('Y-m-d H:i:s') . "] Client error detected, not retrying";
                    break; // Client error, don't retry
                }
                
                if ($attempt < $max_attempts) {
                    $sleep_time = pow(2, $attempt - 1);
                    $debug_log[] = "[" . date('Y-m-d H:i:s') . "] Server error, waiting {$sleep_time} seconds before retry";
                    sleep($sleep_time);
                }
            }
        }
        
        $attempt++;
    }

    // All attempts failed
    $final_error_message = "Failed to send email after {$max_attempts} attempts";
    $debug_log[] = "[" . date('Y-m-d H:i:s') . "] FINAL ERROR: {$final_error_message}. Last error: {$last_error}";
    error_log("{$final_error_message}. Last error: {$last_error}");
    
    return new WP_REST_Response([
        'status' => 'error',
        'message' => $final_error_message,
        'details' => [
            'attempts' => $max_attempts,
            'last_error' => $last_error,
            'all_attempts' => $response_details,
            'email' => $email,
            'resource' => $title,
            'api_endpoint' => $api_endpoint
        ],
        'debug_log' => $debug_log
    ], 500);
}


function handle_google_login(WP_REST_Request $request) {
    $body = $request->get_json_params();
    $id_token = sanitize_text_field($body['credential']);

    // Verify token via Google
    $response = wp_remote_get("https://oauth2.googleapis.com/tokeninfo?id_token={$id_token}");
    if (is_wp_error($response)) {
        return new WP_Error('token_verification_failed', 'Google token verification failed', ['status' => 401]);
    }

    $user_data = json_decode(wp_remote_retrieve_body($response), true);
    $client_id = '208816274064-ov7l1so9h451v0j9ftpqrlldl3l9ohg1.apps.googleusercontent.com';

    if ($user_data['aud'] !== $client_id) {
        return new WP_Error('invalid_token', 'Invalid audience in token', ['status' => 401]);
    }

    $email = sanitize_email($user_data['email']);
    if (!$email) {
        return new WP_Error('invalid_email', 'No valid email found', ['status' => 400]);
    }

    $user = get_user_by('email', $email);

    // If user doesn't exist, create one
    if (!$user) {
        $username = sanitize_user(current(explode('@', $email)));
        $base = $username;
        $i = 1;
        while (username_exists($username)) {
            $username = $base . $i++;
        }

        $password = wp_generate_password();
        $user_id = wp_create_user($username, $password, $email);

        if (is_wp_error($user_id)) {
            return new WP_Error('user_creation_failed', 'Failed to create user', ['status' => 500]);
        }

        $user = get_user_by('id', $user_id);
    }

    // Generate your JWT here
    $secret_key = CUSTOM_AUTH_JWT_SECRET_KEY;
    $payload = [
        'iss' => get_site_url(),
        'iat' => time(),
        // 'exp' => time() + 70000000
        'user_id' => $user->ID,
        'user_email' => $user->user_email,
    ];
    $jwt = JWT::encode($payload, $secret_key, 'HS256');

    
    return [
        'status' => 'logged_in',
        'token' => $jwt,
        'user_email' => $user->user_email,
        'user_id' => $user->ID,
    ];
}

function handle_verify_token(WP_REST_Request $request) {
    $user_id = $request->get_param('user_id');
    $email = $request->get_param('user_email');
    if( !empty($user_id) && !empty($email)) {
        return array(
                'valid' => true,
                'user' => array(
                    'id' => $user_id,
                    'email' => $email
                )
            );  
    }else{
        return new WP_Error('invalid_token', 'Invalid or expired token', array('status' => 401));
    }
}   

add_action('wp_enqueue_scripts' ,'enqueue_google_login_scripts');

// add_action('wp_enqueue_scripts', 'enqueue_google_login_scripts');
function enqueue_google_login_scripts() {
    if (!is_admin()) {
        wp_enqueue_script(
            'auth-plugin-login-profile',
            plugin_dir_url(__FILE__) . 'js/login-profile.js',
            array(), // No dependencies
            filemtime(plugin_dir_path(__FILE__) . 'js/login-profile.js'),
            true // Load in footer
        );
    }
    
    // Enqueue Google Identity Services script
    wp_enqueue_script('google-identity', 'https://accounts.google.com/gsi/client', [], null, true);

    // Register a custom script for handling the login
    wp_register_script('custom-google-login-handler', plugin_dir_url(__FILE__) . 'js/google-login-handler.js', [], filemtime(plugin_dir_path(__FILE__) . 'js/google-login-handler.js'), true);

    // Pass client ID to the script
    wp_localize_script('custom-google-login-handler', 'GoogleLoginSettings', [
        'client_id' => '208816274064-ov7l1so9h451v0j9ftpqrlldl3l9ohg1.apps.googleusercontent.com',
        'redirect_url' => '/', // or wherever you want to send the user after login
    ]);

    wp_enqueue_script('custom-google-login-handler');
}

