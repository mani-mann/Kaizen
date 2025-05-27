<?php
/*
Plugin Name: Sudoku
Description: Sudoku Challenge landing page
Version: 1.0
Author: Hardik
*/


// Register custom rewrite rule
function sudoku_rewrite_rule() {
    add_rewrite_rule('^sudoku/?$', 'index.php?sudoku_page=1', 'top');
}
add_action('init', 'sudoku_rewrite_rule');

// Allow query var
function sudoku_query_vars($vars) {
    $vars[] = 'sudoku_page';
    return $vars;
}
add_filter('query_vars', 'sudoku_query_vars');

// Template redirect
function sudoku_template_redirect() {
    if (intval(get_query_var('sudoku_page')) === 1) {
        header('Content-Type: text/html');
        sudoku_display();
        exit;
    }
}
add_action('template_redirect', 'sudoku_template_redirect');

// Function to send the enrollment email by calling the Express.js endpoint (runs asynchronously via WP-Cron)
function send_enrollment_email($name, $email) {
    $api_endpoint = 'https://email-wyl0.onrender.com/send-email';
    // Construct the email content as per your Express server's expectation
    $email_subject = 'Welcome to Sudoku Enrollments!';

    $body = json_encode([
        'email'   => $email,
        'name'    => $name,
        'template' => 'welcome',
        'subject' => $email_subject,
    ]);

    $args = [
        'body'        => $body,
        'headers'     => [
            'Content-Type' => 'application/json',
        ],
        'method'      => 'POST',
        'timeout'     => 45, // Set a reasonable timeout for the external API call (e.g., 45 seconds)
        'sslverify'   => true, // Always verify SSL for production
        'data_format' => 'body', // Specify that the 'body' is already formatted
    ];

    $response = wp_remote_post($api_endpoint, $args);

    // Basic error handling for the API call
    if ( is_wp_error( $response ) ) {
        $error_message = $response->get_error_message();
        // Since you don't have direct log access, this error will be lost
        // in a cron context. You might need to set up custom database logging
        // if these API calls fail frequently.
        // error_log("Failed to send email via Express server. WP_Error: {$error_message}");
    } else {
        $response_code = wp_remote_retrieve_response_code( $response );
        $response_body = wp_remote_retrieve_body( $response );

        if ( $response_code === 200 ) {
            // Email likely sent successfully by the Express server
            // error_log("Email API call successful for {$email}. Response: {$response_body}");
        } else {
            // Express server returned a non-200 status code
            // error_log("Email API call failed for {$email}. Status: {$response_code}, Body: {$response_body}");
        }
    }
}
// Add the action for our scheduled event, which will trigger send_enrollment_email
add_action('sudoku_send_enrollment_email_hook', 'send_enrollment_email', 10, 2);


