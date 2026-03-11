# TyranoCode 動作確認チェックリスト

## 事前準備

1. VS Code のターミナルで拡張をビルド:
   ```
   cd tyranodev
   npm run compile
   ```
2. VS Code をリロード: `Ctrl+Shift+P` → `Developer: Reload Window`
3. `test-game/data/scenario/first.ks` を開く（これで拡張が自動起動します）
4. VS Code の設定で以下が有効になっていることを確認:
   - `editor.inlayHints.enabled` → `on` or `onUnlessPressed`
   - `editor.semanticHighlighting.enabled` → `true`
   - `editor.codeLens` → `true`

---

## 基本機能（既存）

### シンタックスハイライト
- [☑] **確認手順**: `first.ks` を開く。タグ名（`title`, `bg`, `jump` など）、属性名、属性値、コメント（`;` 行）がそれぞれ異なる色で表示されていること
- [☑] **確認箇所**: `first.ks` の 8行目 `[title name="TyranoScript Test Game"]` で `title` がタグ色、`name` が属性色、`"TyranoScript Test Game"` が文字列色になっている

### タグ補完
- [☑] **確認手順**: `first.ks` の末尾 `[s]` の後に新しい行を追加し、`[` を入力する
- [☑] **期待結果**: タグ名の一覧が補完候補として表示される（`bg`, `jump`, `if`, `chara_show` など多数）
- [☑] **確認手順2**: `[b` まで入力してみる → `bg`, `bgmovie`, `button` など `b` で始まるタグに絞り込まれる
- [☑] **確認手順3**: `@` を行頭で入力 → 同様にタグ候補が表示される

### ホバー（タグの説明表示）
- [☑] **確認手順**: `first.ks` の 8行目 `[title` の `title` にマウスカーソルを乗せる
- [☑] **期待結果**: タグの説明（英語/日本語）がポップアップで表示される
- [☑] **確認手順2**: `scene1.ks` の 11行目 `[bg storage=...` の `bg` にホバー → 背景変更タグの説明が出る
- [☑] **確認手順3**: 属性名 `storage` にもホバー → 属性の説明が表示される

### 診断（Linting）
- [☑] **確認手順**: `first.ks` の適当な場所に `[invalid_tag_xyz]` と入力する
- [☑] **期待結果**: 下の **Problems パネル** (`Ctrl+Shift+M`) に「Unknown tag: invalid_tag_xyz」等の警告が表示される
- [☑] **確認手順2**: 入力した行を削除して元に戻す → 警告が消える
- [☑] **確認手順3**: `scene1.ks` を開くと、到達不能コード等の正当な警告のみが表示される

### 定義ジャンプ (Go to Definition)
- [☑] **確認手順**: `scene2.ks` の 88行目 `@jump target="*after_choice"` の `*after_choice` にカーソルを置く
- [☑] **操作**: `F12` を押す
- [☑] **期待結果**: 同ファイル 155行目の `*after_choice` ラベル定義にジャンプする
- [☑] **確認手順2**: `first.ks` の 124行目 `@jump storage="scene1.ks" target=*start` の `*start` で `F12` → `scene1.ks` の `*start` にジャンプ

### 参照検索 (Find All References)
- [☑] **確認手順**: `scene2.ks` の 155行目 `*after_choice` にカーソルを置く
- [☑] **操作**: `Shift+F12` を押す
- [☑] **期待結果**: `*after_choice` を参照している箇所（88行目、116行目、150行目の3つの `@jump target="*after_choice"`）が一覧表示される

---

## 新機能 #1: Document Symbols / Outline

### Outline パネル
- [☑] **確認手順**: `scene2.ks` を開いた状態で、左サイドバーの **Explorer** アイコンを選び、下部にある **OUTLINE** パネルを展開する
- [☑] **期待結果**: ラベル名が一覧表示される（`*start`, `*choice_cafe`, `*choice_play`, `*choice_haunted`, `*after_choice`, `*continue_talking`, `*go_home`, `*go_ending`）
- [☑] **確認手順2**: `macro.ks` を開く → `talk`, `scene_change`, `fade_text`, `end_fade_text`, `show_pair` のマクロ定義がOutlineに表示される
- [☑] **確認手順3**: Outlineの項目をクリック → エディタ上でその位置にジャンプする

