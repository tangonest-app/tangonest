# TangoNest FDG20 公開確認とデータ更新の保留

2026-10-14 23:11 JSTに、承認済みの中国語文型の読み上げ修正を公開した。

- 本番：[TangoNest](https://tangonest-app.github.io/tangonest/)
- 公開版：`1.0.0-rc.19-fdg20`
- 実装コミット：`16ca8874b735893d869daa0fcc1338025c19ffb2`
- [公開ワークフロー](https://github.com/tangonest-app/tangonest/actions/runs/38576655278)：candidate／deployとも成功
- 配布候補：`work/release-candidate-chinese-pattern-fdg20/`、66静的ファイルのみ

中国語音声の合成直前だけ「～」「〜」「~」を半角スペースに置換する。原文や表示用文字列は保持し、中国語以外の音声は変更しない。

## 検証

npm test／build成功。PC Chromium・390×844スマホ Chromium・デスクトップWebKitの公開前ブラウザテスト207件成功。本番の66ファイルを候補のSHA-256と照合し、全件一致を確認してpublished-baselineを記録した。隔離した本番ブラウザでも18スクリプトが一致、FDG20表示、ページ例外0件。

PWAのFDG19→FDG20更新を隔離環境で確認した。Updateを押すまで旧版を維持し、更新後もfixtureの学習データと設定が保持された。

記録：`work/chinese-audit-2026-10-14/`内のdeploy-ci.log、published-verify.log、published-browser.log、pwa-fdg20-result.json。

## データ更新は後日

ピンイン・日本語訳の43単語の差分更新も承認されたが、ユーザーがChromeを使用するため「データ更新を後で行います」と指定した。実データの更新処理は実行していない。既存の単語・原文・学習履歴・設定を削除／上書きしていない。

承認済みの差分、対象ID、変更前の値、バックアップをGit管理外に保存している。データ更新の再開時は、最新の対象と学習状態を再取得・バックアップし、変更前の値が一致する箇所だけ条件付き更新する。承認後に行われた学習を以前のバックアップで巻き戻さない。

本番公開にユーザーの学習データやバックアップは含めていない。アプリで旧版が表示される場合は更新通知の「Update」を押して新しい版を有効にする。
