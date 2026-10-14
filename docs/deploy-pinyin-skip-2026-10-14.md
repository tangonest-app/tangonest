# TangoNest FDG19 公開確認

2026-10-14 21:06 JSTに、ユーザーの「デプロイ」の承認を受けて本番公開した。

- 本番：[TangoNest](https://tangonest-app.github.io/tangonest/)
- 公開版：`1.0.0-rc.19-fdg19`
- 実装コミット：`6c27df1d393b54d8fa4618ecfdd1f138bd182a7f`
- [GitHub Actions実行](https://github.com/tangonest-app/tangonest/actions/runs/38560132845)：candidate／deployとも成功
- 配布候補：`work/release-candidate-pinyin-skip-fdg19/`。静的成果物のみ配信

Edit Wordの任意ピンイン入力、Libraryの中国語下の表示、Quiz解答後・Reviewの表示を公開。SkipをWrongとして記録し、正答率・学習履歴・Retry Mistakesへ反映する。詳しい変更ファイルと実装は[改善報告](pinyin-skip-2026-10-14.md)を参照。

## 検証

- 公開ワークフローのnpm test／build成功。
- PC Chromium・スマホ390×844 Chromium・デスクトップWebKitでブラウザテスト198件成功。
- 本番URLの66ファイルを候補のSHA-256と照合：全件一致。`tools/published-baseline.json`を記録。
- 本番ブラウザの18スクリプトを照合：全件一致、FDG19表示、ページ例外なし。
- 隔離ブラウザでFDG18→FDG19のPWA更新を検証。Updateを押すまで旧版を維持し、更新後も学習用fixtureデータ・設定を保持した。

記録：`work/deploy-fdg19-ci.log`、`work/deploy-fdg19-verify.log`、`work/deploy-fdg19-browser.log`、`work/pwa-upgrade-result.json`。

既存ユーザーの単語・学習履歴・設定を削除していない。SQLや本番データ移行は実行していない。保存動作のテストは隔離fixture／モッククラウドを利用し、iPhone実機のソフトウェアキーボードは未検証。

PWAで旧版が表示される場合は、アプリの更新通知で「Update」を押して新しい版を有効にする。
