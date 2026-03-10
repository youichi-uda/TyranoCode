# TyranoCode 動作確認チェックリスト

VS Code をリロード (`Ctrl+Shift+P` → `Developer: Reload Window`) してから確認してください。

## 基本機能（既存）
- [ ] .ks ファイルにシンタックスハイライトが適用される
- [ ] タグ名を入力すると補完候補が出る（`[` or `@` の後）
- [ ] タグにホバーすると説明が表示される
- [ ] 不正なタグ/パラメータに警告が出る（Problemsパネル）
- [ ] `*label` 上で F12 → 定義ジャンプ
- [ ] `*label` 上で Shift+F12 → 参照検索

## 新機能 #1: Document Symbols / Outline
- [ ] .ks ファイルを開いた状態で Outline パネル（サイドバー）にラベル・マクロが表示される
- [ ] パンくずリスト（エディタ上部）にラベルが表示される

## 新機能 #2: Document Links
- [ ] `storage="scene2.ks"` の値部分が青いリンクになる
- [ ] Ctrl+クリックでそのファイルが開く

## 新機能 #3: Color Decorator
- [ ] `color=0xFF0000` の横にカラースウォッチ（色付き四角）が表示される
- [ ] クリックでカラーピッカーが開く

## 新機能 #4: Code Folding
- [ ] `[if]...[endif]` ブロックの左に折りたたみ矢印が表示される
- [ ] `[macro]...[endmacro]` も折りたためる
- [ ] 連続するコメント行（`;`）も折りたためる

## 新機能 #5: Signature Help
- [ ] `[bg ` とスペースを打つとパラメータヒントが表示される
- [ ] パラメータの型・説明・必須/任意が見える

## 新機能 #6: リソースファイル補完
- [ ] `[bg storage="` と入力すると data/bgimage/ 内のファイルが候補に出る
- [ ] `[jump storage="` で data/scenario/ 内の .ks ファイルが候補に出る

## 新機能 #7: Workspace Symbols
- [ ] `Ctrl+T` でラベル名・マクロ名を検索できる

## 新機能 #8: Code Actions / Quick Fix
- [ ] 未定義のタグに対する警告の電球アイコンから「Define as macro」が選べる
- [ ] 未定義ラベルの警告から「Create label」が選べる

## 新機能 #9: Inlay Hints
- [ ] `[jump]` の storage 属性の横にパス情報がインラインで表示される
- [ ] `[eval exp="f.x = 1"]` に "game var" 等のヒントが出る

## 新機能 #10: Semantic Tokens
- [ ] 変数 `f.xxx` がハイライトされる（TextMateだけでは着色されない部分）
- [ ] タグ名がキーワードとして色分けされる

## 新機能 #11: Code Lens
- [ ] `*label` の上に「N references」が表示される
- [ ] クリックで参照一覧にジャンプ

## 新機能 #12: Snippets
- [ ] `scene` と入力すると「Scene template」スニペットが補完候補に出る
- [ ] `choice`, `ifblock`, `macro` 等も同様

## 新機能 #13: Rename Symbol
- [ ] `*label` 上で F2 → ラベル名を変更 → 全ファイルの参照も更新される
- [ ] マクロ名でも同様にリネーム可能

## 新機能 #14: Call Hierarchy
- [ ] `*label` 上で右クリック → 「Show Call Hierarchy」
- [ ] Incoming/Outgoing calls が表示される

## 新機能 #15: Bracket Highlight
- [ ] `[if]` にカーソルを置くと対応する `[endif]` がハイライトされる
- [ ] `[macro]` ↔ `[endmacro]` も同様

## 新機能 #16: Variable Tracker
- [ ] エクスプローラーサイドバーに「TyranoScript Variables」ビューが表示される
- [ ] f. / sf. / tf. スコープ別に変数が一覧される
- [ ] 変数をクリックで使用箇所にジャンプ

## テスト
- [ ] ターミナルで `cd tyranodev && npm run test:unit` → 587 tests passed

## 注意事項
- 一部の機能（Inlay Hints, Semantic Tokens）は VS Code の設定で無効化されている場合があります
  - `editor.inlayHints.enabled` → true
  - `editor.semanticHighlighting.enabled` → true
