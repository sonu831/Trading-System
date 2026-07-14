/**
 * Broker Adapter Contract — one wrapper per external system.
 *
 * Every broker SDK (MStock, FlatTrade, Kite) implements this interface.
 * The strategy owns auth FLOW; the adapter owns TRANSPORT.
 * Adding a broker = new adapter file + one registry line. Zero strategy edits.
 */

export interface LoginParams {
  clientcode: string;
  password: string;
  totp?: string;
  state?: string;
}

export interface LoginResult {
  jwtToken: string;
}

export interface VerifyResult {
  jwtToken: string;
}

export interface QuoteParams {
  mode: 'FULL' | 'LTP' | 'OHLC';
  exchangeTokens: Record<string, string[]>;
}

export interface HistoricalParams {
  exchange: string;
  symboltoken: string;
  interval: string;
  fromdate: string;
  todate: string;
}

export interface OptionChainParams {
  underlying: string;
  expiry: string;
  strike?: number;
}

export interface BrokerAdapter {
  /** Stable identifier matching the provider registry key. */
  readonly id: string;

  /** The underlying SDK client (MConnect, etc.) for direct access. */
  readonly client: any;

  // ── Auth ──

  /** Step 1: authenticate with broker credentials. Returns a request/refresh token. */
  login(params: LoginParams): Promise<LoginResult>;

  /** Step 2a: exchange TOTP for a trading token. */
  verifyTOTP(refreshToken: string, totp: string): Promise<VerifyResult>;

  /** Step 2b: exchange SMS/email OTP for a trading token. */
  verifyOTP(refreshToken: string, otp: string): Promise<VerifyResult>;

  /** End an active session. */
  logout(token: string): Promise<void>;

  /** Apply a JWT access token for subsequent API calls. */
  setAccessToken(token: string): void;

  // ── Market Data ──

  /** Get real-time quotes. */
  getQuote(params: QuoteParams): Promise<any>;

  /** Get historical candle data. */
  getHistoricalData(params: HistoricalParams): Promise<any>;

  /** Get option chain for an underlying. */
  getOptionChain(params: OptionChainParams): Promise<any>;

  // ── Portfolio ──

  /** Get open positions. */
  getPositions(): Promise<any>;

  /** Get holdings. */
  getHoldings(): Promise<any>;

  /** Place an order. */
  placeOrder(params: Record<string, unknown>): Promise<any>;
}
