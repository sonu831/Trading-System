/**
 * VendorRegistry — PLUG-AND-PLAY vendor adapter map.
 *
 * ADDING A NEW BROKER = edit ONLY this file + add the vendor file.
 * No other code changes needed. The ingestion service, backfill script,
 * and dashboard all discover available vendors from this registry.
 *
 * Rules:
 *   1. Every entry must have: provider name, factory function, auth strategy.
 *   2. Auth credentials come from L7 API (GET /api/v1/providers/:name/session).
 *   3. Instrument tokens come from vendor/nifty50_shared.json (per-provider token maps).
 *   4. The backfill batch script auto-discovers the first enabled data provider.
 */

// ── Lazy imports — only load the vendor the system actually uses ──
function getMStockVendor() { return require('./mstock').MStockVendor; }
function getFlatTradeVendor() { return require('./flattrade')?.FlatTradeVendor; }
function getKiteVendor() { return require('./kite')?.KiteVendor; }
function getIndianApiVendor() { return require('./indianapi')?.IndianApiVendor; }
function getCompositeVendor() { return require('./composite')?.CompositeVendor; }
function getOptionChainPoller() { return require('./option-chain-poller')?.OptionChainPoller; }

export const VENDOR_REGISTRY: Record<string, {
  /** Human-readable name */
  label: string;
  /** Factory function returning a BaseVendor instance */
  factory: (options: Record<string, any>) => any;
  /** Whether this vendor supports historical REST API (for backfill) */
  supportsBackfill: boolean;
  /** Which token field from nifty50_shared.json to use for subscriptions */
  tokenMapField: string;
  /** Required credential fields for this vendor to function */
  requiredCredentialFields: string[];
}> = {
  mstock: {
    label: 'mStock (Mirae Asset)',
    factory: (opts) => new (getMStockVendor())(opts),
    supportsBackfill: true,
    tokenMapField: 'mstock',
    requiredCredentialFields: ['api_key', 'client_code', 'password'],
  },
  flattrade: {
    label: 'FlatTrade (Pi Connect)',
    factory: (opts) => new (getFlatTradeVendor())(opts),
    supportsBackfill: true,
    tokenMapField: 'flattrade',
    requiredCredentialFields: ['api_key', 'api_secret'],
    /** Historical data via EODChartData POST (epoch timestamps) */
    backfillEndpoint: 'https://piconnect.flattrade.in/PiConnectAPI/EODChartData',
  },
  kite: {
    label: 'Zerodha Kite',
    factory: (opts) => new (getKiteVendor())(opts),
    supportsBackfill: true,
    tokenMapField: 'kite',
    requiredCredentialFields: ['api_key', 'api_secret'],
  },
  indianapi: {
    label: 'IndianAPI (Free)',
    factory: (opts) => new (getIndianApiVendor())(opts),
    supportsBackfill: false,
    tokenMapField: 'indianapi',
    requiredCredentialFields: [],
  },
  optionchain: {
    label: 'Option Chain Poller',
    factory: (opts) => new (getOptionChainPoller())(opts),
    supportsBackfill: false,
    tokenMapField: '',
    requiredCredentialFields: [],
  },
};

/** Resolve a vendor by name from the registry */
export function resolveVendor(providerName: string, options: Record<string, any>) {
  const normalized = providerName.toLowerCase();
  const entry = VENDOR_REGISTRY[normalized] || VENDOR_REGISTRY['composite'];
  if (!entry) throw new Error(`Unknown vendor: ${normalized}`);
  return entry.factory(options);
}

/** Returns all vendor names that have a factory registered */
export function availableVendors(): string[] {
  return Object.keys(VENDOR_REGISTRY).filter(k => !!VENDOR_REGISTRY[k]?.factory);
}

/** Returns vendors that support historical REST API backfill */
export function backfillVendors(): string[] {
  return Object.entries(VENDOR_REGISTRY)
    .filter(([, v]) => (v as any).supportsBackfill)
    .map(([k]) => k);
}
