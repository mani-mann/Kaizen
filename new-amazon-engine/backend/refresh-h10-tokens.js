/**
 * Refresh Helium 10 tokens using saved session cookies
 * Run this after saving new cookies to generate fresh tokens
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Load H10 config
const H10_CONFIG = {
  ACCOUNT_ID: process.env.H10_ACCOUNT_ID || "1547402760",
  BASE_URL: "https://members.helium10.com",
};

// Load session cookies
const SESSION_FILE = path.join(__dirname, 'h10_session.json');

if (!fs.existsSync(SESSION_FILE)) {
  console.error('❌ h10_session.json not found!');
  console.log('💡 Run: node save-h10-cookies.js first');
  process.exit(1);
}

const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));

async function refreshTokens() {
  try {
    const { default: fetch } = await import('node-fetch');
    
    console.log('🔄 Refreshing Helium 10 tokens...\n');
    
    const cookieString = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    console.log('📡 Calling Helium 10 API...');
    const response = await fetch(`${H10_CONFIG.BASE_URL}/api/v1/site/token?accountId=${H10_CONFIG.ACCOUNT_ID}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'cookie': cookieString,
        'referer': `${H10_CONFIG.BASE_URL}/dashboard?accountId=${H10_CONFIG.ACCOUNT_ID}`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to refresh tokens: ${response.status}`);
      console.error(`   Response: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();
    const innerData = data.data || data;

    if (innerData.token && innerData.pacvueToken) {
      // Save tokens to file
      const TOKEN_FILE = path.join(__dirname, 'h10_tokens.json');
      const tokenData = {
        authorization: innerData.token,
        pacvue_token: innerData.pacvueToken,
        refresh_token: innerData.pacvueRefreshToken || null,
        expires_in: innerData.pacvueTokenExpiresIn || 86400,
        timestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
      
      console.log('✅ Tokens refreshed successfully!');
      console.log(`📁 Saved to: ${TOKEN_FILE}`);
      console.log(`\n📊 Token Info:`);
      console.log(`   - Expires in: ${Math.floor((innerData.pacvueTokenExpiresIn || 86400) / 3600)} hours`);
      console.log(`\n💡 Next steps:`);
      console.log('   1. Restart your server (if running)');
      console.log('   2. Try processing ASINs again');
      
      // Also update .env file if tokens are there
      const envFile = path.join(__dirname, '.env');
      if (fs.existsSync(envFile)) {
        let envContent = fs.readFileSync(envFile, 'utf8');
        
        // Update or add H10_AUTHORIZATION_TOKEN
        if (envContent.includes('H10_AUTHORIZATION_TOKEN=')) {
          envContent = envContent.replace(
            /H10_AUTHORIZATION_TOKEN=.*/,
            `H10_AUTHORIZATION_TOKEN=${innerData.token}`
          );
        } else {
          envContent += `\nH10_AUTHORIZATION_TOKEN=${innerData.token}\n`;
        }
        
        // Update or add H10_PACVUE_TOKEN
        if (envContent.includes('H10_PACVUE_TOKEN=')) {
          envContent = envContent.replace(
            /H10_PACVUE_TOKEN=.*/,
            `H10_PACVUE_TOKEN=${innerData.pacvueToken}`
          );
        } else {
          envContent += `H10_PACVUE_TOKEN=${innerData.pacvueToken}\n`;
        }
        
        fs.writeFileSync(envFile, envContent);
        console.log('   ✅ Updated .env file with new tokens');
      }
      
    } else {
      console.error('❌ Invalid response from Helium 10 API');
      console.error('   Response:', JSON.stringify(innerData, null, 2));
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error refreshing tokens:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

refreshTokens();