// Display the content and handle form submission
function sudoku_display() {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        header('Content-Type: application/json');

        $input = json_decode(file_get_contents('php://input'), true);

        if (!$input || !isset($input['name']) || !isset($input['email'])) {
            echo json_encode(['success' => false, 'message' => 'Missing name or email']);
            exit;
        }

        $name = sanitize_text_field($input['name']);
        $email = sanitize_email($input['email']);
        $phone = sanitize_text_field($input['phone']);
        // Assuming standardize_phone_number() is defined elsewhere
        if (function_exists('standardize_phone_number')) {
            $phone = standardize_phone_number($phone);
        }

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
        dbDelta($sql); // Creates or updates the table

        $inserted = $wpdb->insert($table_name, [
            'name'  => $name,
            'email' => $email,
            'phone' => $phone,
        ]);

        $response_message = '';
        $success_status = false;

        if ($inserted !== false) {
            // Schedule the email to be sent in the background using WP-Cron.
            // This prevents timeouts during the form submission.
            wp_schedule_single_event(time() + 5, 'sudoku_send_enrollment_email_hook', [$name, $email]);

            $success_status = true;
            $response_message = 'Successfully enrolled! A confirmation email will be sent to you shortly.';

            echo json_encode([
                'success' => $success_status,
                'message' => $response_message,
                'email_status' => 'scheduled', // Indicate it's scheduled for background delivery
                'email_message' => 'Email scheduled for background delivery via external API.',
            ]);

        } else {
            // Database insertion failed
            $success_status = false;
            $response_message = 'Failed to enroll due to a database error. Please try again.';
            echo json_encode([
                'success' => $success_status,
                'message' => $response_message,
                'email_status' => false,
                'email_message' => 'Email not scheduled due to insertion failure.',
                'debug_info' => 'Database insertion failed: ' . (isset($wpdb->last_error) ? $wpdb->last_error : 'Unknown DB error')
            ]);
        }
        exit;
    }
    echo <<<HTML
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kaizen Sudoku Challenge for Kids</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.css" rel="stylesheet">
        <!--noptimize-->
        <style>
            :root {
        --primary-color: #002855; /* Deep blue background from logo */
        --secondary-color: #FF5722; /* Orange accent from logo */
        --accent-color-1: #FFC107; /* Yellow accent from logo */
        --accent-color-2: #4CAF50; /* Green accent from logo */
        --text-color: #333333;
        --light-color: #FFFFFF;
        --gray-light: #f5f5f5;
        --gray: #e0e0e0;
        --border-radius: 12px;
        --box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }
    .navbar{
        background-color: var(--light-color);
    }

    /* General Styles */
    body {
        font-family: 'Nunito', sans-serif;
        color: var(--text-color);
        background-color: var(--gray-light);
        overflow-x: hidden;
        position: relative;
        background-color: white;
    }

    body::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18h9v9h-9z M11 37h9v9h-9z M11 56h9v9h-9z M11 75h9v9h-9z M30 18h9v9h-9z M30 37h9v9h-9z M30 56h9v9h-9z M30 75h9v9h-9z M49 18h9v9h-9z M49 37h9v9h-9z M49 56h9v9h-9z M49 75h9v9h-9z M68 18h9v9h-9z M68 37h9v9h-9z M68 56h9v9h-9z M68 75h9v9h-9z' fill='rgba(0, 40, 85, 0.05)' fill-rule='evenodd'/%3E%3C/svg%3E");
        z-index: -1;
        opacity: 0.8;
    }
    .popup {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        visibility: hidden;
        opacity: 0;
        transition: visibility 0s, opacity 0.3s ease;
    }

    .popup.show {
        visibility: visible;
        opacity: 1;
    }

    .popup-content {
        background-color: #fff;
        padding: 20px;
        border-radius: var(--border-radius);
        width: 80%;
        max-width: 500px;
        box-shadow: var(--box-shadow);
        position: relative;
    }

    .popup-close {
        position: absolute;
        top: 10px;
        right: 10px;
        font-size: 20px;
        cursor: pointer;
        color: var(--text-color);
        background: none;
        border: none;
    }

    .popup-form .form-group {
        margin-bottom: 15px;
    }

    .popup-form label {
        display: block;
        margin-bottom: 5px;
        font-weight: 600;
    }

    .popup-form input[type="text"],
    .popup-form input[type="email"],
    .popup-form input[type="tel"] {
        width: 100%;
        padding: 8px;
        border: 1px solid var(--gray);
        border-radius: var(--border-radius);
        box-sizing: border-box;
        font-size: 16px;
    }

    .popup-form button[type="submit"] {
        background-color: var(--secondary-color);
        color: var(--light-color);
        padding: 10px 15px;
        border: none;
        border-radius: 50px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 700;
        transition: background-color 0.3s ease;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .popup-form button[type="submit"]:hover {
        background-color: #e64a19;
    }
    .error-message {
        color: red;
        margin: 5px;
        text-align: center;
    }
    a {
        color: var(--secondary-color);
        text-decoration: none;
        transition: all 0.3s ease;
    }

    a:hover {
        color: var(--accent-color-1);
    }

    h1, h2, h3, h4, h5, h6 {
        font-weight: 800;
        margin-bottom: 1rem;
    }

    .section {
        padding: 4rem 0;
        position: relative;
    }

    .section-title {
        text-align: center;
        margin-bottom: 3rem;
        color: var(--primary-color);
        position: relative;
        font-size: 2.5rem;
    }

    .section-title::after {
        content: '';
        display: block;
        width: 80px;
        height: 4px;
        background-color: var(--secondary-color);
        margin: 15px auto 0;
        border-radius: 2px;
    }

    /* Header */
    .site-header {
        background-color: var(--primary-color);
        padding: 1rem 0;
        box-shadow: var(--box-shadow);
    }

    .logo {
        height: 60px;
        width: auto;
    }

    .footer-logo {
        height: 50px;
        width: auto;
        margin-bottom: 15px;
    }

    /* Hero Section */
    .hero-section {
        padding: 0;
        overflow: hidden;
        position: relative;
    }

    .hero-slider {
        position: relative;
        height: 650px;
        overflow: hidden;
    }

    .slide {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        transition: opacity 1s ease-in-out;
        display: flex;
        align-items: center;
    }

    .slide.active {
        opacity: 1;
    }

    .slide-image {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 1;
    }

    .slide-content {
        background-color: var(--gray-light);
        position: relative;
        z-index: 2;
        width: 100%;
        text-align: center;
        padding: 4rem 2rem;
    }

    .hero-title {
        font-size: 3.5rem;
        margin-bottom: 1.5rem;
        font-weight: 800;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    }

    .hero-subtitle {
        font-size: 1.5rem;
        margin-bottom: 2rem;
        font-weight: 500;
        max-width: 800px;
        margin-left: auto;
        margin-right: auto;
    }

    .hero-cta-container {
        display: flex;
        justify-content: center;
        gap: 1.5rem;
        flex-wrap: wrap;
    }

    /* Benefits Section */
    .benefits-section {
        background-color: var(--light-color);
        position: relative;
    }

    .benefits-image {
        width: 300px;
        height: 300px;
        object-fit: cover;
        border-radius: 50%;
        margin: 0 auto;
        display: block;
        border: 8px solid var(--accent-color-2);
        box-shadow: var(--box-shadow);
    }

    .benefits-content {
        padding: 2rem;
        text-align: center;
    }
    .benefit {
      display: flex;
      align-items: center;
      margin-bottom: 30px;
    }
    .benefit-text{
        display: flex;
        flex-direction: column;
        align-items: flex-start;

    }
    .icon-container {
      min-width: 60px;
      min-height: 60px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 20px;
      color: white;
      font-size: 24px;
    }
    .benefit i {
      font-size: 24px;
      color: white;
      border-radius: 50%;
    }
    .benefit:nth-child(1) .icon-container {
      background-color: #fdd835;
    }
    .benefit:nth-child(2) .icon-container {
      background-color: #43a047;
    }
    .benefit:nth-child(3) .icon-container {
      background-color: #fb8c00;
    }
    .benefit:nth-child(4) .icon-container {
      background-color: #3949ab;
    }
    .benefit h3 {
      margin: 0;
      font-size: 1.2em;
      color: #0d47a1;
    }
    .benefit p {
      margin: 5px 0 0;
      text-align: left;
      font-size: 0.95em;
    }
    /* Comparison Table */
    .comparison-section {
        background-color: var(--gray-light);
        position: relative;
    }

    .comparison-table {
        border-radius: var(--border-radius);
        overflow: hidden;
        box-shadow: var(--box-shadow);
    }

    .comparison-header {
        padding: 1.5rem;
        text-align: center;
        font-weight: 700;
        font-size: 1.5rem;
    }

    .free-header {
        background-color: var(--accent-color-2);
        color: var(--light-color);
    }

    .premium-header {
        background-color: var(--accent-color-1);
        color: var(--primary-color);
    }

    .comparison-body {
        background-color: var(--light-color);
        padding: 2rem;
    }

    .feature-item {
        padding: 0.8rem 0;
        display: flex;
        align-items: center;
    }

    .feature-item i {
        margin-right: 10px;
        color: var(--accent-color-2);
    }

    .comparison-footer {
        padding: 1.5rem;
        text-align: center;
    }

    .free-footer {
        background-color: var(--accent-color-2);
    }

    .premium-footer {
        background-color: var(--accent-color-1);
    }

    /* Premium Section */
    .premium-section {
        background-color: var(--light-color);
    }
    .premium-icon-container{
        display: flex;
        flex-direction:row;
        align-items: center;
    }
    .premium-image-container {
        text-align: center;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.26);
      padding: 20px 24px;
      display: flex;
      align-items: flex-start;
      gap: 20px;
      margin-bottom: 24px;
      max-width: 700px;
    }

    .icon-circle {
      width: 50px;
      height: 50px;
      min-width: 50px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
      margin-top: 4px;
    }

    .card:nth-child(1) .icon-circle {
      background-color: #ffd600;
    }

    .card:nth-child(2) .icon-circle {
      background-color: #4caf50;
    }

    .card:nth-child(3) .icon-circle {
      background-color: #f57c00;
    }

    .card h3 {
      margin: 10px;
      color: #0d47a1;
      font-size: 1.1rem;
    }

    .card p {
      margin: 6px 0 0;
      font-size: 0.95rem;
      color: #444;
    }
    .premium-image {
        width: 500px;
        height: 500px;
        object-fit: cover;
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow);
        border: 8px solid var(--accent-color-1);
    }

    .premium-content {
        padding: 2rem;
    }

    /* Testimonial Section */
    .testimonial-section {
        background-color: var(--gray-light);
        position: relative;
    }

    .testimonial-card {
        background-color: var(--light-color);
        border-radius: var(--border-radius);
        padding: 2rem;
        margin-bottom: 2rem;
        box-shadow: var(--box-shadow);
        position: relative;
    }

    .testimonial-card::before {
        /* content: '\201C'; */
        font-size: 6rem;
        position: absolute;
        top: -20px;
        left: 10px;
        color: rgba(0, 40, 85, 0.1);
        font-family: serif;
    }
    .testimonial-image {
        text-align: center;
        margin-bottom: 1rem;
    }

    .testimonial-image img {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: 50%;
        border: 3px solid var(--primary-color);
    }
    .testimonial-text {
        font-style: italic;
        margin-bottom: 1rem;
    }

    .testimonial-author {
        font-weight: 700;
        color: var(--primary-color);
    }

    .testimonial-rating {
        color: var(--accent-color-1);
        margin-top: 0.5rem;
    }

    /* FAQ Section */
    .faq-section {
        background-color: var(--light-color);
    }
    .faq-section .container{
        max-width: 70vw;;
    }

    .accordion-item {
        margin-bottom: 1rem;
        border-radius: var(--border-radius);
        overflow: hidden;
        box-shadow: var(--box-shadow);
        border: none;
    }

    .accordion-button {
        padding: 1.25rem;
        font-weight: 700;
        background-color: var(--primary-color);
        color: var(--light-color);
    }

    .accordion-button:focus {
        box-shadow: none;
        border-color: transparent;
    }

    .accordion-button:not(.collapsed) {
        color: var(--light-color);
        background-color: var(--secondary-color);
    }

    .accordion-body {
        padding: 1.5rem;
        background-color: var(--light-color);
    }

    /* CTA Buttons */
    .btn {
        padding: 0.8rem 1.5rem;
        font-weight: 700;
        text-transform: uppercase;
        border-radius: 50px;
        transition: all 0.3s ease;
        letter-spacing: 0.5px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .btn-primary {
        background-color: var(--secondary-color);
        border-color: var(--secondary-color);
        color: var(--light-color);
    }

    .btn-primary:hover {
        background-color: #e64a19; /* Darker orange */
        border-color: #e64a19;
        transform: translateY(-3px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    .btn-secondary {
        background-color: var(--accent-color-1);
        border-color: var(--accent-color-1);
        color: var(--primary-color);
    }

    .btn-secondary:hover {
        background-color: #ffa000; /* Darker yellow */
        border-color: #ffa000;
        color: var(--primary-color);
        transform: translateY(-3px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    .btn-outline {
        background-color: rgb(76, 175, 80);
        border: 2px solid var(--light-color);
        color: var(--light-color);
    }

    .btn-outline:hover {
        background-color: var(--light-color);
        color: var(--primary-color);
        transform: translateY(-3px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    .cta-container {
        text-align: center;
        margin-top: 2rem;
        display: flex;
        justify-content: center;
        gap: 1rem;
        flex-wrap: wrap;
    }

    /* Decorative elements */
    .puzzle-piece {
        position: absolute;
        opacity: 0.15;
        z-index: 0;
    }

    .puzzle-1 {
        top: 50px;
        left: -30px;
        width: 100px;
        height: 100px;
        transform: rotate(15deg);
    }

    .puzzle-2 {
        bottom: 80px;
        right: 20px;
        width: 80px;
        height: 80px;
        transform: rotate(-20deg);
    }

    .puzzle-3 {
        top: 30%;
        right: 5%;
        width: 60px;
        height: 60px;
        transform: rotate(45deg);
    }

    .puzzle-4 {
        bottom: 20%;
        left: 10%;
        width: 70px;
        height: 70px;
        transform: rotate(-30deg);
    }

    /* Footer */
    .footer {
        background-color: var(--primary-color);
        color: var(--light-color);
        padding: 4rem 0 2rem;
        position: relative;
    }

    .footer-links {
        list-style: none;
        padding: 0;
    }

    .footer-links li {
        margin-bottom: 0.5rem;
    }

    .footer-links a {
        color: var(--light-color);
        opacity: 0.8;
    }

    .footer-links a:hover {
        opacity: 1;
        color: var(--accent-color-1);
    }

    .social-icons {
        display: flex;
        gap: 1rem;
        margin-top: 1rem;
    }

    .social-icons a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.1);
        color: var(--light-color);
        transition: all 0.3s ease;
    }

    .social-icons a:hover {
        background-color: var(--secondary-color);
        transform: translateY(-3px);
    }

    /* Admin Styles */
    .admin-header {
        background-color: var(--primary-color);
        color: var(--light-color);
        padding: 1rem 0;
    }

    .admin-nav {
        background-color: var(--primary-color);
        padding: 0;
    }

    .admin-nav .nav-link {
        color: var(--light-color);
        padding: 1rem 1.5rem;
        border-radius: 0;
    }

    .admin-nav .nav-link:hover,
    .admin-nav .nav-link.active {
        background-color: var(--secondary-color);
    }

    .admin-content {
        padding: 2rem;
        background-color: var(--light-color);
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow);
        margin: 2rem 0;
    }

    .admin-card {
        background-color: var(--light-color);
        border-radius: var(--border-radius);
        padding: 1.5rem;
        box-shadow: var(--box-shadow);
        margin-bottom: 1.5rem;
    }

    .admin-card-header {
        padding-bottom: 1rem;
        margin-bottom: 1.5rem;
        border-bottom: 1px solid var(--gray);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .admin-card-title {
        font-size: 1.25rem;
        margin: 0;
        color: var(--primary-color);
    }

    /* Responsive */
    @media (max-width: 991.98px) {
        .hero-title {
            font-size: 2.8rem;
        }
        
        .hero-subtitle {
            font-size: 1.2rem;
        }
        
        .section-title {
            font-size: 2rem;
        }
        
        .benefits-image,
        .premium-image {
            width: 250px;
            height: 250px;
        }
    }

    @media (max-width: 767.98px) {
        .hero-slider {
            height: 400px;
        }
        
        .hero-title {
            font-size: 2.2rem;
        }
        
        .hero-subtitle {
            font-size: 1.1rem;
        }
        
        .section {
            padding: 3rem 0;
        }
        
        .section-title {
            font-size: 1.8rem;
            margin-bottom: 2rem;
        }
        
        .comparison-table {
            margin-bottom: 2rem;
        }
        
        .social-icons {
            justify-content: center;
        }
    }

    @media (max-width: 575.98px) {
        .hero-slider {
            height: 350px;
        }
        
        .hero-title {
            font-size: 1.8rem;
        }
        
        .hero-subtitle {
            font-size: 1rem;
        }
        
        .btn {
            width: 100%;
            margin-bottom: 0.5rem;
        }
        
        .hero-cta-container,
        .cta-container {
            flex-direction: column;
            gap: 0.5rem;
        }
        
        .benefits-image,
        .premium-image {
            width: 200px;
            height: 200px;
        }
    }

        </style>
        <!--noptimize-->
    </head>
    <body>
        <header>
            <nav class="navbar navbar-expand-lg navbar-light">
                <div class="container">
                    <a class="navbar-brand" href="https://kaizenlessons.in/">
                        <img src="https://kaizenlessons.in/wp-content/uploads/2025/05/kaizen_logo.png" alt="Kaizen Sudoku for Kids" class="logo">
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link" href="https://kaizenlessons.in/">Home</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="#benefits">Benefits</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="#comparison">Compare Plans</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="#testimonials">Testimonials</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="#faq">FAQ</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
        </header>

        <!-- Hero Section -->
        <section class="hero-section" id="hero">
            <div class="hero-slider">
                <div class="slide active">
                    <img src="https://kaizenlessons.in/wp-content/uploads/2025/05/Image-1-1243x600-V2.jpg" alt="Kids solving Sudoku puzzles" class="slide-image">
                </div>
                <div class="slide">
                    <img src="https://kaizenlessons.in/wp-content/uploads/2025/05/Image-2-1243x600-1-1024x494-1.jpg" alt="Happy children learning" class="slide-image">
                </div>
                <div class="slide">
                    <img src="https://kaizenlessons.in/wp-content/uploads/2025/05/Image-3-1243x600-1-1024x494-1.jpg" alt="Educational games for kids" class="slide-image">
                </div>
            </div>
        </section>

        <div class="slide-content">
            <h1 class="hero-title">Sudoku Challenge for Kids</h1>
            <p class="hero-subtitle">Develop critical thinking skills with fun Sudoku puzzles designed for children.</p>
            <div class="hero-cta-container">
                <a href="#" class="btn btn-outline enroll-button">Enroll for FREE</a>
                <a href="https://rzp.io/rzp/NpoTXSiL" class="btn btn-secondary">Get Premium for ₹99</a>
            </div>
        </div>

        <!-- Benefits Section -->
        <section class="section benefits-section" id="benefits">
            <div class="container">
                <h2 class="section-title">Benefits of Sudoku for Kids</h2>
                <div class="row align-items-center">
                    <div class="col-md-5" data-aos="fade-up" data-aos-delay="0">
                        <img src="https://kaizenlessons.in/wp-content/uploads/2025/05/6.jpg" alt="Benefits of Sudoku" class="benefits-image">
                    </div>
                    <div class="col-md-7">
                        <div class="benefits-content">
                            <div class="benefit" data-aos="fade-up" data-aos-delay="0">
                                <div class="icon-container"><i class="fas fa-brain"></i></div>
                                <div class="benefit-text">
                                <h3>Cognitive Development</h3>
                                <p>Sudoku puzzles stimulate critical thinking and help children develop problem-solving skills from an early age.</p>
                                </div>
                            </div>

                            <div class="benefit" data-aos="fade-up" data-aos-delay="100">
                                <div class="icon-container"><i class="fas fa-lightbulb"></i></div>
                                <div class="benefit-text">
                                <h3>Concentration & Focus</h3>
                                <p>Regular Sudoku practice enhances attention span and teaches children the value of patience and persistence.</p>
                                </div>
                            </div>

                            <div class="benefit" data-aos="fade-up" data-aos-delay="200">
                                <div class="icon-container"><i class="fas fa-graduation-cap"></i></div>
                                <div class="benefit-text">
                                <h3>Mathematical Skills</h3>
                                <p>Sudoku creates a foundation for understanding number relationships, patterns, and logical sequences.</p>
                                </div>
                            </div>

                            <div class="benefit" data-aos="fade-up" data-aos-delay="300">
                                <div class="icon-container"><i class="fas fa-trophy"></i></div>
                                <div class="benefit-text">
                                <h3>Confidence Building</h3>
                                <p>Successfully completing puzzles builds self-esteem and teaches kids to overcome challenges independently.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Decorative elements -->
                <div class="puzzle-piece puzzle-1">
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <rect x="0" y="0" width="80" height="80" rx="15" fill="#FFC107"/>
                        <circle cx="20" cy="20" r="10" fill="#002855"/>
                        <circle cx="60" cy="60" r="10" fill="#002855"/>
                    </svg>
                </div>
                <div class="puzzle-piece puzzle-2">
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <rect x="10" y="10" width="80" height="80" rx="15" fill="#4CAF50"/>
                        <circle cx="30" cy="30" r="10" fill="#FFFFFF"/>
                        <circle cx="70" cy="70" r="10" fill="#FFFFFF"/>
                    </svg>
                </div>
            </div>
        </section>

        <!-- Comparison Section -->
        <section class="section comparison-section" id="comparison">
            <div class="container">
                <h2 class="section-title">Choose Your Challenge</h2>
                <div class="row">
                    <div class="col-md-6">
                        <div class="comparison-table" data-aos="fade-up" data-aos-delay="0">
                            <div class="comparison-header free-header">
                                Free Weekly Challenge
                            </div>
                            <div class="comparison-body">
                                <div class="feature-item"><i class="fas fa-check-circle"></i> Weekly Sudoku puzzles via WhatsApp</div>
                                <div class="feature-item"><i class="fas fa-check-circle"></i> Engaging puzzle formats - 4X4, 6X6, Whacky Sudoku</div>
                                <div class="feature-item"><i class="fas fa-check-circle"></i> Gradual buildup of difficulty level</div>
                                <div class="feature-item"><i class="fas fa-check-circle"></i> Solution guides for parents</div>
                                <div class="feature-item"><i class="fas fa-check-circle"></i> Certificate for winners</div>
                                <div class="feature-item"><i class="fas fa-times-circle" style="color: red;"></i> Video tutorials</div>
                                <div class="feature-item"><i class="fas fa-times-circle" style="color: red;"></i> Comprehensive E-Book</div>
                            </div>
                            <div class="comparison-footer free-footer">
                                <a href="#" class="btn btn-primary enroll-button">Enroll for FREE</a>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="comparison-table" data-aos="fade-up" data-aos-delay="100">
                            <div class="comparison-header premium-header">
                                Premium 10-Day Course
                            </div>
                            <div class="comparison-body">

                                <div class="feature-item"><i class="fas fa-check-circle"></i> Everything in Weekly Challenge</div>
                                <div class="feature-item"><i class="fas fa-check-circle"></i> 7-day video course with step-by-step tutorials</div>
                                <div class="feature-item"><i class="fas fa-check-circle"></i> Course runs for a week before start of the challenge</div>
                                <div class="feature-item"><i class="fas fa-check-circle"></i> Printable Sudoku E-Book (70+ puzzles)</div>
                                <div class="feature-item"><i class="fas fa-check-circle"></i> Goodies for winners</div>
                                <div class="feature-item"><i class="fas fa-check-circle"></i> Certificate of completion</div>
                                <div class="feature-item"><i class="fas fa-check-circle"></i> Priority support</div>
                            </div>
                            <div class="comparison-footer premium-footer">
                                <a href="https://rzp.io/rzp/NpoTXSiL" class="btn btn-primary">Get Premium for ₹99</a>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Decorative elements -->
                <div class="puzzle-piece puzzle-3">
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <rect x="20" y="20" width="60" height="60" rx="10" fill="#FF5722"/>
                        <circle cx="40" cy="40" r="8" fill="#FFFFFF"/>
                    </svg>
                </div>
            </div>
        </section>

        <!-- Premium Section -->
        <section class="section premium-section" id="premium">
            <div class="container">
                <h2 class="section-title">Why Choose Premium?</h2>
                <div class="row align-items-center">
                    <div class="col-md-7 order-md-1 order-2">
                          <div class="card" data-aos="fade-up" data-aos-delay="0">
                            <div class="premium-icon-container">
                                <div class="icon-circle"><i class="fas fa-video"></i></div>
                                <h3>7-Day Video Course</h3>
                            </div>
                            <div>
                            <p>Our step-by-step video tutorials make learning Sudoku fun and accessible for children of all ages. Expert instructors guide them from basics to advanced techniques.</p>
                            </div>
                        </div>

                        <div class="card" data-aos="fade-up" data-aos-delay="100" >
                            <div class="premium-icon-container">
                                <div class="icon-circle"><i class="fas fa-book"></i></div>
                                <h3>Printable E-Book</h3>
                            </div>
                            <div>
                            <p>A beautifully illustrated 70+ puzzle guide that walks through Sudoku strategies, and contains practice puzzles.</p>
                            </div>
                        </div>

                        <div class="card" data-aos="fade-up" data-aos-delay="200">
                            <div class="premium-icon-container">
                                <div class="icon-circle"><i class="fas fa-award"></i></div>
                                <h3>Certificate & Goodies</h3>
                            </div>
                            <div>
                            <p>While Free enrolment will win you certificate only, Premium enrolment will win goodies for the winning child.</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-5 order-md-2 order-1 premium-image-container" data-aos="fade-up" data-aos-delay="0">
                        <img src="https://kaizenlessons.in/wp-content/uploads/2025/05/1.webp" alt="Premium Sudoku course" class="premium-image">
                    </div>
                </div>
                <div class="cta-container">
                    <a href="https://rzp.io/rzp/NpoTXSiL" class="btn btn-secondary">Enrol in Premium Course</a>
                </div>
                
                <!-- Decorative elements -->
                <div class="puzzle-piece puzzle-4">
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <rect x="15" y="15" width="70" height="70" rx="12" fill="#4CAF50"/>
                        <rect x="30" y="30" width="40" height="40" rx="8" fill="#002855"/>
                    </svg>
                </div>
            </div>
        </section>

        <section class="section testimonial-section" id="testimonials">
            <div class="container">
                <h2 class="section-title">What Parents & Teachers Say</h2>
                <div class="row">
                    <div class="col-md-4">
                        <div class="testimonial-card" data-aos="fade-up" data-aos-delay="0">
                            <div class="testimonial-image">
                                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRtdXwO7zcU2PEd-GjBiSR3c2AZQHDhSqicUl53K_OXfjgM6j5uafc7bPmwH9m5ry3WFU8&usqp=CAU" alt="Aanya P., Parent">
                            </div>
                            <p class="testimonial-text">"My daughter was struggling with math, but the Sudoku for Kids program made numbers fun for her! She now looks forward to solving puzzles every week and her concentration has improved dramatically."</p>
                            <div class="testimonial-author">Aanya P., Parent</div>
                            <div class="testimonial-rating">
                                <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="testimonial-card" data-aos="fade-up" data-aos-delay="100">
                            <div class="testimonial-image">
                                <img src="https://img.freepik.com/free-photo/smiling-businessman-face-portrait-wearing-suit_53876-148138.jpg?semt=ais_hybrid&w=740" alt="Rohan S., Teacher">
                            </div>
                            <p class="testimonial-text">"The premium package is worth every rupee! The video tutorials are excellent, and my son proudly displays his Sudoku completion certificate. His logical thinking skills have improved tremendously."</p>
                            <div class="testimonial-author">Rohan S., Teacher</div>
                            <div class="testimonial-rating">
                                <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="testimonial-card" data-aos="fade-up" data-aos-delay="200">
                            <div class="testimonial-image">
                                <img src="https://t4.ftcdn.net/jpg/05/70/57/47/360_F_570574724_HWfki1q3XZt9WzVlCcQujOV5Jxe8UBG1.jpg" alt="Meera K., Parent">
                            </div>
                            <p class="testimonial-text">"As a teacher, I recommend these Sudoku challenges to all parents. The structured approach helps children develop logical thinking patterns that are essential for mathematics and beyond."</p>
                            <div class="testimonial-author">Meera K., Parent</div>
                            <div class="testimonial-rating">
                                <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="cta-container">
                    <a href="#" class="btn btn-primary enroll-button">Enroll for FREE</a>
                    <a href="https://rzp.io/rzp/NpoTXSiL" class="btn btn-secondary">Get Premium for ₹99</a>
                </div>
            </div>
        </section>


        <!-- FAQ Section -->
        <section class="section faq-section" id="faq">
            <div class="container">
                <h2 class="section-title">🧩 Sudoku Challenge – FAQs for Parents</h2>
                <div class="accordion" id="faqAccordion">
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="faqHeading0">
                            <button class="accordion-button " type="button" data-bs-toggle="collapse" data-bs-target="#faqCollapse0" aria-expanded="true" aria-controls="faqCollapse0">
                                What is this Sudoku Challenge all about?
                            </button>
                        </h2>
                        <div id="faqCollapse0" class="accordion-collapse collapse show" aria-labelledby="faqHeading0" data-bs-parent="#faqAccordion">
                            <div class="accordion-body">
                                It’s a fun, brain-boosting competition designed for kids aged 6–12. They solve logic-based puzzles from the comfort of home.
                            </div>
                        </div>
                    </div>
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="faqHeading1">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faqCollapse1" aria-expanded="false" aria-controls="faqCollapse1">
                                Who can participate?
                            </button>
                        </h2>
                        <div id="faqCollapse1" class="accordion-collapse collapse" aria-labelledby="faqHeading1" data-bs-parent="#faqAccordion">
                            <div class="accordion-body">
                                Any child between 6 and 12 years can join. No prior experience needed — puzzles are beginner-friendly.
                            </div>
                        </div>
                    </div>
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="faqHeading2">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faqCollapse2" aria-expanded="false" aria-controls="faqCollapse2">
                                Is it really free?
                            </button>
                        </h2>
                        <div id="faqCollapse2" class="accordion-collapse collapse" aria-labelledby="faqHeading2" data-bs-parent="#faqAccordion">
                            <div class="accordion-body">
                                Yes! The basic challenge is completely free. We also offer a Premium Plan with added benefits (video course, e-book, goodies, etc.).
                            </div>
                        </div>
                    </div>
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="faqHeading3">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faqCollapse3" aria-expanded="false" aria-controls="faqCollapse3">
                                When is the Challenge Starting?
                            </button>
                        </h2>
                        <div id="faqCollapse3" class="accordion-collapse collapse" aria-labelledby="faqHeading3" data-bs-parent="#faqAccordion">
                            <div class="accordion-body">
                                The FREE Sudoku challenge will start on 6th of June 2025.<br>
                                The Premium preparatory course will start a week earlier, i.e., 30th May 2025.
                            </div>
                        </div>
                    </div>
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="faqHeading4">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faqCollapse4" aria-expanded="false" aria-controls="faqCollapse4">
                                What all is included in the Premium Plan?
                            </button>
                        </h2>
                        <div id="faqCollapse4" class="accordion-collapse collapse" aria-labelledby="faqHeading4" data-bs-parent="#faqAccordion">
                            <div class="accordion-body">
                                Premium gives your child extra learning support:<br>
                                • 7-day step-by-step video course<br>
                                • Sudoku E-book (70+ puzzles)<br>
                                • Completion certificate<br>
                                • Exciting goodies for winners<br>
                                It’s perfect for parents who want their child to learn deeply, not just compete.
                            </div>
                        </div>
                    </div>
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="faqHeading5">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faqCollapse5" aria-expanded="false" aria-controls="faqCollapse5">
                                How will my child attend the challenge?
                            </button>
                        </h2>
                        <div id="faqCollapse5" class="accordion-collapse collapse" aria-labelledby="faqHeading5" data-bs-parent="#faqAccordion">
                            <div class="accordion-body">
                                You’ll get a puzzle link via WhatsApp & Email. Your child can solve it online using any device (phone, tablet, or computer).
                            </div>
                        </div>
                    </div>
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="faqHeading6">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faqCollapse6" aria-expanded="false" aria-controls="faqCollapse6">
                                Who’s behind this initiative?
                            </button>
                        </h2>
                        <div id="faqCollapse6" class="accordion-collapse collapse" aria-labelledby="faqHeading6" data-bs-parent="#faqAccordion">
                            <div class="accordion-body">
                                The challenge is conducted by Maninder Singh Mann, IIM Alumni & Faculty — a recognized expert in gamified learning for kids.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>


        <!-- Enrollment Form -->

        <div class="popup" id="enrollmentPopup">
        <div class="popup-content">
            <button type="button" class="popup-close" id="closePopup">
            &times;
            </button>
            <h2>Enroll Now</h2>
            <form class="popup-form" id="enrollForm">
            <div class="form-group">
                <label for="name">Child's Name:</label>
                <input type="text" id="name" name="name" required />
            </div>
            <div class="form-group">
                <label for="email">Parent's Email:</label>
                <input type="email" id="email" name="email" required />
            </div>
            <div class="form-group">
                <label for="phone">Parent's Phone Number:</label>
                <input type="tel" id="phone" name="phone" />
            </div>
            <div class="error-message" id="errorMessage"></div>
            <button type="submit" >Submit</button>
            </form>
        </div>
        </div>

        <!-- Footer -->
        <footer class="footer">
            <div class="container">
                <div class="row">
                    <div class="col-md-4">
                        <img src="https://kaizenlessons.in/wp-content/uploads/2025/05/kaizen_logo.png" alt="Kaizen Sudoku for Kids" class="footer-logo">
                        <p>Helping kids develop cognitive skills through Sudoku challenges.</p>
                    </div>
                    <div class="col-md-4">
                        <h3>Quick Links</h3>
                        <ul class="footer-links">
                            <li><a href="#hero">Home</a></li>
                            <li><a href="#benefits">Benefits</a></li>
                            <li><a href="#comparison">Compare Plans</a></li>
                            <li><a href="#testimonials">Testimonials</a></li>
                            <li><a href="#faq">FAQ</a></li>
                        </ul>
                    </div>
                    <div class="col-md-4">
                        <h3>Contact Us</h3>
                        <p><a href="mailto:lessons@kaizenlessons.in">lessons@kaizenlessons.in</a></p>
                        <p>+91 96462 55624</p>
                        <div class="social-icons">
                            <a href="https://www.facebook.com/KaizenLessons/"><i class="fab fa-facebook-f"></i></a>
                            <a href="mailto:lessons@kaizenlessons.in"><i class="fas fa-envelope"></i></a>
                            <a href="https://www.instagram.com/learnwithkaizenlessons/"><i class="fab fa-instagram"></i></a>
                            <!-- <a href="#"><i class="fab fa-youtube"></i></a> -->
                        </div>
                    </div>
                </div>
                <div class="footer-bottom">
                    <p>&copy; 2025 Kaizen Sudoku for Kids. All rights reserved.</p>
                </div>
            </div>
        </footer>
        <script src="https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js"></script>
        <script>
            AOS.init();
            document.addEventListener('DOMContentLoaded', function() {
        // Initialize accordion functionality for FAQ
        const accordionButtons = document.querySelectorAll('.accordion-button');
        
        accordionButtons.forEach(button => {
            button.addEventListener('click', function() {
                this.classList.toggle('collapsed');
                
                const target = document.querySelector(this.getAttribute('data-bs-target'));
                if (target) {
                    target.classList.toggle('show');
                }
            });
        });
        
        // Add smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            });
        });
        
        // Add animation to puzzle piece decorations
        const puzzlePieces = document.querySelectorAll('.puzzle-piece');
        
        // Form validation for enrollment
        const enrollmentForms = document.querySelectorAll('.enrollment-form');
        
        function isValidEmail(email) {
            const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return regex.test(email);
        }
        
        function showError(input, message) {
            const formGroup = input.closest('.form-group');
            const errorElement = formGroup.querySelector('.invalid-feedback') || document.createElement('div');
            
            errorElement.className = 'invalid-feedback';
            errorElement.textContent = message;
            
            if (!formGroup.querySelector('.invalid-feedback')) {
                formGroup.appendChild(errorElement);
            }
            
            input.classList.add('is-invalid');
        }
        
        function clearError(input) {
            input.classList.remove('is-invalid');
            const formGroup = input.closest('.form-group');
            const errorElement = formGroup.querySelector('.invalid-feedback');
            
            if (errorElement) {
                errorElement.remove();
            }
        }
    });

    document.addEventListener('DOMContentLoaded', function() {
        const slides = document.querySelectorAll('.slide');
        let currentSlide = 0;
        
        // Set first slide as active
        if (slides.length > 0) {
            slides[0].classList.add('active');
        }
        
        // Function to change slide
        function nextSlide() {
            // Remove active class from current slide
            slides[currentSlide].classList.remove('active');
            
            // Increment slide index and wrap around if necessary
            currentSlide = (currentSlide + 1) % slides.length;
            
            // Add active class to new current slide
            slides[currentSlide].classList.add('active');
        }
        
        // Auto advance slides every 5 seconds
        if (slides.length > 1) {
            setInterval(nextSlide, 5000);
        }
        
        // Add navigation dots if there are multiple slides
        if (slides.length > 1) {
            const sliderContainer = document.querySelector('.hero-slider');
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'slider-dots';
            
            for (let i = 0; i < slides.length; i++) {
                const dot = document.createElement('span');
                dot.className = 'slider-dot';
                if (i === 0) dot.classList.add('active');
                
                dot.addEventListener('click', function() {
                    // Remove active class from current slide and dot
                    slides[currentSlide].classList.remove('active');
                    dotsContainer.querySelectorAll('.slider-dot')[currentSlide].classList.remove('active');
                    
                    // Update current slide
                    currentSlide = i;
                    
                    // Add active class to new current slide and dot
                    slides[currentSlide].classList.add('active');
                    this.classList.add('active');
                });
                
                dotsContainer.appendChild(dot);
            }
            
            sliderContainer.appendChild(dotsContainer);
            
            // Update dots when slide changes
            const dots = dotsContainer.querySelectorAll('.slider-dot');
            
            const updateDots = function() {
                dots.forEach((dot, index) => {
                    if (index === currentSlide) {
                        dot.classList.add('active');
                    } else {
                        dot.classList.remove('active');
                    }
                });
            };
            
            // Override nextSlide function to update dots
            nextSlide = function() {
                // Remove active class from current slide
                slides[currentSlide].classList.remove('active');
                
                // Increment slide index and wrap around if necessary
                currentSlide = (currentSlide + 1) % slides.length;
                
                // Add active class to new current slide
                slides[currentSlide].classList.add('active');
                
                // Update dots
                updateDots();
            };
        }
        
        // Add swipe support for mobile
        let touchStartX = 0;
        let touchEndX = 0;
        
        const slider = document.querySelector('.hero-slider');
        
        slider.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        slider.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });
        
        function handleSwipe() {
            const threshold = 50; // Minimum distance required for swipe
            
            if (touchEndX + threshold < touchStartX) {
                // Swipe left, go to next slide
                nextSlide();
            } else if (touchEndX > touchStartX + threshold) {
                // Swipe right, go to previous slide
                slides[currentSlide].classList.remove('active');
                currentSlide = (currentSlide - 1 + slides.length) % slides.length;
                slides[currentSlide].classList.add('active');
                
                // Update dots if they exist
                const dots = document.querySelectorAll('.slider-dot');
                if (dots.length > 0) {
                    dots.forEach((dot, index) => {
                        if (index === currentSlide) {
                            dot.classList.add('active');
                        } else {
                            dot.classList.remove('active');
                        }
                    });
                }
            }
        }
    });
    // JavaScript to handle popup functionality
    document.addEventListener("DOMContentLoaded", function () {
        const popup = document.getElementById("enrollmentPopup");
        const closeButton = document.getElementById("closePopup");
        const enrollButtons = document.querySelectorAll(
        '.enroll-button',
        ); // Select all buttons that should open the popup

        // Function to open the popup
        function openPopup() {
        popup.classList.add("show");
        }

        // Attach event listeners to all enroll buttons
        enrollButtons.forEach(function (button) {
        button.addEventListener("click", function (event) {
            event.preventDefault(); // Prevent the button from navigating
            openPopup(); // Open the popup
        });
        });

        // Function to close the popup
        function closePopup() {
        popup.classList.remove("show");
        }

        // Event listener to close the popup when clicking the close button
        closeButton.addEventListener("click", closePopup);

        // Close the popup if the user clicks outside the popup content
        window.addEventListener("click", function (event) {
        if (event.target === popup) {
            closePopup();
        }
        });
    });
    </script>
    </body>
    </html>


    <script>
    document.getElementById("enrollForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const errorMessage = document.getElementById("errorMessage");
    errorMessage.textContent = "";
    const formData = new FormData(this);
    const name = formData.get("name");
    const email = formData.get("email");
    const phone = formData.get("phone");
    if (!name || !email) {
        errorMessage.textContent = "Name and email are required!";
        return;
    }
    if (phone && phone.length < 10) {
        errorMessage.textContent = "Phone number must be at least 10 digits!";
        return;
    }
    const response = await fetch(window.location.href, {
        method: "POST",
        headers: {
        "Content-Type": "application/json"
        },
        body: JSON.stringify({
        name: name,
        email: email,
        phone: phone
        })
    });
    
    const result = await response.json();
    console.log(result);
    if(result.success) {
        document.getElementById("enrollmentPopup").classList.remove("show");
        window.location.href = "/thank-you-sudoku";
    } else {
        errorMessage.textContent = "Email or phone already exists!";
    }
    });
    </script>

    HTML;
}
// Phone number normalization
function standardize_phone_number($phone) {
    if (empty($phone)) return '';
    $phone = preg_replace('/\D+/', '', $phone);
    if (preg_match('/^(91|0091)/', $phone)) $phone = preg_replace('/^(91|0091)/', '', $phone);
    $phone = ltrim($phone, '0');
    if (strlen($phone) > 10) $phone = substr($phone, -10);
    return preg_match('/^\d{10}$/', $phone) ? $phone : '';
}

// Flush rewrite rules on activation
function sudoku_flush_rewrites() {
    sudoku_rewrite_rule();
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'sudoku_flush_rewrites');

// Optional: flush rules on deactivation too
function sudoku_deactivate() {
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'sudoku_deactivate');

add_filter('autoptimize_filter_noptimize', 'disable_ao_on_sudoku', 10, 0);
function disable_ao_on_sudoku() {
    if (get_query_var('sudoku_page') == 1) {
        return true;
    }
    return false;
}