### パンくずリスト（Breadcrumb）
- [☑] **確認手順**: `scene1.ks` を開き、116行目あたり（`*middle` ラベルの後のコード）にカーソルを置く
- [☑] **期待結果**: エディタ上部のパンくずリスト（ファイルパスの横）に現在のラベル名 `middle` が表示される

---

## 新機能 #2: Document Links

- [☑] **確認手順**: `first.ks` の 14行目 `@call storage="tyrano.ks"` を見る
- [☑] **期待結果**: `tyrano.ks` の部分が **青い下線付きリンク** になっている
- [☑] **確認手順2**: `Ctrl+クリック` でそのリンクをクリック → `tyrano.ks` ファイルが開く
- [☑] **確認手順3**: `first.ks` の 17行目 `storage="macro.ks"` → Ctrl+クリック → `macro.ks` が開く
- [☑] **確認手順4**: `scene1.ks` の 282行目 `@jump storage="scene2.ks"` → `scene2.ks` がリンクになっている

---

## 新機能 #3: Color Decorator

- [☑] **確認手順**: `first.ks` の 66行目 `[deffont size=26 color=0xffffff ...]` を見る
- [☑] **期待結果**: `0xffffff` の左横にカラースウォッチ（白い小さな四角）が表示される
- [☑] **確認手順2**: `scene1.ks` の 63行目 `[font size=32 color=0xff6699 bold=true]` → ピンクのスウォッチ
- [☑] **確認手順3**: `scene1.ks` の 69行目 `color=0x99ccff` → 水色のスウォッチ
- [☑] **確認手順4**: `scene1.ks` の 76行目 `color=0xffff00` と `edgecolor=0x000000` → 黄色・黒のスウォッチ
- [☑] **カラーピッカー**: いずれかのカラースウォッチをクリック → VS Code のカラーピッカーが開き、色を変更できる

---

## 新機能 #4: Code Folding

- [☑] **確認手順**: `scene1.ks` の 120行目 `[if exp="sf.play_count > 1"]` の行番号の左にカーソルを移動する
- [☑] **期待結果**: 折りたたみ矢印（▼）が表示される
- [☑] **操作**: 矢印をクリック → `[if]...[endif]`（120-128行）が折りたたまれる
- [☑] **確認手順2**: `macro.ks` の 18行目 `[macro name="talk"]` → 折りたたみ矢印をクリック → `[macro]...[endmacro]`（18-26行）が折りたたまれる
- [☑] **確認手順3**: `first.ks` の 1-5行目（連続コメント行 `;===...`）→ コメントブロックとして折りたためる
- [☑] **確認手順4**: 折りたたまれた行をクリックして再展開できる

---

## 新機能 #5: Signature Help

- [☑] **確認手順**: `first.ks` の末尾付近で新しい行に `[bg ` と入力する（`bg` の後にスペース）
- [☑] **期待結果**: パラメータヒントがポップアップ表示される。`storage` パラメータの型、説明、必須/任意の情報が見える
- [☑] **確認手順2**: `[jump ` と入力 → `storage`, `target` 等のパラメータヒントが表示される
- [☑] **確認手順3**: `[chara_show ` と入力 → `name`, `left`, `top`, `time` 等のパラメータが見える
- [☑] **後片付け**: 入力したテスト行を削除

---

## 新機能 #6: リソースファイル補完

> **注意**: この機能はプロジェクト内に実際のリソースファイルが存在する場合にのみ動作します。test-game の data/bgimage/ 等にファイルがない場合は空の候補リストになります。

- [☑] **確認手順**: `[jump storage="` まで入力する
- [☑] **期待結果**: `data/scenario/` 内の `.ks` ファイル名（`first.ks`, `scene1.ks`, `scene2.ks` 等）が補完候補に表示される
- [☑] **確認手順2**: `[bg storage="` まで入力 → `data/bgimage/` 内の画像ファイルが候補に出る（画像ファイルが存在すれば）
- [☑] **確認手順3**: `[playbgm storage="` → `data/bgm/` 内の音声ファイルが候補に出る（音声ファイルが存在すれば）
- [☑] **後片付け**: 入力したテスト行を削除

---

## 新機能 #7: Workspace Symbols

