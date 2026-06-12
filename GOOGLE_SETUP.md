# Google連携セットアップ

GitHub Pagesはアプリ画面を公開し、予定データはFirebase Authenticationでログインした本人専用のFirestore領域へ保存します。

## 1. Firebaseプロジェクト

1. Firebase Consoleでプロジェクトを作成する。
2. Authenticationのログイン方法でGoogleを有効化する。
3. Authenticationの承認済みドメインへ `pwvnm7nxx5-lgtm.github.io` を追加する。
4. Cloud Firestoreを作成する。
5. Webアプリを追加し、表示されたFirebase設定値を控える。
6. Firebase CLIで `firestore.rules` をデプロイする。

```powershell
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules
```

`firestore.rules` は、ログイン中の本人だけが自分のデータを読み書きできる設定です。

## 2. Google Calendar API

1. 同じGoogle CloudプロジェクトでGoogle Calendar APIを有効化する。
2. OAuth同意画面を設定する。
3. OAuthクライアントIDを「ウェブ アプリケーション」で作成する。
4. 承認済みJavaScript生成元へ以下を追加する。

```text
http://localhost:5173
https://pwvnm7nxx5-lgtm.github.io
```

## 3. ローカル開発

`.env.example` を `.env.local` として作り、Firebase設定値とOAuthクライアントIDを入力する。

```powershell
npm run dev
```

## 4. GitHub Pages

GitHubリポジトリの `Settings > Secrets and variables > Actions` に、`.env.example` と同名のSecretsを登録する。登録後、Actionsの `Deploy to GitHub Pages` を再実行する。

FirebaseのWeb設定値とOAuthクライアントIDはブラウザ向け識別子であり、秘密鍵ではありません。ただし、FirestoreルールとOAuthの承認済み生成元は必ず制限してください。
