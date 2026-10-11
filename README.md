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
- 「手帳にする」から月別の印刷用JPEG・PNGを300dpiで出力
- 日記カード（6日/枚）、写真シール（20日/枚）、月のカレンダー（1か月/枚）の3レイアウト
- 2L・L・ハガキ・A5手帳向け・ロルバーンL向けの5サイズ、プレビュー、複数ページのZIP保存
- カレンダーの日付マス内に写真と短いメモを表示
- 最大60枚の写真を端末内でまとめて読み込み、撮影日で絞り込み、1日1枚を選んで保存

## 手帳にする・写真をまとめる

画面下部または左メニューの「手帳にする」を開き、月・レイアウト・用紙サイズ・画像形式を選びます。サンプルでも試せます。1枚ずつ保存でき、複数枚になる場合はZIPにまとめて保存できます。対応ブラウザでは共有シートからの保存も利用できます。

| プリセット | 仕上がり寸法 | 画像サイズ（300dpi） |
| --- | --- | --- |
| 2L判 | 127 × 178 mm | 1500 × 2102 px |
| L判 | 89 × 127 mm | 1051 × 1500 px |
| ハガキ | 100 × 148 mm | 1181 × 1748 px |
| A5手帳向け | 138 × 200 mm | 1630 × 2362 px |
| ロルバーンL向け | 120 × 165 mm | 1417 × 1949 px |

PNGのpHYs、JPEGのJFIFに300dpi相当の解像度情報を付与します。写真は中央を基準に枠へトリミングします。長いメモは枠内で省略し、プレビューの下に案内します。元の日記は変更しません。以前のバックアップなどで同日に複数の記録がある場合、印刷では自分の記録を優先し、その中で更新が新しい1件を使います。

手帳向けは余白を見込んだ貼り付け用の目安寸法です。ロルバーンLの本体寸法の参考は[DELFONICS公式](https://shop.delfonics.com/c/notebooks/NRP03)。紙面・リング・印刷機の余白は実物で確認してください。実寸で貼る場合は印刷設定を100%にし、フチなし自動拡大を避けます。コンビニ機での実印刷は未検証です。

「記録する」内の「何日分か、まとめて記録する」、またはPC左メニューから複数写真を選びます。JPEGのEXIF、PNGのeXIf、WebPのEXIFから撮影日を読み取ります（DateTimeOriginal優先）。読み取れない写真は仮の日付を表示し、手動で修正できます。HEIC/HEIF/AVIFの撮影日抽出は非対応です。メタデータの走査は先頭2MBまでです。ブラウザからカメラロール全体を読み取ることはなく、選択された写真だけを処理します。

新規登録は1日1枚です。同日に保存済みの記録がある場合は確認を表示し、承認された場合のみ置き換えます。一括保存も1つのトランザクションで処理するため、途中で失敗しても既存記録は保持されます。過去の記録やバックアップを自動で削除・整理することはありません。

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
- `docs/studio.js`: 印刷プレビュー、複数写真の選定・登録画面
- `docs/print.js`: Canvasによる印刷画像生成、解像度情報、ZIP作成
- `docs/exif.js`: 撮影日の読み取り（位置情報などは保存しません）
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

2026年10月11日、ローカルと上記の公開URLで、PlaywrightによるChromium・WebKit両エンジンの操作検証を実施しました。

- 写真追加 → 保存 → 再読み込み → 写真・日付・メモの編集 → 確認付き削除
- サンプルの一括非表示と設定の保持、空の記録画面
- 検索・検索0件、月送り・記録日の印・日別表示
- 写真入りバックアップのダウンロード、復元、重複防止
- 不正JSON・破損写真を含むバックアップの拒否と既存データの保持
- オフラインでの再読み込み、写真閲覧、追加、編集、削除
- 保存容量不足を模擬したエラー表示と編集中の入力保持
- 320 / 375 / 390 / 430 / 768 / 1,440px幅での横はみ出しなし
- スマホ・PC・編集画面・カレンダーのスクリーンショット確認
- 初期画面のaxe WCAG A/AA自動検査で違反0件、JavaScript例外0件
- 操作中に外部配信元への通信や写真・メモのアップロードなし

実機iPhone・Androidでの動作、OSからのホーム画面追加、実機固有の写真選択UI/HEICデコードは未確認です。WebKitによる検証はSafari実機の検証とは区別しています。

検証用の写真・バックアップ・ブラウザデータ・スクリーンショットはローカルの`.qa/`に置き、リポジトリと公開ディレクトリには含めません。

### 印刷・一括登録の追加検証

Chromium・WebKitの両方で、以下をローカルで確認しました。公開後も同じ操作を確認します。

- 3レイアウト × 5サイズのPNG生成と寸法、PNG/JPEGの300dpi情報
- 写真・メモ入りカレンダー、印刷プレビューと対象0件の表示
- 31日分の6ページ出力・ZIPのCRC検証と展開、月末31日、6週ある月
- JPEG/PNGの撮影日時フィクスチャ、同日の1枚選定、日付絞り込み、日付修正、一括保存
- 単写真の撮影日設定、1日1枚の置換確認、キャンセル時の入力保持
- オフラインでの印刷画像生成・ダウンロード、JavaScript例外と外部送信なし
- 新画面のスクリーンショット確認、印刷画面のaxe自動検査で違反0件

実機の共有シート・写真アプリへの保存と、プリンター・コンビニ機での実印刷は未確認です。
