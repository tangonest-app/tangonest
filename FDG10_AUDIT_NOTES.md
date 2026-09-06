# TangoNest FDG10 Product Re-Audit

実施日: 2026-09-05〜06 JST。対象: 1.0.0-rc.19-fdg10。
判定: **NOT READY（本番・実機の受け入れ確認が未完了）**。
本番データ削除なし。本番DB変更なし。公開サイトへの反映なし。

## 1. Executive Summary

FDG9のForest Desk Glassを保ち、Bulk Addの入力支援、検証、保存の安全性、アイコン、画面遷移、学習表示を改善した。
全面Rewrite、独自認証、有料AI API、Dictation、ゲーム要素は追加していない。
単体テストだけで止めず、実ブラウザの操作・目視で見つかったCards反転不良なども修正した。
配布候補は38ファイル。旧配布コード、テスト用認証、開発依存関係は含めない。

## 2. Initial Audit Findings

| 優先度 | 問題 | 原因 |
| --- | --- | --- |
| Critical | ログイン時に既存データを消し得る | 旧reset RPCが認証初期化に残存。フルSQLにも全体リセットが残存 |
| High | Bulkの同時登録・再試行が危険 | ロックが最初のawaitより後。途中保存記録と安定IDが不足 |
| High | 部分失敗の成功件数が不正確 | 応答の行数・IDを検証せず、最後だけで成功数とUndoを構築 |
| Medium | 空欄・CSV・不正行の扱いが崩れる | 行全体のtrim、単純なカンマ分割、無効行のプレビュー除外 |
| Medium | 形式を覚えないと貼り付けにくい | フィールド・ガイド・プロンプト・サンプルを共有していない |
| Medium | 古いアイコンが残り得る | 非バージョンURL、通常画像とmaskable用途の混在、192px画像の不一致 |
| Medium | 戻る・進むが画面に追従しない | ブラウザ履歴とアプリ内移動が未連携 |
| Low | 詳細のお気に入り表示・フォーカスが古い | 詳細DOMの再生成と重複レンダー |

追加発見: CardsのCSSクラス不一致、学習条件復元後の件数、Home習得判定不一致、320px横はみ出し、Bulk末尾CTA、Settings状態省略、空状態の文章連結。

## 3. Fixes Implemented

- 認証初期化から旧リセットを除去。取得失敗では認証を破棄せず、そのユーザー自身のキャッシュだけを保持。
- Bulkのロックを最初のawaitより前に取得。250件ずつ保存し、アカウント別の復旧記録にID・内容・確認済み件数を保持。
- 応答紛失や再読み込み後も、同じIDを照会し未保存分だけ送信。最終読込に失敗した場合は成功と表示しない。
- バッチごとのUndo、停止・再開、入力保持、進捗、登録中の更新防止を整備。
- version・icon・SDKをrelease.jsonに集約。稼働中の互換ファイルは生成し内容一致をテスト。
- 参照されない旧配布ファイル36個を削除。未使用確認済みのLibrary CSS 18ルールを整理。

## 4. Proactive Improvements

- Cards: JSのis-flippedとCSSのflippedを統一。実際の裏面への回転を確認する回帰テストを追加。
- Cards: 保存した学習条件を戻す際、件数も即時更新。
- Home: Memory Pathとヘッダーで同じ学習エンジンの習得基準を使用。未学習はreviewCountで判定。
- Home: Mistake Reviewの空状態で見出しと説明を分離。
- Library: 同期後に詳細表示を更新し、お気に入り操作中のフォーカスを保持。重複描画を除去。
- Navigation: 前回画面、明示URL、戻る・進むを連携。他タブの保存画面が明示URLを上書きしない。
- Settings: Offline/Synced/Needs attentionを固定62pxで切らない。
- SDK: 既存と同じ2.115.0をローカル固定配信し、保存済みシェルを外部CDNなしで起動可能にした。

## 5. Icon System

