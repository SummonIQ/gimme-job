export type DesktopAuthStatus = 'unpaired' | 'paired' | 'invalid';

export interface DesktopAuthState {
  readonly message?: string;
  readonly scopes?: readonly string[];
  readonly status: DesktopAuthStatus;
  readonly tokenId?: string;
  readonly userId?: string;
}

export interface DesktopTokenStore {
  clearToken: () => Promise<void>;
  readToken: () => Promise<string | null>;
  writeToken: (token: string) => Promise<void>;
}

export interface ExchangePairingCodeInput {
  readonly code: string;
  readonly deviceOs?: string;
  readonly label: string;
}

export type ExchangePairingCodeResult =
  | {
      readonly ok: true;
      readonly token: string;
      readonly tokenId: string;
      readonly userId: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export type ValidateDesktopTokenResult =
  | {
      readonly ok: true;
      readonly scopes: readonly string[];
      readonly tokenId: string;
      readonly userId: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export interface DesktopTokenClient {
  exchangePairingCode: (
    input: ExchangePairingCodeInput,
  ) => Promise<ExchangePairingCodeResult>;
  validateToken: (token: string) => Promise<ValidateDesktopTokenResult>;
}
