# Meta広告アクセストークン取得ガイド

## 方法1: Graph API Explorer（推奨 - 最も簡単）

### 手順：

1. **Meta for Developersにアクセス**
   - https://developers.facebook.com/tools/explorer にアクセス
   - Facebookアカウントでログイン

2. **アプリの選択**
   - 上部の「Meta App」ドロップダウンから、既存のアプリを選択
   - アプリがない場合は、新しく作成（下記「アプリの作成方法」参照）

3. **ユーザートークンの生成**
   - 「User or Page」ドロップダウンから自分のユーザーを選択
   - 「Permissions」ボタンをクリック

4. **必要な権限を追加**
   以下の権限にチェックを入れます：
   - `ads_read` - 広告データの読み取り（必須）
   - `ads_management` - 広告の管理
   - `business_management` - ビジネスマネージャーへのアクセス
   - `read_insights` - インサイトデータの読み取り

5. **トークンの生成**
   - 「Generate Access Token」ボタンをクリック
   - 権限の確認画面が表示されるので「Continue」→「Done」
   - 生成されたトークンをコピー

6. **長期トークンに変換（重要！）**
   - 短期トークン（1時間で期限切れ）を長期トークン（60日）に変換します
   - https://developers.facebook.com/tools/debug/accesstoken/ にアクセス
   - トークンを貼り付けて「Extend Access Token」をクリック
   - 新しい長期トークンが生成されます

---

## 方法2: Business Manager経由

### 手順：

1. **Meta Business Suiteにアクセス**
   - https://business.facebook.com/ にログイン

2. **Business Settings（ビジネス設定）**
   - 左下の設定アイコンをクリック
   - 「Business Settings」を選択

3. **System Users（システムユーザー）作成**
   - 「Users」→「System Users」
   - 「Add」をクリックして新しいシステムユーザーを作成
   - 名前: 「MCP Server」など
   - Role: 「Admin」

4. **トークンの生成**
   - 作成したシステムユーザーをクリック
   - 「Generate New Token」ボタン
   - アプリを選択
   - 権限を選択（ads_read, ads_management, business_management）
   - 「Generate Token」

5. **広告アカウントへのアクセス権限を付与**
   - 「Ad Accounts」セクションで「Add Assets」
   - 対象の広告アカウントを選択
   - 権限を付与

---

## アプリの作成方法（初めての方向け）

1. https://developers.facebook.com/apps にアクセス
2. 「Create App」をクリック
3. アプリタイプ: **「Business」**を選択
4. アプリ名を入力（例: 「My Ads MCP Server」）
5. アプリの連絡先メールアドレスを入力
6. ビジネスアカウントを選択（持っていない場合は作成）
7. 「Create App」をクリック

アプリが作成されたら、方法1の手順に戻ってトークンを生成します。

---

## トークンの確認方法

取得したトークンが正しく動作するか確認：

```bash
curl -X GET "https://graph.facebook.com/v21.0/me/adaccounts?access_token=YOUR_ACCESS_TOKEN"
```

正常に動作する場合、広告アカウントのリストが返ってきます。

---

## セキュリティに関する注意

- ✅ アクセストークンは秘密情報です。他人と共有しないでください
- ✅ GitHubなどにアップロードしないでください（.envファイルは.gitignoreに含まれています）
- ✅ 定期的にトークンを更新してください
- ✅ 不要になったトークンは無効化してください

---

## 次のステップ

トークンを取得したら、プロジェクトの `.env` ファイルに設定します：

```bash
META_ACCESS_TOKEN=あなたのトークンをここに貼り付け
```
