/**
 * Built-in TyranoScript tag definitions.
 * This is the authoritative database for autocompletion, hover docs, and validation.
 */

export interface TagParamDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'color' | 'expression' | 'file' | 'enum';
  required: boolean;
  default?: string;
  description: string;
  descriptionJa?: string;
  enumValues?: string[];
}

export interface TagDef {
  name: string;
  category: string;
  description: string;
  descriptionJa?: string;
  params: TagParamDef[];
  /** Tags that must pair with this one (e.g., [macro] -> [endmacro]) */
  closingTag?: string;
  /** Whether this tag is a closing tag */
  isClosing?: boolean;
  deprecated?: boolean;
  since?: string;
}

export const TAG_DATABASE: Map<string, TagDef> = new Map();

function def(tag: TagDef): void {
  TAG_DATABASE.set(tag.name, tag);
}

// ────────────────────────── System / Flow Control ──────────────────────────

def({
  name: 'jump',
  category: 'flow',
  description: 'Jump to a label or scenario file.',
  descriptionJa: '指定したラベルまたはシナリオファイルにジャンプします。',
  params: [
    { name: 'storage', type: 'file', required: false, description: 'Scenario file to jump to (e.g., "scene2.ks").', descriptionJa: 'ジャンプ先のシナリオファイル' },
    { name: 'target', type: 'string', required: false, description: 'Label name to jump to (e.g., "*start").', descriptionJa: 'ジャンプ先のラベル名' },
    { name: 'countpage', type: 'boolean', required: false, default: 'true', description: 'Whether to count this as a page for back-log.' },
    { name: 'cond', type: 'expression', required: false, description: 'Condition expression. Tag executes only if true.' },
  ],
});

def({
  name: 'call',
  category: 'flow',
  description: 'Call a subroutine. Returns with [return].',
  descriptionJa: 'サブルーチンを呼び出します。[return]で戻ります。',
  params: [
    { name: 'storage', type: 'file', required: false, description: 'Scenario file containing the subroutine.' },
    { name: 'target', type: 'string', required: false, description: 'Label name of the subroutine.' },
    { name: 'cond', type: 'expression', required: false, description: 'Condition expression.' },
  ],
});

def({
  name: 'return',
  category: 'flow',
  description: 'Return from a subroutine called with [call].',
  descriptionJa: '[call]で呼び出したサブルーチンから戻ります。',
  params: [
    { name: 'cond', type: 'expression', required: false, description: 'Condition expression.' },
  ],
});

def({
  name: 'if',
  category: 'flow',
  description: 'Conditional branch. Must be closed with [endif].',
  descriptionJa: '条件分岐。[endif]で閉じる必要があります。',
  closingTag: 'endif',
  params: [
    { name: 'exp', type: 'expression', required: true, description: 'JavaScript expression to evaluate.' },
  ],
});

def({
  name: 'elsif',
  category: 'flow',
  description: 'Else-if branch within an [if] block.',
  descriptionJa: '[if]ブロック内のelse-if分岐。',
  params: [
    { name: 'exp', type: 'expression', required: true, description: 'JavaScript expression to evaluate.' },
  ],
});

def({
  name: 'else',
  category: 'flow',
  description: 'Else branch within an [if] block.',
  descriptionJa: '[if]ブロック内のelse分岐。',
  params: [],
});

def({
  name: 'endif',
  category: 'flow',
  description: 'End of [if] block.',
  descriptionJa: '[if]ブロックの終了。',
  isClosing: true,
  params: [],
});

def({
  name: 'ignore',
  category: 'flow',
  description: 'Ignore everything until [endignore].',
  descriptionJa: '[endignore]までの内容を無視します。',
  closingTag: 'endignore',
  params: [
    { name: 'exp', type: 'expression', required: true, description: 'Condition expression to evaluate.' },
  ],
});

def({
  name: 'endignore',
  category: 'flow',
  description: 'End of [ignore] block.',
  isClosing: true,
  params: [],
});

def({
  name: 's',
  category: 'flow',
  description: 'Stop script execution. Game waits for user interaction (button click, etc.).',
  descriptionJa: 'スクリプトの実行を停止します。',
  params: [
    { name: 'cond', type: 'expression', required: false, description: 'Condition expression.' },
  ],
});

def({
  name: 'wait',
  category: 'flow',
  description: 'Wait for a specified time.',
  descriptionJa: '指定した時間待機します。',
  params: [
    { name: 'time', type: 'number', required: true, description: 'Wait time in milliseconds.' },
    { name: 'cond', type: 'expression', required: false, description: 'Condition expression.' },
  ],
});

def({
  name: 'waitclick',
  category: 'flow',
  description: 'Wait for a mouse click.',
  descriptionJa: 'マウスクリックを待ちます。',
  params: [
    { name: 'cond', type: 'expression', required: false, description: 'Condition expression.' },
  ],
});

// ────────────────────────── Macro ──────────────────────────

def({
  name: 'macro',
  category: 'macro',
  description: 'Define a macro.',
  descriptionJa: 'マクロを定義します。',
  closingTag: 'endmacro',
  params: [
    { name: 'name', type: 'string', required: true, description: 'Macro name.' },
  ],
});

def({
  name: 'endmacro',
  category: 'macro',
  description: 'End of macro definition.',
  descriptionJa: 'マクロ定義の終了。',
  isClosing: true,
  params: [],
});

// ────────────────────────── Script / Eval ──────────────────────────

