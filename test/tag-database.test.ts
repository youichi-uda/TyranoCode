/**
 * Comprehensive tag database tests.
 *
 * Validates every tag and parameter in the TAG_DATABASE against:
 *   1. Structural integrity (valid types, no empty names, etc.)
 *   2. Ground-truth parameter lists extracted from the TyranoScript engine source
 *   3. Vital/required correctness
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TAG_DATABASE, TagDef, TagParamDef } from '../src/language/tag-database';
import { registerExtendedTags } from '../src/language/tag-database-ext';

// ── Initialize full database ──
beforeAll(() => {
  registerExtendedTags();
});

// ════════════════════════════════════════════════════════════════════
// Source-of-truth: parameters extracted from TyranoScript engine source
// (tyranoscript repo: tyrano/plugins/kag/kag.tag*.js)
// ════════════════════════════════════════════════════════════════════

interface SourceTag {
  params: string[];
  vital: string[];
}

const SOURCE_TAGS: Record<string, SourceTag> = {
  // ── kag.tag.js ──
  jump:       { params: ['storage', 'target', 'countpage'], vital: [] },
  position:   { params: ['layer', 'page', 'left', 'top', 'width', 'height', 'color', 'opacity', 'vertical', 'frame', 'radius', 'border_color', 'border_size', 'marginl', 'margint', 'marginr', 'marginb', 'margin', 'gradient', 'visible', 'next'], vital: [] },
  image:      { params: ['layer', 'page', 'visible', 'top', 'left', 'x', 'y', 'width', 'height', 'pos', 'name', 'folder', 'time', 'wait', 'depth', 'reflect', 'zindex', 'animimg'], vital: [] },
  freeimage:  { params: ['layer', 'page', 'time', 'wait'], vital: ['layer'] },
  free:       { params: ['layer', 'page', 'name', 'wait', 'time'], vital: ['layer', 'name'] },
  ptext:      { params: ['layer', 'page', 'x', 'y', 'vertical', 'text', 'size', 'face', 'color', 'italic', 'bold', 'align', 'edge', 'shadow', 'name', 'time', 'width', 'zindex', 'overwrite'], vital: ['layer', 'x', 'y'] },
  mtext:      { params: ['layer', 'page', 'x', 'y', 'vertical', 'text', 'size', 'face', 'color', 'italic', 'bold', 'shadow', 'edge', 'name', 'zindex', 'width', 'align', 'fadeout', 'time', 'in_effect', 'in_delay', 'in_delay_scale', 'in_sync', 'in_shuffle', 'in_reverse', 'wait', 'out_effect', 'out_delay', 'out_scale_delay', 'out_sync', 'out_shuffle', 'out_reverse'], vital: ['x', 'y'] },
  link:       { params: ['target', 'storage', 'keyfocus', 'once'], vital: [] },
  wait:       { params: ['time'], vital: ['time'] },
  quake:      { params: ['count', 'time', 'timemode', 'hmax', 'vmax', 'wait'], vital: ['time'] },
  quake2:     { params: ['time', 'hmax', 'vmax', 'wait', 'copybase', 'skippable'], vital: [] },
  vibrate:    { params: ['time', 'power', 'count'], vital: [] },
  font:       { params: ['size', 'color', 'bold', 'italic', 'face', 'edge', 'edge_method', 'shadow', 'effect', 'effect_speed', 'gradient'], vital: [] },
  deffont:    { params: ['size', 'color', 'bold', 'italic', 'face', 'edge', 'edge_method', 'shadow', 'effect', 'effect_speed', 'gradient'], vital: [] },
  message_config: { params: ['ch_speed_in_click', 'effect_speed_in_click', 'edge_overlap_text', 'speech_bracket_float', 'speech_margin_left', 'kerning', 'add_word_nobreak', 'remove_word_nobreak', 'line_spacing', 'letter_spacing', 'control_line_break', 'control_line_break_chars'], vital: [] },
  layopt:     { params: ['layer', 'page', 'visible', 'left', 'top', 'opacity', 'autohide', 'index'], vital: ['layer'] },
  ruby:       { params: ['text'], vital: ['text'] },
  button:     { params: ['graphic', 'storage', 'target', 'ext', 'name', 'x', 'y', 'width', 'height', 'fix', 'savesnap', 'folder', 'exp', 'preexp', 'visible', 'hint', 'clickse', 'enterse', 'leavese', 'activeimg', 'clickimg', 'enterimg', 'autoimg', 'skipimg', 'keyfocus', 'auto_next', 'role'], vital: [] },
  glyph:      { params: ['line', 'layer', 'fix', 'left', 'top', 'name', 'folder', 'width', 'height', 'anim', 'time', 'figure', 'color', 'html', 'marginl', 'marginb', 'keyframe', 'easing', 'count', 'delay', 'derection', 'mode', 'koma_anim', 'koma_count', 'koma_width', 'koma_anim_time', 'target'], vital: [] },
  glyph_skip: { params: ['delete', 'use'], vital: [] },
  glyph_auto: { params: ['delete', 'fix', 'use'], vital: [] },
  glink_config: { params: ['auto_place', 'auto_place_force', 'margin_y', 'margin_x', 'padding_y', 'padding_x', 'direction', 'wrap', 'dx', 'dy', 'width', 'vertical', 'horizontal', 'place_area', 'show_time', 'show_effect', 'show_keyframe', 'show_delay', 'show_easing', 'select_time', 'select_effect', 'select_keyframe', 'select_delay', 'select_easing', 'reject_time', 'reject_effect', 'reject_keyframe', 'reject_delay', 'reject_easing'], vital: [] },
  glink:      { params: ['color', 'font_color', 'storage', 'target', 'hold', 'name', 'text', 'x', 'y', 'width', 'height', 'exp', 'preexp', 'size', 'graphic', 'enterimg', 'cm', 'opacity', 'clickse', 'enterse', 'leavese', 'face', 'bold', 'keyfocus', 'autopos'], vital: [] },
  trans:      { params: ['layer', 'method', 'children', 'time'], vital: ['time', 'layer'] },
  bg:         { params: ['storage', 'method', 'wait', 'time', 'cross', 'position'], vital: ['storage'] },
  clickable:  { params: ['width', 'height', 'x', 'y', 'border', 'color', 'mouseopacity', 'opacity', 'storage', 'target', 'name'], vital: ['width', 'height'] },
  current:    { params: ['layer', 'page'], vital: [] },
  fuki_chara: { params: ['name', 'sippo', 'sippo_left', 'sippo_top', 'sippo_width', 'sippo_height', 'enable', 'max_width', 'fix_width', 'font_color', 'font_size', 'color', 'opacity', 'border_size', 'border_color', 'radius'], vital: ['name'] },
  graph:      { params: ['storage'], vital: ['storage'] },
  cm:         { params: ['next'], vital: [] },
  mark:       { params: ['color', 'font_color', 'size'], vital: [] },
  locate:     { params: ['x', 'y'], vital: [] },
  delay:      { params: ['speed'], vital: [] },
  resetdelay: { params: ['speed'], vital: [] },
  configdelay: { params: ['speed'], vital: [] },
  mask:       { params: ['time', 'effect', 'color', 'graphic', 'folder'], vital: [] },
  mask_off:   { params: ['time', 'effect'], vital: [] },

  // ── kag.tag_ext.js ──
  loadjs:     { params: ['storage', 'type'], vital: ['storage'] },
  movie:      { params: ['storage', 'volume', 'skip', 'mute', 'bgmode', 'loop'], vital: ['storage'] },
  bgmovie:    { params: ['storage', 'volume', 'loop', 'mute', 'time', 'stop'], vital: ['storage'] },
  wait_bgmovie: { params: ['stop'], vital: [] },
  stop_bgmovie: { params: ['time', 'wait'], vital: [] },
  anim:       { params: ['name', 'layer', 'left', 'top', 'width', 'height', 'opacity', 'color', 'time', 'effect'], vital: [] },
  stopanim:   { params: ['name'], vital: ['name'] },
  keyframe:   { params: ['name'], vital: ['name'] },
  kanim:      { params: ['name', 'layer', 'keyframe'], vital: ['keyframe'] },
  stop_kanim: { params: ['name', 'layer'], vital: [] },
  xanim:      { params: ['name', 'layer', 'keyframe', 'easing', 'count', 'delay', 'direction', 'mode', 'reset', 'time', 'svg', 'svg_x', 'svg_y', 'svg_rotate', 'next', 'wait'], vital: [] },
  stop_xanim: { params: ['name', 'layer', 'complete'], vital: [] },
  chara_config: { params: ['pos_mode', 'effect', 'ptext', 'time', 'memory', 'anim', 'pos_change_time', 'talk_focus', 'brightness_value', 'blur_value', 'talk_anim', 'talk_anim_time', 'talk_anim_value', 'talk_anim_zoom_rate', 'plus_lighter'], vital: [] },
  chara_new:  { params: ['name', 'storage', 'width', 'height', 'reflect', 'jname', 'color', 'map_face', 'fuki', 'is_show'], vital: ['name', 'storage'] },
  chara_show: { params: ['name', 'page', 'layer', 'wait', 'left', 'top', 'width', 'height', 'zindex', 'depth', 'reflect', 'face', 'storage', 'time'], vital: ['name'] },
  chara_hide: { params: ['name', 'page', 'layer', 'wait', 'pos_mode', 'time'], vital: ['name'] },
  chara_hide_all: { params: ['page', 'layer', 'wait', 'time'], vital: [] },
  chara_delete: { params: ['name'], vital: ['name'] },
  chara_mod:  { params: ['name', 'face', 'reflect', 'storage', 'time', 'cross', 'wait', 'next'], vital: ['name'] },
  chara_move: { params: ['name', 'time', 'anim', 'left', 'top', 'width', 'height', 'effect', 'wait'], vital: ['name'] },
  chara_face: { params: ['name', 'face', 'storage'], vital: ['name', 'face', 'storage'] },
  chara_layer: { params: ['name', 'part', 'id', 'storage', 'zindex'], vital: ['name', 'part', 'id'] },
  chara_layer_mod: { params: ['name', 'part', 'zindex'], vital: ['name', 'part'] },
  chara_part: { params: ['name', 'allow_storage', 'time', 'wait', 'force'], vital: ['name'] },
  chara_part_reset: { params: ['name', 'part'], vital: ['name'] },
  chara_ptext: { params: ['name', 'face'], vital: [] },
  filter:     { params: ['layer', 'page', 'name', 'grayscale', 'sepia', 'saturate', 'hue', 'invert', 'opacity', 'brightness', 'contrast', 'blur'], vital: [] },
  free_filter: { params: ['layer', 'page', 'name'], vital: [] },
  position_filter: { params: ['layer', 'page', 'remove', 'grayscale', 'sepia', 'saturate', 'hue', 'invert', 'opacity', 'brightness', 'contrast', 'blur'], vital: [] },
  web:        { params: ['url'], vital: ['url'] },
  autoconfig: { params: ['speed', 'clickstop'], vital: [] },
  showmenubutton: { params: ['keyfocus'], vital: [] },
  autostop:   { params: ['next'], vital: [] },

  // ── kag.tag_audio.js ──
  playbgm:    { params: ['storage', 'loop', 'fadein', 'time', 'volume', 'buf', 'target', 'sprite_time', 'pause', 'seek', 'html5', 'click', 'stop', 'base64'], vital: ['storage'] },
  stopbgm:    { params: ['fadeout', 'time', 'target', 'buf', 'buf_all', 'stop'], vital: [] },
  fadeinbgm:  { params: ['storage', 'loop', 'fadein', 'sprite_time', 'html5', 'time', 'pause', 'seek'], vital: ['storage'] },
  fadeoutbgm: { params: ['loop', 'storage', 'fadeout', 'time'], vital: [] },
  xchgbgm:    { params: ['storage', 'loop', 'fadein', 'fadeout', 'time', 'buf'], vital: ['storage'] },
  playse:     { params: ['storage', 'target', 'volume', 'loop', 'buf', 'sprite_time', 'html5', 'clear'], vital: ['storage'] },
  stopse:     { params: ['storage', 'fadeout', 'time', 'buf', 'target'], vital: [] },
  fadeinse:   { params: ['storage', 'target', 'loop', 'volume', 'fadein', 'buf', 'sprite_time', 'html5', 'time'], vital: ['storage', 'time'] },
  fadeoutse:  { params: ['storage', 'target', 'loop', 'buf', 'fadeout'], vital: [] },
  bgmopt:     { params: ['volume', 'effect', 'buf', 'tag_volume', 'next', 'time', 'samebgm_restart'], vital: [] },
  seopt:      { params: ['volume', 'effect', 'buf', 'tag_volume', 'next'], vital: [] },
  changevol:  { params: ['target', 'volume', 'buf', 'time', 'next'], vital: [] },
  pausebgm:   { params: ['target', 'buf', 'next'], vital: [] },
  resumebgm:  { params: ['target', 'buf', 'next'], vital: [] },
  pausese:    { params: ['target', 'buf', 'next'], vital: [] },
  resumese:   { params: ['target', 'buf', 'next'], vital: [] },
  voconfig:   { params: ['sebuf', 'name', 'vostorage', 'number', 'waittime', 'preload'], vital: [] },
  popopo:     { params: ['volume', 'time', 'tailtime', 'frequency', 'octave', 'type', 'mode', 'buf', 'storage', 'samplerate', 'chara', 'noplaychars', 'interval'], vital: [] },
  speak_on:   { params: ['volume', 'pitch', 'rate', 'cancel'], vital: [] },
  speak_off:  { params: ['volume'], vital: [] },

  // ── kag.tag_system.js ──
  eval:       { params: ['exp', 'next'], vital: ['exp'] },
  clearvar:   { params: ['exp'], vital: [] },
  clearstack: { params: ['stack'], vital: [] },
  close:      { params: ['ask'], vital: [] },
  trace:      { params: ['exp'], vital: [] },
  body:       { params: ['bgimage', 'bgrepeat', 'bgcolor', 'bgcover', 'scWidth', 'scHeight'], vital: [] },
  title:      { params: ['name'], vital: ['name'] },
  emb:        { params: ['exp'], vital: ['exp'] },
  if:         { params: ['exp'], vital: ['exp'] },
  elsif:      { params: ['exp'], vital: ['exp'] },
  call:       { params: ['storage', 'target', 'countpage', 'auto_next'], vital: [] },
  macro:      { params: ['name'], vital: ['name'] },
  erasemacro: { params: ['name'], vital: ['name'] },
  savesnap:   { params: ['title'], vital: ['title'] },
  autosave:   { params: ['title'], vital: [] },
  autoload:   { params: ['title'], vital: [] },
  checkpoint: { params: ['name'], vital: ['name'] },
  rollback:   { params: ['checkpoint', 'variable_over', 'bgm_over'], vital: ['checkpoint'] },
  clear_checkpoint: { params: ['name'], vital: [] },
  ignore:     { params: ['exp'], vital: ['exp'] },
  edit:       { params: ['name', 'length', 'initial', 'placeholder', 'color', 'left', 'top', 'size', 'face', 'width', 'autocomplete', 'height', 'maxchars'], vital: ['name'] },
  preload:    { params: ['storage', 'wait', 'single_use', 'name'], vital: ['storage'] },
  clearfix:   { params: ['name'], vital: [] },
  cursor:     { params: ['storage', 'x', 'y', 'type', 'click_effect', 'mousedown_effect', 'touch_effect', 'next'], vital: [] },
  sleepgame:  { params: ['storage', 'target', 'next'], vital: [] },
  awakegame:  { params: ['variable_over', 'sound_opt_over', 'bgm_over'], vital: [] },
  dialog:     { params: ['name', 'type', 'text', 'storage', 'target', 'storage_cancel', 'target_cancel', 'label_ok', 'label_cancel'], vital: [] },
  plugin:     { params: ['name', 'storage'], vital: ['name'] },
  sysview:    { params: ['type', 'storage'], vital: ['type', 'storage'] },
  loadcss:    { params: ['file'], vital: ['file'] },
  save_img:   { params: ['storage', 'folder'], vital: [] },
  html:       { params: ['layer', 'top', 'left'], vital: [] },

  // ── kag.tag_camera.js ──
  camera:     { params: ['time', 'from_x', 'from_y', 'from_zoom', 'from_rotate', 'x', 'y', 'zoom', 'rotate', 'layer', 'wait', 'ease_type'], vital: [] },
  reset_camera: { params: ['time', 'wait', 'ease_type', 'layer'], vital: [] },
  mask_already_in_tag_js: { params: [], vital: [] }, // mask/mask_off already listed above

  // ── kag.tag_ar.js ──
  bgcamera:   { params: ['name', 'wait', 'time', 'fit', 'width', 'height', 'left', 'top', 'qrcode', 'debug', 'mode', 'stop', 'audio', 'mute'], vital: [] },
  stop_bgcamera: { params: ['time', 'wait'], vital: [] },
  qr_config:  { params: ['qrcode'], vital: [] },
  qr_define:  { params: ['url', 'storage', 'target', 'clear'], vital: ['url'] },

  // ── kag.tag_vchat.js ──
  vchat_config: { params: ['chara_name_color'], vital: [] },
  vchat_chara: { params: ['name', 'color'], vital: ['name'] },

  // ── kag.tag_three.js ──
  '3d_init':  { params: ['layer', 'page', 'camera', 'near', 'far', 'material_type', 'ambient_light', 'directional_light', 'encoding', 'antialias', 'studio', 'fps_rate', 'stats', 'background', 'debug_pos', 'xr', 'next'], vital: [] },
  '3d_model_new': { params: ['name', 'storage', 'pos', 'rot', 'scale', 'tonemap', 'motion', 'next', 'folder', 'cache', 'update'], vital: ['name', 'storage'] },
  '3d_show':  { params: ['name', 'group', 'group_uuid', 'time', 'scene_add', 'scale', 'pos', 'rot', 'force_sprite', 'wait', 'collision', 'opacity', 'visible'], vital: ['name'] },
  '3d_hide':  { params: ['name', 'time', 'next', 'wait'], vital: ['name'] },
  '3d_hide_all': { params: ['time', 'wait'], vital: [] },
  '3d_delete': { params: ['name', 'scene', 'next'], vital: ['name'] },
  '3d_delete_all': { params: [], vital: [] },
  '3d_anim':  { params: ['name', 'time', 'effect', 'pos', 'rot', 'scale', 'walk', 'lookat', 'callback', 'relative', 'loop', 'direction', 'wait', 'next'], vital: ['name'] },
  '3d_anim_stop': { params: ['name', 'next'], vital: ['name'] },
  '3d_scene': { params: ['tonemap', 'tonemap_value', 'light_amb', 'fog', 'fog_range', 'fog_color', 'next'], vital: [] },
  '3d_camera': { params: ['pos', 'rot', 'lookat', 'next'], vital: [] },
  '3d_model_mod': { params: ['name', 'type', 'scale', 'pos', 'rot', 'next'], vital: ['name'] },
  '3d_sprite_new': { params: ['name', 'storage', 'scale', 'pos', 'rot', 'tonemap', 'next', 'folder'], vital: ['name', 'storage'] },
  '3d_sprite_mod': { params: ['name', 'jname', 'type', 'texture', 'texture_repeat', 'storage', 'texture_reload', 'scale', 'pos', 'rot', 'width', 'height', 'depth', 'next'], vital: ['name'] },
  '3d_box_new': { params: ['name', 'type', 'texture', 'color', 'width', 'height', 'depth', 'scale', 'pos', 'rot', 'folder'], vital: ['name'] },
  '3d_cylinder_new': { params: ['name', 'type', 'texture', 'color', 'width', 'height', 'segment', 'side', 'scale', 'pos', 'rot', 'folder'], vital: ['name'] },
  '3d_sphere_new': { params: ['name', 'type', 'texture', 'color', 'radius', 'width', 'height', 'side', 'scale', 'pos', 'rot', 'folder'], vital: ['name'] },
  '3d_image_new': { params: ['name', 'type', 'texture', 'texture_repeat', 'width', 'height', 'width_vertical', 'width_seg', 'height_seg', 'scale', 'pos', 'rot', 'doubleside', 'tonemap'], vital: ['name', 'width'] },
  '3d_video_play': { params: ['name', 'texture', 'scale', 'pos', 'rot', 'auto', 'loop', 'next'], vital: ['name'] },
  '3d_event': { params: ['name', 'type', 'exp', 'storage', 'target', 'distance', 'ground', 'mode'], vital: ['name'] },
  '3d_event_delete': { params: ['name'], vital: ['name'] },
  '3d_clone': { params: ['name', 'time', 'scale', 'pos', 'rot'], vital: ['name'] },
  '3d_canvas_show': { params: ['time'], vital: [] },
  '3d_canvas_hide': { params: ['time'], vital: [] },
  '3d_gyro':  { params: ['max_x', 'max_y', 'mode', 'next'], vital: [] },
  'obj_model_new': { params: ['name', 'type', 'texture', 'texture_repeat', 'color', 'arg1', 'arg2', 'arg3', 'arg4', 'update', 'scale', 'pos', 'rot', 'side', 'doubleside', 'tonemap', 'material_type', 'user_data', 'motion', 'opacity', 'folder', 'next'], vital: ['name', 'type'] },
  'obj_model_mod': { params: ['name', 'jname', 'type', 'texture', 'texture_repeat', 'side', 'doubleside', 'storage', 'folder', 'texture_reload', 'scale', 'pos', 'rot', 'width', 'height', 'depth', 'color', 'visible', 'next'], vital: ['name'] },
};

// Remove placeholder entry
delete (SOURCE_TAGS as any)['mask_already_in_tag_js'];

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('TAG_DATABASE structural integrity', () => {
  it('should have at least 150 tags', () => {
    expect(TAG_DATABASE.size).toBeGreaterThanOrEqual(150);
  });

  it('every tag should have a non-empty name', () => {
    for (const [key, tag] of TAG_DATABASE) {
      expect(key).toBe(tag.name);
      expect(tag.name.length).toBeGreaterThan(0);
    }
  });

  it('every tag should have a non-empty category', () => {
    for (const [, tag] of TAG_DATABASE) {
      expect(tag.category.length, `${tag.name} missing category`).toBeGreaterThan(0);
    }
  });

  it('every tag should have a non-empty description', () => {
    for (const [, tag] of TAG_DATABASE) {
      expect(tag.description.length, `${tag.name} missing description`).toBeGreaterThan(0);
    }
  });

  it('every param should have valid type', () => {
    const validTypes = ['string', 'number', 'boolean', 'color', 'expression', 'file', 'enum'];
    for (const [, tag] of TAG_DATABASE) {
      for (const param of tag.params) {
        expect(validTypes, `${tag.name}.${param.name} has invalid type "${param.type}"`).toContain(param.type);
      }
    }
  });

  it('every param should have a non-empty name', () => {
    for (const [, tag] of TAG_DATABASE) {
      for (const param of tag.params) {
        expect(param.name.length, `${tag.name} has empty param name`).toBeGreaterThan(0);
      }
    }
  });

  it('every param should have a non-empty description', () => {
    for (const [, tag] of TAG_DATABASE) {
      for (const param of tag.params) {
        expect(param.description.length, `${tag.name}.${param.name} missing description`).toBeGreaterThan(0);
      }
    }
  });

  it('enum params should have enumValues', () => {
    for (const [, tag] of TAG_DATABASE) {
      for (const param of tag.params) {
        if (param.type === 'enum') {
          expect(param.enumValues, `${tag.name}.${param.name} is enum but has no enumValues`).toBeDefined();
          expect(param.enumValues!.length, `${tag.name}.${param.name} has empty enumValues`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('no duplicate param names within a tag', () => {
    for (const [, tag] of TAG_DATABASE) {
      const names = tag.params.map(p => p.name);
      const unique = new Set(names);
      expect(names.length, `${tag.name} has duplicate params: ${names.filter((n, i) => names.indexOf(n) !== i).join(', ')}`).toBe(unique.size);
    }
  });
});

describe('TAG_DATABASE vs engine source: tag existence', () => {
  const sourceTagNames = Object.keys(SOURCE_TAGS);

  for (const tagName of sourceTagNames) {
    it(`tag "${tagName}" should exist in database`, () => {
      expect(TAG_DATABASE.has(tagName), `Missing tag: ${tagName}`).toBe(true);
    });
  }
});

describe('TAG_DATABASE vs engine source: parameter coverage', () => {
  for (const [tagName, source] of Object.entries(SOURCE_TAGS)) {
    if (source.params.length === 0) continue;

    it(`[${tagName}] should have all source parameters`, () => {
      const dbTag = TAG_DATABASE.get(tagName);
      if (!dbTag) return; // existence tested separately

      const dbParamNames = new Set(dbTag.params.map(p => p.name));
      const missing: string[] = [];

      for (const srcParam of source.params) {
        if (!dbParamNames.has(srcParam)) {
          missing.push(srcParam);
        }
      }

      expect(missing, `[${tagName}] missing params: ${missing.join(', ')}`).toEqual([]);
    });
  }
});

describe('TAG_DATABASE vs engine source: vital/required', () => {
  for (const [tagName, source] of Object.entries(SOURCE_TAGS)) {
    if (source.vital.length === 0) continue;

    it(`[${tagName}] vital params should be required`, () => {
      const dbTag = TAG_DATABASE.get(tagName);
      if (!dbTag) return;

      for (const vitalParam of source.vital) {
        const dbParam = dbTag.params.find(p => p.name === vitalParam);
        if (dbParam) {
          expect(dbParam.required, `[${tagName}].${vitalParam} should be required (vital in source)`).toBe(true);
        }
      }
    });
  }

  // Check that params NOT vital in source are NOT required (prevents false-required)
  for (const [tagName, source] of Object.entries(SOURCE_TAGS)) {
    it(`[${tagName}] non-vital params should not be required`, () => {
      const dbTag = TAG_DATABASE.get(tagName);
      if (!dbTag) return;

      for (const dbParam of dbTag.params) {
        // Skip params not in source (extension-added like 'cond')
        if (!source.params.includes(dbParam.name)) continue;
        // Skip vital params
        if (source.vital.includes(dbParam.name)) continue;

        expect(dbParam.required, `[${tagName}].${dbParam.name} is required but NOT vital in source`).toBe(false);
      }
    });
  }
});

// ════════════════════════════════════════════════════════════════════
// Scanner tests
// ════════════════════════════════════════════════════════════════════

import { Scanner } from '../src/parser/scanner';

describe('Scanner: basic tokenization', () => {
  it('should tokenize a simple tag', () => {
    const tokens = new Scanner('[jump target="*start"]').scan();
    const types = tokens.map(t => t.type);
    expect(types).toContain('TAG_OPEN');
    expect(types).toContain('TAG_NAME');
    expect(types).toContain('ATTR_NAME');
    expect(types).toContain('ATTR_EQUALS');
    expect(types).toContain('ATTR_VALUE');
    expect(types).toContain('TAG_CLOSE');
    expect(types).toContain('EOF');

    const nameToken = tokens.find(t => t.type === 'TAG_NAME');
    expect(nameToken?.value).toBe('jump');
  });

  it('should tokenize @ shorthand', () => {
    const tokens = new Scanner('@jump target=*start').scan();
    const nameToken = tokens.find(t => t.type === 'TAG_NAME');
    expect(nameToken?.value).toBe('jump');
  });

  it('should tokenize labels', () => {
    const tokens = new Scanner('*start').scan();
    const label = tokens.find(t => t.type === 'LABEL');
    expect(label?.value).toBe('start');
  });

  it('should tokenize comments', () => {
    const tokens = new Scanner(';this is a comment').scan();
    const comment = tokens.find(t => t.type === 'COMMENT');
    expect(comment?.value).toBe(';this is a comment');
  });

  it('should tokenize plain text', () => {
    const tokens = new Scanner('Hello world').scan();
    const text = tokens.find(t => t.type === 'TEXT');
    expect(text?.value).toBe('Hello world');
  });

  it('should tokenize speaker name tag [#name]', () => {
    const tokens = new Scanner('[#sakura]').scan();
    const nameToken = tokens.find(t => t.type === 'TAG_NAME');
    expect(nameToken?.value).toBe('#sakura');
  });

  it('should tokenize speaker clear tag [#]', () => {
    const tokens = new Scanner('[#]').scan();
    const nameToken = tokens.find(t => t.type === 'TAG_NAME');
    expect(nameToken?.value).toBe('#');
  });

  it('should tokenize closing tags [/ruby]', () => {
    const tokens = new Scanner('[/ruby]').scan();
    const nameToken = tokens.find(t => t.type === 'TAG_NAME');
    expect(nameToken?.value).toBe('/ruby');
  });

  it('should tokenize multiple tags on one line', () => {
    const tokens = new Scanner('[l][r]').scan();
    const tagNames = tokens.filter(t => t.type === 'TAG_NAME').map(t => t.value);
    expect(tagNames).toEqual(['l', 'r']);
  });

  it('should handle unquoted attribute values', () => {
    const tokens = new Scanner('[bg storage=sky.jpg time=1000]').scan();
    const values = tokens.filter(t => t.type === 'ATTR_VALUE').map(t => t.value);
    expect(values).toContain('sky.jpg');
    expect(values).toContain('1000');
  });

  it('should handle single-quoted attribute values', () => {
    const tokens = new Scanner("[eval exp='f.x = 1']").scan();
    const val = tokens.find(t => t.type === 'ATTR_VALUE');
    expect(val?.value).toBe('f.x = 1');
  });

  it('should handle double-quoted attribute values with escape', () => {
    const tokens = new Scanner('[eval exp="f.x = \\"hello\\""]').scan();
    const val = tokens.find(t => t.type === 'ATTR_VALUE');
    expect(val?.value).toContain('hello');
  });

  it('should handle attributes with dots and dashes', () => {
    const tokens = new Scanner('[tag data-id=123 my.attr=val]').scan();
    const attrNames = tokens.filter(t => t.type === 'ATTR_NAME').map(t => t.value);
    expect(attrNames).toContain('data-id');
    expect(attrNames).toContain('my.attr');
  });
});

// ════════════════════════════════════════════════════════════════════
// Parser tests
// ════════════════════════════════════════════════════════════════════

import { Parser } from '../src/parser/parser';

describe('Parser: AST generation', () => {
  const parser = new Parser('test.ks');

  it('should parse a simple tag', () => {
    const result = parser.parse('[jump target="*end"]');
    const tag = result.nodes.find(n => n.type === 'tag');
    expect(tag).toBeDefined();
    if (tag?.type === 'tag') {
      expect(tag.name).toBe('jump');
      expect(tag.attributes.find(a => a.name === 'target')?.value).toBe('*end');
    }
  });

  it('should parse labels', () => {
    const result = parser.parse('*myLabel');
    expect(result.labels.has('myLabel')).toBe(true);
  });

  it('should parse comments', () => {
    const result = parser.parse(';a comment');
    const comment = result.nodes.find(n => n.type === 'comment');
    expect(comment).toBeDefined();
  });

  it('should parse text', () => {
    const result = parser.parse('Hello world');
    const text = result.nodes.find(n => n.type === 'text');
    expect(text).toBeDefined();
    if (text?.type === 'text') {
      expect(text.content).toBe('Hello world');
    }
  });

  it('should parse [iscript]...[endscript] block', () => {
    const result = parser.parse('[iscript]\nvar x = 1;\n[endscript]');
    const node = result.nodes.find(n => n.type === 'iscript');
    expect(node).toBeDefined();
    if (node?.type === 'iscript') {
      expect(node.scriptContent).toContain('var x = 1');
    }
  });

  it('should parse [html]...[endhtml] block', () => {
    const result = parser.parse('[html]\n<div>hello</div>\n[endhtml]');
    const node = result.nodes.find(n => n.type === 'html');
    expect(node).toBeDefined();
    if (node?.type === 'html') {
      expect(node.htmlContent).toContain('<div>hello</div>');
    }
  });

  it('should parse [macro]...[endmacro] and register it', () => {
    const result = parser.parse('[macro name="mymacro"]\n[jump target="*end"]\n[endmacro]');
    expect(result.macros.has('mymacro')).toBe(true);
    const macro = result.macros.get('mymacro');
    expect(macro?.body.length).toBeGreaterThan(0);
  });

  it('should parse [if]...[elsif]...[else]...[endif] block', () => {
    const result = parser.parse('[if exp="f.x==1"]\nA\n[elsif exp="f.x==2"]\nB\n[else]\nC\n[endif]');
    const ifBlock = result.nodes.find(n => n.type === 'if_block');
    expect(ifBlock).toBeDefined();
    if (ifBlock?.type === 'if_block') {
      expect(ifBlock.condition).toBe('f.x==1');
      expect(ifBlock.thenBranch.length).toBeGreaterThan(0);
      expect(ifBlock.elsifBranches.length).toBe(1);
      expect(ifBlock.elseBranch).not.toBeNull();
    }
  });

  it('should parse @ tag shorthand', () => {
    const result = parser.parse('@jump target=*end');
    const tag = result.nodes.find(n => n.type === 'tag');
    expect(tag).toBeDefined();
    if (tag?.type === 'tag') {
      expect(tag.name).toBe('jump');
    }
  });

  it('should not produce errors for valid syntax', () => {
    const result = parser.parse([
      '*start',
      ';comment',
      '[bg storage="room.jpg" time=1000]',
      '[chara_show name="sakura" left=300]',
      '[#sakura]',
      'Hello, this is a test.[l][r]',
      'Second line.[p]',
      '[cm]',
      '@jump target=*start',
    ].join('\n'));
    expect(result.errors).toEqual([]);
  });
});

describe('Parser: test-game .ks file parsing', () => {
  const fs = require('fs');
  const path = require('path');
  const scenarioDir = path.resolve(__dirname, '../../test-game/data/scenario');

  let ksFiles: string[] = [];
  try {
    ksFiles = fs.readdirSync(scenarioDir)
      .filter((f: string) => f.endsWith('.ks'))
      .map((f: string) => path.join(scenarioDir, f));
  } catch {
    // Directory may not exist in CI
  }

  for (const file of ksFiles) {
    const basename = path.basename(file);
    it(`should parse ${basename} without errors`, () => {
      const source = fs.readFileSync(file, 'utf-8');
      const parser = new Parser(basename);
      const result = parser.parse(source);
      expect(result.errors, `Parse errors in ${basename}: ${result.errors.map(e => e.message).join('; ')}`).toEqual([]);
    });
  }
});
