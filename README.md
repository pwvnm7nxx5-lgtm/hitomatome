# ひとまとめ

教員の日々の予定・タスクを、まず一か所へ集めるためのWebアプリです。

公開版: https://pwvnm7nxx5-lgtm.github.io/hitomatome/

## 現在使える機能

- 一行入力と音声入力から予定・タスク候補を作成
- 今日・未整理・未完了タスクの一覧
- 過去・今日・未来の予定を確認できる月間カレンダー
- 完了済み項目の確認と未完了への復元
- ChatGPTでプリントから抽出したJSONの一括取り込み
- Googleカレンダーの新規予定画面への受け渡し
- ブラウザ内へのデータ保存
- アプリ内の使い方・ChatGPT向け指示文
- スマホのホーム画面へ追加できるPWA

## 起動

```powershell
npm install
npm run dev
```

公開用ファイルを作成する場合:

```powershell
npm run build
```

## 注意

現在の初版ではデータをブラウザのローカルストレージへ保存します。別端末との同期とGoogleカレンダー予定の自動取得には、FirebaseプロジェクトとGoogle OAuthの設定が必要です。

このPCのNode.js 24ではViteのビルド終了時に問題が起きるため、`npm run build` は自動的にNode.js 22を一時利用します。

## Google連携の設定

`.env.example` の項目を `.env.local` に設定すると、GoogleログインによるFirestore同期とGoogleカレンダーの読み取り表示が有効になります。

詳しい手順は [GOOGLE_SETUP.md](./GOOGLE_SETUP.md) を参照してください。

- Firebase AuthenticationでGoogleプロバイダを有効化
- Cloud Firestoreを作成し、`firestore.rules`を適用
- Google Calendar APIを有効化
- OAuthウェブクライアントの承認済みJavaScript生成元へ公開URLを追加
- GitHub Pages公開では、同名の値をGitHub Actions Secretsへ登録
