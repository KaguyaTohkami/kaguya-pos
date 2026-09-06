# K-POS

Cloudflare Workers + D1 を使用したオンラインPOSシステムです。

## 構成

- Next.js / React
- Cloudflare Workers
- Cloudflare D1
- Cloudflare Assets
- 任意でCloudflare R2（商品画像保存）


## 新規環境の構築

### 1. 依存関係をインストール

```bash
bun install
```

### 2. Cloudflareへログイン

```bash
bunx wrangler login
```

### 3. D1を作成

```bash
bunx wrangler d1 create YOUR_D1_NAME
```

表示された `database_name` と `database_id` を `wrangler.jsonc` に設定します。

```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "YOUR_D1_NAME",
    "database_id": "YOUR_D1_DATABASE_ID"
  }
]
```

### 4. ビルド

```bash
bun run build
```

### 5. デプロイ

```bash
bunx wrangler deploy
```

## D1の初期化

K-POSは初回アクセス時にWorkerがD1の必要なテーブルを安全に1つずつ作成します。

手動でSQLを一括実行する必要はありません。

作成されるテーブル:

- `settings`
- `staff`
- `products`
- `sales`
- `sale_items`
- `role_display_settings`

初期設定:

- 店舗名: `K-POS`
- 初期管理者名: `サーバー管理者`
- 初期ロール: `SUPER_ADMIN`
- 有効: `true`
- パスワード: 未設定
- アクセスキー: 未設定

既存D1を使用する場合も、既存データを削除せず、不足している構造だけを補完します。

## スタッフ

管理権限を持つユーザーはスタッフ管理画面からスタッフ名を変更できます。

`SUPER_ADMIN` の名前も変更できます。名前を変更してもロールや権限は変更されません。

## R2

商品画像をR2へ保存する場合は、利用者自身のCloudflare環境でR2バケットを作成してください。
本配布版には本番R2オブジェクトを含めません。

## GitHub

新規プロジェクトとして使用する場合は、GitHubに `K-POS` リポジトリを作成して、プロジェクトのルートをそのまま `main` ブランチへ配置します。

```bash
git init
git add .
git commit -m "Initial K-POS"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/K-POS.git
git push -u origin main
```

## Cloudflare Workers Builds

- Repository: 自分の `K-POS`
- Branch: `main`
- Root directory: `/`
- Build command: `bun run build`
- Deploy command: `bunx wrangler deploy`

## Worker名

`wrangler.jsonc` の `name` は小文字・数字・ハイフンのみを使用してください。

例:

```text
k-pos
```


## APIセキュリティ

- D1 APIはスタッフのBearer認証を必須化しています。
- `password_hash` と `access_key` はAPIから取得できません。
- 商品・店舗設定・スタッフ・会計履歴・在庫更新にはロール別のサーバー側権限チェックがあります。
- 初回セットアップでパスワードを設定できるのは初期SUPER_ADMIN（local_id=1）のみです。追加スタッフのパスワードはスタッフ管理画面から管理者が設定してください。
- 配布先ではD1を設定後、初期管理者のパスワードを必ず設定してください。
