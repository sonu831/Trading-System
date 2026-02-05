const path = require('path');

// 1. Register ts-node to handle the SDK import
require('ts-node').register({
  transpileOnly: true,
  ignore: [/node_modules\/(?!@mstock-mirae-asset)/],
  compilerOptions: {
    module: "commonjs",
    allowJs: true,
    esModuleInterop: true
  }
});

// 2. Load Env
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { MConnect } = require('@mstock-mirae-asset/nodetradingapi-typeb');
const OTPAuth = require('otpauth');
const fs = require('fs');

const CLIENT_CODE = process.env.MSTOCK_CLIENT_CODE;
const PASSWORD = process.env.MSTOCK_PASSWORD;
const TOTP_SECRET = process.env.MSTOCK_TOTP_SECRET;
const API_KEY = process.env.MSTOCK_API_KEY;

if (!CLIENT_CODE || !PASSWORD || !TOTP_SECRET || !API_KEY) {
  console.error('❌ Missing Credentials in .env');
  process.exit(1);
}

const client = new MConnect('https://api.mstock.trade', encodeURIComponent(API_KEY));

async function main() {
  console.log(`🔐 Generating Token for ${CLIENT_CODE}...`);

  // Generate TOTP
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(TOTP_SECRET),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
  const code = totp.generate();
  console.log(`   TOTP: ${code}`);

  try {
    const response = await client.login({
      clientcode: CLIENT_CODE,
      password: PASSWORD,
      totp: code,
      state: 'live',
    });

    if (response.data && response.data.jwtToken) {
      const token = response.data.jwtToken;
      console.log('✅ Login Successful!');
      
      // Check for Access Token inside format
      const parts = token.split('.');
      let finalToken = token;
      
      if (parts.length === 3) {
        try {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            if (payload.ACCESS_TOKEN) {
                console.log('   Found Inner Access Token.');
                finalToken = payload.ACCESS_TOKEN;
            }
        } catch(e) { /* ignore */ }
      }

      console.log(`\n🔑 MSTOCK_ACCESS_TOKEN=${finalToken}\n`);
      
      // Update .env file logic
      const envPath = path.resolve(__dirname, '../../.env');
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Replace existing token
      // Regex to find MSTOCK_ACCESS_TOKEN=... up to newline
      const regex = /^MSTOCK_ACCESS_TOKEN=.*$/m;
      if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `MSTOCK_ACCESS_TOKEN=${finalToken}`);
      } else {
          envContent += `\nMSTOCK_ACCESS_TOKEN=${finalToken}\n`;
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log(`📝 Updated .env file automatically.`);

    } else {
      console.error('❌ Login response missing jwtToken:', JSON.stringify(response));
      process.exit(1);
    }

  } catch (e) {
    console.error('❌ Login Failed:', e.message);
    if(e.response) console.error(e.response.data);
    process.exit(1);
  }
}

main();
