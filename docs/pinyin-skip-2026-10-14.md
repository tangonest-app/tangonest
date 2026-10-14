# TangoNest：ピンイン・Quiz Skip改善

公開状況：2026-10-14にユーザー承認を受け、FDG19を本番公開・検証済み。[公開確認報告](deploy-pinyin-skip-2026-10-14.md)を参照。以下は公開前の実装・検証記録。

2026-10-14。正式な開発元 `TangoNest_GitHub_DEPLOY_FDG10` の作業ブランチ `fix/pinyin-and-quiz-skip` に実装。配布候補は `1.0.0-rc.19-fdg19`。本番へのデプロイ、mainへの統合、クラウド実データの更新はしていない。

## 実装内容

Edit WordのFront／Back直下に「Pinyin / Pronunciation」を追加した。任意入力で、声調記号・スペースをそのまま保存できる。中国語Frontでは開いた状態、それ以外の空欄では折りたたむ。既存の発音がある場合は編集できる状態にする。

既存のpronunciationフィールドと同期経路を使用する。旧pron／reading／pinyinフィールドも読み込める。明示的に空欄へ戻した際、古い別名の値が復活しないよう優先順位を修正した。未登録のピンインを推測・一括補完する処理は追加していない。SQLや本番データ移行は実行していない。

Libraryの中国語Frontの下に小さなピンインを表示する。空欄の場合は表示しない。既存の検索対象・並び替え・フィルターを維持した。詳細画面でも旧形式の発音を読み込める。

Quizは正解・不正解・Skipの解答後とReviewの一覧・詳細にピンインを表示する。中国語の解答前にはピンインを出さない。Listeningのピンインヒントも中国語では出題中に隠す。保存済みの設定値は維持し、他言語の既存発音表示は継続する。

Skipはstatus=incorrect、ok=falseで記録し、skipped=trueを理由として残す。Wrong一覧、Retry Mistakes、正答率、学習イベント、弱点記録に含める。正答率は正解数÷記録済み全問題数。正解1・不正解1・Skip1なら33%。Skip件数はWrongの内数として表示し、二重加算しない。

二重解答とSkipの連打は既存のansweredガードと専用のSkip分岐で防ぐ。次の問題への移動はNextまたは既存の自動進行設定で行う。Retryでは重複IDを除き、複数問ある場合は直前と同じ問題から始まらないようにする。設定・チェックポイント・再開時の学習イベントの再送防止も維持する。

編集画面の再描画で言語選択が戻る問題を修正した。スマホではフォーム全体をシート内でスクロールでき、背後の追加ボタンがフォームを覆わないよう調整した。

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| app.js | 編集入力の読込・保存、再描画時の保持、Quiz採点・集計・Review・Retry |
| index.html | Pinyin / Pronunciation入力、ビルド版の参照 |
| tn-library-management.js | 中国語一覧のピンイン、詳細の旧形式対応 |
| tn-supabase-sync.js | オンライン・オフライン編集のpronunciation保存、隔離QAのローカル編集経路 |
| example-fields-rc19-fdg1.js | 旧形式の読込と明示的な空欄の優先（HTMLが直接読む編集元） |
| style.css | 小さなピンイン表示、編集フォームのスクロールと重なり順 |
| release.json | 未公開候補の版番号をfdg19へ更新 |
| tests/e2e/pinyin-skip.spec.js | 登録・編集・保持・クリア・検索・Quiz各方式・Skip・クラウド同期のテスト |
| tests/e2e/quiz-session.spec.js、quiz-learning.spec.js | SkipをWrongとする期待値、履歴・再開・設定の保護 |
| tests/unit/example-fields.test.js、sync-regression.test.js | 旧形式・空欄・オフライン同期とクラウド保存の回帰テスト |

ビルド生成物も更新：app-rc19-fdg1.js、style-rc19-fdg1.css、tn-library-management-rc19-fdg1.js、tn-supabase-sync-rc19-fdg1.js、config.js、config-rc19-fdg1.js、sw.js。生成物を手編集せずnpm run buildで同期した。

## テスト結果

| 検証 | 結果 |
|---|---|
| npm run build／check:runtime | 成功。12組の編集元・生成物、42 HTML参照、62オフライン資産が整合 |
| npm test | 成功。構文・単体・同期回帰・静的契約・言語・配布パイプライン |
| Quiz関連E2E 3ファイル | PC Chromium・スマホ390×844・デスクトップWebKitの96件成功 |
| 表示修正後のpinyin-skip.spec.js | 上記3ブラウザの36件成功 |
| 最後の編集画面の重なり修正後 | 編集・保存・クラウド同期の6件成功 |
| git diff --check | 成功 |
| package:release | 66ファイルの配布候補を作成 |
| ローカル候補のハッシュ照合 | 66ファイル一致 |
| ローカル候補のブラウザ読み込み | 18スクリプト一致、ページ例外なし |

E2E件数には再確認による重複があり、合計を固有テスト件数として扱わない。全テストは隔離したfixture／モッククラウドで実行した。既存の本番単語・意味・例文・タグ・熟練度には触れていない。iPhone実機のソフトウェアキーボードや本番クラウド実DBは未検証。

新規ピンイン保存、再編集、再読み込み、空欄へのクリア、既存別名からの読込、検索・並び替え・言語フィルター、正解／不正解／Skip後の表示、Wrongの件数・正答率・Retry、Typing・Choice・Listening、連打、再開時の重複学習更新防止、Quiz設定保持、モッククラウドのオンライン・オフライン同期を確認した。

## 配布候補と画面

配布候補：`work/release-candidate-pinyin-skip-fdg19/`。release-inventory.jsonに66ファイルのSHA-256を保存している。ソース・SQL・テスト・QAデータは配布物に含めない。本番公開はこの候補の承認後に、DEVELOPMENT.mdの手順で行う。

スクリーンショット：`work/pinyin-skip-review/screenshots/` のlibrary-desktop.png、edit-desktop.png、library-mobile.png、edit-mobile.png。

再検証：

```sh
npm test
npm run test:e2e -- pinyin-skip.spec.js quiz-session.spec.js quiz-learning.spec.js
npm run check:runtime
```
