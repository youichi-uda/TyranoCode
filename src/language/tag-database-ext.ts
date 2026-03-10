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
  { name: 'gradient', type: 'string', required: false, description: 'Gradient definition.' },
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
  { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
  { name: 'wait', type: 'boolean', required: false, description: 'Wait for completion.' },
  { name: 'face', type: 'string', required: false, description: 'Font face.' },
  { name: 'bold', type: 'boolean', required: false, description: 'Bold text.' },
  { name: 'edge', type: 'color', required: false, description: 'Edge color.' },
]});

def({ name: 'fuki_start', category: 'text', description: 'Enable speech bubble mode.', descriptionJa: '吹き出しモードを有効にします。', params: [
  { name: 'layer', type: 'string', required: false, description: 'Target message layer.' },
]});
simple('fuki_stop', 'text', 'Disable speech bubble mode.', '吹き出しモードを無効にします。');
def({ name: 'fuki_chara', category: 'text', description: 'Register speech bubble settings per character.', descriptionJa: 'キャラクターごとの吹き出し設定を登録します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Character name.' },
  { name: 'left', type: 'number', required: false, description: 'Bubble X.' },
  { name: 'top', type: 'number', required: false, description: 'Bubble Y.' },
  { name: 'sippo', type: 'string', required: false, description: 'Tail direction.' },
  { name: 'sippo_left', type: 'number', required: false, description: 'Tail X offset.' },
  { name: 'sippo_top', type: 'number', required: false, description: 'Tail Y offset.' },
  { name: 'max_width', type: 'number', required: false, description: 'Maximum bubble width.' },
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
  { name: 'color', type: 'string', required: false, description: 'Background color.' },
  { name: 'opacity', type: 'number', required: false, description: 'Opacity.' },
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
  { name: 'effect', type: 'string', required: false, description: 'Transition effect.' },
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
  { name: 'pos_change_time', type: 'number', required: false, description: 'Position change duration (ms).' },
  { name: 'brightness_value', type: 'number', required: false, description: 'Brightness value for non-speaker.' },
  { name: 'blur_value', type: 'number', required: false, description: 'Blur value for non-speaker.' },
  { name: 'talk_anim', type: 'string', required: false, description: 'Speaking animation type.' },
  { name: 'talk_anim_time', type: 'number', required: false, description: 'Speaking animation duration (ms).' },
  { name: 'talk_anim_value', type: 'number', required: false, description: 'Speaking animation value.' },
  { name: 'talk_anim_zoom_rate', type: 'number', required: false, description: 'Speaking animation zoom rate.' },
  { name: 'effect', type: 'string', required: false, description: 'Transition effect.' },
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
  { name: 'zindex', type: 'string', required: false, description: 'Layering priority.' },
]});

def({ name: 'chara_layer_mod', category: 'character', description: 'Modify character variation definitions.', descriptionJa: 'キャラクター差分定義を変更します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Character name.' },
  { name: 'part', type: 'string', required: true, description: 'Part category.' },
  { name: 'zindex', type: 'string', required: false, description: 'Layering priority.' },
]});