- [☑] **確認手順**: `Ctrl+T` を押す（ワークスペースシンボル検索を開く）
- [☑] **操作**: `start` と入力する
- [☑] **期待結果**: プロジェクト全体から `*start` ラベル（scene1.ks, scene2.ks, ending.ks など）が検索結果として表示される
- [☑] **確認手順2**: `talk` と入力 → `macro.ks` の `talk` マクロ定義が見つかる
- [☑] **確認手順3**: 結果をクリック → そのファイル・行にジャンプ

---

## 新機能 #8: Code Actions / Quick Fix

- [☑] **確認手順**: `first.ks` の適当な位置に `[my_custom_tag]` と入力する
- [☑] **期待結果**: 黄色い波線（警告）が表示される。Problems パネルに「Unknown tag」警告が出る
- [☑] **操作**: `my_custom_tag` にカーソルを置き、左端に表示される **電球アイコン** 💡 をクリック（または `Ctrl+.`）
- [☑] **期待結果**: 「Define as macro」というクイックフィックスが選択肢に表示される
- [☑] **確認手順2**: `[jump target="*nonexistent_label"]` と入力 → 未定義ラベルの警告が出る → 電球から「Create label」が選べる
- [☑] **後片付け**: テスト行を削除

---

## 新機能 #9: Inlay Hints

> 設定: `editor.inlayHints.enabled` が `on` になっていること

- [☑] **確認手順**: `first.ks` の 124行目 `@jump storage="scene1.ks" target=*start` を見る
- [☑] **期待結果**: `scene1.ks` の後（閉じ引用符の右）に薄いグレーの文字で ` data/scenario/scene1.ks` とパス情報が表示される
- [☑] **確認手順2**: `scene1.ks` の 17行目 `[chara_show name="sakura" ...]` を見る → `sakura` の後に ` (Sakura)` と表示名ヒントが出る
- [☑] **確認手順3**: `first.ks` の 22行目 `[eval exp="f.player_name = 'Player'"]` → `exp=` の値の前に `game var: ` というスコープヒントが表示される
- [☑] **確認手順4**: `first.ks` の 28行目 `[eval exp="sf.play_count = ..."]` → `system var: ` ヒント
- [☑] **確認手順5**: `first.ks` の 31行目 `[eval exp="tf.current_mood = ..."]` → `temp var: ` ヒント

---

## 新機能 #10: Semantic Tokens

> 設定: `editor.semanticHighlighting.enabled` が `true` になっていること

- [☑] **確認手順**: `first.ks` の 22行目 `[eval exp="f.player_name = 'Player'"]` を見る
- [☑] **期待結果**: `f.player_name` が通常の文字列色とは異なる「変数」専用の色でハイライトされる
- [☑] **確認手順2**: `scene1.ks` の 120行目 `[if exp="sf.play_count > 1"]` → `sf.play_count` が変数色でハイライト
- [☑] **確認手順3**: `scene1.ks` の 120行目 `if` タグ名 → 通常のタグとは異なる「キーワード」色で表示される
- [☑] **確認手順4**: `scene1.ks` の 128行目 `endif`、126行目 `else` も同様にキーワード色
- [☑] **補足**: カラーテーマによっては差が見えにくい場合があります。Dark+, Monokai 等のテーマで確認するのがおすすめです

---

## 新機能 #11: Code Lens

- [☑] **確認手順**: `scene2.ks` を開く
- [☑] **期待結果**: 各 `*label` 行（例: `*start`, `*choice_cafe` 等）の **上の行** に薄い文字で「N references」と表示される
- [☑] **確認手順2**: `*after_choice`（155行目）の上に「3 references」と表示されていること（88行目、116行目、150行目で参照されている）
- [☑] **操作**: 「3 references」をクリック → 参照元の一覧がポップアップ表示され、クリックでジャンプできる
- [☑] **確認手順3**: `sub.ks` を開く → `*festival_comment` の上に参照数が表示される

---

## 新機能 #12: Snippets

