# ひとまとめ

教員の日々の予定・タスクを、まず一か所へ集めるためのWebアプリです。

公開版: https://pwvnm7nxx5-lgtm.github.io/hitomatome/

## 現在使える機能

- 一行入力と音声入力から予定・タスク候補を作成
- 今日・受信箱・未完了タスクの一覧
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