def({ name: 'chara_part', category: 'character', description: 'Change character variation part.', descriptionJa: 'キャラクター差分パーツを変更します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Character name.' },
  { name: 'time', type: 'number', required: false, description: 'Transition time (ms).' },
  { name: 'allow_storage', type: 'boolean', required: false, description: 'Allow storage parameter.' },
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
  { name: 'saturate', type: 'number', required: false, description: 'Saturation.' },
  { name: 'hue', type: 'number', required: false, description: 'Hue rotation (degrees).' },
  { name: 'invert', type: 'number', required: false, description: 'Inversion (0-100).' },
  { name: 'opacity', type: 'number', required: false, description: 'Opacity (0-100).' },
]});
def({ name: 'free_filter', category: 'transition', description: 'Clear filter effect.', descriptionJa: 'フィルターを解除します。', params: [
  { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
]});

def({ name: 'mask', category: 'transition', description: 'Display screen mask overlay.', descriptionJa: 'スクリーンマスクを表示します。', params: [
  { name: 'color', type: 'color', required: false, description: 'Mask color.' },
  { name: 'opacity', type: 'number', required: false, description: 'Opacity (0-255).' },
  { name: 'storage', type: 'file', required: false, description: 'Mask image.' },
  { name: 'time', type: 'number', required: false, description: 'Fade duration (ms).' },
  { name: 'layer', type: 'string', required: false, description: 'Target layer.' },
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
  { name: 'left', type: 'number', required: false, description: 'X position.' },
  { name: 'top', type: 'number', required: false, description: 'Y position.' },
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
  { name: 'time', type: 'number', required: false, description: 'Transition time (ms).' },
  { name: 'mute', type: 'boolean', required: false, description: 'Mute audio.' },
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
  { name: 'z', type: 'string', required: false, description: 'Z displacement.' },
  { name: 'rotateX', type: 'string', required: false, description: 'X-axis rotation.' },
  { name: 'rotateY', type: 'string', required: false, description: 'Y-axis rotation.' },
  { name: 'rotateZ', type: 'string', required: false, description: 'Z-axis rotation.' },
  { name: 'scaleX', type: 'number', required: false, description: 'X scale.' },
  { name: 'scaleY', type: 'number', required: false, description: 'Y scale.' },
  { name: 'scaleZ', type: 'number', required: false, description: 'Z scale.' },
  { name: 'skew', type: 'string', required: false, description: 'Skew transform.' },
  { name: 'skewX', type: 'string', required: false, description: 'X-axis skew.' },
  { name: 'skewY', type: 'string', required: false, description: 'Y-axis skew.' },
  { name: 'perspective', type: 'string', required: false, description: 'Perspective distance.' },
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
  { name: 'delay', type: 'number', required: false, description: 'Start delay (ms).' },
  { name: 'direction', type: 'string', required: false, description: 'Animation direction.' },
  { name: 'mode', type: 'string', required: false, description: 'Fill mode.' },
  { name: 'reset', type: 'boolean', required: false, description: 'Reset before animation.' },
  { name: 'svg_x', type: 'boolean', required: false, description: 'Apply SVG X movement.' },
  { name: 'svg_y', type: 'boolean', required: false, description: 'Apply SVG Y movement.' },
  { name: 'svg_rotate', type: 'boolean', required: false, description: 'Apply SVG rotation.' },
  { name: 'next', type: 'boolean', required: false, description: 'Proceed to next tag.' },
  { name: 'width', type: 'number', required: false, description: 'Width.' },
  { name: 'height', type: 'number', required: false, description: 'Height.' },
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
  { name: 'label_ok', type: 'string', required: false, description: 'OK button label text.' },
  { name: 'label_ng', type: 'string', required: false, description: 'Cancel button label text.' },
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

def({ name: 'glyph_skip', category: 'system', description: 'Set skip-mode indicator image.', descriptionJa: 'スキップモードインジケータ画像を設定します。', params: [
  { name: 'storage', type: 'file', required: false, description: 'Glyph image file.' },
  { name: 'x', type: 'number', required: false, description: 'X position.' },
  { name: 'y', type: 'number', required: false, description: 'Y position.' },
  { name: 'width', type: 'number', required: false, description: 'Width.' },
  { name: 'height', type: 'number', required: false, description: 'Height.' },
]});

def({ name: 'glyph_auto', category: 'system', description: 'Set auto-mode indicator image.', descriptionJa: 'オートモードインジケータ画像を設定します。', params: [
  { name: 'storage', type: 'file', required: false, description: 'Glyph image file.' },
  { name: 'x', type: 'number', required: false, description: 'X position.' },
  { name: 'y', type: 'number', required: false, description: 'Y position.' },
  { name: 'width', type: 'number', required: false, description: 'Width.' },
  { name: 'height', type: 'number', required: false, description: 'Height.' },
]});

def({ name: 'dialog_config', category: 'system', description: 'Configure dialog appearance.', descriptionJa: 'ダイアログの外観を設定します。', params: [
  { name: 'title_color', type: 'color', required: false, description: 'Title text color.' },
  { name: 'bg_color', type: 'color', required: false, description: 'Background color.' },
  { name: 'text_color', type: 'color', required: false, description: 'Body text color.' },
  { name: 'border_color', type: 'color', required: false, description: 'Border color.' },
  { name: 'border_radius', type: 'number', required: false, description: 'Border radius.' },
  { name: 'font_size', type: 'number', required: false, description: 'Font size.' },
  { name: 'font_face', type: 'string', required: false, description: 'Font family.' },
]});

def({ name: 'dialog_config_ok', category: 'system', description: 'Configure dialog OK button.', descriptionJa: 'ダイアログOKボタンを設定します。', params: [
  { name: 'text', type: 'string', required: false, description: 'Button label.' },
  { name: 'color', type: 'color', required: false, description: 'Text color.' },
  { name: 'bg_color', type: 'color', required: false, description: 'Background color.' },
  { name: 'border_color', type: 'color', required: false, description: 'Border color.' },
]});

def({ name: 'dialog_config_ng', category: 'system', description: 'Configure dialog Cancel button.', descriptionJa: 'ダイアログキャンセルボタンを設定します。', params: [
  { name: 'text', type: 'string', required: false, description: 'Button label.' },
  { name: 'color', type: 'color', required: false, description: 'Text color.' },
  { name: 'bg_color', type: 'color', required: false, description: 'Background color.' },
  { name: 'border_color', type: 'color', required: false, description: 'Border color.' },
]});

def({ name: 'dialog_config_filter', category: 'system', description: 'Configure dialog background filter.', descriptionJa: 'ダイアログ背景フィルターを設定します。', params: [
  { name: 'blur', type: 'number', required: false, description: 'Blur radius.' },
  { name: 'grayscale', type: 'number', required: false, description: 'Grayscale (0-100).' },
  { name: 'sepia', type: 'number', required: false, description: 'Sepia (0-100).' },
  { name: 'saturate', type: 'number', required: false, description: 'Saturation.' },
  { name: 'hue', type: 'number', required: false, description: 'Hue rotation (degrees).' },
  { name: 'brightness', type: 'number', required: false, description: 'Brightness.' },
  { name: 'contrast', type: 'number', required: false, description: 'Contrast.' },
  { name: 'opacity', type: 'number', required: false, description: 'Opacity.' },
]});

def({ name: 'mode_effect', category: 'system', description: 'Configure mode transition effects.', descriptionJa: 'モード切替エフェクトを設定します。', params: [
  { name: 'all', type: 'string', required: false, description: 'Effect for all modes.' },
  { name: 'skip', type: 'string', required: false, description: 'Effect for skip mode.' },
  { name: 'auto', type: 'string', required: false, description: 'Effect for auto mode.' },
  { name: 'stop', type: 'string', required: false, description: 'Effect for stop.' },
  { name: 'holdskip', type: 'string', required: false, description: 'Effect for hold-skip.' },
  { name: 'holdstop', type: 'string', required: false, description: 'Effect for hold-stop.' },
  { name: 'env', type: 'string', required: false, description: 'Effect environment.' },
  { name: 'width', type: 'number', required: false, description: 'Effect width.' },
  { name: 'height', type: 'number', required: false, description: 'Effect height.' },
  { name: 'color', type: 'string', required: false, description: 'Effect color.' },
  { name: 'bgcolor', type: 'string', required: false, description: 'Background color.' },
]});

def({ name: 'loading_log', category: 'system', description: 'Configure loading indicator behavior.', descriptionJa: 'ローディング表示の動作を設定します。', params: [
  { name: 'all', type: 'boolean', required: false, description: 'Show for all loading.' },
  { name: 'preload', type: 'boolean', required: false, description: 'Show during preload.' },
  { name: 'save', type: 'boolean', required: false, description: 'Show during save.' },
  { name: 'dottime', type: 'number', required: false, description: 'Dot animation interval (ms).' },
  { name: 'icon', type: 'string', required: false, description: 'Loading icon.' },
]});

def({ name: 'body', category: 'system', description: 'Configure game screen exterior.', descriptionJa: 'ゲーム画面外の設定を行います。', params: [
  { name: 'bgimage', type: 'file', required: false, description: 'Background image.' },
  { name: 'bgcolor', type: 'color', required: false, description: 'Background color.' },
  { name: 'bgcover', type: 'boolean', required: false, description: 'Stretch to cover.' },
  { name: 'bgrepeat', type: 'string', required: false, description: 'Background repeat mode.' },
  { name: 'scWidth', type: 'string', required: false, description: 'Screen width override.' },
  { name: 'scHeight', type: 'string', required: false, description: 'Screen height override.' },
]});

def({ name: 'cursor', category: 'system', description: 'Configure mouse cursor.', descriptionJa: 'マウスカーソルを設定します。', params: [
  { name: 'storage', type: 'string', required: false, description: 'Cursor image or "default".' },
  { name: 'auto_hide', type: 'string', required: false, description: 'Auto-hide timeout.' },
  { name: 'x', type: 'number', required: false, description: 'Cursor X offset.' },
  { name: 'y', type: 'number', required: false, description: 'Cursor Y offset.' },
  { name: 'type', type: 'string', required: false, description: 'Cursor type.' },
  { name: 'click_effect', type: 'string', required: false, description: 'Click effect type.' },
  { name: 'e_width', type: 'number', required: false, description: 'Effect width.' },
  { name: 'e_opacity', type: 'number', required: false, description: 'Effect opacity.' },
  { name: 'e_time', type: 'number', required: false, description: 'Effect duration (ms).' },
  { name: 'e_color', type: 'string', required: false, description: 'Effect color.' },
  { name: 'e_blend', type: 'string', required: false, description: 'Effect blend mode.' },
  { name: 'e_scale', type: 'number', required: false, description: 'Effect scale.' },
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
  { name: 'fadein', type: 'boolean', required: false, description: 'Enable fade-in.' },
  { name: 'fadeout', type: 'boolean', required: false, description: 'Enable fade-out.' },
]});

def({ name: 'fadeinse', category: 'audio', description: 'Play SE with fade-in.', descriptionJa: 'フェードインでSEを再生します。', params: [
  { name: 'storage', type: 'file', required: true, description: 'Audio file.' },
  { name: 'time', type: 'number', required: false, default: '2000', description: 'Fade-in time (ms).' },
  { name: 'loop', type: 'boolean', required: false, default: 'false', description: 'Loop.' },
  { name: 'volume', type: 'number', required: false, description: 'Volume (0-100).' },
  { name: 'buf', type: 'string', required: false, default: '0', description: 'Slot.' },
  { name: 'sprite_time', type: 'string', required: false, description: 'Sprite animation time.' },
  { name: 'html5', type: 'boolean', required: false, description: 'Use HTML5 audio.' },
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
  { name: 'tag_volume', type: 'number', required: false, description: 'Tag-level volume.' },
  { name: 'samebgm_restart', type: 'boolean', required: false, description: 'Restart if same BGM.' },
  { name: 'next', type: 'boolean', required: false, description: 'Proceed to next tag.' },
]});

def({ name: 'seopt', category: 'audio', description: 'Modify SE configuration.', descriptionJa: 'SE設定を変更します。', params: [
  { name: 'volume', type: 'number', required: false, description: 'Volume (0-100).' },
  { name: 'buf', type: 'string', required: false, description: 'Slot.' },
  { name: 'effect', type: 'boolean', required: false, default: 'true', description: 'Apply to current SE.' },
  { name: 'time', type: 'number', required: false, description: 'Fade time (ms).' },
  { name: 'tag_volume', type: 'number', required: false, description: 'Tag-level volume.' },
  { name: 'next', type: 'boolean', required: false, description: 'Proceed to next tag.' },
]});

def({ name: 'changevol', category: 'audio', description: 'Change volume of playing audio.', descriptionJa: '再生中オーディオの音量を変更します。', params: [
  { name: 'target', type: 'enum', required: false, default: 'bgm', enumValues: ['bgm', 'se'], description: 'Target type.' },
  { name: 'volume', type: 'number', required: false, description: 'Volume (0-100).' },
  { name: 'buf', type: 'string', required: false, description: 'Slot.' },
  { name: 'time', type: 'number', required: false, description: 'Fade time (ms).' },
  { name: 'next', type: 'boolean', required: false, description: 'Proceed to next tag.' },
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
  { name: 'waittime', type: 'number', required: false, description: 'Wait time before next voice (ms).' },
  { name: 'preload', type: 'boolean', required: false, description: 'Preload voice files.' },
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
  { name: 'color', type: 'string', required: false, description: 'Text color.' },
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
  { name: 'lip', type: 'string', required: false, description: 'Lip sync mode.' },
  { name: 'lip_time', type: 'number', required: false, description: 'Lip sync interval (ms).' },
  { name: 'lip_se', type: 'number', required: false, description: 'Lip sync SE slot.' },
  { name: 'lip_sound_level', type: 'number', required: false, description: 'Lip sync sound threshold.' },
  { name: 'breath', type: 'boolean', required: false, description: 'Enable breathing animation.' },
  { name: 'left', type: 'number', required: false, description: 'X position.' },
  { name: 'top', type: 'number', required: false, description: 'Y position.' },
  { name: 'width', type: 'number', required: false, description: 'Canvas width.' },
  { name: 'height', type: 'number', required: false, description: 'Canvas height.' },
  { name: 'zindex', type: 'number', required: false, description: 'Z-index.' },
  { name: 'opacity', type: 'number', required: false, description: 'Opacity (0-255).' },
  { name: 'glleft', type: 'number', required: false, description: 'GL canvas X offset.' },
  { name: 'gltop', type: 'number', required: false, description: 'GL canvas Y offset.' },
  { name: 'glscale', type: 'number', required: false, description: 'GL canvas scale.' },
]});
def({ name: 'live2d_show', category: 'live2d', description: 'Display Live2D model.', descriptionJa: 'Live2Dモデルを表示します。', params: [
  { name: 'name', type: 'string', required: false, description: 'Model ID.' },
  { name: 'time', type: 'number', required: false, description: 'Transition time (ms).' },
  { name: 'idle', type: 'string', required: false, description: 'Idle motion.' },
  { name: 'scale', type: 'number', required: false, description: 'Scale factor.' },
  { name: 'x', type: 'number', required: false, description: 'X position.' },
  { name: 'y', type: 'number', required: false, description: 'Y position.' },
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
  { name: 'filenm', type: 'string', required: false, description: 'Motion file name.' },
  { name: 'force', type: 'boolean', required: false, description: 'Force play motion.' },
  { name: 'idle', type: 'string', required: false, description: 'Idle motion after play.' },
]});
def({ name: 'live2d_expression', category: 'live2d', description: 'Change Live2D expression.', descriptionJa: 'Live2D表情を変更します。', params: [
  { name: 'name', type: 'string', required: false, description: 'Model ID.' },
  { name: 'expression', type: 'string', required: false, description: 'Expression name.' },
  { name: 'filenm', type: 'string', required: false, description: 'Expression file name.' },
]});
def({ name: 'live2d_trans', category: 'live2d', description: 'Move Live2D model.', descriptionJa: 'Live2Dモデルを移動します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Model ID.' },
  { name: 'left', type: 'number', required: true, description: 'X position.' },
  { name: 'top', type: 'number', required: true, description: 'Y position.' },
  { name: 'time', type: 'number', required: false, description: 'Transition time (ms).' },
]});
def({ name: 'live2d_rotate', category: 'live2d', description: 'Rotate Live2D model.', descriptionJa: 'Live2Dモデルを回転します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Model ID.' },
  { name: 'rotate', type: 'number', required: true, description: 'Rotation angle.' },
  { name: 'time', type: 'number', required: false, description: 'Transition time (ms).' },
]});
def({ name: 'live2d_scale', category: 'live2d', description: 'Scale Live2D model.', descriptionJa: 'Live2Dモデルをスケーリングします。', params: [
  { name: 'name', type: 'string', required: true, description: 'Model ID.' },
  { name: 'scaleX', type: 'number', required: true, description: 'X scale factor.' },
  { name: 'scaleY', type: 'number', required: true, description: 'Y scale factor.' },
  { name: 'time', type: 'number', required: false, description: 'Transition time (ms).' },
]});
def({ name: 'live2d_opacity', category: 'live2d', description: 'Change Live2D model opacity.', descriptionJa: 'Live2Dモデルの不透明度を変更します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Model ID.' },
  { name: 'opacity', type: 'number', required: false, description: 'Opacity (0-255).' },
  { name: 'time', type: 'number', required: false, description: 'Transition time (ms).' },
]});
def({ name: 'live2d_color', category: 'live2d', description: 'Change Live2D model color tint.', descriptionJa: 'Live2Dモデルの色調を変更します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Model ID.' },
  { name: 'red', type: 'number', required: false, description: 'Red channel.' },
  { name: 'green', type: 'number', required: false, description: 'Green channel.' },
  { name: 'blue', type: 'number', required: false, description: 'Blue channel.' },
]});
def({ name: 'live2d_shake', category: 'live2d', description: 'Shake Live2D model.', descriptionJa: 'Live2Dモデルを揺らします。', params: [
  { name: 'name', type: 'string', required: true, description: 'Model ID.' },
]});
def({ name: 'live2d_fadein', category: 'live2d', description: 'Fade in Live2D canvas.', descriptionJa: 'Live2Dキャンバスをフェードインします。', params: [
  { name: 'time', type: 'number', required: false, description: 'Fade time (ms).' },
  { name: 'wait', type: 'boolean', required: false, description: 'Wait for completion.' },
]});
def({ name: 'live2d_fadeout', category: 'live2d', description: 'Fade out Live2D canvas.', descriptionJa: 'Live2Dキャンバスをフェードアウトします。', params: [
  { name: 'time', type: 'number', required: false, description: 'Fade time (ms).' },
  { name: 'wait', type: 'boolean', required: false, description: 'Wait for completion.' },
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
  { name: 'page', type: 'string', required: false, description: 'Page target.' },
  { name: 'near', type: 'number', required: false, description: 'Near clipping plane.' },
  { name: 'far', type: 'number', required: false, description: 'Far clipping plane.' },
  { name: 'material_type', type: 'string', required: false, description: 'Default material type.' },
  { name: 'ambient_light', type: 'number', required: false, description: 'Ambient light intensity.' },
  { name: 'directional_light', type: 'number', required: false, description: 'Directional light intensity.' },
  { name: 'antialias', type: 'boolean', required: false, description: 'Enable antialiasing.' },
  { name: 'studio', type: 'boolean', required: false, description: 'Enable studio mode.' },
  { name: 'fps_rate', type: 'number', required: false, description: 'FPS rate.' },
  { name: 'background', type: 'boolean', required: false, description: 'Show background.' },
  { name: 'xr', type: 'string', required: false, description: 'XR mode.' },
]});
def({ name: '3d_model_new', category: '3d', description: 'Load 3D model (GLTF/OBJ).', descriptionJa: '3Dモデルを読み込みます。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'storage', type: 'file', required: true, description: 'Model file.' },
  { name: 'pos', type: 'string', required: false, description: 'Position x,y,z.' },
  { name: 'rot', type: 'string', required: false, description: 'Rotation x,y,z.' },
  { name: 'scale', type: 'string', required: false, description: 'Scale x,y,z.' },
  { name: 'tonemap', type: 'boolean', required: false, description: 'Enable tone mapping.' },
  { name: 'motion', type: 'string', required: false, description: 'Initial motion.' },
  { name: 'folder', type: 'string', required: false, description: 'Model folder.' },
]});
def({ name: '3d_show', category: '3d', description: 'Display 3D object.', descriptionJa: '3Dオブジェクトを表示します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'time', type: 'number', required: false, description: 'Fade-in time (ms).' },
  { name: 'pos', type: 'string', required: false, description: 'Position x,y,z.' },
  { name: 'rot', type: 'string', required: false, description: 'Rotation x,y,z.' },
  { name: 'scale', type: 'string', required: false, description: 'Scale x,y,z.' },
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

def({ name: '3d_sphere_new', category: '3d', description: 'Create 3D sphere.', descriptionJa: '3D球体を作成します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'texture', type: 'string', required: false, description: 'Texture image.' },
  { name: 'color', type: 'string', required: false, description: 'Object color.' },
  { name: 'radius', type: 'number', required: false, description: 'Sphere radius.' },
  { name: 'width', type: 'number', required: false, description: 'Width segments.' },
  { name: 'height', type: 'number', required: false, description: 'Height segments.' },
  { name: 'side', type: 'number', required: false, description: 'Material side.' },
  { name: 'scale', type: 'string', required: false, description: 'Scale x,y,z.' },
  { name: 'pos', type: 'string', required: false, description: 'Position x,y,z.' },
  { name: 'rot', type: 'string', required: false, description: 'Rotation x,y,z.' },
]});

def({ name: '3d_cylinder_new', category: '3d', description: 'Create 3D cylinder.', descriptionJa: '3D円柱を作成します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'texture', type: 'string', required: false, description: 'Texture image.' },
  { name: 'color', type: 'string', required: false, description: 'Object color.' },
  { name: 'width', type: 'number', required: false, description: 'Radius top.' },
  { name: 'height', type: 'number', required: false, description: 'Height.' },
  { name: 'segment', type: 'number', required: false, description: 'Radial segments.' },
  { name: 'side', type: 'number', required: false, description: 'Material side.' },
  { name: 'scale', type: 'string', required: false, description: 'Scale x,y,z.' },
  { name: 'pos', type: 'string', required: false, description: 'Position x,y,z.' },
  { name: 'rot', type: 'string', required: false, description: 'Rotation x,y,z.' },
]});

