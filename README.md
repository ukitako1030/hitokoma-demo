# ひとこま — 写真と、ひとこと。

生成りの紙、墨色、セージグリーンを基調とした、端末内保存の写真日記デモです。

公開URL: https://ukitako1030.github.io/hitokoma-demo/

## できること

- 写真1枚・メモ・日付の追加、詳細表示、編集、確認付き削除
- 新しい日付順・月ごとのタイムライン
- メモのキーワード検索（全角・半角、大文字・小文字を正規化）
- 月送りカレンダー、記録日の印、日別表示
- IndexedDBによる端末内保存
- 写真を含むJSONバックアップの書き出し・追加復元
- サンプル6件の表示・非表示
- PWAとオフラインでの閲覧・記録・編集・削除・検索・復元
- iPhone優先のレスポンシブ画面、キーボード操作、動きを抑える設定への対応

## プライバシーと保存

利用者の写真・メモをサーバー、GitHub、外部APIへ送信する処理はありません。ログイン、広告、アクセス解析、SNS連携、課金、外部フォント、クラウドDBはありません。アプリ本体・サンプルの取得にのみ同一配信元へのHTTP通信を使用します。GitHub Pages側の通常の配信ログはホスティングサービスの管理範囲です。

写真は端末内で長辺1,600px以下、JPEG品質0.84に変換します。キャンバスによる再エンコードで、元の写真の位置情報などEXIFメタデータは引き継ぎません。JPEG・PNG・WebP・ブラウザでデコードできるHEIC/HEIF/AVIFを受け付けます。読み込めない形式はメッセージを表示します。入力写真は40MB以下、デコード後は1億画素以下に制限します。

ブラウザのデータ消去、プライベートブラウズ終了、容量整理、端末の故障などで記録が失われることがあります。定期的にバックアップしてください。別ブラウザ・別端末・ホーム画面版への移行にはバックアップを利用します。

バックアップは`hitokoma-backup` version 1形式のJSON（100MB、1,000件まで）。サンプルを除くユーザー記録のみ書き出します。復元は内容と画像を全件検証してから1つのIndexedDBトランザクションで追加し、同じIDの記録はスキップします。既存記録を上書きしません。バックアップには写真とメモがそのまま含まれるため、自分で安全に保管してください。

## 構成と実行

実行時の外部依存はゼロ。ビルド不要のHTML/CSS/JavaScriptです。

```sh
python -m http.server 4173
```

http://localhost:4173/docs/ を開きます。`file://`ではなくHTTPまたはHTTPSで開いてください。

- `docs/index.html`: アプリの画面構造とCSP
- `docs/style.css`: モバイル・PCの表示
- `docs/app.js`: UI・サンプル・操作
- `docs/core.js`: IndexedDB、写真変換、バックアップの検証と復元
- `docs/sw.js`: サブディレクトリ対応のオフラインキャッシュ
- `docs/manifest.webmanifest`: PWA設定
- `docs/assets/`: 同梱写真とオリジナルアイコン

## 無料で公開

公開リポジトリの`main`ブランチ、`/docs`をGitHub Pagesの配信元にします。独自ドメイン・有料API・有料サービスは使用しません。標準の `https://ukitako1030.github.io/hitokoma-demo/` で公開します。

GitHub Pagesは公開リポジトリでGitHub Freeから利用できます。根拠: [GitHub公式ドキュメント](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

アセット、manifestのstart_url/scope、Service Workerは相対パスです。IndexedDBとキャッシュ名は配信パスごとに分離しています。アプリ更新時は`docs/sw.js`の`CACHE`のバージョンを更新してください。初回のオフライン準備完了は設定画面で確認できます。

## サンプル写真の出典

写真6点は2026年10月11日、このデモ向けにOpenAIの組み込みimagegenツールで生成したオリジナル素材です。第三者の写真サイト・人物・実在店舗の画像を転載していません。サンプルの出来事も架空です。生成結果をJPEG（1,200×900）に最適化して同梱しています。モデル名を指定できない組み込みツールを使用しており、特定モデル名は断定していません。

| ファイル | 内容 |
| --- | --- |
| `docs/assets/cafe.jpg` | 窓辺のカプチーノとクロワッサン |
| `docs/assets/walk.jpg` | 秋の川沿いの散歩道 |
| `docs/assets/lunch.jpg` | トマトとバジルのパスタ |
| `docs/assets/flowers.jpg` | 窓辺のコスモス |
| `docs/assets/sea.jpg` | 夕暮れの海 |
| `docs/assets/reading.jpg` | 雨の日の本とお茶 |

SVG・PNGアイコンもこのデモ用のオリジナル図案です。

### 生成プロンプト

共通指定:

> Use case: photorealistic-natural. Asset type: sample photograph for an original Japanese personal photo diary app. Landscape aspect ratio 4:3. Realistic editorial photography, warm restrained film grain, beautiful soft highlights, calm sage green and warm cream palette, believable everyday moment. Full bleed single photo, no collage, no framing, no visible text, no logo, no watermark, no identifiable person or existing business. Create an original scene.

各シーン（共通指定に追加）:

- **cafe:** A close-up of a handmade ivory ceramic cappuccino cup and flaky croissant on a small worn oak cafe table beside a softly lit window, a little green foliage out of focus, relaxed candid Japanese cafe morning.
- **walk:** A quiet sunlit walking path beside a small river in rural Japan in early autumn, feathery grasses and muted olive green trees, low warm afternoon sunlight, no buildings or people identifiable.
- **lunch:** A lovely simple home-cooked lunch on a pale linen table, white ceramic plate of tomato and basil pasta with a small green salad, understated Japanese home, natural window light, candid overhead photograph.
- **flowers:** Small white cosmos flowers and a few dusty pink cosmos blossoms in a thin clear glass vase on a warm wooden windowsill, soft autumn daylight, blurred garden, intimate film photography.
- **sea:** A quiet shoreline with gentle pale blue waves and warm sand at sunset, distant horizon with soft peach light and silvery water, atmospheric natural film photography, no people or buildings.
- **reading:** An open book with out-of-focus unreadable pages, a handmade ceramic tea cup and knitted blanket on a wooden table near a window in soft rainy afternoon light, quiet Japanese home atmosphere.

## 検証

操作検証は公開前・公開URLで実施し、実施範囲を最終報告に記載します。検証用の写真・バックアップ・ブラウザデータ・スクリーンショットはローカルの`.qa/`に置き、リポジトリと公開ディレクトリには含めません。