- [☑] **確認手順**: `first.ks` の末尾で新しい行に移動し、行頭で `scene` と入力する（`[` は不要）
- [☑] **期待結果**: 補完候補に「scene — TyranoScript: Full scene template...」が表示される
- [☑] **操作**: Enter で選択 → ラベル、背景、キャラ、ダイアログのテンプレートが挿入される。Tab でプレースホルダー間を移動可能
- [☑] **確認手順2**: `choice` と入力 → glink 選択肢テンプレート
- [☑] **確認手順3**: `ifblock` と入力 → if/else/endif テンプレート
- [☑] **確認手順4**: `macro` と入力 → macro/endmacro テンプレート
- [☑] **確認手順5**: `chara` → キャラクター定義テンプレート、`bgm` → 音楽再生、`transition` → シーン遷移
- [☑] **後片付け**: 挿入されたテスト行を Ctrl+Z で元に戻す

---

## 新機能 #13: Rename Symbol

- [☑] **確認手順**: `scene2.ks` の 65行目 `*choice_cafe` にカーソルを置く
- [☑] **操作**: `F2` を押す
- [☑] **期待結果**: リネームダイアログが表示され、現在のラベル名 `choice_cafe` が入っている
- [☑] **操作**: `choice_coffee` に変更して Enter
- [☑] **期待結果**: `*choice_cafe` の定義と、57行目の `target="*choice_cafe"` の参照が同時に `choice_coffee` に変更される
- [☑] **確認手順2**: `macro.ks` の 18行目 `[macro name="talk"]` の `talk` で F2 → マクロ名を `dialogue` に変更 → `scene1.ks` と `scene2.ks` の `[talk ...]` 使用箇所も同時に更新される
- [☑] **後片付け**: `Ctrl+Z` を複数回押して変更を元に戻す（ファイルを保存しないこと）

---

## 新機能 #14: Call Hierarchy

- [☑] **確認手順**: `sub.ks` の 11行目 `*festival_comment` にカーソルを置く
- [☑] **操作**: 右クリック → コンテキストメニューから **「Show Call Hierarchy」** を選択
- [☑] **期待結果**: 下部のパネルに Call Hierarchy ビューが表示される
- [☑] **確認手順2**: **Incoming Calls**（左矢印アイコン）に切り替え → `scene2.ks` から `[call storage="sub.ks" target="*festival_comment"]` で呼び出されていることが表示される
- [☑] **確認手順3**: `scene1.ks` の `*start` で同様に操作 → `first.ks` の `[jump storage="scene1.ks" target=*start]` からの着信が表示される

---

## 新機能 #15: Bracket Highlight

- [☑] **確認手順**: `scene1.ks` の 120行目 `[if exp="sf.play_count > 1"]` の `if` にカーソルを置く
- [☑] **期待結果**: 対応する `[if]`・`[elsif]`・`[else]`・`[endif]` がすべてハイライト（背景色変更）される
- [☑] **確認手順2**: 128行目の `[endif]` にカーソルを置く → 同じブロックの `[if]`・`[elsif]` 等がすべてハイライトされる
- [☑] **確認手順3**: 123行目の `[elsif]` にカーソルを置く → 同様にブロック全体がハイライトされる
- [☑] **確認手順4**: `macro.ks` の 18行目 `[macro name="talk"]` にカーソル → 26行目の `[endmacro]` がハイライトされる

---

## 新機能 #16: Variable Tracker

- [☑] **確認手順**: 左サイドバーの **Explorer** アイコンをクリック
- [☑] **期待結果**: Explorer ビューの下部に **「TyranoScript Variables」** というセクションが表示される
- [☑] **確認手順2**: セクションを展開 → `f. (Game Variables)`, `sf. (System Variables)`, `tf. (Temporary Variables)` のスコープ別カテゴリが表示される
- [☑] **確認手順3**: `f. (Game Variables)` を展開 → `f.player_name`, `f.affection`, `f.route`, `f.scene_count` 等の変数名が一覧される
- [☑] **確認手順4**: 各変数の横に「N write, M read」と使用回数が表示される
- [☑] **確認手順5**: 変数名を展開 → 使用箇所（ファイル名:行番号）が一覧される
- [☑] **確認手順6**: 使用箇所をクリック → エディタでその行にジャンプする

> **注意**: 変数一覧はプロジェクトのインデックスに基づきます。`.ks` ファイルを何か開いた状態でないと表示されない場合があります。`Ctrl+Shift+P` → `TyranoCode: Refresh Variables` で更新もできます。

---

## 新機能 #17: Scene Preview

