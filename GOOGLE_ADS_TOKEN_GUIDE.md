# Google広告API認証情報取得ガイド

Google広告APIを使用するには、以下の4つの認証情報が必要です：

1. **Developer Token** - Google Ads APIへのアクセス権
2. **Client ID** - OAuth 2.0クライアントID
3. **Client Secret** - OAuth 2.0クライアントシークレット
4. **Refresh Token** - 永続的なアクセスのためのトークン

---

## ステップ1: Google Cloud Projectの作成

### 1.1 Google Cloud Consoleにアクセス
- https://console.cloud.google.com/ にアクセス
- Googleアカウントでログイン

### 1.2 新しいプロジェクトを作成
1. 画面上部の「プロジェクトを選択」をクリック
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例：「My Ads MCP Server」）
4. 「作成」をクリック

### 1.3 Google Ads APIを有効化
1. 左側のメニューから「APIとサービス」→「ライブラリ」を選択
2. 検索ボックスに「Google Ads API」と入力
3. 「Google Ads API」を選択
4. 「有効にする」をクリック

---

## ステップ2: OAuth 2.0 認証情報の作成

### 2.1 OAuth同意画面の設定
1. 「APIとサービス」→「OAuth同意画面」を選択
2. ユーザータイプ：**「外部」**を選択して「作成」
3. アプリ情報を入力：
   - アプリ名：「My Ads MCP Server」
   - ユーザーサポートメール：あなたのメールアドレス
   - デベロッパーの連絡先情報：あなたのメールアドレス
4. 「保存して次へ」を3回クリック（スコープとテストユーザーはスキップ）
5. 「ダッシュボードに戻る」をクリック

### 2.2 OAuth 2.0 クライアントIDの作成
1. 「APIとサービス」→「認証情報」を選択
2. 「認証情報を作成」→「OAuth クライアント ID」を選択
3. アプリケーションの種類：**「デスクトップアプリ」**を選択
4. 名前：「MCP Server Client」（任意）
5. 「作成」をクリック
6. **重要**: ポップアップに表示される以下をコピー：
   - クライアントID（例：123456789-abc.apps.googleusercontent.com）
   - クライアントシークレット（例：GOCSPX-xxxxxxxxxx）
7. これらを安全な場所に保存

---

## ステップ3: Developer Tokenの取得

### 3.1 Google Ads アカウントにアクセス
1. https://ads.google.com/ にアクセス
2. 広告アカウントにログイン

### 3.2 API Centerにアクセス
1. 右上のツールアイコン（🔧）をクリック
2. 「設定」→「APIセンター」を選択
   - 直接アクセス: https://ads.google.com/aw/apicenter

### 3.3 Developer Tokenを取得
1. 「API Center」ページで「Developer Token」セクションを確認
2. トークンが表示されていない場合：
   - 「トークンをリクエスト」をクリック
   - 利用目的を入力（例：「個人用のMCPサーバー開発」）
   - 送信

### 3.4 トークンの状態について
- **テスト用トークン**: すぐに発行される（自分の管理アカウントのみアクセス可能）
- **本番用トークン**: Googleの審査が必要（通常数日かかる）

**重要**: テスト用トークンでも、自分の広告アカウントにアクセスするには十分です！

---

## ステップ4: Refresh Tokenの取得

Refresh Tokenを取得するには、OAuth 2.0認証フローを実行する必要があります。

### 4.1 認証URLの生成

以下のURLをブラウザで開きます（**CLIENT_ID**を実際の値に置き換えてください）：

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent
```

**置き換える箇所**:
- `YOUR_CLIENT_ID` → ステップ2.2で取得したクライアントID

### 4.2 認証コードの取得
1. URLをブラウザで開く
2. Googleアカウントでログイン（広告アカウントにアクセスできるアカウント）
3. アクセス権限を確認して「許可」
4. 表示される**認証コード**をコピー（例：4/0AY0e-g7xxxxx）

### 4.3 Refresh Tokenの取得

以下のcurlコマンドを実行します（**YOUR_**部分を実際の値に置き換えてください）：

```bash
curl -d "code=YOUR_AUTHORIZATION_CODE&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&redirect_uri=urn:ietf:wg:oauth:2.0:oob&grant_type=authorization_code" https://oauth2.googleapis.com/token
```

**置き換える箇所**:
- `YOUR_AUTHORIZATION_CODE` → 4.2で取得した認証コード
- `YOUR_CLIENT_ID` → クライアントID
- `YOUR_CLIENT_SECRET` → クライアントシークレット

### 4.4 レスポンスからRefresh Tokenを取得

レスポンスは以下のような形式です：

```json
{
  "access_token": "ya29.a0AfH6SMBx...",
  "expires_in": 3599,
  "refresh_token": "1//0gHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxQ",
  "scope": "https://www.googleapis.com/auth/adwords",
  "token_type": "Bearer"
}
```

**`refresh_token`** の値をコピーして保存してください。

---

## ステップ5: Customer IDの確認

Google広告アカウントのCustomer ID（顧客ID）も必要です。

1. https://ads.google.com/ にアクセス
2. 右上に表示される**10桁の数字**（例：123-456-7890）
3. ハイフンを除いた数字のみを使用（例：1234567890）

---

## ステップ6: .envファイルに設定

すべての認証情報を`.env`ファイルに設定します：

```bash
# Google広告API
GOOGLE_ADS_DEVELOPER_TOKEN=あなたのDeveloper Token
GOOGLE_ADS_CLIENT_ID=あなたのClient ID
GOOGLE_ADS_CLIENT_SECRET=あなたのClient Secret
GOOGLE_ADS_REFRESH_TOKEN=あなたのRefresh Token
```

---

## トラブルシューティング

### 「このアプリは確認されていません」と表示される
- OAuth同意画面の設定時に「外部」を選択している場合に表示されます
- 「詳細」→「（アプリ名）に移動」をクリックして続行できます
- 個人使用の場合は問題ありません

### Developer Tokenが「保留中」のまま
- テスト用トークンは即座に使用可能です
- 自分の管理アカウント内のアカウントにはアクセスできます
- 本番環境での使用が必要な場合のみ、審査を待つ必要があります

### Refresh Tokenが取得できない
- `access_type=offline`と`prompt=consent`が認証URLに含まれているか確認
- すでに一度認証している場合、Googleアカウントの「アプリのアクセス権」から該当アプリを削除してから再実行

---

## セキュリティに関する注意

- ✅ すべての認証情報は秘密情報です。他人と共有しないでください
- ✅ GitHubなどにアップロードしないでください（.envファイルは.gitignoreに含まれています）
- ✅ 定期的にトークンを更新してください
- ✅ 不要になったトークンは無効化してください

---

## 参考リンク

- [Google Ads API 公式ドキュメント](https://developers.google.com/google-ads/api/docs/start)
- [OAuth 2.0 認証ガイド](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Google Ads API Center](https://ads.google.com/aw/apicenter)

---

## 次のステップ

すべての認証情報を取得したら、プロジェクトの `.env` ファイルに設定してください。

その後、MCPサーバーのコードでGoogle Ads APIを使用できるようになります！
