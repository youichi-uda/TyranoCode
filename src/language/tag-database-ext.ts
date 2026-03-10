/**
 * Extended tag definitions — covers all remaining TyranoScript built-in tags
 * not already defined in tag-database.ts.
 *
 * Categories: message settings, system, effects, animation (extras),
 * audio (extras), character (extras), layer (extras), Live2D, 3D, AR, VChat,
 * input forms, design, menu, variables (extras).
 */

import { TAG_DATABASE, TagDef, TagParamDef } from './tag-database';

function def(tag: TagDef): void {
  TAG_DATABASE.set(tag.name, tag);
}
function simple(name: string, category: string, desc: string, descJa?: string): void {
  def({ name, category, description: desc, descriptionJa: descJa, params: [] });
}

export function registerExtendedTags(): void {

// ══════════════════════════ Message Settings ══════════════════════════

def({ name: 'deffont', category: 'text', description: 'Set default font attributes.', descriptionJa: 'デフォルトフォント属性を設定します。', params: [
  { name: 'size', type: 'number', required: false, description: 'Default font size.' },
  { name: 'color', type: 'color', required: false, description: 'Default color.' },
  { name: 'bold', type: 'boolean', required: false, description: 'Bold.' },
  { name: 'italic', type: 'boolean', required: false, description: 'Italic.' },
  { name: 'face', type: 'string', required: false, description: 'Font family.' },
  { name: 'edge', type: 'color', required: false, description: 'Edge color or "none".' },
  { name: 'shadow', type: 'color', required: false, description: 'Shadow color or "none".' },
  { name: 'effect', type: 'string', required: false, description: 'Text effect.' },
  { name: 'effect_speed', type: 'string', required: false, description: 'Effect speed.' },
]});

simple('resetstyle', 'text', 'Reset text style and position.', 'テキストスタイルと位置をリセットします。');
simple('resetdelay', 'text', 'Reset text display speed to default.', 'テキスト表示速度をデフォルトにリセットします。');

def({ name: 'configdelay', category: 'text', description: 'Set default text display speed globally.', descriptionJa: 'テキスト表示速度をグローバルに設定します。', params: [
  { name: 'speed', type: 'number', required: true, description: 'Delay per character (ms).' },
]});

def({ name: 'current', category: 'text', description: 'Set active message layer.', descriptionJa: 'アクティブなメッセージレイヤーを設定します。', params: [
  { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
  { name: 'page', type: 'enum', required: false, enumValues: ['fore', 'back'], description: 'Page.' },
]});

simple('hidemessage', 'text', 'Temporarily hide message layer.', 'メッセージレイヤーを一時的に非表示にします。');
simple('skipstart', 'text', 'Start skip mode.', 'スキップモードを開始します。');
simple('skipstop', 'text', 'Stop skip mode.', 'スキップモードを停止します。');
simple('cancelskip', 'text', 'Cancel skip mode.', 'スキップモードをキャンセルします。');
simple('autostart', 'text', 'Start auto mode.', 'オートモードを開始します。');

def({ name: 'autostop', category: 'text', description: 'Stop auto mode.', descriptionJa: 'オートモードを停止します。', params: [
  { name: 'next', type: 'boolean', required: false, default: 'true', description: 'Proceed to next tag.' },
]});

def({ name: 'autoconfig', category: 'text', description: 'Configure auto mode.', descriptionJa: 'オートモードを設定します。', params: [
  { name: 'speed', type: 'number', required: false, description: 'Auto speed (ms).' },
  { name: 'clickstop', type: 'boolean', required: false, description: 'Stop on click.' },
]});

def({ name: 'config_record_label', category: 'text', description: 'Configure read-text tracking.', descriptionJa: '既読テキスト追跡を設定します。', params: [
  { name: 'color', type: 'color', required: false, description: 'Already-read text color.' },
  { name: 'skip', type: 'boolean', required: false, description: 'Allow skipping unread text.' },
]});

def({ name: 'message_config', category: 'text', description: 'Detailed message configuration.', descriptionJa: 'メッセージの詳細設定。', params: [
  { name: 'ch_speed_in_click', type: 'number', required: false, description: 'Speed when clicking.' },
  { name: 'line_spacing', type: 'number', required: false, description: 'Line spacing (px).' },
  { name: 'kerning', type: 'number', required: false, description: 'Character spacing (px).' },
]});

def({ name: 'position_filter', category: 'text', description: 'Apply filter behind message window.', descriptionJa: 'メッセージウィンドウ背後にフィルターを適用します。', params: [
  { name: 'grayscale', type: 'number', required: false, description: 'Grayscale (0-100).' },
  { name: 'blur', type: 'number', required: false, description: 'Blur radius.' },
  { name: 'sepia', type: 'number', required: false, description: 'Sepia (0-100).' },
]});

simple('nolog', 'text', 'Pause backlog recording.', 'バックログの記録を一時停止します。');
simple('endnolog', 'text', 'Resume backlog recording.', 'バックログの記録を再開します。');

def({ name: 'pushlog', category: 'text', description: 'Add text to backlog manually.', descriptionJa: 'バックログにテキストを手動追加します。', params: [
  { name: 'text', type: 'string', required: true, description: 'Text to add.' },
  { name: 'join', type: 'boolean', required: false, description: 'Join with previous entry.' },
]});

def({ name: 'mark', category: 'text', description: 'Apply marker effect to text.', descriptionJa: 'テキストにマーカー効果を適用します。', params: [
  { name: 'color', type: 'color', required: false, description: 'Marker color.' },
  { name: 'font_color', type: 'color', required: false, description: 'Text color.' },
  { name: 'size', type: 'number', required: false, description: 'Marker size.' },
]});

simple('endmark', 'text', 'End marker effect.', 'マーカー効果を終了します。');

def({ name: 'graph', category: 'text', description: 'Display inline image in message text.', descriptionJa: 'メッセージテキスト内にインライン画像を表示します。', params: [
  { name: 'storage', type: 'file', required: true, description: 'Image filename.' },
]});

def({ name: 'mtext', category: 'text', description: 'Display text with animation effects.', descriptionJa: 'アニメーション付きテキストを表示します。', params: [
  { name: 'text', type: 'string', required: true, description: 'Text to display.' },
  { name: 'x', type: 'number', required: false, description: 'X position.' },
  { name: 'y', type: 'number', required: false, description: 'Y position.' },
  { name: 'in_effect', type: 'string', required: false, description: 'Entrance animation.' },
  { name: 'out_effect', type: 'string', required: false, description: 'Exit animation.' },
  { name: 'time', type: 'number', required: false, description: 'Animation duration (ms).' },
  { name: 'name', type: 'string', required: false, description: 'Element name.' },
  { name: 'size', type: 'number', required: false, description: 'Font size.' },
  { name: 'color', type: 'color', required: false, description: 'Text color.' },
]});

def({ name: 'fuki_start', category: 'text', description: 'Enable speech bubble mode.', descriptionJa: '吹き出しモードを有効にします。', params: [
  { name: 'layer', type: 'string', required: false, description: 'Target message layer.' },
]});
simple('fuki_stop', 'text', 'Disable speech bubble mode.', '吹き出しモードを無効にします。');
def({ name: 'fuki_chara', category: 'text', description: 'Register speech bubble settings per character.', descriptionJa: 'キャラクターごとの吹き出し設定を登録します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Character name.' },
  { name: 'left', type: 'number', required: false, description: 'Bubble X.' },
  { name: 'top', type: 'number', required: false, description: 'Bubble Y.' },
]});

