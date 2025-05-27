const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Test Gmail SMTP connection
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP connection failed:', error);
  } else {
    console.log('SMTP connection successful!');
  }
});

app.post('/send-email', async (req, res) => {
  const { email, subject, content } = req.body;

  if (!email || !subject || !content) {
    return res.status(400).json({ error: 'Email, subject, and content are required.' });
  }

  const mailOptions = {
    from: `Kaizen Lessons <${process.env.EMAIL_USER}>`,
    to: email,
    subject: subject,
    text: content,
    headers: {
      'X-Mailer': 'Node.js Gmail Express Server',
      'Reply-To': process.env.EMAIL_USER,
    },
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
