/**
 * Save Helium 10 session cookies to h10_session.json
 * This will allow the system to refresh tokens automatically
 */

const fs = require('fs');
const path = require('path');

// Cookies from browser
const cookies = {
  sid: 'd581hu1418kj2t5i29j3c7g8qa',
  _identity: 'b5ad74fd119af877a86fabc3f3c439dd11d1f6e6757225ab195ba2f24494b73ba%3A2%3A%7Bi%3A0%3Bs%3A9%3A%22_identity%22%3Bi%3A1%3Bs%3A112%3A%22%5B1547402760%2C%22Rdc23zre7xBXXqxWRUfQoxmyF979gQ4a%22%2C2592000%2C%22WRPkE0r42lJmrPbYTzFlokucrrZhi2DP%22%2Cnull%2C%2245.248.159.122%22%5D%22%3B%7D',
  _csrf: 'f007957beb7ea9d6bdb1587fe237b4b5d31d8c35999ee0cacd6b9e48d5aeeefaa%3A2%3A%7Bi%3A0%3Bs%3A5%3A%22_csrf%22%3Bi%3A1%3Bs%3A32%3A%22d2rYXGeNM6Cq85D-uOJZOtHJF34MSZsq%22%3B%7D'
};

// Path to session file (same as server.js)
const SESSION_FILE = path.join(__dirname, 'h10_session.json');

try {
  // Save cookies to file
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  console.log('✅ Helium 10 session cookies saved successfully!');
  console.log(`📁 File: ${SESSION_FILE}`);
  console.log('\n💡 Next steps:');
  console.log('   1. Restart your server (if running)');
  console.log('   2. The system will automatically refresh tokens on next API call');
  console.log('   3. Or call POST /api/h10/refresh to refresh immediately');
} catch (error) {
  console.error('❌ Error saving cookies:', error.message);
  process.exit(1);
}