def({ name: 'emb', category: 'script', description: 'Embed expression result in text.', descriptionJa: '式の評価結果をテキストに埋め込みます。', params: [
  { name: 'exp', type: 'expression', required: true, description: 'JavaScript expression.' },
]});

// ══════════════════════════ Variables / JS extras ══════════════════════════

def({ name: 'trace', category: 'script', description: 'Output value to console.', descriptionJa: 'コンソールに値を出力します。', params: [
  { name: 'text', type: 'string', required: false, description: 'Text to output.' },
  { name: 'exp', type: 'expression', required: false, description: 'Expression to evaluate.' },
]});

def({ name: 'loadjs', category: 'script', description: 'Load external JavaScript file.', descriptionJa: '外部JavaScriptファイルを読み込みます。', params: [
  { name: 'storage', type: 'file', required: true, description: 'JS file path.' },
  { name: 'type', type: 'string', required: false, description: '"module" for ES6 modules.' },
]});

def({ name: 'preload', category: 'script', description: 'Preload asset files.', descriptionJa: 'アセットファイルをプリロードします。', params: [
  { name: 'storage', type: 'string', required: true, description: 'Files to preload (comma-separated).' },
]});
simple('wait_preload', 'script', 'Wait for preload to complete.', 'プリロード完了を待ちます。');

def({ name: 'unload', category: 'script', description: 'Discard preloaded audio data.', descriptionJa: 'プリロード済み音声データを破棄します。', params: [
  { name: 'storage', type: 'file', required: true, description: 'Audio file to unload.' },
]});

def({ name: 'plugin', category: 'script', description: 'Load a plugin.', descriptionJa: 'プラグインを読み込みます。', params: [
  { name: 'name', type: 'string', required: true, description: 'Plugin name.' },
  { name: 'storage', type: 'string', required: false, default: 'init.ks', description: 'Plugin entry file.' },
]});

// ══════════════════════════ Label / Jump extras ══════════════════════════

def({ name: 'glink_config', category: 'ui', description: 'Configure graphical link auto-placement.', descriptionJa: 'グラフィカルリンクの自動配置を設定します。', params: [
  { name: 'auto_place', type: 'boolean', required: false, description: 'Enable auto-placement.' },
  { name: 'margin_x', type: 'number', required: false, description: 'Horizontal margin.' },
  { name: 'margin_y', type: 'number', required: false, description: 'Vertical margin.' },
  { name: 'width', type: 'number', required: false, description: 'Default width.' },
  { name: 'height', type: 'number', required: false, description: 'Default height.' },
]});

def({ name: 'clickable', category: 'ui', description: 'Define transparent clickable area.', descriptionJa: '透明なクリック可能エリアを定義します。', params: [
  { name: 'width', type: 'number', required: true, description: 'Area width.' },
  { name: 'height', type: 'number', required: true, description: 'Area height.' },
  { name: 'x', type: 'number', required: true, description: 'X position.' },
  { name: 'y', type: 'number', required: true, description: 'Y position.' },
  { name: 'target', type: 'string', required: false, description: 'Jump label.' },
  { name: 'storage', type: 'file', required: false, description: 'Jump file.' },
  { name: 'exp', type: 'expression', required: false, description: 'JS on click.' },
]});

// ══════════════════════════ Character extras ══════════════════════════

def({ name: 'chara_move', category: 'character', description: 'Move/resize a character.', descriptionJa: 'キャラクターを移動/リサイズします。', params: [
  { name: 'name', type: 'string', required: true, description: 'Character ID.' },
  { name: 'left', type: 'number', required: false, description: 'X position.' },
  { name: 'top', type: 'number', required: false, description: 'Y position.' },
  { name: 'width', type: 'number', required: false, description: 'Width.' },
  { name: 'height', type: 'number', required: false, description: 'Height.' },
  { name: 'anim', type: 'boolean', required: false, description: 'Animate movement.' },
  { name: 'time', type: 'number', required: false, default: '600', description: 'Animation duration (ms).' },
  { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait for completion.' },
]});

def({ name: 'chara_delete', category: 'character', description: 'Delete character definition.', descriptionJa: 'キャラクター定義を削除します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Character ID.' },
]});

