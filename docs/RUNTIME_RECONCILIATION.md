# 実行コード整合性とQuiz実装計画

調査日: 2026-10-11（日本時間）。対象: tangonest-app/tangonest。

## 確定した関係

- `TangoNest_Living_Library` は前チャットの開発・テスト用フォルダでGit管理外。
- `TangoNest_GitHub_DEPLOY_FDG10` は同じリモートの公開用Gitリポジトリ。FDG10というフォルダ名でも実行内容はFDG16。
- 旧運用は、開発元で生成・検証した実行ファイルだけを公開リポジトリへ取り込み、通常名ソースやテストを取り残していた。旧READMEもこの運用を明記していた。ファイル名や更新時刻ではなく、公開バイト列と生成処理から判断した。
- 新運用はGitリポジトリへ編集元と対応するQAを集約する。参照元は変更せず保存した。

## 公開版との照合

- GitHub APIのPages設定: `legacy`, `main:/`, status `built`。
- 公開ビルドとリモートmain: `f828b09117292613655488eba959ae3fee71fec2`（2026-09-08 20:43 JST）。
- 既存配布記録69ファイルについて、公開URL・開発元・Git管理先・記録済みSHA-256が全一致。
- 新しい配布候補66ファイルも公開版と全一致。旧69件との差は、未参照のルート用icon-192/icon-512とFDG16報告書を配布対象から外したこと。元ファイル自体は保持。
- 公開ページとサブパスで配信したローカル候補を新規Chromiumで開き、HTMLの全18スクリプトの応答をローカル実ファイルと照合。両方一致、ページエラー0。ユーザーの既存ブラウザ状態には触れていない。
- Pages設定・main・公開ファイル・本番DBは変更していない。

## 同名31件の判断

10件はブラウザが読む互換ファイルと開発元ソースが完全一致しており、その公開済み内容からGit側の編集元を復元した。15件はFDG16のQA・依存・テスト設定を採用して調整した。READMEは新手順へ更新。過去の報告書3件とSQL2件はそのまま保存した。

| ファイル | 判断・内容 |
|---|---|
| `FDG10_UPDATE_GUIDE.md` | 過去のSQL・公開説明の差。履歴を維持 |
| `RC19_ACCOUNT_ISOLATION_QA_REPORT.md` | 過去のデフォルト名等の差。履歴を維持 |
| `README.md` | 古いFDG12・別フォルダ編集の説明を現行手順へ更新 |
| `RELEASE_REPORT.md` | 過去の名称・リセット説明の差。履歴を維持 |
| `SUPABASE_SCHEMA_CURRENT.sql` | 開発元では名前による削除・旧リセット等を除去。既存ファイルは維持 |
| `TANGONEST_RC19_PRODUCTION_MIGRATION.sql` | 上記と同内容の差。既存ファイルは維持 |
| `app.js` | 公開済みのQuiz・音声・設定保存・ローカライズ等を編集元へ復元 |
| `config.js` | FDG16版番号へ一致 |
| `default-playlist.js` | 公開済みのNew Playlistと名前に依存しない修復処理へ一致 |
| `manifest.json` | FDG16アイコンとPWA参照へ一致 |
| `package-lock.json` | 上記依存の固定。互換範囲の開発用2依存も更新 |
| `package.json` | FDG16の検証コマンド・開発用依存。整合性/build/packageを追加 |
| `playwright.config.js` | ポート指定とlocale。さらに既存サーバー再利用を禁止 |
| `style.css` | 公開済みの重複CSS整理・表示調整へ一致 |
| `tests/e2e/accessibility.spec.js` | FDG16のUI・IME・同期・PWA等に対応したテストへ更新 |
| `tests/e2e/app.spec.js` | FDG16のUI・IME・同期・PWA等に対応したテストへ更新 |
| `tests/e2e/fixtures.js` | FDG16のUI・IME・同期・PWA等に対応したテストへ更新 |
| `tests/e2e/mobile.spec.js` | FDG16のUI・IME・同期・PWA等に対応したテストへ更新 |
| `tests/e2e/pwa-harness.html` | FDG16のUI・IME・同期・PWA等に対応したテストへ更新 |
| `tests/e2e/responsive-matrix.spec.js` | FDG16のUI・IME・同期・PWA等に対応したテストへ更新 |
| `tests/e2e/visual.spec.js` | FDG16のUI・IME・同期・PWA等に対応したテストへ更新 |
| `tests/static/learning-contracts.test.js` | FDG16のUI・IME・同期・PWA等に対応したテストへ更新 |
| `tests/static/release-contracts.test.js` | FDG16のUI・IME・同期・PWA等に対応したテストへ更新 |
| `tests/static/ui-contracts.test.js` | FDG16のUI・IME・同期・PWA等に対応したテストへ更新 |
| `tests/unit/learning-presentation.test.js` | FDG16のUI・IME・同期・PWA等に対応したテストへ更新 |
| `tests/unit/sync-regression.test.js` | FDG16のUI・IME・同期・PWA等に対応したテストへ更新 |
| `tn-library-management.js` | 公開済みのLibrary・Bulk Add・保存状態処理へ一致 |
| `tn-supabase-sync.js` | 公開済みのリセットRPC停止・同期・例文処理へ一致 |
| `ui/forest-desk-glass.css` | 公開済みのテーマ・画面調整へ一致 |
| `ui/learning-presentation.js` | 公開済みの弱点・復習表示へ一致 |
| `ui/runtime.js` | 公開済みのPWA更新・アクセシビリティ処理へ一致 |