def({
  name: 'iscript',
  category: 'script',
  description: 'Begin JavaScript block. End with [endscript].',
  descriptionJa: 'JavaScriptブロックの開始。[endscript]で終了。',
  closingTag: 'endscript',
  params: [],
});

def({
  name: 'endscript',
  category: 'script',
  description: 'End of JavaScript block.',
  isClosing: true,
  params: [],
});

def({
  name: 'eval',
  category: 'script',
  description: 'Evaluate a JavaScript expression and optionally assign to a variable.',
  descriptionJa: 'JavaScript式を評価し、変数に代入できます。',
  params: [
    { name: 'exp', type: 'expression', required: true, description: 'JavaScript expression to evaluate.' },
    { name: 'cond', type: 'expression', required: false, description: 'Condition expression.' },
  ],
});

def({
  name: 'clearvar',
  category: 'script',
  description: 'Clear all game variables (f. scope).',
  descriptionJa: 'すべてのゲーム変数（f.スコープ）をクリアします。',
  params: [],
});

def({
  name: 'clearsysvar',
  category: 'script',
  description: 'Clear all system variables (sf. scope).',
  descriptionJa: 'すべてのシステム変数（sf.スコープ）をクリアします。',
  params: [],
});

// ────────────────────────── Text / Message ──────────────────────────

def({
  name: 'l',
  category: 'text',
  description: 'Wait for click (line break wait).',
  descriptionJa: 'クリック待ち（行末クリック待ち）。',
  params: [],
});

def({
  name: 'r',
  category: 'text',
  description: 'Insert line break.',
  descriptionJa: '改行を挿入します。',
  params: [],
});

def({
  name: 'p',
  category: 'text',
  description: 'Wait for click then clear message area (page break).',
  descriptionJa: 'クリック待ち後にメッセージエリアをクリア（改ページ）。',
  params: [],
});

def({
  name: 'er',
  category: 'text',
  description: 'Clear current message layer text.',
  descriptionJa: '現在のメッセージレイヤーのテキストをクリアします。',
  params: [],
});

def({
  name: 'cm',
  category: 'text',
  description: 'Clear all message layers.',
  descriptionJa: 'すべてのメッセージレイヤーをクリアします。',
  params: [
    { name: 'next', type: 'boolean', required: false, default: 'true', description: 'Whether to auto-advance after clearing.' },
  ],
});

def({
  name: 'ct',
  category: 'text',
  description: 'Clear text and reset all message layer attributes.',
  descriptionJa: 'テキストをクリアし、全メッセージレイヤーの属性をリセットします。',
  params: [],
});

def({
  name: 'position',
  category: 'text',
  description: 'Set message window position and size.',
  descriptionJa: 'メッセージウィンドウの位置とサイズを設定します。',
  params: [
    { name: 'layer', type: 'string', required: false, default: 'message0', description: 'Target message layer.' },
    { name: 'left', type: 'number', required: false, description: 'Left position (px).' },
    { name: 'top', type: 'number', required: false, description: 'Top position (px).' },
    { name: 'width', type: 'number', required: false, description: 'Width (px).' },
    { name: 'height', type: 'number', required: false, description: 'Height (px).' },
    { name: 'page', type: 'enum', required: false, enumValues: ['fore', 'back'], description: 'Page (fore or back).' },
    { name: 'opacity', type: 'number', required: false, description: 'Opacity (0-255).' },
    { name: 'margint', type: 'number', required: false, description: 'Top margin inside the message window (px).', descriptionJa: 'メッセージウィンドウ内の上マージン' },
    { name: 'marginl', type: 'number', required: false, description: 'Left margin inside the message window (px).', descriptionJa: 'メッセージウィンドウ内の左マージン' },
    { name: 'marginr', type: 'number', required: false, description: 'Right margin inside the message window (px).', descriptionJa: 'メッセージウィンドウ内の右マージン' },
    { name: 'marginb', type: 'number', required: false, description: 'Bottom margin inside the message window (px).', descriptionJa: 'メッセージウィンドウ内の下マージン' },
    { name: 'frame', type: 'file', required: false, description: 'Background image for the message window.', descriptionJa: 'メッセージウィンドウの背景画像' },
    { name: 'color', type: 'color', required: false, description: 'Background color of the message window.' },
    { name: 'vertical', type: 'boolean', required: false, description: 'Vertical text mode.', descriptionJa: '縦書きモード' },
    { name: 'visible', type: 'boolean', required: false, description: 'Message window visibility.' },
    { name: 'radius', type: 'number', required: false, description: 'Border radius (px).' },
    { name: 'border_size', type: 'number', required: false, description: 'Border width (px).' },
    { name: 'border_color', type: 'color', required: false, description: 'Border color.' },
    { name: 'margin', type: 'number', required: false, description: 'Margin for all sides (px).' },
    { name: 'gradient', type: 'string', required: false, description: 'CSS gradient for background.' },
  ],
});

def({
  name: 'font',
  category: 'text',
  description: 'Set font attributes for text display.',
  descriptionJa: 'テキスト表示のフォント属性を設定します。',
  params: [
    { name: 'size', type: 'number', required: false, description: 'Font size (px).' },
    { name: 'color', type: 'color', required: false, description: 'Font color (e.g., "0xFFFFFF").' },
    { name: 'face', type: 'string', required: false, description: 'Font family name.' },
    { name: 'bold', type: 'boolean', required: false, description: 'Bold text.' },
    { name: 'italic', type: 'boolean', required: false, description: 'Italic text.' },
    { name: 'edge', type: 'color', required: false, description: 'Text edge/shadow color.' },
    { name: 'edgecolor', type: 'color', required: false, description: 'Text edge color (alias for edge).' },
    { name: 'shadow', type: 'color', required: false, description: 'Text shadow color.' },
    { name: 'effect', type: 'string', required: false, description: 'Text effect.' },
    { name: 'effect_speed', type: 'string', required: false, description: 'Text effect speed.' },
    { name: 'gradient', type: 'string', required: false, description: 'CSS gradient for text.' },
  ],
});