def({ name: 'chara_config', category: 'character', description: 'Configure character system behavior.', descriptionJa: 'キャラクターシステムの動作を設定します。', params: [
  { name: 'pos_mode', type: 'boolean', required: false, description: 'Auto-position characters.' },
  { name: 'ptext', type: 'string', required: false, description: 'Name display text area.' },
  { name: 'time', type: 'number', required: false, description: 'Expression change duration (ms).' },
  { name: 'memory', type: 'boolean', required: false, description: 'Remember final expression.' },
  { name: 'anim', type: 'boolean', required: false, description: 'Position change animation.' },
  { name: 'talk_focus', type: 'enum', required: false, enumValues: ['brightness', 'blur', 'none'], description: 'Non-speaker effect.' },
]});

def({ name: 'chara_ptext', category: 'character', description: 'Display character name / change expression.', descriptionJa: 'キャラクター名表示/表情変更。', params: [
  { name: 'name', type: 'string', required: false, description: 'Character name.' },
  { name: 'face', type: 'string', required: false, description: 'Expression.' },
]});

def({ name: 'chara_layer', category: 'character', description: 'Define character variation parts.', descriptionJa: 'キャラクターの差分パーツを定義します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Character name.' },
  { name: 'part', type: 'string', required: true, description: 'Part category.' },
  { name: 'id', type: 'string', required: true, description: 'Variation ID.' },
  { name: 'storage', type: 'file', required: false, description: 'Part image.' },
]});

def({ name: 'chara_layer_mod', category: 'character', description: 'Modify character variation definitions.', descriptionJa: 'キャラクター差分定義を変更します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Character name.' },
  { name: 'part', type: 'string', required: true, description: 'Part category.' },
  { name: 'zindex', type: 'string', required: false, description: 'Layering priority.' },
]});

def({ name: 'chara_part', category: 'character', description: 'Change character variation part.', descriptionJa: 'キャラクター差分パーツを変更します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Character name.' },
  { name: 'time', type: 'number', required: false, description: 'Transition time (ms).' },
]});

def({ name: 'chara_part_reset', category: 'character', description: 'Reset character parts to default.', descriptionJa: 'キャラクターパーツをデフォルトにリセットします。', params: [
  { name: 'name', type: 'string', required: true, description: 'Character name.' },
  { name: 'part', type: 'string', required: false, description: 'Specific part.' },
]});

// ══════════════════════════ Layer / Image extras ══════════════════════════

