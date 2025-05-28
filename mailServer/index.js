const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
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

// Health check
app.get('/', (req, res) => {
  res.status(200).send('Server is up and running!');
});

// Send email
app.post('/send-email', async (req, res) => {
  const { email, name } = req.body;
  const subject = "🎉 Welcome to the 7-Day Sudoku Challenge!";
  if (!email || !name ) {
    return res.status(400).json({ error: 'Email, name, and subject are required.' });
  }

  // Read and personalize HTML
  const templatePath = path.join(__dirname, 'emailTemplates', 'welcome.html');
  let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
  htmlTemplate = htmlTemplate.replace('{{name}}', name);

  const mailOptions = {
    from: `"Kaizen MicroLessons" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    html: htmlTemplate,
    headers: {
      'X-Mailer': 'Node.js Gmail Express Server',
      'Reply-To': process.env.EMAIL_USER,
    },
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'HTML email sent successfully!' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