唯一の原本は既存icon-1024.png。ユーザー提供ZIPの原本とSHA-256が一致。
cf19403f13c02d901fd5d9a0399c2d4ef1c6fcd7932d74e5e49f65a3380f30ca

通常画像は原本のサイズ展開のみ。絵柄・色・影・装飾は変更していない。
assets/icons/fdg10/に16/32/64/152/180/192/512px、ICO、maskable-512、生成記録を用意。
maskableだけは原本全体を安全領域に収める背景キャンバスを使用。トリミングなし。
ルートのfavicon、Apple Touch Icon、192/512pxも同じ原本の派生画像に更新。

HTML・CSS・manifest・shortcut・SW参照を統一。バージョン付きURL、新キャッシュ限定フォールバック、旧TangoNestシェルの更新時整理を実装。
他アプリのキャッシュ、Cookie、認証保存領域を一括削除しない。毎回の強制リセットはしない。

**iPad左上の異物: 実機で再現できず、原因特定・解消確認は未完了。**
原本はRGB、alphaなし。派生画像に異物を描き足す処理はない。原本の形を推測で切り取って隠していない。
OS処理、既存インストールの保持画像、新規追加との差の実機確認が必要。

## 6. Bulk Add Assistant

言語・保存先・形式 → Prompt/Formatをコピー → 貼付 → 検証 → Preview → 件数・保存先確認 → Import。
標準はFront[TAB]Back[TAB]POS[TAB]Gender[TAB]Example[TAB]Pronunciation。
Front+Back、従来5列、カンマ、複数スペースにも対応。optional空欄を許容し、未対応のTags列は追加しない。
言語は既存の20言語定義を再利用。コピー内容は選択言語・形式・語数を反映する。

Readyは登録可能、Warningは確認後に登録可能、Errorは修正するまで登録不可。
行番号、必須欄、列数、引用符、POS/Gender、重複、空白、制御文字、文字化け、HTMLを検査。
HTMLは実行せず文字として表示。全行を検証し、Previewは60行まで・全6項目を描画。
Mobileは表の横スクロールを採用。操作欄は末尾でも到達でき、登録CTAを広く確保。

Skip Exact Duplicates / Add Bothを維持。CloudのReplaceはデータ保護のため無効表示し理由を提示。
有料AI APIへの送信なし。ユーザー自身がコピーしたプロンプトを使用する方式。
10/100/500/1000語、1014語欠落防止、部分失敗、保存後の応答紛失、再読込、再開、停止、二重クリック、Undoを検証。

## 7. Device Verification

指定9幅: 1440/1280/1024/834/768/430/390/375/320px × 主要7画面。
既存テストの追加幅: 1920/1366/1024/768/393/375/360/412px。
Chromium desktop、Chromium mobile emulation、desktop WebKitを使用。834px・390pxは目視操作も実施。
横はみ出し、数値、主要ボタン、modal、表、固定操作欄を確認。

Windows/Android/iPhone/iPadの実機確認ではない。
OSキーボード、ホーム画面への実インストール、ロック中のTTSは未検証。

## 8. Functional Verification

Auth: モックで新規/既存、誤パスワード、復元、ログアウト、再ログイン、別タブ、別アカウント。
Home: 学習数、記憶度、空状態、学習導線。
Add/Bulk: 保存先、重複、確認、入力検証、大量登録、進捗、復旧、Undo。
Library: 大量表示、検索、フィルター、ソート、詳細、お気に入り、Load All、編集・削除導線。
Playlist: 初期リストの改名・削除、空の状態で20回再読込しても1リスト。
Cards: 絞込み、裏返し、評価、次へ、条件復元、長文・空状態。
Quiz: 対象言語/リスト、少数データ、選択肢、手動/自動送り、フィードバック、キーボード、揺れ防止。
Listen: 言語指定、再生/停止/次/一時停止と表示。各OS音声の音質・発音評価はしていない。
Settings: 開閉、音声設定、データ操作導線、同期状態。
PWA: 配布物のbase path、manifest、SDK、アイコン、旧キャッシュ更新、offline。

