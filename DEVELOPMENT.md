# TangoNest 開発・配布手順

2026-10-11 時点。正式な編集元はこの Git リポジトリです。今回のブランチは `codex/align-runtime-source`。以前の `TangoNest_Living_Library` は FDG16 の参照として残し、今後の変更は二重管理しません。

## 読み込みと編集対象

`app.js` → `npm run build` → `app-rc19-fdg1.js` → `index.html` → ブラウザ。

互換ファイル名の `rc19-fdg1` は版番号の根拠ではありません。内容、HTML、Service Worker、公開ハッシュで判定します。12組の対応は `tools/runtime-pairs.json` に集約しています。`ui/living-library.js`、`ui/study-continuity.js`、`ui/listen-reading.js`、`languages.js`、`bulk-format.js`、ロケール等は HTML から直接読む編集元です。

## ローカル作業

1. このリポジトリで Git status を確認し、作業ブランチを使う。参照フォルダから一括コピーしない。
2. `npm ci` を実行する。
3. 対応表の編集元、または HTML が直接読むファイルを編集する。
4. `npm run build`。互換ファイル、バージョン参照、マニフェスト、静的キャッシュ一覧を生成する。SQLは処理しない。
5. `npm test`。入力と生成物の差があれば失敗する。隔離したコピーで、古い生成物の配布拒否・変更伝播・再ビルドの再現性・SQL保持・配布先の上書き拒否も確認する。
6. `npm run dev` で起動し、`http://127.0.0.1:4173/` を確認する。編集中の変更は再度ビルドしてから再読み込みする。
7. 関連する `npm run test:e2e -- ...` を実行する。ブラウザテストのサーバーは再利用しないため、別フォルダのアプリを誤って検証しない。ポートが使用中なら `TN_TEST_PORT=4196` 等を指定する。
8. コミット前に `npm run check:runtime` と Git diff を確認する。実行用ファイルだけを手編集しない。

## 配布候補の作成・検証

実際の機能変更を公開する場合は `release.json` の `version` を増やしてからビルドします。同じ互換ファイル名でも、クエリのバージョンと Service Worker のキャッシュ版を更新します。今回の編集元整備は実行ファイルの変更を伴わず、FDG16のままです。

```sh
npm run build
npm test
npm run package:release -- work/release-candidate-01
npm run verify:published -- work/release-candidate-01 https://tangonest-app.github.io/tangonest/
```

配布先は毎回新しいディレクトリを指定します。既存候補は上書きしません。抽出対象は静的キャッシュ資産と必要なライセンス等に限定し、SQL・テスト・ツール・認証情報・QAログを配布しません。`release-inventory.json` に実ファイルの SHA-256 を保存します。前回公開した `tools/published-baseline.json` と同じ版番号で内容が変わっている場合、配布候補の作成を拒否します。`verify:published` はその候補と指定URLの全ファイルを照合します。新機能を含む未公開候補が現行公開版と一致しないのは正常です。公開前はローカルの候補配信URL、公開後は公開URLを指定してください。

配布候補をブラウザでも確認する場合、別ターミナルで `python3 -m http.server 4178 --bind 127.0.0.1 --directory work/release-candidate-01` を起動し、このリポジトリから `node tools/verify-browser-runtime.js http://127.0.0.1:4178/` を実行します。公開版の読み込み確認には同ツールへ公開URLを渡します。新しい隔離ブラウザで全18スクリプトを実ファイルと照合し、既存ブラウザのログイン状態には触れません。画面操作は関連E2Eと実機で別途確認します。

## 公開時の手順（今回は実行していません）

現在の Pages 設定は **legacy / main ブランチ / ルート** です。mainへのpushだけで公開されるため、今回のブランチをmainへ反映しません。

今後の正式運用は、配布候補だけを送る `.github/workflows/pages-candidate.yml` に移行します。公開を承認された時点で、まず GitHub Pages の配信元を GitHub Actions に変更し、`github-pages` environment の必要な承認者を設定してください。その後、QAの通った変更をmainに反映します。これは手動公開へ移行するための一度限りの設定で、今回まだ変更していません。

手動の「Publish reviewed runtime to Pages」をmainに対して実行すると、ソース整合性・自動テスト・ビルド・実ブラウザの確認後、抽出した候補をアップロードし、environmentの承認を経て公開します。公開後にPagesビルドのコミットと公開ハッシュ、画面、旧版からの更新を確認します。`npm run verify:published -- <候補ディレクトリ> https://tangonest-app.github.io/tangonest/ --record-baseline` で全ファイル一致を確認した後だけ、公開基準を更新してGitに保存します。配布前の利用者データ削除やSQL実行は不要です。既存PWAの更新は利用者が更新を承認する仕組みを維持します。

## SQLと過去の資料

既存のルートSQL・過去の公開報告書は保存しています。自動ビルドの入力ではありません。`docs/reference/fdg16-schema.sql` は開発元のFDG16 SQLを別名で保存した契約テスト用資料です。本番DBの現在状態を証明せず、実行手順にも含めません。
