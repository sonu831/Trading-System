import { MConnect } from '@mstock-mirae-asset/nodetradingapi-typeb';
import * as OTPAuth from 'otpauth';

const CLIENT_CODE = process.env.MSTOCK_CLIENT_CODE || 'MA31803';
const PASSWORD = process.env.MSTOCK_PASSWORD;
const TOTP_SECRET = process.env.MSTOCK_TOTP_SECRET;
const API_KEY = process.env.MSTOCK_API_KEY;

if (!CLIENT_CODE || !PASSWORD || !TOTP_SECRET) {
  console.error('Missing Env Vars');
  process.exit(1);
}

const client = new MConnect('https://api.mstock.trade', encodeURIComponent(API_KEY || ''));

async function testDirectLogin() {
  console.log('--- Testing One-Step Direct Login ---');

  // Generate TOTP
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(TOTP_SECRET),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
  const code = totp.generate();
  console.log(`Generated TOTP: ${code}`);

  try {
    console.log('Calling client.login({ totp: code }) ...');
    const response = await client.login({
      clientcode: CLIENT_CODE,
      password: PASSWORD,
      totp: code, // Trying direct TOTP
      state: 'live',
    });

    console.log('Response:', JSON.stringify(response, null, 2));

    if (response.data && response.data.jwtToken) {
      const token = response.data.jwtToken;
      // Decode to see if it's a trading token (often larger) or limited
      console.log(`Token Length: ${token.length}`);
      // Try to unwrap just in case
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('Payload keys:', Object.keys(payload));
        if (payload.ACCESS_TOKEN) console.log('✅ Contains inner ACCESS_TOKEN (Trading Token!)');
        else console.log('⚠️ No inner ACCESS_TOKEN (Might be Login-Only token)');
      }
    }
  } catch (e: any) {
    console.error('❌ Login Failed:', e.message);
    if (e.response) console.error('Data:', e.response.data);
  }
}

testDirectLogin();