## 9. Performance

1000行のparserは約2〜7ms（同時テスト負荷で変動）。
実ブラウザ+モックで10/100/500/1000語保存は約0.25/0.27/0.48/1.34秒、要求数1/1/2/4。
これは実Supabaseの通信待ち時間ではない。
Library起動は1000語約0.4秒、5000語約1.2秒、検索約0.2秒。初期DOM約2100要素、一覧100行。
Load Allはユーザー操作で展開。Cloud後のLibrary二重描画を除去し、フォーカス競合も解消。

## 10. Accessibility

ログインと主要画面をaxeで確認。別途7画面のWCAG 2A/AA・2.1AAもチェック。
入力名、フォーカス、Escape、キーボードQuiz、詳細操作後のフォーカスを検証。
Cards反転はreduced-motionでも裏面へ切り替わることをテスト。
読み上げソフト実機での全操作や、WCAG完全適合の認証を主張するものではない。

## 11. Security

Supabase Email+Passwordを維持。独自パスワード認証やservice_role keyを追加していない。
SQLのRLS、auth.uid()/user_id、RPC所有者確認をコードレビュー。
アカウント別cache/pending/import記録と切替時分離をモックで検証。
実DBに適用されているpolicy/grantとの一致は管理アクセスがなく未確認。
XSS文字列からimg要素を作らないことを実ブラウザで検証。依存関係監査で脆弱性0。SDKのMITライセンス同梱。

## 12. PDCA Log

1. 公開ログインとローカル全機能を操作 → 旧reset・Bulk・iconsを追跡 → 改善 → 単体・静的テスト。
2. 故障注入登録 → 部分保存・応答紛失・再送を検証 → 永続journal、安定ID、保存件数の検証。
3. アカウント切替・詳細操作 → 同期失敗時cacheとお気に入りフォーカスを改善 → 再確認。
4. 9幅×7画面とa11y → 320px横幅・preview色を調整 → 99チェックを実行。
5. Native E2E → ページ復元・Home件数を修正。fixtureのSW迂回と旧文言期待値も修正。
6. Mobile/iPad相当を再操作 → Bulk末尾、空状態、Cards復元件数・実反転、Settings省略を発見 → 修正と回帰テスト追加。
7. 配布物のみで起動 → WebKitの自動化offlineフラグ内部エラーは、接続切断での故障注入でも検証。SW fallbackは機能した。
8. 最後の変更を固定し、連続した全体テストを実施。最終結果は次項。

## 13. Automated Test Result

- 最終Native全体A: **195 PASS / 0 FAIL / 6 SKIP / 0 flaky**。
- 同じ版の最終Native全体B: **195 PASS / 0 FAIL / 6 SKIP / 0 flaky**。
- SKIP内訳: mobile専用をdesktop/WebKitで除外2、desktop性能測定をmobileで除外3、WebKitで既存persona複合ケースを除外1。他の対応プロジェクトでは実行。
- 別の総合harness: **99 PASS / 0 FAILを2回連続**。9幅×7画面、故障注入、復旧、a11yを含む。
- 配布物単体: **6 PASS / 0 FAIL**。実SDK、base path、SW、offline、clipboard、モック2タブ・ブラウザプロセス再起動を含む。
- npm test: syntax 12対象、unit 8スイート、static 5スイートすべてPASS。Library性能ベンチマークPASS。npm auditの脆弱性0。
- 7画面WCAG検査: violations 0。通常画面の未捕捉例外・ブロッキングConsoleエラー0。

証跡（開発ソースのqa/内）: fdg10-release-a.json、fdg10-release-b.json、fdg10-cycle-1788621943868.json、fdg10-cycle-1788622533536.json、fdg10-package-verification.json。
2回の総合harnessと最終ソースのruntime SHA-256: 93b6b6d08cee40c240a09bc4d0c097ba19903a38ad96301b17baf48c517fa665。