- [☑] **確認手順**: `scene1.ks` を開いた状態で `Ctrl+Shift+P` → `TyranoCode: Preview Scene` と入力して実行
- [☑] **期待結果**: エディタの横に WebView パネルが開く
- [☑] **確認箇所**: パネル内にモックアップが表示される:
  - 背景: `classroom.jpg` の名前が表示される（実際の画像がなくてもプレースホルダーが出る）
  - キャラクター: `sakura`, `takeshi` の配置位置が表示される
  - ダイアログ: セリフテキストが表示される
  - ラベル: `*start`, `*middle`, `*end` がセクション区切りとして表示される
- [☑] **確認手順2**: `scene1.ks` を編集（例: セリフを変更）→ Preview パネルがリアルタイムで更新される
- [☑] **確認手順3**: `scene2.ks` に切り替え → Preview の内容もそのファイルに更新される（アクティブエディタ連動）
- [☑] **後片付け**: 編集した内容を Ctrl+Z で戻す

---

## 新機能 #18: ホバー画像プレビュー

- [☑] **確認手順**: `scene1.ks` の `[bg storage="classroom.jpg"]` の `classroom.jpg` にマウスカーソルを乗せる
- [☑] **期待結果**: ホバーポップアップにファイル名、パス、画像サムネイルが表示される
- [☑] **確認手順2**: `[chara_new storage="chara/sakura/normal.png"]` の画像パスにホバー → サムネイル表示
- [☑] **確認手順3**: 存在しない画像ファイル名にホバー → 通常の属性ドキュメントが表示される（エラーにならない）

---

## 新機能 #19: 多言語対応 (i18n)

> VS Code のロケール切替が必要: `Ctrl+Shift+P` → `Configure Display Language` → `ja` / `en`

- [ ] **確認手順**: VS Code の表示言語を日本語 (`ja`) に設定し、再起動する
- [ ] **期待結果（日本語）**:
  - タグホバーのパラメータ表ヘッダー: 「名前 / 型 / 必須 / 既定値 / 説明」
  - 診断メッセージ: 「不明なタグまたは未定義のマクロ: [xxx]」
  - CodeLens: 「N 参照」
  - 変数トラッカーのスコープ: 「f. (ゲーム変数)」「sf. (システム変数)」等
  - スニペットの説明文が日本語
  - コマンドパレット: 「TyranoCode: シーンプレビュー」等
- [ ] **確認手順2**: 表示言語を英語 (`en`) に戻す → 全て英語表示に戻ること

---

## PRO機能 #20: フローチャート表示

### Claude が確認可能 ✅
- [☑] buildGraph() のノード/エッジ抽出ロジック（ユニットテスト済）
- [☑] LABEL_REF_TAGS 経由の jump/call/button/glink エッジ検出
- [☑] cross-file jump/call エッジ抽出
- [☑] if ブロック・マクロ定義内のエッジ抽出
- [☑] 動的ラベル（&prefix）のスキップ
- [☑] fallthrough エッジ（シーン先頭→最初のラベル）

### 手動確認が必要 🔧
- [ ] `Ctrl+Shift+P` → `TyranoCode: Show Flow Graph` を実行
- [ ] Webview パネルが開き、ノード（シーン=緑、ラベル=青）とエッジが表示される
- [ ] ノードクリック → 該当ファイル・行にジャンプ
- [ ] パン（ドラッグ）とズーム（スクロール）が動作する
- [ ] 凡例（Scene / Label / jump / call / choice）が表示される
- [ ] `+` / `−` / `⊞` ボタンでズーム・フィットが動作する

---

## PRO機能 #21: ブレークポイントデバッガ

### Claude が確認可能 ✅
- [☑] DAP デバッグアダプタの登録（extension.ts で registerDebugAdapterDescriptorFactory）
- [☑] package.json の debuggers 設定（type: tyranoscript, configurationAttributes）
- [☑] breakpoints 設定（language: tyranoscript）

### 手動確認が必要 🔧
- [ ] `.vscode/launch.json` に TyranoScript デバッグ設定を追加できる
- [ ] `.ks` ファイルの行番号クリックでブレークポイントが設置できる（赤い丸が出る）
- [ ] F5 でデバッグセッションが起動する（WebSocket サーバーが立ち上がる）
- [ ] ※ ランタイム接続テストは TyranoScript ゲームが実行中の環境が必要

