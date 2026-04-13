# Ads MCP Server

Meta広告とGoogle広告のデータをClaude Code / Claude Desktopから取得できるMCPサーバーです。

## 機能

- **Google Ads API** - キャンペーン・広告グループ・広告のパフォーマンスデータ取得（GAQL対応）
- **Meta Ads API** - アカウント一覧、インサイト、クリエイティブ分析
- **OAuth認証UI** - ブラウザで簡単に認証完了（複数アカウント対応）
- **トークン暗号化** - AES-256で安全に保存

## セットアップ

### 1. 前提条件

- Node.js v18以上
- Google Cloud Projectの作成が必要（[手順はこちら](./GOOGLE_ADS_TOKEN_GUIDE.md)）

### 2. インストール

```bash
git clone https://github.com/ryohasegawaaduno-crypto/ads-mcp-server.git
cd ads-mcp-server
npm install
```

### 3. 環境変数の設定

```bash
# Mac / Linux
cp .env.example .env

# Windows（コマンドプロンプト）
copy .env.example .env
```

`.env` を編集して、Google Cloud Consoleで取得した値を設定:

```
GOOGLE_ADS_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_ADS_DEVELOPER_TOKEN=xxxxx
```

各値の取得方法:
- Google Ads: [GOOGLE_ADS_TOKEN_GUIDE.md](./GOOGLE_ADS_TOKEN_GUIDE.md)
- Meta Ads: [META_TOKEN_GUIDE.md](./META_TOKEN_GUIDE.md)

### 4. ビルド

```bash
npm run build
```

### 5. OAuth認証

```bash
npm run oauth
```

ブラウザで `http://localhost:3456` を開いて「Googleアカウントで認証」をクリック。

### 6. Claude Code / Claude Desktopに登録

**Claude Code CLIの場合:**

```bash
claude mcp add ads-mcp-server node /path/to/ads-mcp-server/build/index.js
```

**Claude Desktopの場合:**

���定ファイルに追加:
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ads-mcp-server": {
      "command": "node",
      "args": ["/path/to/ads-mcp-server/build/index.js"]
    }
  }
}
```

> Windows の場合、パスはスラッシュを使用してください:
> `"args": ["C:/Users/yourname/ads-mcp-server/build/index.js"]`

### 7. 再起動して確認

Claude Code / Claude Desktopを再起動して確認:

```
Google広告のアカウント一覧を表示して
```

## 使い方

```
# Google広告
Google広告アカウントの一覧を表示して
顧客ID 1234567890のキャンペーンパフォーマンスを過去7日間で取得して

# Meta広告
Meta広告アカウントの一覧を表示して
アカウントact_123456789のキャンペーンパフォーマンスを過去7日間で取得して
```

## セキュリティ

- トークンはAES-256-CBCで暗号化されて `.tokens/` に保存
- `.env` / `.tokens/` は `.gitignore` に含まれておりGit管理外
- 暗号化キーはオーナーのみ読み取り可（パーミッション600）

## ライセンス

MIT