def({ name: 'bg2', category: 'background', description: 'Alternative background switching.', descriptionJa: '代替背景切替。', params: [
  { name: 'storage', type: 'file', required: true, description: 'Background image.' },
  { name: 'time', type: 'number', required: false, description: 'Transition time (ms).' },
  { name: 'method', type: 'string', required: false, description: 'Transition method.' },
  { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait.' },
]});

def({ name: 'free', category: 'layer', description: 'Release/delete a named element.', descriptionJa: '名前付き要素を解放/削除します。', params: [
  { name: 'layer', type: 'string', required: true, description: 'Target layer.' },
  { name: 'name', type: 'string', required: true, description: 'Element name.' },
  { name: 'time', type: 'number', required: false, description: 'Fade-out time (ms).' },
  { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait.' },
]});

def({ name: 'locate', category: 'layer', description: 'Set reference position for next element.', descriptionJa: '次の要素の参照位置を設定します。', params: [
  { name: 'x', type: 'number', required: false, description: 'X position.' },
  { name: 'y', type: 'number', required: false, description: 'Y position.' },
]});

def({ name: 'backlay', category: 'layer', description: 'Copy foreground to background page.', descriptionJa: '前景を背景ページにコピーします。', params: [
  { name: 'layer', type: 'string', required: false, description: 'Specific layer to copy.' },
]});

simple('wt', 'layer', 'Wait for transition to complete.', 'トランジション完了を待ちます。');

def({ name: 'clearfix', category: 'layer', description: 'Clear elements from fix layer.', descriptionJa: 'fixレイヤーの要素をクリアします。', params: [
  { name: 'name', type: 'string', required: false, description: 'Specific element name; omit to clear all.' },
]});

// ══════════════════════════ Effects / Video ══════════════════════════

def({ name: 'filter', category: 'transition', description: 'Apply visual filter effect.', descriptionJa: 'ビジュアルフィルターを適用します。', params: [
  { name: 'layer', type: 'string', required: true, description: 'Target layer.' },
  { name: 'name', type: 'string', required: false, description: 'Filter name.' },
  { name: 'grayscale', type: 'number', required: false, description: 'Grayscale (0-100).' },
  { name: 'sepia', type: 'number', required: false, description: 'Sepia (0-100).' },
  { name: 'blur', type: 'number', required: false, description: 'Blur radius.' },
  { name: 'brightness', type: 'number', required: false, description: 'Brightness.' },
  { name: 'contrast', type: 'number', required: false, description: 'Contrast.' },
]});
def({ name: 'free_filter', category: 'transition', description: 'Clear filter effect.', descriptionJa: 'フィルターを解除します。', params: [
  { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
]});

def({ name: 'mask', category: 'transition', description: 'Display screen mask overlay.', descriptionJa: 'スクリーンマスクを表示します。', params: [
  { name: 'color', type: 'color', required: false, description: 'Mask color.' },
  { name: 'opacity', type: 'number', required: false, description: 'Opacity (0-255).' },
  { name: 'storage', type: 'file', required: false, description: 'Mask image.' },
  { name: 'time', type: 'number', required: false, description: 'Fade duration (ms).' },
]});
def({ name: 'mask_off', category: 'transition', description: 'Remove screen mask.', descriptionJa: 'スクリーンマスクを解除します。', params: [
  { name: 'time', type: 'number', required: false, description: 'Fade-out time (ms).' },
]});

def({ name: 'layermode', category: 'transition', description: 'Apply composite layer blending.', descriptionJa: '合成レイヤーブレンドを適用します。', params: [
  { name: 'layer', type: 'string', required: true, description: 'Target layer.' },
  { name: 'mode', type: 'string', required: false, description: 'Blend mode.' },
  { name: 'storage', type: 'file', required: false, description: 'Image file.' },
  { name: 'time', type: 'number', required: false, description: 'Transition time (ms).' },
  { name: 'name', type: 'string', required: false, description: 'Element name.' },
  { name: 'opacity', type: 'number', required: false, description: 'Opacity (0-255).' },
]});
def({ name: 'free_layermode', category: 'transition', description: 'Clear composite layer effect.', descriptionJa: '合成レイヤー効果を解除します。', params: [
  { name: 'time', type: 'number', required: false, description: 'Fade-out time (ms).' },
  { name: 'wait', type: 'boolean', required: false, description: 'Wait for fade to complete.' },
]});

def({ name: 'layermode_movie', category: 'transition', description: 'Apply video as composite layer.', descriptionJa: '動画を合成レイヤーとして適用します。', params: [
  { name: 'storage', type: 'file', required: true, description: 'Video file.' },
  { name: 'mode', type: 'string', required: false, description: 'Blend mode.' },
  { name: 'loop', type: 'boolean', required: false, default: 'true', description: 'Loop.' },
  { name: 'volume', type: 'number', required: false, description: 'Volume (0-100).' },
]});

def({ name: 'bgmovie', category: 'video', description: 'Play video as background.', descriptionJa: '動画を背景として再生します。', params: [
  { name: 'storage', type: 'file', required: true, description: 'Video file.' },
  { name: 'time', type: 'number', required: false, default: '300', description: 'Fade-in time (ms).' },
  { name: 'loop', type: 'boolean', required: false, default: 'true', description: 'Loop.' },
  { name: 'volume', type: 'number', required: false, description: 'Volume (0-100).' },
  { name: 'mute', type: 'boolean', required: false, default: 'false', description: 'Mute.' },
]});
simple('wait_bgmovie', 'video', 'Wait for background movie completion.', '背景動画の完了を待ちます。');
def({ name: 'stop_bgmovie', category: 'video', description: 'Stop background movie.', descriptionJa: '背景動画を停止します。', params: [
  { name: 'time', type: 'number', required: false, default: '300', description: 'Fade-out time (ms).' },
  { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait.' },
]});

def({ name: 'quake2', category: 'transition', description: 'Alternative shake effect.', descriptionJa: '代替画面揺れ効果。', params: [
  { name: 'x', type: 'number', required: false, description: 'Horizontal range.' },
  { name: 'y', type: 'number', required: false, description: 'Vertical range.' },
  { name: 'time', type: 'number', required: true, description: 'Duration (ms).' },
]});

def({ name: 'vibrate', category: 'transition', description: 'Vibrate device.', descriptionJa: 'デバイスを振動させます。', params: [
  { name: 'pattern', type: 'string', required: false, description: 'Vibration pattern.' },
]});
simple('vibrate_stop', 'transition', 'Stop device vibration.', 'デバイス振動を停止します。');

// ══════════════════════════ Animation extras ══════════════════════════

simple('wa', 'animation', 'Wait for all animations to complete.', '全アニメーション完了を待ちます。');

def({ name: 'stopanim', category: 'animation', description: 'Stop active animation.', descriptionJa: 'アクティブなアニメーションを停止します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Element name.' },
]});

def({ name: 'frame', category: 'animation', description: 'Define keyframe within animation block.', descriptionJa: 'アニメーションブロック内のキーフレームを定義します。', params: [
  { name: 'p', type: 'string', required: true, description: 'Keyframe position (0%-100%).' },
  { name: 'x', type: 'string', required: false, description: 'X displacement.' },
  { name: 'y', type: 'string', required: false, description: 'Y displacement.' },
  { name: 'rotate', type: 'string', required: false, description: 'Rotation.' },
  { name: 'scale', type: 'number', required: false, description: 'Scale.' },
  { name: 'opacity', type: 'number', required: false, description: 'Opacity (0-255).' },
]});

def({ name: 'stop_kanim', category: 'animation', description: 'Stop keyframe animation.', descriptionJa: 'キーフレームアニメーションを停止します。', params: [
  { name: 'name', type: 'string', required: false, description: 'Element name.' },
  { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
]});

def({ name: 'xanim', category: 'animation', description: 'Universal animation (anim + kanim + SVG).', descriptionJa: '汎用アニメーション。', params: [
  { name: 'name', type: 'string', required: false, description: 'Target element.' },
  { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
  { name: 'keyframe', type: 'string', required: false, description: 'Keyframe name.' },
  { name: 'time', type: 'number', required: false, description: 'Duration (ms).' },
  { name: 'easing', type: 'string', required: false, description: 'Timing function.' },
  { name: 'count', type: 'string', required: false, description: 'Loop count or "infinite".' },
  { name: 'wait', type: 'boolean', required: false, default: 'false', description: 'Wait.' },
  { name: 'left', type: 'string', required: false, description: 'X position.' },
  { name: 'top', type: 'string', required: false, description: 'Y position.' },
  { name: 'opacity', type: 'number', required: false, description: 'Opacity (0-255).' },
  { name: 'svg', type: 'string', required: false, description: 'SVG path file.' },
]});

def({ name: 'stop_xanim', category: 'animation', description: 'Stop xanim.', descriptionJa: 'xanimを停止します。', params: [
  { name: 'name', type: 'string', required: false, description: 'Element name.' },
  { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
  { name: 'complete', type: 'boolean', required: false, default: 'false', description: 'Jump to end state.' },
]});

// ══════════════════════════ Camera extras ══════════════════════════

simple('wait_camera', 'camera', 'Wait for camera animation to finish.', 'カメラアニメーション完了を待ちます。');

// ══════════════════════════ System ══════════════════════════

simple('start_keyconfig', 'system', 'Enable keyboard configuration.', 'キーボード設定を有効にします。');
simple('stop_keyconfig', 'system', 'Disable keyboard configuration.', 'キーボード設定を無効にします。');
simple('clearstack', 'system', 'Clear call stack.', 'コールスタックをクリアします。');
simple('wait_cancel', 'system', 'Cancel active wait.', 'アクティブなwaitをキャンセルします。');
simple('closeconfirm_on', 'system', 'Enable exit confirmation.', '終了確認を有効にします。');
simple('closeconfirm_off', 'system', 'Disable exit confirmation.', '終了確認を無効にします。');

def({ name: 'close', category: 'system', description: 'Close game window.', descriptionJa: 'ゲームウィンドウを閉じます。', params: [
  { name: 'ask', type: 'boolean', required: false, default: 'true', description: 'Show exit confirmation.' },
]});

def({ name: 'dialog', category: 'system', description: 'Display a dialog box.', descriptionJa: 'ダイアログボックスを表示します。', params: [
  { name: 'type', type: 'enum', required: false, default: 'alert', enumValues: ['alert', 'confirm', 'input'], description: 'Dialog type.' },
  { name: 'title', type: 'string', required: false, description: 'Dialog title.' },
  { name: 'text', type: 'string', required: false, description: 'Dialog message.' },
  { name: 'storage', type: 'file', required: false, description: 'Jump file (confirm).' },
  { name: 'target', type: 'string', required: false, description: 'Jump label (confirm).' },
  { name: 'name', type: 'string', required: false, description: 'Variable name (input).' },
]});

def({ name: 'savesnap', category: 'save', description: 'Create save data snapshot.', descriptionJa: 'セーブデータのスナップショットを作成します。', params: [
  { name: 'title', type: 'string', required: false, description: 'Save data title.' },
]});

simple('autoload', 'save', 'Load auto-saved data.', 'オートセーブデータをロードします。');

def({ name: 'checkpoint', category: 'save', description: 'Register checkpoint for rollback.', descriptionJa: 'ロールバック用チェックポイントを登録します。', params: [
  { name: 'name', type: 'string', required: false, description: 'Checkpoint name.' },
]});
simple('rollback', 'save', 'Rollback to last checkpoint.', '最後のチェックポイントにロールバックします。');
simple('clear_checkpoint', 'save', 'Delete checkpoint data.', 'チェックポイントデータを削除します。');

def({ name: 'breakgame', category: 'system', description: 'Delete sleep state data.', descriptionJa: 'スリープ状態データを削除します。', params: [
  { name: 'name', type: 'string', required: false, description: 'Sleep state ID.' },
]});

def({ name: 'erasemacro', category: 'macro', description: 'Delete a registered macro.', descriptionJa: '登録済みマクロを削除します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Macro name.' },
]});

// ══════════════════════════ System Design ══════════════════════════

def({ name: 'showmenubutton', category: 'system', description: 'Display menu button.', descriptionJa: 'メニューボタンを表示します。', params: [
  { name: 'keyfocus', type: 'boolean', required: false, description: 'Keyboard focus.' },
]});
simple('hidemenubutton', 'system', 'Hide menu button.', 'メニューボタンを非表示にします。');

def({ name: 'glyph', category: 'system', description: 'Set click-wait indicator image.', descriptionJa: 'クリック待ちインジケータ画像を設定します。', params: [
  { name: 'storage', type: 'file', required: false, description: 'Glyph image file.' },
  { name: 'x', type: 'number', required: false, description: 'X position.' },
  { name: 'y', type: 'number', required: false, description: 'Y position.' },
  { name: 'width', type: 'number', required: false, description: 'Width.' },
  { name: 'height', type: 'number', required: false, description: 'Height.' },
]});

def({ name: 'body', category: 'system', description: 'Configure game screen exterior.', descriptionJa: 'ゲーム画面外の設定を行います。', params: [
  { name: 'bgimage', type: 'file', required: false, description: 'Background image.' },
  { name: 'bgcolor', type: 'color', required: false, description: 'Background color.' },
  { name: 'bgcover', type: 'boolean', required: false, description: 'Stretch to cover.' },
]});

def({ name: 'cursor', category: 'system', description: 'Configure mouse cursor.', descriptionJa: 'マウスカーソルを設定します。', params: [
  { name: 'storage', type: 'string', required: false, description: 'Cursor image or "default".' },
  { name: 'auto_hide', type: 'string', required: false, description: 'Auto-hide timeout.' },
]});

def({ name: 'sysview', category: 'system', description: 'Change system screen HTML.', descriptionJa: 'システム画面のHTMLを変更します。', params: [
  { name: 'type', type: 'enum', required: true, enumValues: ['save', 'load', 'backlog', 'menu'], description: 'Screen type.' },
  { name: 'storage', type: 'file', required: true, description: 'HTML file path.' },
]});

def({ name: 'save_img', category: 'system', description: 'Set custom save thumbnail.', descriptionJa: 'カスタムセーブサムネイルを設定します。', params: [
  { name: 'storage', type: 'file', required: false, description: 'Image file or "default".' },
  { name: 'folder', type: 'string', required: false, default: 'bgimage', description: 'Image folder.' },
]});

def({ name: 'loadcss', category: 'system', description: 'Load CSS file.', descriptionJa: 'CSSファイルを読み込みます。', params: [
  { name: 'file', type: 'string', required: true, description: 'CSS file path from data/.' },
]});

def({ name: 'lang_set', category: 'system', description: 'Switch language.', descriptionJa: '言語を切り替えます。', params: [
  { name: 'lang', type: 'string', required: true, description: 'Language code.' },
]});

// ══════════════════════════ Menu / HTML ══════════════════════════

simple('showsave', 'system', 'Display save screen.', 'セーブ画面を表示します。');
simple('showload', 'system', 'Display load screen.', 'ロード画面を表示します。');
simple('showmenu', 'system', 'Display menu screen.', 'メニュー画面を表示します。');
simple('showlog', 'system', 'Display backlog.', 'バックログを表示します。');
simple('showconfig', 'system', 'Display config screen.', '設定画面を表示します。');

def({ name: 'web', category: 'system', description: 'Open website in browser.', descriptionJa: 'ブラウザでウェブサイトを開きます。', params: [
  { name: 'url', type: 'string', required: true, description: 'URL to open.' },
  { name: 'target', type: 'string', required: false, default: '_blank', description: 'Browser target.' },
]});

// ══════════════════════════ Audio extras ══════════════════════════

def({ name: 'xchgbgm', category: 'audio', description: 'Cross-fade between BGM tracks.', descriptionJa: 'BGMトラック間でクロスフェードします。', params: [
  { name: 'storage', type: 'file', required: true, description: 'Next BGM file.' },
  { name: 'loop', type: 'boolean', required: false, default: 'true', description: 'Loop.' },
  { name: 'time', type: 'number', required: false, default: '2000', description: 'Cross-fade time (ms).' },
  { name: 'buf', type: 'string', required: false, default: '0', description: 'Slot.' },
]});

def({ name: 'fadeinse', category: 'audio', description: 'Play SE with fade-in.', descriptionJa: 'フェードインでSEを再生します。', params: [
  { name: 'storage', type: 'file', required: true, description: 'Audio file.' },
  { name: 'time', type: 'number', required: false, default: '2000', description: 'Fade-in time (ms).' },
  { name: 'loop', type: 'boolean', required: false, default: 'false', description: 'Loop.' },
  { name: 'volume', type: 'number', required: false, description: 'Volume (0-100).' },
  { name: 'buf', type: 'string', required: false, default: '0', description: 'Slot.' },
]});

def({ name: 'fadeoutse', category: 'audio', description: 'Fade out and stop SE.', descriptionJa: 'SEをフェードアウトして停止します。', params: [
  { name: 'time', type: 'number', required: false, default: '2000', description: 'Fade-out time (ms).' },
  { name: 'buf', type: 'string', required: false, default: '0', description: 'Slot.' },
]});

def({ name: 'bgmopt', category: 'audio', description: 'Modify BGM configuration.', descriptionJa: 'BGM設定を変更します。', params: [
  { name: 'volume', type: 'number', required: false, description: 'Volume (0-100).' },
  { name: 'buf', type: 'string', required: false, description: 'Slot.' },
  { name: 'effect', type: 'boolean', required: false, default: 'true', description: 'Apply to current BGM.' },
  { name: 'time', type: 'number', required: false, description: 'Fade time (ms).' },
]});

def({ name: 'seopt', category: 'audio', description: 'Modify SE configuration.', descriptionJa: 'SE設定を変更します。', params: [
  { name: 'volume', type: 'number', required: false, description: 'Volume (0-100).' },
  { name: 'buf', type: 'string', required: false, description: 'Slot.' },
  { name: 'effect', type: 'boolean', required: false, default: 'true', description: 'Apply to current SE.' },
  { name: 'time', type: 'number', required: false, description: 'Fade time (ms).' },
]});

def({ name: 'changevol', category: 'audio', description: 'Change volume of playing audio.', descriptionJa: '再生中オーディオの音量を変更します。', params: [
  { name: 'target', type: 'enum', required: false, default: 'bgm', enumValues: ['bgm', 'se'], description: 'Target type.' },
  { name: 'volume', type: 'number', required: false, description: 'Volume (0-100).' },
  { name: 'buf', type: 'string', required: false, description: 'Slot.' },
  { name: 'time', type: 'number', required: false, description: 'Fade time (ms).' },
]});

def({ name: 'pausebgm', category: 'audio', description: 'Pause BGM.', descriptionJa: 'BGMを一時停止します。', params: [
  { name: 'buf', type: 'string', required: false, description: 'Slot.' },
]});
def({ name: 'resumebgm', category: 'audio', description: 'Resume BGM.', descriptionJa: 'BGMを再開します。', params: [
  { name: 'buf', type: 'string', required: false, description: 'Slot.' },
]});
def({ name: 'pausese', category: 'audio', description: 'Pause SE.', descriptionJa: 'SEを一時停止します。', params: [
  { name: 'buf', type: 'string', required: false, description: 'Slot.' },
]});
def({ name: 'resumese', category: 'audio', description: 'Resume SE.', descriptionJa: 'SEを再開します。', params: [
  { name: 'buf', type: 'string', required: false, description: 'Slot.' },
]});
simple('wbgm', 'audio', 'Wait for BGM completion.', 'BGM再生完了を待ちます。');
simple('wse', 'audio', 'Wait for SE completion.', 'SE再生完了を待ちます。');

// ══════════════════════════ Voice ══════════════════════════

def({ name: 'voconfig', category: 'audio', description: 'Configure voice playback.', descriptionJa: 'ボイス再生を設定します。', params: [
  { name: 'sebuf', type: 'string', required: true, description: 'Playback slot.' },
  { name: 'name', type: 'string', required: true, description: 'Character name.' },
  { name: 'vostorage', type: 'string', required: true, description: 'File template with {number}.' },
  { name: 'number', type: 'string', required: true, description: 'Initial number.' },
]});
simple('vostart', 'audio', 'Enable auto voice playback.', '自動ボイス再生を有効にします。');
simple('vostop', 'audio', 'Disable auto voice playback.', '自動ボイス再生を無効にします。');
simple('speak_on', 'audio', 'Enable text-to-speech.', 'テキスト読み上げを有効にします。');
simple('speak_off', 'audio', 'Disable text-to-speech.', 'テキスト読み上げを無効にします。');

// ══════════════════════════ Input Form ══════════════════════════

def({ name: 'edit', category: 'ui', description: 'Display text input field.', descriptionJa: 'テキスト入力フィールドを表示します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Input field ID.' },
  { name: 'text', type: 'string', required: false, description: 'Default text.' },
  { name: 'width', type: 'number', required: false, description: 'Width.' },
  { name: 'height', type: 'number', required: false, description: 'Height.' },
  { name: 'x', type: 'number', required: false, description: 'X position.' },
  { name: 'y', type: 'number', required: false, description: 'Y position.' },
  { name: 'size', type: 'number', required: false, description: 'Font size.' },
  { name: 'maxchars', type: 'number', required: false, description: 'Max characters.' },
]});

def({ name: 'commit', category: 'ui', description: 'Submit form input as variable.', descriptionJa: 'フォーム入力を変数として確定します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Form field to confirm.' },
]});