def({ name: '3d_box_new', category: '3d', description: 'Create 3D box.', descriptionJa: '3Dボックスを作成します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'texture', type: 'string', required: false, description: 'Texture image.' },
  { name: 'color', type: 'string', required: false, description: 'Object color.' },
  { name: 'width', type: 'number', required: false, description: 'Width.' },
  { name: 'height', type: 'number', required: false, description: 'Height.' },
  { name: 'depth', type: 'number', required: false, description: 'Depth.' },
  { name: 'scale', type: 'string', required: false, description: 'Scale x,y,z.' },
  { name: 'pos', type: 'string', required: false, description: 'Position x,y,z.' },
  { name: 'rot', type: 'string', required: false, description: 'Rotation x,y,z.' },
  { name: 'tonemap', type: 'boolean', required: false, description: 'Enable tone mapping.' },
]});

def({ name: '3d_image_new', category: '3d', description: 'Create 3D image plane.', descriptionJa: '3D画像プレーンを作成します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'texture', type: 'string', required: true, description: 'Texture image.' },
  { name: 'width', type: 'number', required: true, description: 'Width.' },
  { name: 'height', type: 'number', required: false, description: 'Height.' },
  { name: 'scale', type: 'string', required: false, description: 'Scale x,y,z.' },
  { name: 'pos', type: 'string', required: false, description: 'Position x,y,z.' },
  { name: 'rot', type: 'string', required: false, description: 'Rotation x,y,z.' },
  { name: 'doubleside', type: 'boolean', required: false, description: 'Render both sides.' },
  { name: 'tonemap', type: 'boolean', required: false, description: 'Enable tone mapping.' },
]});

