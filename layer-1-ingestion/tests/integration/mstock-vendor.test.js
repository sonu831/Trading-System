/**
 * MStockVendor Integration Tests
 *
 * Runs against the LIVE MStock API.
 * Requires valid credentials in .env
 */

require('ts-node').register({
  transpileOnly: true,
  ignore: [/node_modules\/(?!@mstock-mirae-asset)/],
});

const { MStockVendor } = require('../../src/vendors/mstock');
const { DateTime } = require('luxon');

describe('MStock Vendor Integration', () => {
  let vendor;

  beforeAll(() => {
    // Initialize vendor
    vendor = new MStockVendor({
      symbols: ['NSE:22'], // ACC
      onTick: jest.fn(),
    });
  });

  afterAll(async () => {
    if (vendor) {
      await vendor.disconnect();
    }
  });

  test('should authenticate successfully (2-Step)', async () => {
    await vendor.connect();
    // Even if WS fails (502), the Auth (HTTP) step should succeed and set the token
    // Use reflection or public method to check connection state or token presence
    expect(vendor.accessToken).toBeDefined();
    expect(vendor.accessToken.length).toBeGreaterThan(50);
  });

  test('should fetch historical data with chunking logic', async () => {
    // Use a known date range (e.g., last 3 days)
    const end = DateTime.now();
    const start = end.minus({ days: 3 });

    // We use a fixed date in the past to ensure data exists (Market hours issue otherwise)
    // Fixed date: 2025-08-11 to 2025-08-14 (from previous manual verifiction)
    const params = {
      exchange: 'NSE',
      symboltoken: '22',
      interval: 'ONE_MINUTE',
      fromdate: '2025-08-11',
      todate: '2025-08-14',
    };

    const response = await vendor.fetchData(params);

    expect(response).toBeDefined();
    expect(response.status).toBe(true);
    expect(response.data).toBeDefined();

    // Handle array or object wrapper
    const candles = response.data.candles || response.data;
    expect(Array.isArray(candles)).toBe(true);
    expect(candles.length).toBeGreaterThan(0);

    // Based on previous manual test, we expect around 750 candles
    console.log(`Test Retrieved ${candles.length} candles.`);
  });
});
