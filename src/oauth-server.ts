import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { TokenManager } from './token-manager.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.OAUTH_PORT || '3456');

// トークンマネージャーのインスタンス
const tokenManager = new TokenManager();

// Google OAuth2クライアント（.env から取得）
const GOOGLE_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('ERROR: GOOGLE_ADS_CLIENT_ID と GOOGLE_ADS_CLIENT_SECRET を .env に設定してください。');
  console.error('取得方法: GOOGLE_ADS_TOKEN_GUIDE.md を参照');
  process.exit(1);
}
const REDIRECT_URI = `http://localhost:${PORT}/auth/google/callback`;

const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// ホームページ
app.get('/', (req, res) => {
  const googleAccounts = tokenManager.getAllGoogleAdsAccounts();
  const metaToken = tokenManager.getMetaAdsToken();

  const accountListHtml = googleAccounts.length > 0
    ? googleAccounts.map(a => `
        <div style="background:#e8f5e9;border-radius:8px;padding:12px;margin:8px 0;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong>${a.email}</strong><br>
            <small style="color:#666">最終更新: ${new Date(a.timestamp).toLocaleString('ja-JP')}</small>
          </div>
          <span style="color:#27ae60;font-weight:600;">✓ 接続済み</span>
        </div>
      `).join('')
    : '<p style="color:#999;text-align:center;padding:12px;">アカウント未接続</p>';

  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>広告API認証 - MCP Server</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 600px;
          width: 100%;
          padding: 40px;
        }
        h1 { color: #333; font-size: 28px; margin-bottom: 10px; text-align: center; }
        .subtitle { color: #666; text-align: center; margin-bottom: 30px; font-size: 14px; }
        .service-card {
          background: #f7f9fc;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
          border: 2px solid #e2e8f0;
        }
        .service-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .service-name { font-size: 20px; font-weight: 600; color: #333; }
        .status { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .status.connected { background: #d4edda; color: #155724; }
        .status.disconnected { background: #f8d7da; color: #721c24; }
        .auth-button {
          display: inline-block;
          background: #4285f4;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          width: 100%;
          text-align: center;
          margin-top: 12px;
        }
        .auth-button:hover { background: #357ae8; }
        .info-text { color: #666; font-size: 13px; margin-top: 8px; line-height: 1.5; }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          color: #999;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>広告API認証センター</h1>
        <p class="subtitle">Claude MCPサーバーの広告API認証管理</p>

        <!-- Google Ads -->
        <div class="service-card">
          <div class="service-header">
            <div class="service-name">Google Ads</div>
            <span class="status ${googleAccounts.length > 0 ? 'connected' : 'disconnected'}">
              ${googleAccounts.length > 0 ? googleAccounts.length + ' アカウント接続済み' : '未接続'}
            </span>
          </div>
          ${accountListHtml}
          <a href="/auth/google" class="auth-button">
            ${googleAccounts.length > 0 ? '+ 別のGoogleアカウントを追加' : 'Googleアカウントで認証'}
          </a>
          <a href="/auth/google/manual" style="display:inline-block;background:#ff9800;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;width:100%;text-align:center;margin-top:8px;">
            手動でトークンを入力（Workspace制限回避）
          </a>
          <p class="info-text">
            複数のGoogleアカウントを追加できます。OAuth認証が使えない場合は手動入力も可能です。
          </p>
        </div>

        <!-- Meta Ads -->
        <div class="service-card">
          <div class="service-header">
            <div class="service-name">Meta Ads (Facebook/Instagram)</div>
            <span class="status ${metaToken ? 'connected' : 'disconnected'}">
              ${metaToken ? '✓ 接続済み' : '未接続'}
            </span>
          </div>
          <p class="info-text">
            ${metaToken ? '✓ Meta Ads APIに接続済みです。環境変数経由で設定されています。' : 'Meta広告APIは環境変数で設定してください。'}
          </p>
        </div>

        <div class="footer">
          <p>Claude MCP Server v1.0.0</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Google OAuth認証開始
app.get('/auth/google', (req, res) => {
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    prompt: 'consent' // refresh_tokenを確実に取得するため
  });

  res.redirect(authorizeUrl);
});

// Google OAuthコールバック
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>認証エラー</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
          }
          .error-container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          h1 { color: #e74c3c; margin-bottom: 20px; }
          p { color: #666; margin-bottom: 24px; }
          a {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>❌ 認証エラー</h1>
          <p>認証コードが取得できませんでした。もう一度お試しください。</p>
          <a href="/">ホームに戻る</a>
        </div>
      </body>
      </html>
    `);
  }

  try {
    // 認証コードをトークンに交換
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error('Refresh tokenが取得できませんでした');
    }

    // メールアドレスを取得
    let email = 'unknown';
    try {
      const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      email = userInfoRes.data.email || 'unknown';
    } catch (e) {
      console.error('メールアドレス取得失敗:', e);
    }

    // トークンを保存（複数アカウント対応）
    tokenManager.addGoogleAdsAccount(
      email,
      tokens.refresh_token,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    );

    console.log(`✅ Google Ads認証成功！（${email}）Refresh tokenを保存しました`);

    res.send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>認証成功</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
          }
          .success-container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          .success-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 { color: #27ae60; margin-bottom: 20px; }
          p { color: #666; margin-bottom: 24px; line-height: 1.6; }
          .info-box {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
            color: #155724;
            font-size: 14px;
          }
          a {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            margin: 8px;
          }
          a:hover {
            background: #5568d3;
          }
        </style>
      </head>
      <body>
        <div class="success-container">
          <div class="success-icon">✅</div>
          <h1>認証成功！</h1>
          <p><strong>${email}</strong> の Google Ads API認証が完了しました。</p>
          <div class="info-box">
            <strong>次のステップ：</strong><br>
            1. Developer Tokenを取得（まだの場合）<br>
            2. Claude MCPサーバーを再起動<br>
            3. Google Ads APIの利用を開始
          </div>
          <p><small>トークンは安全に暗号化されて保存されています</small></p>
          <a href="/">ホームに戻る</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Google OAuth認証エラー:', error);
    res.send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>認証エラー</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
          }
          .error-container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          h1 { color: #e74c3c; margin-bottom: 20px; }
          p { color: #666; margin-bottom: 24px; }
          .error-details {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
            color: #721c24;
            font-size: 14px;
            text-align: left;
          }
          a {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>❌ 認証エラー</h1>
          <p>トークンの取得中にエラーが発生しました。</p>
          <div class="error-details">
            <strong>エラー詳細：</strong><br>
            ${error instanceof Error ? error.message : String(error)}
          </div>
          <a href="/">もう一度試す</a>
        </div>
      </body>
      </html>
    `);
  }
});

// JSON bodyパーサー
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 手動トークン入力ページ
app.get('/auth/google/manual', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>手動トークン入力 - Google Ads</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 600px;
          width: 100%;
          padding: 40px;
        }
        h1 { color: #333; font-size: 24px; margin-bottom: 10px; text-align: center; }
        .subtitle { color: #666; text-align: center; margin-bottom: 30px; font-size: 14px; line-height: 1.6; }
        .form-group { margin-bottom: 20px; }
        label { display: block; font-weight: 600; color: #333; margin-bottom: 6px; font-size: 14px; }
        input, textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          font-family: monospace;
          transition: border-color 0.2s;
        }
        input:focus, textarea:focus { outline: none; border-color: #667eea; }
        textarea { min-height: 80px; resize: vertical; }
        .submit-btn {
          display: block;
          width: 100%;
          background: #27ae60;
          color: white;
          padding: 14px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 10px;
        }
        .submit-btn:hover { background: #219a52; }
        .back-link { display: block; text-align: center; margin-top: 16px; color: #667eea; text-decoration: none; }
        .help-box {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
          font-size: 13px;
          color: #856404;
          line-height: 1.6;
        }
        .help-box strong { display: block; margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>手動トークン入力</h1>
        <p class="subtitle">
          Google Workspaceの制限等でOAuth認証が使えない場合、<br>
          リフレッシュトークンを直接入力して登録できます。
        </p>

        <div class="help-box">
          <strong>リフレッシュトークンの取得方法：</strong>
          1. <a href="https://developers.google.com/oauthplayground/" target="_blank">Google OAuth Playground</a> を開く<br>
          2. 右上の歯車アイコン → 「Use your own OAuth credentials」にチェック<br>
          3. Client ID: <code>${GOOGLE_CLIENT_ID}</code><br>
          4. Client Secret: <code>${GOOGLE_CLIENT_SECRET}</code><br>
          5. 左の「Step 1」で <code>https://www.googleapis.com/auth/adwords</code> と <code>https://www.googleapis.com/auth/analytics.readonly</code> を入力して Authorize<br>
          6. 「Step 2」で「Exchange authorization code for tokens」をクリック<br>
          7. 表示された <strong>refresh_token</strong> の値をコピー
        </div>

        <form action="/auth/google/manual" method="POST">
          <div class="form-group">
            <label>メールアドレス</label>
            <input type="email" name="email" placeholder="your-email@example.com" required>
          </div>
          <div class="form-group">
            <label>リフレッシュトークン</label>
            <textarea name="refresh_token" placeholder="1//0e..." required></textarea>
          </div>
          <div class="form-group">
            <label>Client ID（別のOAuthクライアントを使った場合のみ入力）</label>
            <input type="text" name="client_id" placeholder="省略時: デフォルトのClient IDを使用">
          </div>
          <div class="form-group">
            <label>Client Secret（別のOAuthクライアントを使った場合のみ入力）</label>
            <input type="text" name="client_secret" placeholder="省略時: デフォルトのClient Secretを使用">
          </div>
          <button type="submit" class="submit-btn">トークンを登録</button>
        </form>
        <a href="/" class="back-link">ホームに戻る</a>
      </div>
    </body>
    </html>
  `);
});

// 手動トークン保存処理
app.post('/auth/google/manual', (req, res) => {
  const { email, refresh_token, client_id, client_secret } = req.body;

  if (!email || !refresh_token) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head><meta charset="UTF-8"><title>エラー</title>
        <style>
          body { font-family: -apple-system, sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .box { background: white; border-radius: 12px; padding: 40px; max-width: 500px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          h1 { color: #e74c3c; margin-bottom: 20px; }
          a { display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>入力エラー</h1>
          <p>メールアドレスとリフレッシュトークンの両方を入力してください。</p>
          <br><a href="/auth/google/manual">戻る</a>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const useClientId = (client_id && client_id.trim()) || GOOGLE_CLIENT_ID;
    const useClientSecret = (client_secret && client_secret.trim()) || GOOGLE_CLIENT_SECRET;

    tokenManager.addGoogleAdsAccount(
      email.trim(),
      refresh_token.trim(),
      useClientId,
      useClientSecret,
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    );

    console.log(`✅ 手動トークン登録成功！（${email}）Client ID: ${useClientId.substring(0, 20)}...`);

    res.send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head><meta charset="UTF-8"><title>登録成功</title>
        <style>
          body { font-family: -apple-system, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .box { background: white; border-radius: 12px; padding: 40px; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
          h1 { color: #27ae60; margin-bottom: 20px; }
          p { color: #666; margin-bottom: 16px; line-height: 1.6; }
          .info-box { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 16px; margin: 20px 0; color: #155724; font-size: 14px; }
          a { display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 8px; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>登録成功！</h1>
          <p><strong>${email}</strong> のトークンを登録しました。</p>
          <div class="info-box">
            Claude MCPサーバーを再起動すると、このアカウントの広告データにアクセスできるようになります。
          </div>
          <a href="/">ホームに戻る</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('手動トークン登録エラー:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head><meta charset="UTF-8"><title>エラー</title>
        <style>
          body { font-family: -apple-system, sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .box { background: white; border-radius: 12px; padding: 40px; max-width: 500px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          h1 { color: #e74c3c; margin-bottom: 20px; }
          a { display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>登録エラー</h1>
          <p>${error instanceof Error ? error.message : String(error)}</p>
          <br><a href="/auth/google/manual">戻る</a>
        </div>
      </body>
      </html>
    `);
  }
});

// 認証状態確認API
app.get('/status', (req, res) => {
  const googleAccounts = tokenManager.getAllGoogleAdsAccounts();
  const metaToken = tokenManager.getMetaAdsToken();

  res.json({
    google_ads: {
      account_count: googleAccounts.length,
      accounts: googleAccounts.map(a => ({
        email: a.email,
        has_developer_token: !!a.developer_token,
        timestamp: a.timestamp
      }))
    },
    meta_ads: {
      authenticated: !!metaToken
    }
  });
});

// サーバー起動
export function startOAuthServer() {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🚀 OAuth認証サーバーが起動しました！                          ║
║                                                                ║
║   📍 URL: http://localhost:${PORT}                              ║
║                                                                ║
║   👉 ブラウザで上記URLを開いて認証を開始してください            ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);
  });
}

// モジュールとして直接実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  startOAuthServer();
}