def({ name: '3d_sprite_new', category: '3d', description: 'Create 3D sprite.', descriptionJa: '3Dスプライトを作成します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'storage', type: 'file', required: true, description: 'Sprite image.' },
  { name: 'scale', type: 'string', required: false, description: 'Scale x,y,z.' },
  { name: 'pos', type: 'string', required: false, description: 'Position x,y,z.' },
  { name: 'rot', type: 'string', required: false, description: 'Rotation x,y,z.' },
  { name: 'tonemap', type: 'boolean', required: false, description: 'Enable tone mapping.' },
]});

def({ name: '3d_text_new', category: '3d', description: 'Create 3D text.', descriptionJa: '3Dテキストを作成します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'text', type: 'string', required: true, description: 'Text content.' },
  { name: 'color', type: 'string', required: false, description: 'Text color.' },
]});

def({ name: '3d_canvas_show', category: '3d', description: 'Show 3D canvas.', descriptionJa: '3Dキャンバスを表示します。', params: [
  { name: 'time', type: 'number', required: false, description: 'Fade-in time (ms).' },
]});

def({ name: '3d_canvas_hide', category: '3d', description: 'Hide 3D canvas.', descriptionJa: '3Dキャンバスを非表示にします。', params: [
  { name: 'time', type: 'number', required: false, description: 'Fade-out time (ms).' },
]});