// ══════════════════════════ Live2D ══════════════════════════

def({ name: 'live2d_new', category: 'live2d', description: 'Load a Live2D model.', descriptionJa: 'Live2Dモデルを読み込みます。', params: [
  { name: 'name', type: 'string', required: false, description: 'Model ID.' },
  { name: 'model_id', type: 'string', required: false, description: 'Folder name under model/.' },
  { name: 'idle', type: 'string', required: false, default: 'Idle', description: 'Default idle motion.' },
  { name: 'scale', type: 'number', required: false, default: '1', description: 'Scale factor.' },
  { name: 'x', type: 'number', required: false, description: 'X position.' },
  { name: 'y', type: 'number', required: false, description: 'Y position.' },
  { name: 'jname', type: 'string', required: false, description: 'Display name.' },
]});
def({ name: 'live2d_show', category: 'live2d', description: 'Display Live2D model.', descriptionJa: 'Live2Dモデルを表示します。', params: [
  { name: 'name', type: 'string', required: false, description: 'Model ID.' },
  { name: 'time', type: 'number', required: false, description: 'Transition time (ms).' },
]});
def({ name: 'live2d_hide', category: 'live2d', description: 'Hide Live2D model.', descriptionJa: 'Live2Dモデルを非表示にします。', params: [
  { name: 'name', type: 'string', required: false, description: 'Model ID.' },
  { name: 'time', type: 'number', required: false, description: 'Fade-out time (ms).' },
]});
def({ name: 'live2d_mod', category: 'live2d', description: 'Modify Live2D model parameters.', descriptionJa: 'Live2Dモデルのパラメータを変更します。', params: [
  { name: 'name', type: 'string', required: false, description: 'Model ID.' },
  { name: 'idle', type: 'string', required: false, description: 'Idle motion.' },
  { name: 'scale', type: 'number', required: false, description: 'Scale.' },
  { name: 'x', type: 'number', required: false, description: 'X.' },
  { name: 'y', type: 'number', required: false, description: 'Y.' },
]});
def({ name: 'live2d_motion', category: 'live2d', description: 'Play Live2D motion.', descriptionJa: 'Live2Dモーションを再生します。', params: [
  { name: 'name', type: 'string', required: false, description: 'Model ID.' },
  { name: 'mtn', type: 'string', required: false, description: 'Motion name.' },
  { name: 'no', type: 'number', required: false, default: '0', description: 'Motion index.' },
]});
def({ name: 'live2d_expression', category: 'live2d', description: 'Change Live2D expression.', descriptionJa: 'Live2D表情を変更します。', params: [
  { name: 'name', type: 'string', required: false, description: 'Model ID.' },
  { name: 'expression', type: 'string', required: false, description: 'Expression name.' },
]});
def({ name: 'live2d_delete', category: 'live2d', description: 'Delete Live2D model.', descriptionJa: 'Live2Dモデルを削除します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Model ID.' },
]});
simple('live2d_delete_all', 'live2d', 'Delete all Live2D models.', '全Live2Dモデルを削除します。');
simple('live2d_restore', 'live2d', 'Restore Live2D from save data.', 'セーブデータからLive2Dを復元します。');