> **注意**: デバッガはゲームランタイムに `debug-bridge.js` を注入して WebSocket 接続する設計。完全テストにはブラウザで TyranoScript ゲームを実行中の環境が必要。

---

## PRO機能 #22: 自動テストランナー

### Claude が確認可能 ✅
- [☑] 選択肢検出ロジック（button/glink + [s] パターン）（ユニットテスト済）
- [☑] ルート探索 BFS（選択肢の組合せ生成、MAX_ROUTES=500 制限）
- [☑] 未到達ラベル検出ロジック（ユニットテスト済）
- [☑] LABEL_REF_TAGS 経由の参照ラベル収集

### 手動確認が必要 🔧
- [ ] `Ctrl+Shift+P` → `TyranoCode: Run All Routes` を実行
- [ ] Output パネル（`TyranoCode Test Runner`）にルート解析結果が表示される
- [ ] カバレッジレポート（ファイル数、ラベル数、選択肢数）が表示される
- [ ] エラーがある場合、Problems パネルに diagnostics が表示される（30秒後に自動消去）
- [ ] 未到達ラベルがあれば一覧表示される

---

## PRO機能 #23: パフォーマンスプロファイラ

### Claude が確認可能 ✅
- [☑] タグ数・ラベル数・リソース数カウント（ユニットテスト済）
- [☑] トランジション検出（bg, chara_show, trans 等）
- [☑] eval/iscript カウント
- [☑] 選択肢ポイント検出
- [☑] 複雑度分類（low/medium/high/critical 閾値）
- [☑] if ブロック内の再帰的走査

### 手動確認が必要 🔧
- [ ] `Ctrl+Shift+P` → `TyranoCode: Profile Scene` を実行
- [ ] Output パネル（`TyranoCode Profiler`）にプロファイル結果が表示される
- [ ] プロジェクト概要（合計シーン/タグ/ラベル/リソース）が出る
- [ ] リソース種別（image/audio/video 等）の内訳が出る
- [ ] シーン複雑度ランキング（○/△/▲/● + LOW〜CRITICAL）が表示される
- [ ] 警告（高トランジション密度、多 eval、多画像ロード、長 wait 等）があれば表示される

---

## PRO機能 #24: ライセンス管理

### Claude が確認可能 ✅
- [☑] LicenseManager の初期化・ステータスバー表示（extension.ts のコード確認済）
- [☑] PRO コマンド実行時の `licenseManager.requirePro()` ゲート

### 手動確認が必要 🔧
- [ ] PRO コマンド実行時にライセンスキー入力ダイアログが表示される
- [ ] ステータスバーに「$(code) TyranoCode」（Free）が表示される
- [ ] ステータスバークリック → ライセンスアクティベーション画面が出る
- [ ] ※ ライセンス検証は未実装（Phase 2 最後のタスク）

---

## テスト（自動）

- [ ] **確認手順**: VS Code のターミナルで以下を実行:
  ```
  cd tyranodev
  npm run test:unit
  ```
- [ ] **期待結果**: `681 tests passed` と表示される（テストファイル 2つ: `tag-database.test.ts` 587件, `providers.test.ts` 94件）

---

## コンパイル確認

- [ ] `npm run compile` がエラーなしで完了する

---

## トラブルシューティング

### 拡張が動作しない場合
1. `Ctrl+Shift+P` → `Developer: Reload Window` でリロード
2. Output パネル（`Ctrl+Shift+U`）のドロップダウンで「TyranoCode」を選択し、エラーが出ていないか確認
3. `npm run compile` でビルドエラーがないか確認

### Inlay Hints / Semantic Tokens が表示されない場合
VS Code 設定（`Ctrl+,`）で以下を検索して有効にする:
- `editor.inlayHints.enabled` → `on` に変更
- `editor.semanticHighlighting.enabled` → `true` に変更

### Code Lens が表示されない場合
- `editor.codeLens` が `true` になっていることを確認

### Variable Tracker が見つからない場合
- Explorer サイドバーの一番下までスクロールする
- ビューが折りたたまれている場合がある
- `Ctrl+Shift+P` → `TyranoCode: Show Variables` で直接開ける

### 補完候補が出ない場合
- `Ctrl+Space` で手動で補完を呼び出してみる
- `editor.quickSuggestions` が有効になっていることを確認
