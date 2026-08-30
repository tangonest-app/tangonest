# TangoNest rc18 UX Validation

## Scope

Study Focusのデザイン、既存機能、Audio、Auth、Syncの設計を維持し、Library整列、言語順、Quiz集中表示を検証した。自動操作はローカルの隔離データを使い、本番Supabaseのデータには接続していない。

## Personas

| Persona | 主な観点 | 結果 |
|---|---|---|
| A: 本気の語学学習者 | 登録、検索、Cards、Quiz、Listen | 日常学習の主要導線を完走 |
| B: 説明を読まない大学生 | 初見操作、Add Word、Quiz開始 | 主操作を直接発見可能 |
| C: 忙しい社会人 | 短時間復習、自動進行 | Quizの毎問Next操作を削減 |
| D: 開発者 | State、Console、性能、Responsive | 自動QAと5,000語負荷を通過 |
| E: UX Designer | 整列、階層、余白、一貫性 | Libraryの共通Gridへ統一 |
| F: 操作に不慣れなユーザー | タップ領域、戻り方、Feedback | Mobile主要操作を44px前後で維持 |

## Usage Cycles

| # | Journey | 操作・スクロール観察 | 結果 |
|---:|---|---|---|
| 1 | New user -> Add Word -> Library | Addから一覧まで直進 | PASS |
| 2 | Bulk Add 10 -> Search -> Filter | フィルター状態を再描画後も維持 | PASS |
| 3 | Library -> Cards 10 | 前後移動と評価状態を確認 | PASS |
| 4 | Choice Quiz 10 -> Result | Smart Autoで毎問Next不要、通常PCの1問はpage scroll 0 | PASS |
| 5 | Typing Quiz | EnterでCheck/次問 | PASS |
| 6 | Listen | Play/Pause/Previous/Next/Stop | PASS |
| 7 | French -> English Bulk Add | 共通言語順と学習導線 | PASS |
| 8 | English -> Japanese | Create/Library/Quizの言語表示 | PASS |
| 9 | Mobile 390px | Library/Quiz/Listen、横scroll 0 | PASS |
| 10 | Desktop large library | Search/Filter/Quiz、描画100行上限 | PASS |
| 11 | Intentional mistakes | Incorrect、正答、Mistake Review、学習状態 | PASS |
| 12 | Reload -> Resume | ページ・学習データ・Default List維持 | PASS |

## Issues And Decisions

| Severity | Problem | Impact | Cause | Fix | Result |
|---|---|---|---|---|---|
| High | Desktop LibraryのFilterが実質開けない状態になり得た | Search以外の絞り込みが使えない | closed detailsとdesktop CSSの組み合わせ | Desktopは常時open、tablet/mobileは開閉状態を保持 | FIXED |
| High | Mobile QuizのIncorrect情報がbottom tab下へ押し出された | 正答確認がしづらい | 4択全件とfeedbackを同時表示 | 回答後は選択肢と正答だけを残し、feedbackを圧縮 | FIXED |
| Medium | 768px LibraryでFilterと分類タブが一覧を押し下げた | 最初の単語まで遠い | 旧CSSのbutton widthとbreakpoint | 5列タブ、折りたたみFilterへ変更 | FIXED |
| Medium | Quiz feedbackとToastが重なった | Feedbackを読みづらい | 同じ状態を2箇所で通知 | Quiz中の重複Toastを除去 | FIXED |
| Medium | Language配列が機能ごとに異なる | 画面ごとに順番が変わる | 独立定義 | `TangoNestLanguages`共通定義へ統一 | FIXED |
| Polish | Quiz旧feedback CSSが残った | 保守時に仕様が混ざる | UI整理後のdead selector | 未使用10 selectorを削除 | FIXED |
| Acceptance | 端末固有TTS音質 | 実機Voice差を自動評価できない | OS/端末依存 | Audioロジックを変更せず回帰のみ実施 | NOT FIXED: physical acceptance |
| Acceptance | 実SupabaseのPC/スマホ同期 | 本番環境の最終保証が必要 | 資格情報・実端末依存 | Mock/contract回帰を実施 | NOT FIXED: production acceptance |

## PDCA

1. 指定4項目を分析し、Library Grid、共通言語定義、Quiz Focus、Smart Autoを実装。Desktop/Mobile E2Eで確認。
2. Persona B/Fで初見・Mobileを確認。Feedbackがbottom tabへ近すぎる問題を修正し再テスト。
3. Persona A/Cで12導線を連続操作。Quizの重複Toastを除去し、クリック数と視線移動を削減。
4. Persona DでConsole、State、5,000語、Default List、Auth/Sync contractを確認。Desktop Filter detailsの問題を発見・修正。
5. Persona Eで56枚を目視。768pxの分類タブとFilter密度を修正し、全Breakpointを再撮影。

## Evidence

- `qa/screenshots/`: 8 viewport、Home/Library/Cards/Quiz/Quiz feedback/Listen/Settings、合計56枚。
- Full Playwright: 60 passed、6 expected skipped、0 functional failures。
- Persona journey: desktop/mobile各12 journeyを完走。
- Library browser performance: 5,000語で描画100行上限、横overflowなし。
- CSS audit: unused selector 0、`!important`追加なし。
- Dependency audit: vulnerabilities 0。

## Remaining Acceptance

実Supabaseへ必要なSQLが適用済みであること、GitHub Pagesへの配置、PC/スマートフォン実機でのLogin・同期・端末Voice品質はユーザー環境で最終確認が必要。