SQLは別名の `docs/reference/fdg16-schema.sql` をオフライン契約テスト用に保存した。現行DBのスキーマを確認した証拠ではなく、実行対象でもない。旧SQLの全内容を保持し、ビルドからSQLコピー処理を除去した。

## 確立した読み込み経路

`app.js`（編集元）→ `npm run build` → `app-rc19-fdg1.js`（互換生成物）→ `index.html` → ブラウザ。

全12組は `tools/runtime-pairs.json`。直接読み込むUI補助・言語・ロケール等は従来どおり直接編集する。`npm test` が全組一致を確認し、不一致なら配布不可。ビルドでは以前コピー対象から漏れていたdefault-playlistとlearning-engineも全組共通の対応表で生成する。

`package:release` は静的資産だけを新規フォルダへ抽出する。古い生成物、同じ版番号での内容変更、既存候補の上書きを拒否する。公開ハッシュ確認成功後だけ公開基準を更新できる。GitHub ActionsのQAと手動配布ワークフローを追加したが、現在のPages設定には反映していない。正式運用への切替と公開は別途承認後に実施する。具体的手順は `DEVELOPMENT.md`。

## 今回の検証

- `npm test`: 構文・単体・静的・言語・ビルド/配布パイプライン検証成功。
- ブラウザ4スイート: runtime-loading / quiz-focus / progression / random-front。desktop Chromium・mobile Chromium・desktop WebKitの計102件成功。
- 公開版とローカル候補の読み込み確認: 各18スクリプト一致、ページエラー0。
- 12組の整合性、ビルド後の実行ファイル不変、旧SQL保持、生成処理の再現性を確認。
- `npm audit --audit-level=high`: 0 vulnerabilities。ビルド用依存2件を互換範囲で更新。アプリの実行用依存は変更していない。
- スマホ実機のソフトキーボード自動表示、現在の本番DB状態、全アプリの実機受入は今回の検証範囲外。

## 次のQuiz実装計画（まだ実装していない）

1. **設定とセッションを固定する。** 開始時のライブラリ・範囲・形式・方向・件数・音声・時間制限等をセッション設定として保持する。Retry中でも元の設定を失わない設計を先に用意する。
2. **Typingの初期方向をBack→Frontへ。** 新規/未設定の場合に適用し、明示的に保存した方向は維持する。ChoiceとListeningの既存動作を保つ。アカウント切替、保存復元、形式切替を検証する。
3. **正誤共通の進行時間へ。** 共通の基準時間を1か所で管理する（初期案2秒）。音声終了待ち、手動Enter、一時停止、非表示タブ、二重進行防止を維持し、正誤で同じ基準時間になることを時計制御テストで確認する。
4. **Skipを誤答から分ける。** 回答記録にcorrect/incorrect/skippedを区別し、入力・正答のスナップショットも保存する。初期案ではSkipを誤答数・誤答による学習更新に含めず、正答率は採点済み回答を分母にする。時間切れは既存の不正解扱いを維持する。空欄Enterは引き続き無操作。既存の正誤記録は互換変換する。
5. **Continue Quizを追加する。** 終了画面から元の設定を使って新しいセッションを開始する。設定に合う現存単語を重複なしで抽出し、今回は出題順をシャッフルする。2問以上で同じ並びになった場合は並びを変更する。件数は利用可能数で制限し、候補0件・1件・途中終了・Retry後も検証する。
6. **復習画面を回答記録に基づいて改善する。** 正解・誤答・Skipを別集計し、問題、自分の回答、正答、例文/詳細、音声、保存を表示する。Retry Mistakesは実際の誤答を対象にし、Skipは別に見直せる導線を用意する。全問正解・全問Skip・部分終了・長文・モバイルを確認する。
7. **フォーカスとキーボードの受入確認。** 今回はブラウザで初問/次問フォーカスとEnterを検証済み。次回は実際のTyping連続回答・Skip・Retry・Continue・IME確定・350ms入力ロックを通して維持を確認する。iOS SafariとAndroid Chromeの実機でキーボード表示と画面内の入力欄を確認し、制約があればワンタップで入力開始できる導線を設ける。

各区切りで生成→対象テスト→配布候補のローカル確認を行う。Quizの実装と本番公開は今回行っていない。