def({
  name: 'resetfont',
  category: 'text',
  description: 'Reset font to default settings.',
  descriptionJa: 'フォントをデフォルト設定にリセットします。',
  params: [],
});

def({
  name: 'delay',
  category: 'text',
  description: 'Set text display speed.',
  descriptionJa: 'テキスト表示速度を設定します。',
  params: [
    { name: 'speed', type: 'number', required: true, description: 'Delay per character in ms. 0=instant.' },
  ],
});

def({
  name: 'nowait',
  category: 'text',
  description: 'Display following text instantly (no character-by-character animation).',
  descriptionJa: '以降のテキストを即座に表示します。',
  params: [],
});

def({
  name: 'endnowait',
  category: 'text',
  description: 'End [nowait] mode.',
  descriptionJa: '[nowait]モードを終了します。',
  params: [],
});

def({
  name: 'ruby',
  category: 'text',
  description: 'Set ruby (furigana) text for the next character.',
  descriptionJa: '次の文字にルビ（ふりがな）を設定します。',
  params: [
    { name: 'text', type: 'string', required: true, description: 'Ruby text.' },
  ],
});

// ────────────────────────── Character ──────────────────────────

def({
  name: 'chara_new',
  category: 'character',
  description: 'Define a new character.',
  descriptionJa: '新しいキャラクターを定義します。',
  params: [
    { name: 'name', type: 'string', required: true, description: 'Character ID.' },
    { name: 'storage', type: 'file', required: true, description: 'Default character image file.' },
    { name: 'jname', type: 'string', required: false, description: 'Display name (shown in name box).' },
    { name: 'color', type: 'color', required: false, description: 'Name display color.' },
    { name: 'width', type: 'number', required: false, description: 'Image width.' },
    { name: 'height', type: 'number', required: false, description: 'Image height.' },
    { name: 'reflect', type: 'boolean', required: false, description: 'Mirror the image horizontally.' },
    { name: 'is_show', type: 'boolean', required: false, description: 'Whether to show the character immediately.' },
  ],
});

