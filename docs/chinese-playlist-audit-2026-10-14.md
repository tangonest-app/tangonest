# Chineseプレイリストの品質監査（承認前）

2026-10-14。実データ更新と本番公開は未実行。詳細な学習データ・バックアップ・差分はGit管理外の`work/chinese-audit-2026-10-14/`へ保存し、公開成果物へ含めない。

`tools/chinese-playlist-audit.js`はローカルのスナップショットと、IDごとにレビューした判断ファイルから候補・JSON差分・HTML比較を作る。ネットワーク接続や本番書き込みは行わない。対象ID・言語・件数・変更前の値を検査し、更新候補をback／pronunciationに限定する。原文・ID・関連・学習フィールド・設定・履歴・他プレイリストに差があれば失敗する。同じ判断を適用済みの候補へ再評価するとalready-presentになり、重複を作らない。既存の出力フォルダーは上書きしない。

```sh
node tools/chinese-playlist-audit.js <snapshot.json> <decisions.json> <new-output-dir>
```

中国語の文型記号「～」「〜」「~」は`app.js`の`normalizeChinesePatternText`で派生文字列だけをスペースへ置換する。`speak`が中国語音声の合成直前に使い、元のword.frontと他言語の音声は変更しない。ピンインの自動推測処理は追加していない。

ローカル候補はFDG20。npm build／test、監査の単体テスト、chinese-patternとpinyin-skipのブラウザ45件が成功。PC／スマホ／WebKitの隔離環境で確認し、本番の学習操作は実行していない。

承認後は差分フィールドだけを同じ単語IDへ条件付き更新する。学習状態や履歴の一括上書き、バックアップImport、単語の追加・削除は行わない。公開には別途ユーザー承認を確認する。