def({ name: '3d_anim', category: '3d', description: 'Animate 3D object.', descriptionJa: '3Dオブジェクトをアニメーションします。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'pos', type: 'string', required: false, description: 'Target position x,y,z.' },
  { name: 'rot', type: 'string', required: false, description: 'Target rotation x,y,z.' },
  { name: 'scale', type: 'string', required: false, description: 'Target scale x,y,z.' },
  { name: 'time', type: 'number', required: false, description: 'Duration (ms).' },
  { name: 'easing', type: 'string', required: false, description: 'Easing function.' },
  { name: 'wait', type: 'boolean', required: false, description: 'Wait for completion.' },
]});

def({ name: '3d_anim_stop', category: '3d', description: 'Stop 3D animation.', descriptionJa: '3Dアニメーションを停止します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'complete', type: 'boolean', required: false, description: 'Jump to end state.' },
]});

def({ name: '3d_camera', category: '3d', description: 'Control 3D camera.', descriptionJa: '3Dカメラを操作します。', params: [
  { name: 'pos', type: 'string', required: false, description: 'Camera position x,y,z.' },
  { name: 'lookAt', type: 'string', required: false, description: 'Look-at target x,y,z.' },
  { name: 'fov', type: 'number', required: false, description: 'Field of view.' },
  { name: 'rot', type: 'string', required: false, description: 'Camera rotation x,y,z.' },
  { name: 'time', type: 'number', required: false, description: 'Transition time (ms).' },
  { name: 'easing', type: 'string', required: false, description: 'Easing function.' },
]});