// ══════════════════════════ 3D (basic subset) ══════════════════════════

def({ name: '3d_init', category: '3d', description: 'Initialize 3D rendering.', descriptionJa: '3Dレンダリングを初期化します。', params: [
  { name: 'layer', type: 'string', required: false, default: '0', description: 'Layer.' },
  { name: 'camera', type: 'enum', required: false, enumValues: ['Perspective', 'Orthographic'], description: 'Camera type.' },
]});
def({ name: '3d_model_new', category: '3d', description: 'Load 3D model (GLTF/OBJ).', descriptionJa: '3Dモデルを読み込みます。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'storage', type: 'file', required: true, description: 'Model file.' },
  { name: 'pos', type: 'string', required: false, description: 'Position x,y,z.' },
  { name: 'rot', type: 'string', required: false, description: 'Rotation x,y,z.' },
  { name: 'scale', type: 'string', required: false, description: 'Scale x,y,z.' },
]});
def({ name: '3d_show', category: '3d', description: 'Display 3D object.', descriptionJa: '3Dオブジェクトを表示します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'time', type: 'number', required: false, description: 'Fade-in time (ms).' },
]});
def({ name: '3d_hide', category: '3d', description: 'Hide 3D object.', descriptionJa: '3Dオブジェクトを非表示にします。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'time', type: 'number', required: false, description: 'Fade-out time (ms).' },
]});
simple('3d_hide_all', '3d', 'Hide all 3D objects.', '全3Dオブジェクトを非表示にします。');
def({ name: '3d_delete', category: '3d', description: 'Delete 3D object.', descriptionJa: '3Dオブジェクトを削除します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
]});
simple('3d_delete_all', '3d', 'Delete all 3D objects.', '全3Dオブジェクトを削除します。');
simple('3d_close', '3d', 'Destroy 3D scene.', '3Dシーンを破棄します。');