def({
  name: 'chara_show',
  category: 'character',
  description: 'Show a character on screen.',
  descriptionJa: 'キャラクターを画面に表示します。',
  params: [
    { name: 'name', type: 'string', required: true, description: 'Character ID.' },
    { name: 'storage', type: 'file', required: false, description: 'Character image to use (overrides default).' },
    { name: 'left', type: 'number', required: false, description: 'Left position.' },
    { name: 'top', type: 'number', required: false, description: 'Top position.' },
    { name: 'width', type: 'number', required: false, description: 'Width.' },
    { name: 'height', type: 'number', required: false, description: 'Height.' },
    { name: 'time', type: 'number', required: false, default: '1000', description: 'Fade-in time (ms).' },
    { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait for animation to complete.' },
    { name: 'reflect', type: 'boolean', required: false, description: 'Mirror the image horizontally.' },
    { name: 'zindex', type: 'number', required: false, description: 'Z-index (layer order).' },
    { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
    { name: 'page', type: 'enum', required: false, enumValues: ['fore', 'back'], description: 'Page (fore or back).' },
    { name: 'depth', type: 'string', required: false, description: 'Depth order for positioning.' },
    { name: 'face', type: 'string', required: false, description: 'Face name registered with [chara_face].' },
  ],
});

def({
  name: 'chara_hide',
  category: 'character',
  description: 'Hide a character.',
  descriptionJa: 'キャラクターを非表示にします。',
  params: [
    { name: 'name', type: 'string', required: true, description: 'Character ID.' },
    { name: 'time', type: 'number', required: false, default: '1000', description: 'Fade-out time (ms).' },
    { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait for animation to complete.' },
    { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
    { name: 'page', type: 'enum', required: false, enumValues: ['fore', 'back'], description: 'Page (fore or back).' },
    { name: 'pos_mode', type: 'boolean', required: false, description: 'Whether to use position mode.' },
  ],
});

def({
  name: 'chara_mod',
  category: 'character',
  description: 'Change character image (expression change).',
  descriptionJa: 'キャラクターの画像を変更します（表情変更）。',
  params: [
    { name: 'name', type: 'string', required: true, description: 'Character ID.' },
    { name: 'storage', type: 'file', required: false, description: 'New image file.' },
    { name: 'face', type: 'string', required: false, description: 'Face name registered with [chara_face].', descriptionJa: '[chara_face]で登録した表情名' },
    { name: 'reflect', type: 'boolean', required: false, description: 'Mirror the image horizontally.' },
    { name: 'time', type: 'number', required: false, default: '600', description: 'Cross-fade time (ms).' },
    { name: 'cross', type: 'boolean', required: false, default: 'true', description: 'Use cross-fade transition.' },
    { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait for animation to complete.' },
    { name: 'next', type: 'boolean', required: false, default: 'true', description: 'Auto-advance after animation.' },
  ],
});

def({
  name: 'chara_hide_all',
  category: 'character',
  description: 'Hide all characters.',
  descriptionJa: 'すべてのキャラクターを非表示にします。',
  params: [
    { name: 'time', type: 'number', required: false, default: '1000', description: 'Fade-out time (ms).' },
    { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait for animation to complete.' },
    { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
    { name: 'page', type: 'enum', required: false, enumValues: ['fore', 'back'], description: 'Page (fore or back).' },
  ],
});

def({
  name: 'chara_face',
  category: 'character',
  description: 'Register a named expression (face) for a character.',
  descriptionJa: 'キャラクターの表情（face）を名前付きで登録します。',
  params: [
    { name: 'name', type: 'string', required: true, description: 'Character ID.' },
    { name: 'face', type: 'string', required: true, description: 'Face/expression name.' },
    { name: 'storage', type: 'file', required: true, description: 'Image file for this face.' },
  ],
});

// ────────────────────────── Background ──────────────────────────

def({
  name: 'bg',
  category: 'background',
  description: 'Change the background image.',
  descriptionJa: '背景画像を変更します。',
  params: [
    { name: 'storage', type: 'file', required: true, description: 'Background image file.' },
    { name: 'time', type: 'number', required: false, default: '1000', description: 'Transition time (ms).' },
    { name: 'method', type: 'string', required: false, default: 'crossfade', description: 'Transition method.' },
    { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait for transition to complete.' },
    { name: 'color', type: 'color', required: false, description: 'Background color (if no image).' },
    { name: 'cross', type: 'boolean', required: false, default: 'true', description: 'Use cross-fade transition.' },
  ],
});

// ────────────────────────── Layer / Image ──────────────────────────

def({
  name: 'layopt',
  category: 'layer',
  description: 'Set layer options (visibility, position, etc.).',
  descriptionJa: 'レイヤーのオプションを設定します。',
  params: [
    { name: 'layer', type: 'string', required: true, description: 'Layer name (e.g., "0", "1", "message0").' },
    { name: 'visible', type: 'boolean', required: false, description: 'Layer visibility.' },
    { name: 'left', type: 'number', required: false, description: 'Left position.' },
    { name: 'top', type: 'number', required: false, description: 'Top position.' },
    { name: 'opacity', type: 'number', required: false, description: 'Opacity (0-255).' },
    { name: 'page', type: 'enum', required: false, enumValues: ['fore', 'back'], description: 'Page (fore or back).' },
  ],
});

def({
  name: 'image',
  category: 'layer',
  description: 'Display an image on a layer.',
  descriptionJa: 'レイヤーに画像を表示します。',
  params: [
    { name: 'storage', type: 'file', required: true, description: 'Image file.' },
    { name: 'layer', type: 'string', required: false, default: '0', description: 'Target layer.' },
    { name: 'page', type: 'enum', required: false, default: 'fore', enumValues: ['fore', 'back'], description: 'Page.' },
    { name: 'left', type: 'number', required: false, default: '0', description: 'Left position.' },
    { name: 'top', type: 'number', required: false, default: '0', description: 'Top position.' },
    { name: 'width', type: 'number', required: false, description: 'Width.' },
    { name: 'height', type: 'number', required: false, description: 'Height.' },
    { name: 'name', type: 'string', required: false, description: 'Element name (for animation targeting).' },
    { name: 'visible', type: 'boolean', required: false, default: 'true', description: 'Visibility.' },
    { name: 'folder', type: 'string', required: false, description: 'Resource folder to search for the image file.', descriptionJa: '画像ファイルを検索するリソースフォルダ' },
    { name: 'x', type: 'number', required: false, description: 'X position (alias for left).', descriptionJa: 'X座標（leftのエイリアス）' },
    { name: 'y', type: 'number', required: false, description: 'Y position (alias for top).', descriptionJa: 'Y座標（topのエイリアス）' },
    { name: 'time', type: 'number', required: false, description: 'Fade-in time (ms).' },
    { name: 'wait', type: 'boolean', required: false, description: 'Wait for animation to complete.' },
    { name: 'zindex', type: 'number', required: false, description: 'Z-index (layer order).' },
    { name: 'depth', type: 'string', required: false, description: 'Depth order for positioning.' },
    { name: 'reflect', type: 'boolean', required: false, description: 'Mirror the image horizontally.' },
    { name: 'pos', type: 'string', required: false, description: 'Position preset name.' },
    { name: 'animimg', type: 'boolean', required: false, description: 'Whether to use animated image.' },
  ],
});

def({
  name: 'freeimage',
  category: 'layer',
  description: 'Remove all images from a layer.',
  descriptionJa: 'レイヤーからすべての画像を除去します。',
  params: [
    { name: 'layer', type: 'string', required: true, description: 'Target layer.' },
    { name: 'page', type: 'enum', required: false, enumValues: ['fore', 'back'], description: 'Page.' },
    { name: 'time', type: 'number', required: false, description: 'Fade-out time (ms).' },
    { name: 'wait', type: 'boolean', required: false, description: 'Wait for fade-out to complete.' },
  ],
});

// ────────────────────────── Audio ──────────────────────────

def({
  name: 'playbgm',
  category: 'audio',
  description: 'Play background music.',
  descriptionJa: 'BGMを再生します。',
  params: [
    { name: 'storage', type: 'file', required: true, description: 'Audio file.' },
    { name: 'loop', type: 'boolean', required: false, default: 'true', description: 'Loop playback.' },
    { name: 'volume', type: 'number', required: false, default: '100', description: 'Volume (0-100).' },
    { name: 'time', type: 'number', required: false, description: 'Fade-in time (ms).' },
    { name: 'buf', type: 'number', required: false, default: '0', description: 'Audio buffer number.' },
    { name: 'sprite_time', type: 'string', required: false, description: 'Sprite display timing.' },
    { name: 'html5', type: 'boolean', required: false, description: 'Use HTML5 audio mode.' },
    { name: 'pause', type: 'boolean', required: false, description: 'Pause playback instead of stopping.' },
    { name: 'seek', type: 'number', required: false, description: 'Seek position in ms.' },
    { name: 'restart', type: 'boolean', required: false, description: 'Restart from beginning if already playing.' },
    { name: 'fadein', type: 'boolean', required: false, description: 'Enable fade-in effect.' },
    { name: 'stop', type: 'boolean', required: false, description: 'Stop currently playing BGM first.' },
  ],
});

def({
  name: 'stopbgm',
  category: 'audio',
  description: 'Stop background music.',
  descriptionJa: 'BGMを停止します。',
  params: [
    { name: 'time', type: 'number', required: false, description: 'Fade-out time (ms).' },
    { name: 'buf', type: 'number', required: false, default: '0', description: 'Audio buffer number.' },
    { name: 'fadeout', type: 'boolean', required: false, description: 'Use fade-out effect when stopping.' },
    { name: 'buf_all', type: 'boolean', required: false, description: 'Stop all audio buffers.' },
    { name: 'stop', type: 'boolean', required: false, description: 'Force stop playback.' },
  ],
});

def({
  name: 'fadeoutbgm',
  category: 'audio',
  description: 'Fade out BGM.',
  descriptionJa: 'BGMをフェードアウトします。',
  params: [
    { name: 'time', type: 'number', required: false, default: '2000', description: 'Fade-out time (ms).' },
    { name: 'buf', type: 'number', required: false, default: '0', description: 'Audio buffer number.' },
  ],
});

def({
  name: 'fadeinbgm',
  category: 'audio',
  description: 'Fade in BGM.',
  descriptionJa: 'BGMをフェードインします。',
  params: [
    { name: 'time', type: 'number', required: false, default: '2000', description: 'Fade-in time (ms).' },
    { name: 'storage', type: 'file', required: true, description: 'Audio file.' },
    { name: 'loop', type: 'boolean', required: false, default: 'true', description: 'Loop playback.' },
    { name: 'buf', type: 'number', required: false, default: '0', description: 'Audio buffer number.' },
    { name: 'volume', type: 'number', required: false, description: 'Volume (0-100).' },
    { name: 'sprite_time', type: 'string', required: false, description: 'Sprite display timing.' },
    { name: 'html5', type: 'boolean', required: false, description: 'Use HTML5 audio mode.' },
    { name: 'pause', type: 'boolean', required: false, description: 'Pause playback instead of stopping.' },
    { name: 'seek', type: 'number', required: false, description: 'Seek position in ms.' },
  ],
});

def({
  name: 'playse',
  category: 'audio',
  description: 'Play a sound effect.',
  descriptionJa: 'SEを再生します。',
  params: [
    { name: 'storage', type: 'file', required: true, description: 'Audio file.' },
    { name: 'loop', type: 'boolean', required: false, default: 'false', description: 'Loop playback.' },
    { name: 'volume', type: 'number', required: false, default: '100', description: 'Volume (0-100).' },
    { name: 'buf', type: 'number', required: false, default: '0', description: 'SE buffer number.' },
    { name: 'sprite_time', type: 'string', required: false, description: 'Sprite display timing.' },
    { name: 'clear', type: 'boolean', required: false, description: 'Clear audio buffer after playback.' },
    { name: 'html5', type: 'boolean', required: false, description: 'Use HTML5 audio mode.' },
    { name: 'target', type: 'string', required: false, description: 'Target element for audio playback.' },
  ],
});

def({
  name: 'stopse',
  category: 'audio',
  description: 'Stop a sound effect.',
  descriptionJa: 'SEを停止します。',
  params: [
    { name: 'buf', type: 'number', required: false, default: '0', description: 'SE buffer number.' },
    { name: 'time', type: 'number', required: false, description: 'Fade-out time (ms).' },
    { name: 'fadeout', type: 'boolean', required: false, description: 'Use fade-out effect when stopping.' },
  ],
});

// ────────────────────────── Animation ──────────────────────────

def({
  name: 'anim',
  category: 'animation',
  description: 'Animate an element using jQuery-style animation.',
  descriptionJa: 'jQuery風アニメーションで要素をアニメーションします。',
  params: [
    { name: 'name', type: 'string', required: false, description: 'Target element name.' },
    { name: 'left', type: 'number', required: false, description: 'Target left position.' },
    { name: 'top', type: 'number', required: false, description: 'Target top position.' },
    { name: 'width', type: 'number', required: false, description: 'Target width.' },
    { name: 'height', type: 'number', required: false, description: 'Target height.' },
    { name: 'opacity', type: 'number', required: false, description: 'Target opacity (0-255).' },
    { name: 'time', type: 'number', required: false, default: '2000', description: 'Animation duration (ms).' },
    { name: 'effect', type: 'string', required: false, default: 'linear', description: 'Easing function.' },
    { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait for animation to complete.' },
    { name: 'layer', type: 'string', required: false, description: 'Target layer name.' },
    { name: 'color', type: 'string', required: false, description: 'Target color value.' },
  ],
});

def({
  name: 'keyframe',
  category: 'animation',
  description: 'Define a CSS keyframe animation.',
  descriptionJa: 'CSSキーフレームアニメーションを定義します。',
  params: [
    { name: 'name', type: 'string', required: true, description: 'Keyframe animation name.' },
  ],
  closingTag: 'endkeyframe',
});

def({
  name: 'endkeyframe',
  category: 'animation',
  description: 'End keyframe definition.',
  isClosing: true,
  params: [],
});

def({
  name: 'kanim',
  category: 'animation',
  description: 'Apply a keyframe animation to an element.',
  descriptionJa: 'キーフレームアニメーションを要素に適用します。',
  params: [
    { name: 'name', type: 'string', required: false, description: 'Target element name.' },
    { name: 'keyframe', type: 'string', required: true, description: 'Keyframe animation name.' },
    { name: 'time', type: 'number', required: false, default: '2000', description: 'Duration (ms).' },
    { name: 'easing', type: 'string', required: false, default: 'linear', description: 'Easing function.' },
    { name: 'count', type: 'string', required: false, default: '1', description: 'Iteration count ("infinite" for loop).' },
    { name: 'delay', type: 'number', required: false, description: 'Delay before starting (ms).' },
    { name: 'direction', type: 'enum', required: false, enumValues: ['normal', 'reverse', 'alternate'], description: 'Animation direction.' },
    { name: 'mode', type: 'enum', required: false, enumValues: ['forwards', 'backwards', 'both', 'none'], description: 'Fill mode.' },
    { name: 'layer', type: 'string', required: false, description: 'Target layer name.' },
  ],
});

// ────────────────────────── Transition ──────────────────────────

def({
  name: 'trans',
  category: 'transition',
  description: 'Execute a page transition.',
  descriptionJa: 'ページトランジションを実行します。',
  params: [
    { name: 'method', type: 'string', required: false, default: 'crossfade', description: 'Transition method.' },
    { name: 'time', type: 'number', required: false, default: '1000', description: 'Transition time (ms).' },
    { name: 'layer', type: 'string', required: false, default: 'base', description: 'Target layer.' },
    { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait for transition to complete.' },
    { name: 'rule', type: 'string', required: false, description: 'Rule image for transition.' },
    { name: 'vague', type: 'number', required: false, description: 'Edge softness for rule transition.' },
    { name: 'children', type: 'boolean', required: false, description: 'Apply transition to child elements.' },
  ],
});

def({
  name: 'quake',
  category: 'transition',
  description: 'Screen shake effect.',
  descriptionJa: '画面揺れ効果。',
  params: [
    { name: 'count', type: 'number', required: false, default: '10', description: 'Number of shakes.' },
    { name: 'time', type: 'number', required: false, default: '100', description: 'Duration per shake (ms).' },
    { name: 'hmax', type: 'number', required: false, default: '10', description: 'Max horizontal displacement.' },
    { name: 'vmax', type: 'number', required: false, default: '10', description: 'Max vertical displacement.' },
    { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait for effect to complete.' },
    { name: 'hsize', type: 'number', required: false, description: 'Horizontal shake size.' },
    { name: 'vsize', type: 'number', required: false, description: 'Vertical shake size.' },
    { name: 'power', type: 'number', required: false, description: 'Shake power intensity.' },
  ],
});

// ────────────────────────── Button / Link / Choice ──────────────────────────

def({
  name: 'button',
  category: 'ui',
  description: 'Create a clickable button.',
  descriptionJa: 'クリック可能なボタンを作成します。',
  params: [
    { name: 'graphic', type: 'file', required: false, description: 'Button image file.' },
    { name: 'storage', type: 'file', required: false, description: 'Scenario file to jump to on click.' },
    { name: 'target', type: 'string', required: false, description: 'Label to jump to on click.' },
    { name: 'name', type: 'string', required: false, description: 'Element name.' },
    { name: 'text', type: 'string', required: false, description: 'Button text (instead of graphic).' },
    { name: 'x', type: 'number', required: false, description: 'X position.' },
    { name: 'y', type: 'number', required: false, description: 'Y position.' },
    { name: 'width', type: 'number', required: false, description: 'Width.' },
    { name: 'height', type: 'number', required: false, description: 'Height.' },
    { name: 'exp', type: 'expression', required: false, description: 'JS expression to evaluate on click.' },
    { name: 'cond', type: 'expression', required: false, description: 'Condition for button visibility.' },
    { name: 'clickse', type: 'file', required: false, description: 'Sound effect on click.' },
    { name: 'enterse', type: 'file', required: false, description: 'Sound effect on hover.' },
    { name: 'enterimg', type: 'file', required: false, description: 'Image displayed on hover.', descriptionJa: 'マウスオーバー時に表示される画像' },
    { name: 'folder', type: 'string', required: false, description: 'Resource folder for button images.', descriptionJa: 'ボタン画像のリソースフォルダ' },
    { name: 'fix', type: 'boolean', required: false, description: 'Fix button position (not affected by scrolling).', descriptionJa: 'ボタンを固定表示にする（スクロールの影響を受けない）' },
    { name: 'role', type: 'string', required: false, description: 'Built-in system action (e.g., "save", "load", "sleepgame", "close").', descriptionJa: 'システム組み込みアクション' },
    { name: 'keyfocus', type: 'string', required: false, description: 'Keyboard focus order number.', descriptionJa: 'キーボードフォーカス順序' },
    { name: 'clickimg', type: 'file', required: false, description: 'Image displayed on click.', descriptionJa: 'クリック時に表示される画像' },
    { name: 'leavese', type: 'file', required: false, description: 'Sound effect on mouse leave.', descriptionJa: 'マウスリーブ時のSE' },
    { name: 'hint', type: 'string', required: false, description: 'Tooltip text on hover.', descriptionJa: 'ホバー時のツールチップ' },
    { name: 'preexp', type: 'expression', required: false, description: 'Pre-evaluated expression available as "preexp" in exp.', descriptionJa: 'exp内でpreexpとして参照可能な事前評価式' },
  ],
});

def({
  name: 'glink',
  category: 'ui',
  description: 'Create a styled text link (graphical link).',
  descriptionJa: 'スタイル付きテキストリンクを作成します。',
  params: [
    { name: 'color', type: 'color', required: false, description: 'Background color.' },
    { name: 'storage', type: 'file', required: false, description: 'Jump target file.' },
    { name: 'target', type: 'string', required: false, description: 'Jump target label.' },
    { name: 'text', type: 'string', required: true, description: 'Display text.' },
    { name: 'size', type: 'number', required: false, description: 'Font size.' },
    { name: 'x', type: 'number', required: false, description: 'X position.' },
    { name: 'y', type: 'number', required: false, description: 'Y position.' },
    { name: 'width', type: 'number', required: false, description: 'Width.' },
    { name: 'height', type: 'number', required: false, description: 'Height.' },
    { name: 'exp', type: 'expression', required: false, description: 'JS expression on click.' },
    { name: 'cond', type: 'expression', required: false, description: 'Condition expression.' },
    { name: 'clickse', type: 'file', required: false, description: 'Click SE.' },
    { name: 'enterse', type: 'file', required: false, description: 'Hover SE.' },
    { name: 'face', type: 'string', required: false, description: 'Font family name.' },
    { name: 'graphic', type: 'string', required: false, description: 'Background graphic image.' },
    { name: 'enterimg', type: 'string', required: false, description: 'Image displayed on hover.' },
    { name: 'autopos', type: 'boolean', required: false, description: 'Enable automatic positioning.' },
    { name: 'keyfocus', type: 'string', required: false, description: 'Keyboard focus order number.' },
    { name: 'hint', type: 'string', required: false, description: 'Tooltip text on hover.' },
    { name: 'font_color', type: 'color', required: false, description: 'Font color.' },
    { name: 'border_color', type: 'color', required: false, description: 'Border color.' },
  ],
});

def({
  name: 'link',
  category: 'ui',
  description: 'Begin an inline text link. End with [endlink].',
  descriptionJa: 'インラインテキストリンクを開始。[endlink]で終了。',
  closingTag: 'endlink',
  params: [
    { name: 'storage', type: 'file', required: false, description: 'Jump target file.' },
    { name: 'target', type: 'string', required: false, description: 'Jump target label.' },
    { name: 'exp', type: 'expression', required: false, description: 'JS expression on click.' },
    { name: 'keyfocus', type: 'string', required: false, description: 'Keyboard focus order number.' },
  ],
});

def({
  name: 'endlink',
  category: 'ui',
  description: 'End of inline text link.',
  isClosing: true,
  params: [],
});

// ────────────────────────── Save / Load ──────────────────────────

def({
  name: 'save',
  category: 'save',
  description: 'Save the game state to a slot.',
  descriptionJa: 'ゲーム状態をスロットにセーブします。',
  params: [
    { name: 'num', type: 'number', required: true, description: 'Save slot number.' },
  ],
});

def({
  name: 'load',
  category: 'save',
  description: 'Load a game state from a slot.',
  descriptionJa: 'スロットからゲーム状態をロードします。',
  params: [
    { name: 'num', type: 'number', required: true, description: 'Save slot number.' },
  ],
});

def({
  name: 'autosave',
  category: 'save',
  description: 'Perform an autosave.',
  descriptionJa: 'オートセーブを実行します。',
  params: [
    { name: 'title', type: 'string', required: false, description: 'Title for the save data.' },
  ],
});

// ────────────────────────── Camera ──────────────────────────

def({
  name: 'camera',
  category: 'camera',
  description: 'Move/zoom the camera.',
  descriptionJa: 'カメラを移動/ズームします。',
  params: [
    { name: 'x', type: 'number', required: false, description: 'Camera X position.' },
    { name: 'y', type: 'number', required: false, description: 'Camera Y position.' },
    { name: 'zoom', type: 'number', required: false, description: 'Zoom level (1.0 = normal).' },
    { name: 'rotate', type: 'number', required: false, description: 'Rotation angle (degrees).' },
    { name: 'time', type: 'number', required: false, default: '1000', description: 'Animation time (ms).' },
    { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait for animation.' },
    { name: 'from_x', type: 'number', required: false, description: 'Starting X position.' },
    { name: 'from_y', type: 'number', required: false, description: 'Starting Y position.' },
    { name: 'from_zoom', type: 'number', required: false, description: 'Starting zoom level.' },
    { name: 'from_rotate', type: 'number', required: false, description: 'Starting rotation angle.' },
    { name: 'layer', type: 'string', required: false, description: 'Target layer for camera effect.' },
    { name: 'ease_type', type: 'string', required: false, description: 'Easing function type.' },
  ],
});

def({
  name: 'reset_camera',
  category: 'camera',
  description: 'Reset camera to default position.',
  descriptionJa: 'カメラをデフォルト位置にリセットします。',
  params: [
    { name: 'time', type: 'number', required: false, default: '1000', description: 'Animation time (ms).' },
    { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait for animation.' },
    { name: 'layer', type: 'string', required: false, description: 'Target layer for camera reset.' },
    { name: 'ease_type', type: 'string', required: false, description: 'Easing function type.' },
  ],
});

// ────────────────────────── HTML ──────────────────────────

def({
  name: 'html',
  category: 'html',
  description: 'Insert raw HTML. End with [endhtml].',
  descriptionJa: '生のHTMLを挿入します。[endhtml]で終了。',
  closingTag: 'endhtml',
  params: [
    { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
    { name: 'page', type: 'enum', required: false, enumValues: ['fore', 'back'], description: 'Page (fore or back).' },
    { name: 'name', type: 'string', required: false, description: 'Element name.' },
    { name: 'top', type: 'number', required: false, description: 'Top position.' },
    { name: 'left', type: 'number', required: false, description: 'Left position.' },
    { name: 'width', type: 'number', required: false, description: 'Width.' },
    { name: 'height', type: 'number', required: false, description: 'Height.' },
  ],
});

def({
  name: 'endhtml',
  category: 'html',
  description: 'End of HTML block.',
  isClosing: true,
  params: [],
});

// ────────────────────────── Video ──────────────────────────

def({
  name: 'movie',
  category: 'video',
  description: 'Play a video file.',
  descriptionJa: '動画ファイルを再生します。',
  params: [
    { name: 'storage', type: 'file', required: true, description: 'Video file.' },
    { name: 'skip', type: 'boolean', required: false, default: 'true', description: 'Allow skipping.' },
    { name: 'volume', type: 'number', required: false, description: 'Volume.' },
    { name: 'mute', type: 'boolean', required: false, description: 'Mute audio playback.' },
    { name: 'time', type: 'number', required: false, description: 'Playback duration limit (ms).' },
    { name: 'loop', type: 'boolean', required: false, description: 'Loop video playback.' },
    { name: 'left', type: 'number', required: false, description: 'Left position.' },
    { name: 'top', type: 'number', required: false, description: 'Top position.' },
    { name: 'width', type: 'number', required: false, description: 'Video width.' },
    { name: 'height', type: 'number', required: false, description: 'Video height.' },
  ],
});

// ────────────────────────── System Config ──────────────────────────

def({
  name: 'title',
  category: 'system',
  description: 'Set the window title.',
  descriptionJa: 'ウィンドウタイトルを設定します。',
  params: [
    { name: 'name', type: 'string', required: true, description: 'Window title text.' },
  ],
});

def({
  name: 'screen_full',
  category: 'system',
  description: 'Switch to fullscreen mode.',
  descriptionJa: 'フルスクリーンモードに切り替えます。',
  params: [],
});

def({
  name: 'sleepgame',
  category: 'system',
  description: 'Pause the game and push state to stack.',
  descriptionJa: 'ゲームを一時停止し、状態をスタックに積みます。',
  params: [
    { name: 'storage', type: 'file', required: false, description: 'Scenario to run while game is paused.' },
    { name: 'name', type: 'string', required: false, description: 'Name identifier for the sleep state.' },
    { name: 'target', type: 'string', required: false, description: 'Label to jump to in the paused scenario.' },
  ],
});

def({
  name: 'awakegame',
  category: 'system',
  description: 'Resume the paused game.',
  descriptionJa: '一時停止したゲームを再開します。',
  params: [
    { name: 'name', type: 'string', required: false, description: 'Name identifier of the sleep state to resume.' },
  ],
});

// ────────────────────────── Name (speaker) ──────────────────────────

def({
  name: 'ptext',
  category: 'text',
  description: 'Display text directly on a layer.',
  descriptionJa: 'レイヤー上にテキストを直接表示します。',
  params: [
    { name: 'name', type: 'string', required: false, description: 'Element name.' },
    { name: 'text', type: 'string', required: true, description: 'Text to display.' },
    { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
    { name: 'page', type: 'enum', required: false, default: 'fore', enumValues: ['fore', 'back'], description: 'Page.' },
    { name: 'face', type: 'string', required: false, description: 'Font family.' },
    { name: 'x', type: 'number', required: false, description: 'X position.' },
    { name: 'y', type: 'number', required: false, description: 'Y position.' },
    { name: 'size', type: 'number', required: false, description: 'Font size (px).' },
    { name: 'color', type: 'color', required: false, description: 'Text color.' },
    { name: 'bold', type: 'boolean', required: false, description: 'Bold text.' },
    { name: 'italic', type: 'boolean', required: false, description: 'Italic text.' },
    { name: 'edge', type: 'color', required: false, description: 'Text edge color.' },
    { name: 'shadow', type: 'color', required: false, description: 'Text shadow color.' },
    { name: 'width', type: 'number', required: false, description: 'Text area width.' },
    { name: 'overwrite', type: 'boolean', required: false, description: 'Overwrite existing text element with same name.' },
    { name: 'vertical', type: 'boolean', required: false, description: 'Vertical text mode.' },
    { name: 'zindex', type: 'number', required: false, description: 'Z-index.' },
  ],
});

/**
 * Get all tag names grouped by category
 */
export function getTagsByCategory(): Map<string, TagDef[]> {
  const categories = new Map<string, TagDef[]>();
  for (const tag of TAG_DATABASE.values()) {
    const list = categories.get(tag.category) ?? [];
    list.push(tag);
    categories.set(tag.category, list);
  }
  return categories;
}

/**
 * Check if a tag name is a known built-in tag
 */
export function isBuiltinTag(name: string): boolean {
  return TAG_DATABASE.has(name.toLowerCase());
}