def({ name: '3d_scene', category: '3d', description: 'Configure 3D scene settings.', descriptionJa: '3Dシーン設定を変更します。', params: [
  { name: 'ambient_light', type: 'number', required: false, description: 'Ambient light intensity.' },
  { name: 'directional_light', type: 'number', required: false, description: 'Directional light intensity.' },
  { name: 'tonemap', type: 'boolean', required: false, description: 'Enable tone mapping.' },
]});

def({ name: '3d_motion', category: '3d', description: 'Play 3D model motion.', descriptionJa: '3Dモデルモーションを再生します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'motion', type: 'string', required: false, description: 'Motion name.' },
]});

def({ name: '3d_event', category: '3d', description: 'Register 3D event.', descriptionJa: '3Dイベントを登録します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'type', type: 'string', required: false, description: 'Event type.' },
  { name: 'exp', type: 'expression', required: false, description: 'JavaScript expression.' },
  { name: 'storage', type: 'file', required: false, description: 'Jump file.' },
  { name: 'target', type: 'string', required: false, description: 'Jump label.' },
  { name: 'distance', type: 'number', required: false, description: 'Detection distance.' },
  { name: 'mode', type: 'string', required: false, description: 'Event mode.' },
]});

def({ name: '3d_event_delete', category: '3d', description: 'Delete 3D event.', descriptionJa: '3Dイベントを削除します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
]});