// ══════════════════════════ Scene system tags (used by engine) ══════════════════════════

// These tags are used internally by TyranoScript config/system scenarios
// (cg.ks, title.ks, config.ks, replay.ks, make.ks)
def({ name: 'cg_image_button', category: 'system', description: 'CG gallery image button (system).', params: [
  { name: 'graphic', type: 'file', required: false, description: 'Button image.' },
  { name: 'storage', type: 'file', required: false, description: 'CG image.' },
  { name: 'x', type: 'number', required: false, description: 'X position.' },
  { name: 'y', type: 'number', required: false, description: 'Y position.' },
  { name: 'no_graphic', type: 'file', required: false, description: 'Image shown when CG is not yet unlocked.' },
  { name: 'width', type: 'number', required: false, description: 'Button width.' },
  { name: 'height', type: 'number', required: false, description: 'Button height.' },
  { name: 'folder', type: 'string', required: false, description: 'Resource folder for CG images.' },
]});
def({ name: 'replay_image_button', category: 'system', description: 'Replay gallery button (system).', params: [
  { name: 'graphic', type: 'file', required: false, description: 'Button image.' },
  { name: 'storage', type: 'file', required: false, description: 'Scene file.' },
  { name: 'target', type: 'string', required: false, description: 'Target label.' },
  { name: 'name', type: 'string', required: false, description: 'Element name.' },
  { name: 'x', type: 'number', required: false, description: 'X position.' },
  { name: 'y', type: 'number', required: false, description: 'Y position.' },
  { name: 'no_graphic', type: 'file', required: false, description: 'Image shown when replay is not yet unlocked.' },
  { name: 'width', type: 'number', required: false, description: 'Button width.' },
  { name: 'height', type: 'number', required: false, description: 'Button height.' },
  { name: 'folder', type: 'string', required: false, description: 'Resource folder for images.' },
]});

