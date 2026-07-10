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

export interface BrokerAdapter {
  /** Stable identifier matching the provider registry key. */
  readonly id: string;

  /** Step 1: authenticate with broker credentials. Returns a request/refresh token. */
  login(params: LoginParams): Promise<LoginResult>;

  /** Step 2a: exchange TOTP for a trading token. */
  verifyTOTP(refreshToken: string, totp: string): Promise<VerifyResult>;

  /** Step 2b: exchange SMS/email OTP for a trading token. */
  verifyOTP(refreshToken: string, otp: string): Promise<VerifyResult>;

  /** End an active session. */
  logout(token: string): Promise<void>;
}