途中の失敗を削除して隠さず、修正後に再実行した。
当初macOS制限でNativeブラウザを起動できなかったが、制限解除後Chromium/WebKitで実行した。
実Supabase smokeは認証情報未設定で開始前に終了コード2。PASSではなく未実施。

## 14. Manual Test Result

実ブラウザで入力、選択、保存、Preview、Add Both、確認、Undo、詳細、お気に入り、Cards、Quiz、Listen、Settingsを操作。
DOMだけでは見逃していたCards反転を目視で発見し、修正後の裏面日本語まで確認した。
Desktop・834px・390pxで、Bulk末尾CTAとSettingsのOffline全文も目視確認。
全OS実機や本番アカウントを操作したという意味ではない。

## 15. Console Status

通常操作の目視検証で重大Consoleエラーなし。既存E2Eも未捕捉例外とconsole.errorを検査。
故障注入時のCloud data load incomplete等は想定内warning。warningが常に0とは主張しない。
Offline注入中の接続エラーと、通常時の4xx/5xxは区別する。
NativeのNO_COLOR/FORCE_COLOR警告はテストプロセスのもので、アプリConsoleエラーではない。

## 16. Remaining Issues

実Supabaseの既存ユーザーログイン、RLS、RPC、Realtime、2アカウント分離は未検証。
iPad左上アイコンの原因特定・実機修正確認は未完了。実インストール、ロック中再生も未検証。
ローカル結果からこれらを完了と判定しない。実機画像を推測で加工して問題を隠さない。
ローカルの検証済み範囲ではCritical/High/Mediumの既知不具合0、明確なregression 0。
No known actionable issues remain within the verified local scope. 上記の未検証範囲はこの判断に含めない。

## 17. Changed Files

主要変更: app.js、tn-supabase-sync.js、tn-library-management.js、index.html、style.css、ui/runtime.js、ui/forest-desk-glass.css、sw.js、manifest.json、config.js。
新規: bulk-format.js、release.json、assets/icons/fdg10/、vendor/、tools/prepare-release.js、tools/generate-icons.py、tools/package-release.js。
SQL: SUPABASE_SCHEMA_CURRENT.sql、TANGONEST_RC19_PRODUCTION_MIGRATION.sql、SUPABASE_FDG10_SAFETY.sql。
QA: Bulk/SW/sync単体、静的契約、Bulk/現行修正E2E、モック故障注入harness、配布物検証。
文書: README、本報告、FDG10_UPDATE_GUIDE。FDG9_RELEASE_NOTESは上書きしない。
稼働中の*-rc19-fdg1という互換名は残すが、中身はFDG10に一致。未使用旧配布名36個は削除。

開始時: ソースに.gitなし。別の公開cloneはclean main、ahead1/behind2、origin/mainは4da1fbf。reset/rebase/pushなし。
変更前バックアップ: /private/tmp/tangonest-fdg9-before-audit.tgz。

## 18. Database Changes

本番実行: **None**。個人データをテスト目的で削除していない。
用意した変更: 旧reset2RPCを所有者確認付き無変更応答へ置き換えるSUPABASE_FDG10_SAFETY.sql。
繰り返し実行可能な1トランザクション。ユーザーの明示操作による通常の削除機能は維持。
フルSQLから全アカウント対象リセットを除去。RLSを弱める変更なし。

## 19. Release Readiness

**NOT READY**。更新候補は作成したが、一般公開済み・実機受け入れ完了とは扱わない。
公開URLは更新していない。最終の読取確認でもFDG9のHTMLだった。GitHub CLIの認証と専用Supabaseテストアカウントがない。
残作業: 安全化SQLの適用、専用2アカウントで実認証/所有権確認、iPadアイコン確認、公開元への配布と版表示確認。
具体的手順はFDG10_UPDATE_GUIDE.md。古いRESET SQL、全サイトデータ消去、既存単語削除は不要。