// ══════════════════════════ Misc ══════════════════════════

def({ name: 'popopo', category: 'audio', description: 'Play synthesized text sound.', descriptionJa: 'テキスト表示と同期したポポポ音を再生します。', params: [
  { name: 'volume', type: 'number', required: false, description: 'Volume (0-100).' },
  { name: 'frequency', type: 'string', required: false, description: 'Pitch (A-G, with + for sharp).' },
  { name: 'type', type: 'enum', required: false, enumValues: ['sine', 'square', 'sawtooth', 'triangle', 'noise', 'file', 'none'], description: 'Sound type.' },
  { name: 'chara', type: 'string', required: false, default: 'default', description: 'Apply to specific character.' },
]});

def({ name: 'set_resizecall', category: 'system', description: 'Call scenario on screen resize.', descriptionJa: '画面リサイズ時にシナリオを呼び出します。', params: [
  { name: 'storage', type: 'file', required: true, description: 'Scenario file.' },
  { name: 'target', type: 'string', required: false, description: 'Label.' },
]});

def({ name: 'apply_local_patch', category: 'system', description: 'Apply local patch file.', descriptionJa: 'ローカルパッチを適用します。', params: [
  { name: 'file', type: 'string', required: true, description: 'Patch file path.' },
  { name: 'reload', type: 'boolean', required: false, default: 'false', description: 'Auto-restart.' },
]});

def({ name: 'check_web_patch', category: 'system', description: 'Check for updates on server.', descriptionJa: 'サーバーで更新を確認します。', params: [
  { name: 'url', type: 'string', required: true, description: 'Patch JSON URL.' },
  { name: 'reload', type: 'boolean', required: false, default: 'false', description: 'Auto-restart.' },
]});

// AR tags
def({ name: 'bgcamera', category: 'ar', description: 'Stream device camera as background.', descriptionJa: 'デバイスカメラを背景にストリームします。', params: [
  { name: 'name', type: 'string', required: false, description: 'Element ID.' },
  { name: 'wait', type: 'boolean', required: false, default: 'true', description: 'Wait for display.' },
  { name: 'time', type: 'number', required: false, default: '1000', description: 'Fade-in time (ms).' },
  { name: 'mode', type: 'enum', required: false, enumValues: ['front', 'back'], description: 'Camera.' },
]});
def({ name: 'stop_bgcamera', category: 'ar', description: 'Stop camera stream.', descriptionJa: 'カメラストリームを停止します。', params: [
  { name: 'time', type: 'number', required: false, default: '1000', description: 'Fade-out time (ms).' },
]});

// VChat tags
simple('vchat_in', 'vchat', 'Chat balloon positioning (internal).', 'チャット吹き出し位置調整（内部）。');
def({ name: 'vchat_config', category: 'vchat', description: 'Configure VChat.', descriptionJa: 'VChatを設定します。', params: [
  { name: 'chara_name_color', type: 'color', required: false, description: 'Character name color.' },
]});
def({ name: 'vchat_chara', category: 'vchat', description: 'Register character for VChat.', descriptionJa: 'VChatにキャラクターを登録します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Character ID.' },
  { name: 'color', type: 'color', required: false, description: 'Display color.' },
]});

} // end registerExtendedTags