simple('3d_event_start', '3d', 'Start 3D event processing.', '3Dイベント処理を開始します。');
simple('3d_event_stop', '3d', 'Stop 3D event processing.', '3Dイベント処理を停止します。');
simple('3d_gyro', '3d', 'Enable gyroscope control.', 'ジャイロスコープ操作を有効にします。');
simple('3d_gyro_stop', '3d', 'Disable gyroscope control.', 'ジャイロスコープ操作を無効にします。');
simple('3d_debug', '3d', 'Enable 3D debug mode.', '3Dデバッグモードを有効にします。');
simple('3d_debug_bk', '3d', 'Enable 3D debug background.', '3Dデバッグ背景を有効にします。');
simple('3d_debug_camera', '3d', 'Enable 3D debug camera.', '3Dデバッグカメラを有効にします。');
simple('3d_fps_control', '3d', 'Enable FPS camera control.', 'FPSカメラ操作を有効にします。');
simple('3d_helper', '3d', 'Show 3D helper axes.', '3Dヘルパー軸を表示します。');

def({ name: '3d_new_group', category: '3d', description: 'Create 3D object group.', descriptionJa: '3Dオブジェクトグループを作成します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Group ID.' },
]});

def({ name: '3d_add_group', category: '3d', description: 'Add object to 3D group.', descriptionJa: '3Dグループにオブジェクトを追加します。', params: [
  { name: 'group', type: 'string', required: true, description: 'Group ID.' },
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
]});

