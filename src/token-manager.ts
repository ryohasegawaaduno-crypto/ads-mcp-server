import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GoogleAdsAccount {
  email: string;
  refresh_token: string;
  developer_token?: string;
  client_id: string;
  client_secret: string;
  timestamp: number;
}

interface TokenData {
  google_ads?: {
    refresh_token: string;
    developer_token?: string;
    client_id: string;
    client_secret: string;
    timestamp: number;
  };
  google_ads_accounts?: GoogleAdsAccount[];
  meta_ads?: {
    access_token: string;
    timestamp: number;
  };
}

export class TokenManager {
  private tokensFilePath: string;
  private encryptionKey: string;

  constructor() {
    // トークンを保存するディレクトリ
    const tokensDir = path.join(__dirname, '..', '.tokens');
    if (!fs.existsSync(tokensDir)) {
      fs.mkdirSync(tokensDir, { recursive: true });
    }

    this.tokensFilePath = path.join(tokensDir, 'tokens.enc');

    // 暗号化キーの生成または読み込み
    const keyPath = path.join(tokensDir, '.key');
    if (fs.existsSync(keyPath)) {
      this.encryptionKey = fs.readFileSync(keyPath, 'utf-8');
    } else {
      // 初回起動時に暗号化キーを生成
      this.encryptionKey = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(keyPath, this.encryptionKey, { mode: 0o600 });
    }
  }

  /**
   * データを暗号化
   */
  private encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey, 'hex'),
      iv
    );

    let encrypted = cipher.update(data, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * データを復号化
   */
  private decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey, 'hex'),
      iv
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  }

  /**
   * トークンを保存
   */
  saveTokens(tokens: TokenData): void {
    const encrypted = this.encrypt(JSON.stringify(tokens));
    fs.writeFileSync(this.tokensFilePath, encrypted, { mode: 0o600 });
  }

  /**
   * トークンを読み込み
   */
  loadTokens(): TokenData | null {
    if (!fs.existsSync(this.tokensFilePath)) {
      return null;
    }

    try {
      const encrypted = fs.readFileSync(this.tokensFilePath, 'utf-8');
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('トークンの読み込みに失敗しました:', error);
      return null;
    }
  }

  /**
   * Google Ads トークンを保存（後方互換性）
   */
  saveGoogleAdsToken(refreshToken: string, clientId: string, clientSecret: string, developerToken?: string): void {
    const existingTokens = this.loadTokens() || {};
    existingTokens.google_ads = {
      refresh_token: refreshToken,
      developer_token: developerToken,
      client_id: clientId,
      client_secret: clientSecret,
      timestamp: Date.now()
    };
    this.saveTokens(existingTokens);
  }

  /**
   * Google Ads アカウントを追加（複数アカウント対応）
   */
  addGoogleAdsAccount(email: string, refreshToken: string, clientId: string, clientSecret: string, developerToken?: string): void {
    const existingTokens = this.loadTokens() || {};
    if (!existingTokens.google_ads_accounts) {
      existingTokens.google_ads_accounts = [];
    }

    // 同じメールのアカウントがあれば更新、なければ追加
    const existingIndex = existingTokens.google_ads_accounts.findIndex(a => a.email === email);
    const account: GoogleAdsAccount = {
      email,
      refresh_token: refreshToken,
      developer_token: developerToken,
      client_id: clientId,
      client_secret: clientSecret,
      timestamp: Date.now()
    };

    if (existingIndex >= 0) {
      existingTokens.google_ads_accounts[existingIndex] = account;
    } else {
      existingTokens.google_ads_accounts.push(account);
    }

    // 後方互換: google_adsも更新（最初のアカウントとして）
    if (!existingTokens.google_ads) {
      existingTokens.google_ads = {
        refresh_token: refreshToken,
        developer_token: developerToken,
        client_id: clientId,
        client_secret: clientSecret,
        timestamp: Date.now()
      };
    }

    this.saveTokens(existingTokens);
  }

  /**
   * Meta Ads トークンを保存
   */
  saveMetaAdsToken(accessToken: string): void {
    const existingTokens = this.loadTokens() || {};
    existingTokens.meta_ads = {
      access_token: accessToken,
      timestamp: Date.now()
    };
    this.saveTokens(existingTokens);
  }

  /**
   * Google Ads トークンを取得（後方互換性）
   */
  getGoogleAdsToken(): { refresh_token: string; developer_token?: string; client_id: string; client_secret: string; timestamp: number } | null {
    const tokens = this.loadTokens();
    return tokens?.google_ads || null;
  }

  /**
   * 全Google Adsアカウントを取得
   */
  getAllGoogleAdsAccounts(): GoogleAdsAccount[] {
    const tokens = this.loadTokens();
    const accounts: GoogleAdsAccount[] = [];

    // google_ads_accountsから取得
    if (tokens?.google_ads_accounts) {
      accounts.push(...tokens.google_ads_accounts);
    }

    // 後方互換: google_adsがあってgoogle_ads_accountsに含まれていない場合
    if (tokens?.google_ads && accounts.length === 0) {
      accounts.push({
        email: 'default',
        refresh_token: tokens.google_ads.refresh_token,
        developer_token: tokens.google_ads.developer_token,
        client_id: tokens.google_ads.client_id,
        client_secret: tokens.google_ads.client_secret,
        timestamp: tokens.google_ads.timestamp
      });
    }

    return accounts;
  }

  /**
   * Meta Ads トークンを取得
   */
  getMetaAdsToken(): string | null {
    const tokens = this.loadTokens();
    return tokens?.meta_ads?.access_token || null;
  }

  /**
   * トークンをクリア
   */
  clearTokens(): void {
    if (fs.existsSync(this.tokensFilePath)) {
      fs.unlinkSync(this.tokensFilePath);
    }
  }
}
