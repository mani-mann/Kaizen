# Email Templates

This directory contains HTML email templates used by the chatbot system.

## Template Files

### welcome.html
- **Purpose**: Welcome email sent to new users who sign up for the 7-Day Sudoku Challenge
- **Triggers**: Automatically sent when user provides email address via chatbot
- **Variables**: 
  - `{{name}}` - User's name
  - `{{userEmail}}` - User's email address
  - `{{websiteUrl}}` - Website URL for CTA button
  - `{{currentDate}}` - Current date when email is sent

### admin-notification.html
- **Purpose**: Admin notification sent when new user provides contact information
- **Triggers**: Automatically sent to admin email when user contact info is collected
- **Variables**:
  - `{{userEmail}}` - User's email address
  - `{{userPhone}}` - User's phone number
  - `{{timestamp}}` - Registration timestamp
  - `{{userId}}` - Database user ID

## Template Variables

Templates use double curly braces `{{variable}}` for placeholder replacement.
All variables are processed by the EmailService class before sending.

## Styling

- Mobile-responsive design
- Inline CSS for better email client compatibility
- Professional branding with Kaizen MicroLessons theme
- Accessibility considerations (color contrast, readable fonts)

## Editing Templates

1. Edit the HTML files directly in this directory
2. Test changes by triggering emails through the chatbot
3. Ensure all `{{variables}}` are properly replaced
4. Test across different email clients if possible

## Environment Variables

Make sure these are set in your .env file:
- `EMAIL_USER` - Gmail account for sending emails
- `EMAIL_PASS` - App-specific password for Gmail
- `ADMIN_EMAIL` - Email address to receive admin notifications
- `WEBSITE_URL` - URL for website links in emails

## Fallback Templates

If template files cannot be loaded, the EmailService will use a simple fallback template to ensure emails are still sent.