def({ name: '3d_sound', category: '3d', description: 'Play positional 3D audio.', descriptionJa: '3D位置オーディオを再生します。', params: [
  { name: 'name', type: 'string', required: true, description: 'Object ID.' },
  { name: 'storage', type: 'file', required: true, description: 'Audio file.' },
  { name: 'pos', type: 'string', required: false, description: 'Position x,y,z.' },
]});

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
  { name: 'time', type: 'number', required: false, description: 'Sound duration (ms).' },
  { name: 'tailtime', type: 'number', required: false, description: 'Tail duration (ms).' },
  { name: 'octave', type: 'number', required: false, description: 'Octave.' },
  { name: 'mode', type: 'string', required: false, description: 'Playback mode.' },
  { name: 'buf', type: 'string', required: false, description: 'Audio slot.' },
  { name: 'storage', type: 'string', required: false, description: 'Sound file.' },
  { name: 'samplerate', type: 'number', required: false, description: 'Sample rate.' },
  { name: 'noplaychars', type: 'string', required: false, description: 'Characters to skip sound.' },
  { name: 'interval', type: 'number', required: false, description: 'Sound interval (ms).' },
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
  { name: 'fit', type: 'boolean', required: false, description: 'Fit to screen.' },
  { name: 'width', type: 'number', required: false, description: 'Width.' },
  { name: 'height', type: 'number', required: false, description: 'Height.' },
  { name: 'left', type: 'number', required: false, description: 'X position.' },
  { name: 'top', type: 'number', required: false, description: 'Y position.' },
  { name: 'qrcode', type: 'string', required: false, description: 'QR code detection mode.' },
  { name: 'debug', type: 'boolean', required: false, description: 'Enable debug mode.' },
  { name: 'audio', type: 'boolean', required: false, description: 'Enable audio capture.' },
]});
def({ name: 'stop_bgcamera', category: 'ar', description: 'Stop camera stream.', descriptionJa: 'カメラストリームを停止します。', params: [
  { name: 'time', type: 'number', required: false, default: '1000', description: 'Fade-out time (ms).' },
  { name: 'wait', type: 'boolean', required: false, description: 'Wait for completion.' },
]});

def({ name: 'qr_config', category: 'ar', description: 'Configure QR code detection.', descriptionJa: 'QRコード検出を設定します。', params: [
  { name: 'qrcode', type: 'string', required: true, description: 'QR code pattern.' },
]});

def({ name: 'qr_define', category: 'ar', description: 'Define QR code action.', descriptionJa: 'QRコードアクションを定義します。', params: [
  { name: 'url', type: 'string', required: true, description: 'QR code URL pattern.' },
  { name: 'storage', type: 'file', required: false, description: 'Jump file.' },
  { name: 'target', type: 'string', required: false, description: 'Jump label.' },
  { name: 'clear', type: 'boolean', required: false, description: 'Clear after detection.' },
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
