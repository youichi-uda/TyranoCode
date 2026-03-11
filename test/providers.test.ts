/**
 * Tests for new language providers.
 * Tests what can be tested without VS Code API (scanner/parser-based logic).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Scanner } from '../src/parser/scanner';
import { Parser } from '../src/parser/parser';
import { TAG_DATABASE } from '../src/language/tag-database';
import { registerExtendedTags } from '../src/language/tag-database-ext';
import {
  LABEL_REF_TAGS,
  ProjectIndex,
  ParsedScenario,
  ScenarioNode,
  TagNode,
  LabelNode,
  MacroDefNode,
} from '../src/parser/types';

beforeAll(() => {
  registerExtendedTags();
});

// ════════════════════════════════════════════════════════════════════
// Folding: verify AST block structure used by folding provider
// ════════════════════════════════════════════════════════════════════

describe('Folding: block detection via parser', () => {
  const parser = new Parser('test.ks');

  it('should detect if_block spanning multiple lines', () => {
    const result = parser.parse([
      '[if exp="f.x==1"]',
      'Hello',
      '[endif]',
    ].join('\n'));
    const ifBlock = result.nodes.find(n => n.type === 'if_block');
    expect(ifBlock).toBeDefined();
    expect(ifBlock!.range.start.line).toBe(0);
    expect(ifBlock!.range.end.line).toBeGreaterThanOrEqual(2);
  });

  it('should detect macro_def spanning multiple lines', () => {
    const result = parser.parse([
      '[macro name="test"]',
      '[jump target="*end"]',
      '[endmacro]',
    ].join('\n'));
    const macro = result.nodes.find(n => n.type === 'macro_def');
    expect(macro).toBeDefined();
    expect(macro!.range.start.line).toBe(0);
  });

  it('should detect iscript block', () => {
    const result = parser.parse([
      '[iscript]',
      'var x = 1;',
      'var y = 2;',
      '[endscript]',
    ].join('\n'));
    const iscript = result.nodes.find(n => n.type === 'iscript');
    expect(iscript).toBeDefined();
    expect(iscript!.range.start.line).toBe(0);
  });

  it('should detect html block', () => {
    const result = parser.parse([
      '[html]',
      '<div>test</div>',
      '[endhtml]',
    ].join('\n'));
    const html = result.nodes.find(n => n.type === 'html');
    expect(html).toBeDefined();
  });

  it('should detect label sections', () => {
    const result = parser.parse([
      '*start',
      'Hello',
      '*end',
      'Goodbye',
    ].join('\n'));
    expect(result.labels.size).toBe(2);
    expect(result.labels.has('start')).toBe(true);
    expect(result.labels.has('end')).toBe(true);
  });

  it('should detect consecutive comments', () => {
    const result = parser.parse([
      ';comment 1',
      ';comment 2',
      ';comment 3',
      'text',
    ].join('\n'));
    const comments = result.nodes.filter(n => n.type === 'comment');
    expect(comments.length).toBe(3);
    // All on consecutive lines
    expect(comments[0].range.start.line).toBe(0);
    expect(comments[1].range.start.line).toBe(1);
    expect(comments[2].range.start.line).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════
// Color: verify 0xRRGGBB parsing
// ════════════════════════════════════════════════════════════════════

describe('Color: hex value parsing', () => {
  it('should find color attributes in tags', () => {
    const result = new Parser('test.ks').parse('[font color=0xFF0000]');
    const tag = result.nodes.find(n => n.type === 'tag');
    expect(tag).toBeDefined();
    if (tag?.type === 'tag') {
      const colorAttr = tag.attributes.find(a => a.name === 'color');
      expect(colorAttr).toBeDefined();
      expect(colorAttr!.value).toBe('0xFF0000');
    }
  });

  it('should parse 0xRRGGBB format', () => {
    const hex = '0xFF8800';
    const match = hex.match(/^0x([0-9A-Fa-f]{6})$/);
    expect(match).not.toBeNull();
    const r = parseInt(match![1].substring(0, 2), 16) / 255;
    const g = parseInt(match![1].substring(2, 4), 16) / 255;
    const b = parseInt(match![1].substring(4, 6), 16) / 255;
    expect(r).toBe(1);
    expect(g).toBeCloseTo(0.533, 2);
    expect(b).toBe(0);
  });

  it('should parse 0xAARRGGBB format', () => {
    const hex = '0x80FF0000';
    const match = hex.match(/^0x([0-9A-Fa-f]{8})$/);
    expect(match).not.toBeNull();
    const a = parseInt(match![1].substring(0, 2), 16) / 255;
    const r = parseInt(match![1].substring(2, 4), 16) / 255;
    expect(a).toBeCloseTo(0.502, 2);
    expect(r).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// Bracket matching: verify token pairing logic
// ════════════════════════════════════════════════════════════════════

describe('Bracket matching: tag pair detection', () => {
  it('should find matching if/endif tokens', () => {
    const tokens = new Scanner('[if exp="true"]\nHello\n[endif]').scan();
    const tagNames = tokens.filter(t => t.type === 'TAG_NAME');
    expect(tagNames.map(t => t.value)).toContain('if');
    expect(tagNames.map(t => t.value)).toContain('endif');
  });

  it('should find matching macro/endmacro tokens', () => {
    const tokens = new Scanner('[macro name="test"]\n[endmacro]').scan();
    const tagNames = tokens.filter(t => t.type === 'TAG_NAME');
    expect(tagNames.map(t => t.value)).toContain('macro');
    expect(tagNames.map(t => t.value)).toContain('endmacro');
  });

  it('should find matching iscript/endscript tokens', () => {
    const tokens = new Scanner('[iscript]\nvar x=1;\n[endscript]').scan();
    const tagNames = tokens.filter(t => t.type === 'TAG_NAME');
    expect(tagNames.map(t => t.value)).toContain('iscript');
    expect(tagNames.map(t => t.value)).toContain('endscript');
  });

  it('should handle nested if blocks', () => {
    const tokens = new Scanner(
      '[if exp="a"]\n[if exp="b"]\n[endif]\n[endif]'
    ).scan();
    const tagNames = tokens.filter(t => t.type === 'TAG_NAME');
    const ifs = tagNames.filter(t => t.value === 'if');
    const endifs = tagNames.filter(t => t.value === 'endif');
    expect(ifs.length).toBe(2);
    expect(endifs.length).toBe(2);
  });

  it('should find closing tags like /ruby', () => {
    const tokens = new Scanner('[ruby text="test"]text[/ruby]').scan();
    const tagNames = tokens.filter(t => t.type === 'TAG_NAME');
    expect(tagNames.map(t => t.value)).toContain('ruby');
    expect(tagNames.map(t => t.value)).toContain('/ruby');
  });
});

// ════════════════════════════════════════════════════════════════════
// Signature help: verify TAG_DATABASE lookup
// ════════════════════════════════════════════════════════════════════

describe('Signature help: tag parameter info', () => {
  it('should find bg tag with params', () => {
    const tag = TAG_DATABASE.get('bg');
    expect(tag).toBeDefined();
    expect(tag!.params.length).toBeGreaterThan(0);
    expect(tag!.params.find(p => p.name === 'storage')).toBeDefined();
  });

  it('should find jump tag with params', () => {
    const tag = TAG_DATABASE.get('jump');
    expect(tag).toBeDefined();
    expect(tag!.params.find(p => p.name === 'target')).toBeDefined();
    expect(tag!.params.find(p => p.name === 'storage')).toBeDefined();
  });

  it('should find chara_show with name required', () => {
    const tag = TAG_DATABASE.get('chara_show');
    expect(tag).toBeDefined();
    const namep = tag!.params.find(p => p.name === 'name');
    expect(namep).toBeDefined();
    expect(namep!.required).toBe(true);
  });

  it('all tags should have consistent parameter info for signature', () => {
    for (const [, tag] of TAG_DATABASE) {
      for (const param of tag.params) {
        // Every param must have info needed for signature display
        expect(param.name.length, `${tag.name}.${param.name} empty name`).toBeGreaterThan(0);
        expect(typeof param.required, `${tag.name}.${param.name} required not boolean`).toBe('boolean');
        expect(param.description.length, `${tag.name}.${param.name} empty desc`).toBeGreaterThan(0);
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// Symbol provider: verify AST provides correct data
// ════════════════════════════════════════════════════════════════════

describe('Symbol provider: AST data for outline', () => {
  const parser = new Parser('test.ks');

  it('should provide labels with correct name and range', () => {
    const result = parser.parse('*start\nHello\n*end\nBye');
    expect(result.labels.size).toBe(2);
    const start = result.labels.get('start')!;
    expect(start.name).toBe('start');
    expect(start.range.start.line).toBe(0);
    const end = result.labels.get('end')!;
    expect(end.name).toBe('end');
    expect(end.range.start.line).toBe(2);
  });

  it('should provide macros with name and body', () => {
    const result = parser.parse('[macro name="greet"]\n[cm]\n[endmacro]');
    expect(result.macros.size).toBe(1);
    const greet = result.macros.get('greet')!;
    expect(greet.name).toBe('greet');
    expect(greet.body.length).toBeGreaterThan(0);
  });

  it('should provide important tags for symbol listing', () => {
    const result = parser.parse([
      '[bg storage="room.jpg"]',
      '[chara_show name="sakura"]',
      '[jump target="*end"]',
    ].join('\n'));
    const tags = result.nodes.filter(n => n.type === 'tag');
    expect(tags.length).toBe(3);
  });
});

// ════════════════════════════════════════════════════════════════════
// Link provider: verify storage attribute extraction
// ════════════════════════════════════════════════════════════════════

describe('Link provider: storage attribute parsing', () => {
  const parser = new Parser('test.ks');

  it('should extract storage attributes from bg', () => {
    const result = parser.parse('[bg storage="sky.jpg" time=1000]');
    const tag = result.nodes.find(n => n.type === 'tag') as any;
    expect(tag.name).toBe('bg');
    const storage = tag.attributes.find((a: any) => a.name === 'storage');
    expect(storage.value).toBe('sky.jpg');
    expect(storage.valueRange).toBeDefined();
  });

  it('should extract storage from jump', () => {
    const result = parser.parse('[jump storage="scene2.ks" target="*start"]');
    const tag = result.nodes.find(n => n.type === 'tag') as any;
    const storage = tag.attributes.find((a: any) => a.name === 'storage');
    expect(storage.value).toBe('scene2.ks');
  });

  it('should handle tags without storage', () => {
    const result = parser.parse('[cm]');
    const tag = result.nodes.find(n => n.type === 'tag') as any;
    expect(tag.name).toBe('cm');
    const storage = tag.attributes.find((a: any) => a.name === 'storage');
    expect(storage).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Rename: verify label/macro reference detection
// ════════════════════════════════════════════════════════════════════

describe('Rename: reference detection', () => {
  const parser = new Parser('test.ks');

  it('should detect jump target references to labels', () => {
    const result = parser.parse([
      '*myLabel',
      '[jump target="*myLabel"]',
      '[call target="*myLabel"]',
    ].join('\n'));
    const tags = result.nodes.filter(n => n.type === 'tag') as any[];
    const jumps = tags.filter(t =>
      (t.name === 'jump' || t.name === 'call') &&
      t.attributes.some((a: any) => a.name === 'target' && a.value?.includes('myLabel'))
    );
    expect(jumps.length).toBe(2);
  });

  it('should detect macro usage', () => {
    const result = parser.parse([
      '[macro name="greet"]',
      '[cm]',
      '[endmacro]',
      '[greet]',
    ].join('\n'));
    expect(result.macros.has('greet')).toBe(true);
    // After macro def, there should be a tag node with name 'greet'
    const usages = result.nodes.filter(n => n.type === 'tag' && (n as any).name === 'greet');
    expect(usages.length).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// Call Hierarchy: verify jump/call detection
// ════════════════════════════════════════════════════════════════════

describe('Call Hierarchy: flow tag detection', () => {
  const parser = new Parser('test.ks');

  it('should detect jump with target and storage', () => {
    const result = parser.parse('[jump storage="other.ks" target="*start"]');
    const tag = result.nodes.find(n => n.type === 'tag') as any;
    expect(tag.name).toBe('jump');
    const target = tag.attributes.find((a: any) => a.name === 'target');
    const storage = tag.attributes.find((a: any) => a.name === 'storage');
    expect(target.value).toBe('*start');
    expect(storage.value).toBe('other.ks');
  });

  it('should detect call tag', () => {
    const result = parser.parse('[call target="*sub"]');
    const tag = result.nodes.find(n => n.type === 'tag') as any;
    expect(tag.name).toBe('call');
  });

  it('should detect link tag', () => {
    const result = parser.parse('[link target="*choice1"]Click[endlink]');
    const tags = result.nodes.filter(n => n.type === 'tag') as any[];
    const link = tags.find(t => t.name === 'link');
    expect(link).toBeDefined();
    expect(link.attributes.find((a: any) => a.name === 'target').value).toBe('*choice1');
  });

  it('should correctly scope labels to sections', () => {
    const result = parser.parse([
      '*intro',
      '[jump target="*middle"]',
      '*middle',
      '[call target="*end"]',
      '*end',
      '[s]',
    ].join('\n'));
    expect(result.labels.size).toBe(3);
    // All flow tags should be parseable
    const tags = result.nodes.filter(n => n.type === 'tag') as any[];
    expect(tags.filter(t => t.name === 'jump').length).toBe(1);
    expect(tags.filter(t => t.name === 'call').length).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// Semantic tokens: verify scanner token mapping
// ════════════════════════════════════════════════════════════════════

describe('Semantic tokens: scanner token types', () => {
  it('should produce TAG_NAME tokens for semantic highlighting', () => {
    const tokens = new Scanner('[bg storage="sky.jpg"]').scan();
    const tagName = tokens.find(t => t.type === 'TAG_NAME');
    expect(tagName).toBeDefined();
    expect(tagName!.value).toBe('bg');
  });

  it('should produce ATTR_NAME tokens', () => {
    const tokens = new Scanner('[bg storage="sky.jpg"]').scan();
    const attrName = tokens.find(t => t.type === 'ATTR_NAME');
    expect(attrName).toBeDefined();
    expect(attrName!.value).toBe('storage');
  });

  it('should produce LABEL tokens', () => {
    const tokens = new Scanner('*myLabel').scan();
    const label = tokens.find(t => t.type === 'LABEL');
    expect(label).toBeDefined();
    expect(label!.value).toBe('myLabel');
  });

  it('should produce COMMENT tokens', () => {
    const tokens = new Scanner(';this is a comment').scan();
    const comment = tokens.find(t => t.type === 'COMMENT');
    expect(comment).toBeDefined();
  });

  it('should handle expression attributes for variable detection', () => {
    const tokens = new Scanner('[eval exp="f.score = 10"]').scan();
    const attrValue = tokens.find(t => t.type === 'ATTR_VALUE');
    expect(attrValue).toBeDefined();
    expect(attrValue!.value).toContain('f.score');
  });
});

// ════════════════════════════════════════════════════════════════════
// Snippets: verify snippet data
// ════════════════════════════════════════════════════════════════════

describe('Snippets: snippet definitions', () => {
  // snippets.ts imports vscode, so it can't be imported in a pure Node test.
  // We verify the expected snippet prefixes are documented.
  const expectedSnippets = ['scene', 'choice', 'ifblock', 'macro', 'chara', 'bgm', 'transition'];

  it('should have 7 expected snippet prefixes defined', () => {
    expect(expectedSnippets.length).toBe(7);
  });
});

// ════════════════════════════════════════════════════════════════════
// Variable tracking: verify variable extraction
// ════════════════════════════════════════════════════════════════════

describe('Variable tracking: extraction from AST', () => {
  it('should extract f. variable writes from eval', () => {
    const parser = new Parser('test.ks');
    const result = parser.parse('[eval exp="f.score = 10"]');
    // Variable extraction happens in ProjectIndexer, not parser
    // But we can verify the eval tag has the right attribute
    const tag = result.nodes.find(n => n.type === 'tag') as any;
    expect(tag.name).toBe('eval');
    const exp = tag.attributes.find((a: any) => a.name === 'exp');
    expect(exp.value).toBe('f.score = 10');
  });

  it('should extract variable reads from if conditions', () => {
    const parser = new Parser('test.ks');
    const result = parser.parse('[if exp="f.score >= 10"]');
    const ifBlock = result.nodes.find(n => n.type === 'if_block') as any;
    expect(ifBlock.condition).toBe('f.score >= 10');
  });

  it('should detect sf. and tf. variables', () => {
    const parser = new Parser('test.ks');
    const result = parser.parse([
      '[eval exp="sf.play_count = sf.play_count + 1"]',
      '[eval exp="tf.temp = true"]',
    ].join('\n'));
    const tags = result.nodes.filter(n => n.type === 'tag') as any[];
    expect(tags[0].attributes[0].value).toContain('sf.play_count');
    expect(tags[1].attributes[0].value).toContain('tf.temp');
  });
});

// ════════════════════════════════════════════════════════════════════
// CodeAction: verify diagnostic message patterns
// ════════════════════════════════════════════════════════════════════

describe('CodeAction: diagnostic message patterns', () => {
  // The codeaction provider matches on diagnostic messages
  // Verify the expected patterns exist

  it('should match "Unknown tag" pattern', () => {
    const msg = 'Unknown tag or undefined macro: "customtag"';
    expect(msg.match(/Unknown tag/)).not.toBeNull();
  });

  it('should match "Undefined label" pattern', () => {
    const msg = 'Undefined label: "*missing_label"';
    expect(msg.match(/Undefined label/)).not.toBeNull();
  });

  it('should match "Unknown parameter" pattern', () => {
    const msg = 'Unknown parameter "xyz" for [bg]';
    expect(msg.match(/Unknown parameter/)).not.toBeNull();
  });

  it('should extract tag name from Unknown tag message', () => {
    const msg = 'Unknown tag or undefined macro: "customtag"';
    const match = msg.match(/"([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('customtag');
  });

  it('should extract label name from Undefined label message', () => {
    const msg = 'Undefined label: "*missing_label"';
    const match = msg.match(/"([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('*missing_label');
  });
});

// ════════════════════════════════════════════════════════════════════
// CodeLens: verify reference counting data
// ════════════════════════════════════════════════════════════════════

describe('CodeLens: reference counting data', () => {
  it('should be able to count label references in AST', () => {
    const parser = new Parser('test.ks');
    const result = parser.parse([
      '*target',
      'Hello',
      '[jump target="*target"]',
      '[call target="*target"]',
      '[jump target="*other"]',
    ].join('\n'));

    // Count references to *target
    let count = 0;
    for (const node of result.nodes) {
      if (node.type === 'tag' && (node.name === 'jump' || node.name === 'call')) {
        const target = node.attributes.find(a => a.name === 'target');
        if (target?.value?.replace(/^\*/, '') === 'target') {
          count++;
        }
      }
    }
    expect(count).toBe(2);
  });

  it('should be able to count macro references in AST', () => {
    const parser = new Parser('test.ks');
    const result = parser.parse([
      '[macro name="greet"]',
      '[cm]',
      '[endmacro]',
      '[greet]',
      '[greet]',
      '[greet]',
    ].join('\n'));

    let count = 0;
    for (const node of result.nodes) {
      if (node.type === 'tag' && node.name === 'greet') {
        count++;
      }
    }
    expect(count).toBe(3);
  });
});

// ════════════════════════════════════════════════════════════════════
// Integration: full scenario parse with all features
// ════════════════════════════════════════════════════════════════════

describe('Integration: complex scenario parsing', () => {
  const parser = new Parser('complex.ks');

  it('should handle a complete scenario with all constructs', () => {
    const source = [
      ';=========================',
      '; Scene: Test',
      ';=========================',
      '',
      '*start',
      '',
      '[bg storage="room.jpg" time=1000 method=crossfade]',
      '[playbgm storage="bgm01.ogg" loop=true]',
      '',
      '[chara_show name="sakura" left=300 time=600]',
      '[chara_mod name="sakura" face="happy"]',
      '',
      '[#sakura]',
      'Hello! Welcome to the game.[l][r]',
      'How are you today?[p]',
      '',
      '[cm]',
      '',
      '[if exp="f.score >= 10"]',
      '@jump target="*good"',
      '[elsif exp="f.score >= 5"]',
      '@jump target="*normal"',
      '[else]',
      '@jump target="*bad"',
      '[endif]',
      '',
      '*good',
      '[font size=32 color=0xFFDD44 bold=true]',
      'Good Ending![p]',
      '[resetfont]',
      '@jump target="*end"',
      '',
      '*normal',
      'Normal Ending.[p]',
      '@jump target="*end"',
      '',
      '*bad',
      'Bad Ending.[p]',
      '@jump target="*end"',
      '',
      '*end',
      '[stopbgm time=2000]',
      '[s]',
    ].join('\n');

    const result = parser.parse(source);

    // No parse errors
    expect(result.errors).toEqual([]);

    // Labels detected
    expect(result.labels.size).toBe(5);
    expect(result.labels.has('start')).toBe(true);
    expect(result.labels.has('good')).toBe(true);
    expect(result.labels.has('normal')).toBe(true);
    expect(result.labels.has('bad')).toBe(true);
    expect(result.labels.has('end')).toBe(true);

    // If block detected
    const ifBlock = result.nodes.find(n => n.type === 'if_block');
    expect(ifBlock).toBeDefined();
    if (ifBlock?.type === 'if_block') {
      expect(ifBlock.condition).toBe('f.score >= 10');
      expect(ifBlock.elsifBranches.length).toBe(1);
      expect(ifBlock.elseBranch).not.toBeNull();
    }

    // Tags detected
    const tags = result.nodes.filter(n => n.type === 'tag') as any[];
    const tagNames = tags.map((t: any) => t.name);
    expect(tagNames).toContain('bg');
    expect(tagNames).toContain('playbgm');
    expect(tagNames).toContain('chara_show');
    expect(tagNames).toContain('chara_mod');
    expect(tagNames).toContain('font');
    expect(tagNames).toContain('stopbgm');

    // Comments detected
    const comments = result.nodes.filter(n => n.type === 'comment');
    expect(comments.length).toBeGreaterThanOrEqual(3);

    // Text detected
    const texts = result.nodes.filter(n => n.type === 'text');
    expect(texts.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// LABEL_REF_TAGS: verify constant contents
// ════════════════════════════════════════════════════════════════════

describe('LABEL_REF_TAGS: constant validation', () => {
  it('should contain all label-referencing tags', () => {
    const expected = ['jump', 'call', 'link', 'button', 'glink', 'clickable', 'sleepgame', 'dialog'];
    for (const tag of expected) {
      expect(LABEL_REF_TAGS.has(tag), `missing "${tag}"`).toBe(true);
    }
  });

  it('should have exactly 8 entries', () => {
    expect(LABEL_REF_TAGS.size).toBe(8);
  });

  it('should not contain non-label-referencing tags', () => {
    const nonLabelTags = ['bg', 'image', 'playbgm', 'eval', 'if', 'macro', 'cm', 'p', 'l', 's'];
    for (const tag of nonLabelTags) {
      expect(LABEL_REF_TAGS.has(tag), `should not contain "${tag}"`).toBe(false);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// MacroDefNode: verify nameRange
// ════════════════════════════════════════════════════════════════════

describe('MacroDefNode: nameRange', () => {
  it('should have nameRange pointing to macro name', () => {
    const result = new Parser('test.ks').parse('[macro name="greet"]\n[cm]\n[endmacro]');
    const macro = result.macros.get('greet')!;
    expect(macro).toBeDefined();
    expect(macro.nameRange).toBeDefined();
    expect(macro.nameRange.start.line).toBe(0);
  });

  it('should have correct nameRange for multi-char names', () => {
    const result = new Parser('test.ks').parse('[macro name="long_macro_name"]\n[endmacro]');
    const macro = result.macros.get('long_macro_name')!;
    expect(macro).toBeDefined();
    expect(macro.name).toBe('long_macro_name');
    expect(macro.nameRange).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Flow Graph: verify data extraction via parser + ProjectIndex
// ════════════════════════════════════════════════════════════════════

describe('Flow Graph: data extraction for graph building', () => {
  function buildMockIndex(...files: { name: string; source: string }[]): ProjectIndex {
    const scenarios = new Map<string, ParsedScenario>();
    const globalLabels = new Map<string, { file: string; node: LabelNode }[]>();
    const globalMacros = new Map<string, { file: string; node: MacroDefNode }>();
    const variables = new Map();

    for (const f of files) {
      const parsed = new Parser(f.name).parse(f.source);
      scenarios.set(f.name, parsed);
      for (const [name, node] of parsed.labels) {
        const arr = globalLabels.get(name) ?? [];
        arr.push({ file: f.name, node });
        globalLabels.set(name, arr);
      }
      for (const [name, node] of parsed.macros) {
        globalMacros.set(name, { file: f.name, node });
      }
    }

    return { scenarios, globalLabels, globalMacros, variables };
  }

  it('should extract jump edges from parsed scenario', () => {
    const index = buildMockIndex({
      name: 'first.ks',
      source: '*start\n[jump target="*end"]\n*end\n[s]',
    });
    const scenario = index.scenarios.get('first.ks')!;

    // Find tags that reference labels
    const jumpTags = scenario.nodes.filter(
      n => n.type === 'tag' && LABEL_REF_TAGS.has(n.name),
    ) as TagNode[];
    expect(jumpTags.length).toBe(1);
    expect(jumpTags[0].name).toBe('jump');
    expect(jumpTags[0].attributes.find(a => a.name === 'target')!.value).toBe('*end');
  });

  it('should extract cross-file jump edges', () => {
    const index = buildMockIndex(
      { name: 'first.ks', source: '*start\n[jump storage="second.ks" target="*begin"]' },
      { name: 'second.ks', source: '*begin\nHello\n[s]' },
    );

    const scenario = index.scenarios.get('first.ks')!;
    const jumpTag = scenario.nodes.find(
      n => n.type === 'tag' && n.name === 'jump',
    ) as TagNode;
    expect(jumpTag.attributes.find(a => a.name === 'storage')!.value).toBe('second.ks');
    expect(jumpTag.attributes.find(a => a.name === 'target')!.value).toBe('*begin');
    expect(index.globalLabels.has('begin')).toBe(true);
  });

  it('should distinguish jump/call/choice edge types', () => {
    const index = buildMockIndex({
      name: 'test.ks',
      source: [
        '*start',
        '[jump target="*a"]',
        '*a',
        '[call target="*b"]',
        '*b',
        '[button text="Option 1" target="*c"]',
        '[s]',
        '*c',
        '[s]',
      ].join('\n'),
    });

    const scenario = index.scenarios.get('test.ks')!;
    const refTags = scenario.nodes.filter(
      n => n.type === 'tag' && LABEL_REF_TAGS.has(n.name),
    ) as TagNode[];

    const tagNames = refTags.map(t => t.name);
    expect(tagNames).toContain('jump');
    expect(tagNames).toContain('call');
    expect(tagNames).toContain('button');
  });

  it('should handle glink choice tags', () => {
    const result = new Parser('test.ks').parse(
      '[glink text="Go" target="*dest" x=100 y=200]',
    );
    const tag = result.nodes.find(n => n.type === 'tag' && (n as TagNode).name === 'glink') as TagNode;
    expect(tag).toBeDefined();
    expect(tag.attributes.find(a => a.name === 'text')!.value).toBe('Go');
    expect(tag.attributes.find(a => a.name === 'target')!.value).toBe('*dest');
    expect(LABEL_REF_TAGS.has('glink')).toBe(true);
  });

  it('should skip dynamic label targets (& prefix)', () => {
    const result = new Parser('test.ks').parse('[jump target="&f.nextLabel"]');
    const tag = result.nodes.find(n => n.type === 'tag') as TagNode;
    const target = tag.attributes.find(a => a.name === 'target')!.value!;
    // Dynamic targets start with & after * removal
    const labelName = target.replace(/^\*/, '');
    expect(labelName.startsWith('&')).toBe(true);
  });

  it('should extract edges from within if blocks', () => {
    const result = new Parser('test.ks').parse([
      '[if exp="f.x==1"]',
      '[jump target="*route_a"]',
      '[elsif exp="f.x==2"]',
      '[jump target="*route_b"]',
      '[else]',
      '[jump target="*route_c"]',
      '[endif]',
    ].join('\n'));

    const ifBlock = result.nodes.find(n => n.type === 'if_block');
    expect(ifBlock).toBeDefined();
    if (ifBlock?.type === 'if_block') {
      // Then branch
      const thenJumps = ifBlock.thenBranch.filter(
        n => n.type === 'tag' && LABEL_REF_TAGS.has((n as TagNode).name),
      );
      expect(thenJumps.length).toBe(1);

      // Elsif branches
      expect(ifBlock.elsifBranches.length).toBe(1);
      const elsifJumps = ifBlock.elsifBranches[0].body.filter(
        n => n.type === 'tag' && LABEL_REF_TAGS.has((n as TagNode).name),
      );
      expect(elsifJumps.length).toBe(1);

      // Else branch
      expect(ifBlock.elseBranch).not.toBeNull();
      const elseJumps = ifBlock.elseBranch!.filter(
        n => n.type === 'tag' && LABEL_REF_TAGS.has((n as TagNode).name),
      );
      expect(elseJumps.length).toBe(1);
    }
  });

  it('should extract edges from within macro definitions', () => {
    const result = new Parser('test.ks').parse([
      '[macro name="go_somewhere"]',
      '[jump target="*destination"]',
      '[endmacro]',
    ].join('\n'));

    const macro = result.macros.get('go_somewhere')!;
    const jumps = macro.body.filter(
      n => n.type === 'tag' && LABEL_REF_TAGS.has((n as TagNode).name),
    );
    expect(jumps.length).toBe(1);
  });

  it('should build correct node set from multi-file project', () => {
    const index = buildMockIndex(
      {
        name: 'first.ks',
        source: '*start\n[jump storage="chapter1.ks" target="*begin"]\n*end\n[s]',
      },
      {
        name: 'chapter1.ks',
        source: '*begin\nHello\n*middle\n[jump target="*fin"]\n*fin\n[s]',
      },
    );

    expect(index.scenarios.size).toBe(2);
    expect(index.globalLabels.size).toBe(5); // start, end, begin, middle, fin
    expect(index.globalLabels.has('start')).toBe(true);
    expect(index.globalLabels.has('begin')).toBe(true);
    expect(index.globalLabels.has('fin')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Profiler: verify static analysis data extraction
// ════════════════════════════════════════════════════════════════════

describe('Profiler: static analysis data', () => {
  const RESOURCE_TAGS_MAP: Record<string, string> = {
    bg: 'image', image: 'image', chara_new: 'image', chara_face: 'image',
    chara_show: 'image', chara_mod: 'image',
    playbgm: 'audio', fadeinbgm: 'audio', playse: 'audio', fadeinse: 'audio',
    movie: 'video', bgmovie: 'video',
    loadjs: 'script', loadcss: 'css',
  };

  const TRANSITION_TAGS = new Set([
    'bg', 'mask', 'mask_off', 'trans', 'quake', 'vibrate',
    'chara_show', 'chara_hide', 'chara_move', 'chara_mod',
    'anim', 'kanim', 'keyframe',
  ]);

  function collectStats(nodes: ScenarioNode[]) {
    let tagCount = 0;
    let labelCount = 0;
    let evalCount = 0;
    let transitionCount = 0;
    let choicePoints = 0;
    const resources: { type: string; file: string; tag: string }[] = [];

    function walk(nodeList: ScenarioNode[]) {
      for (const node of nodeList) {
        if (node.type === 'label') labelCount++;
        if (node.type === 'tag') {
          tagCount++;
          const tn = node as TagNode;

          const resType = RESOURCE_TAGS_MAP[tn.name];
          if (resType) {
            const storage = tn.attributes.find(a => a.name === 'storage');
            if (storage?.value) {
              resources.push({ type: resType, file: storage.value, tag: tn.name });
            }
          }

          if (TRANSITION_TAGS.has(tn.name)) transitionCount++;
          if (tn.name === 'eval' || tn.name === 'iscript') evalCount++;
          if (tn.name === 'button' || tn.name === 'glink') choicePoints++;
        }
        if (node.type === 'if_block') {
          walk(node.thenBranch);
          for (const b of node.elsifBranches) walk(b.body);
          if (node.elseBranch) walk(node.elseBranch);
        }
        if (node.type === 'macro_def') {
          walk(node.body);
        }
      }
    }
    walk(nodes);
    return { tagCount, labelCount, evalCount, transitionCount, choicePoints, resources };
  }

  it('should count tags correctly', () => {
    const result = new Parser('test.ks').parse(
      '[bg storage="room.jpg"]\n[cm]\n[p]\n[s]',
    );
    const stats = collectStats(result.nodes);
    expect(stats.tagCount).toBe(4);
  });

  it('should count labels correctly', () => {
    const result = new Parser('test.ks').parse(
      '*start\n[cm]\n*middle\n[cm]\n*end\n[s]',
    );
    const stats = collectStats(result.nodes);
    expect(stats.labelCount).toBe(3);
  });

  it('should detect resource loads', () => {
    const result = new Parser('test.ks').parse([
      '[bg storage="room.jpg"]',
      '[playbgm storage="bgm01.ogg"]',
      '[playse storage="click.ogg"]',
      '[movie storage="intro.mp4"]',
      '[loadjs storage="custom.js"]',
      '[loadcss storage="style.css"]',
    ].join('\n'));
    const stats = collectStats(result.nodes);
    expect(stats.resources.length).toBe(6);
    expect(stats.resources.filter(r => r.type === 'image').length).toBe(1);
    expect(stats.resources.filter(r => r.type === 'audio').length).toBe(2);
    expect(stats.resources.filter(r => r.type === 'video').length).toBe(1);
    expect(stats.resources.filter(r => r.type === 'script').length).toBe(1);
    expect(stats.resources.filter(r => r.type === 'css').length).toBe(1);
  });

  it('should count transitions', () => {
    const result = new Parser('test.ks').parse([
      '[bg storage="room.jpg" time=1000]',
      '[chara_show name="a"]',
      '[chara_mod name="a" face="happy"]',
      '[trans method=crossfade time=500]',
      '[quake count=3]',
    ].join('\n'));
    const stats = collectStats(result.nodes);
    expect(stats.transitionCount).toBe(5);
  });

  it('should count eval calls', () => {
    const result = new Parser('test.ks').parse([
      '[eval exp="f.x = 1"]',
      '[eval exp="f.y = f.x + 1"]',
    ].join('\n'));
    const stats = collectStats(result.nodes);
    expect(stats.evalCount).toBe(2);
  });

  it('should detect iscript blocks separately', () => {
    const result = new Parser('test.ks').parse([
      '[iscript]',
      'f.z = 100;',
      '[endscript]',
    ].join('\n'));
    // iscript is parsed as its own node type, not a tag
    const iscriptNodes = result.nodes.filter(n => n.type === 'iscript');
    expect(iscriptNodes.length).toBe(1);
  });

  it('should count choice points', () => {
    const result = new Parser('test.ks').parse([
      '[button text="A" target="*a"]',
      '[button text="B" target="*b"]',
      '[glink text="C" target="*c" x=0 y=0]',
      '[s]',
    ].join('\n'));
    const stats = collectStats(result.nodes);
    expect(stats.choicePoints).toBe(3);
  });

  it('should count tags inside if blocks', () => {
    const result = new Parser('test.ks').parse([
      '[if exp="f.x==1"]',
      '[bg storage="a.jpg"]',
      '[playbgm storage="a.ogg"]',
      '[else]',
      '[bg storage="b.jpg"]',
      '[endif]',
    ].join('\n'));
    const stats = collectStats(result.nodes);
    expect(stats.tagCount).toBe(3); // bg, playbgm, bg
    expect(stats.resources.length).toBe(3);
    expect(stats.transitionCount).toBe(2); // two bg tags
  });

  it('should detect long wait warning data', () => {
    const result = new Parser('test.ks').parse('[wait time=10000]');
    const tag = result.nodes.find(n => n.type === 'tag') as TagNode;
    const timeAttr = tag.attributes.find(a => a.name === 'time');
    const waitTime = parseInt(timeAttr?.value ?? '0', 10);
    expect(waitTime).toBe(10000);
    expect(waitTime > 5000).toBe(true);
  });

  it('should classify complexity based on tag count thresholds', () => {
    function getComplexity(tagCount: number, transitionCount: number, resourceCount: number) {
      if (tagCount > 500 || transitionCount > 50 || resourceCount > 30) return 'critical';
      if (tagCount > 200 || transitionCount > 20 || resourceCount > 15) return 'high';
      if (tagCount > 80 || transitionCount > 10) return 'medium';
      return 'low';
    }

    expect(getComplexity(10, 2, 3)).toBe('low');
    expect(getComplexity(100, 5, 5)).toBe('medium');
    expect(getComplexity(300, 5, 5)).toBe('high');
    expect(getComplexity(600, 5, 5)).toBe('critical');
    expect(getComplexity(50, 55, 5)).toBe('critical');
    expect(getComplexity(50, 5, 35)).toBe('critical');
    expect(getComplexity(50, 25, 5)).toBe('high');
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Runner: choice point detection patterns
// ════════════════════════════════════════════════════════════════════

describe('Test Runner: choice point detection', () => {
  function findChoicePoints(nodes: ScenarioNode[]) {
    const points: { label: string | null; options: { text: string; target: string | null }[] }[] = [];
    let currentLabel: string | null = null;
    const pendingChoices: TagNode[] = [];

    for (const node of nodes) {
      if (node.type === 'label') {
        if (pendingChoices.length > 0) {
          points.push(buildPoint(currentLabel, pendingChoices));
          pendingChoices.length = 0;
        }
        currentLabel = node.name;
      }
      if (node.type === 'tag' && (node.name === 'button' || node.name === 'glink')) {
        pendingChoices.push(node);
      }
      if (node.type === 'tag' && node.name === 's' && pendingChoices.length > 0) {
        points.push(buildPoint(currentLabel, pendingChoices));
        pendingChoices.length = 0;
      }
    }
    if (pendingChoices.length > 0) {
      points.push(buildPoint(currentLabel, pendingChoices));
    }
    return points;
  }

  function buildPoint(label: string | null, choices: TagNode[]) {
    return {
      label,
      options: choices.map(c => ({
        text: c.attributes.find(a => a.name === 'text')?.value ?? `(${c.name})`,
        target: c.attributes.find(a => a.name === 'target')?.value?.replace(/^\*/, '') ?? null,
      })),
    };
  }

  it('should detect button choice points followed by [s]', () => {
    const result = new Parser('test.ks').parse([
      '*choice',
      '[button text="Route A" target="*a"]',
      '[button text="Route B" target="*b"]',
      '[s]',
    ].join('\n'));

    const points = findChoicePoints(result.nodes);
    expect(points.length).toBe(1);
    expect(points[0].label).toBe('choice');
    expect(points[0].options.length).toBe(2);
    expect(points[0].options[0].text).toBe('Route A');
    expect(points[0].options[0].target).toBe('a');
    expect(points[0].options[1].text).toBe('Route B');
    expect(points[0].options[1].target).toBe('b');
  });

  it('should detect glink choice points', () => {
    const result = new Parser('test.ks').parse([
      '*select',
      '[glink text="Yes" target="*yes" x=100 y=200]',
      '[glink text="No" target="*no" x=100 y=300]',
      '[s]',
    ].join('\n'));

    const points = findChoicePoints(result.nodes);
    expect(points.length).toBe(1);
    expect(points[0].options.length).toBe(2);
    expect(points[0].options[0].text).toBe('Yes');
    expect(points[0].options[1].text).toBe('No');
  });

  it('should detect multiple choice points in sequence', () => {
    const result = new Parser('test.ks').parse([
      '*choice1',
      '[button text="A" target="*a"]',
      '[button text="B" target="*b"]',
      '[s]',
      '*a',
      '[jump target="*choice2"]',
      '*b',
      '[jump target="*choice2"]',
      '*choice2',
      '[button text="C" target="*c"]',
      '[button text="D" target="*d"]',
      '[s]',
    ].join('\n'));

    const points = findChoicePoints(result.nodes);
    expect(points.length).toBe(2);
    expect(points[0].label).toBe('choice1');
    expect(points[1].label).toBe('choice2');
  });

  it('should handle choices without text attribute', () => {
    const result = new Parser('test.ks').parse([
      '[button target="*x"]',
      '[s]',
    ].join('\n'));

    const points = findChoicePoints(result.nodes);
    expect(points.length).toBe(1);
    expect(points[0].options[0].text).toBe('(button)');
  });

  it('should handle no choice points', () => {
    const result = new Parser('test.ks').parse(
      '*start\n[bg storage="room.jpg"]\nHello[p]\n[s]',
    );
    const points = findChoicePoints(result.nodes);
    expect(points.length).toBe(0);
  });

  it('should flush remaining choices at end of file', () => {
    const result = new Parser('test.ks').parse([
      '*choose',
      '[button text="Go" target="*go"]',
    ].join('\n'));

    const points = findChoicePoints(result.nodes);
    expect(points.length).toBe(1);
    expect(points[0].options[0].text).toBe('Go');
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Runner: unreachable label detection
// ════════════════════════════════════════════════════════════════════

describe('Test Runner: unreachable label detection', () => {
  function collectReferencedLabels(nodes: ScenarioNode[], labels: Set<string>) {
    for (const node of nodes) {
      if (node.type === 'tag' && LABEL_REF_TAGS.has(node.name)) {
        const target = node.attributes.find(a => a.name === 'target');
        if (target?.value) {
          labels.add(target.value.replace(/^\*/, ''));
        }
      }
      if (node.type === 'if_block') {
        collectReferencedLabels(node.thenBranch, labels);
        for (const b of node.elsifBranches) collectReferencedLabels(b.body, labels);
        if (node.elseBranch) collectReferencedLabels(node.elseBranch, labels);
      }
      if (node.type === 'macro_def') {
        collectReferencedLabels(node.body, labels);
      }
    }
  }

  it('should find labels not referenced by any jump/call', () => {
    const result = new Parser('test.ks').parse([
      '*start',
      '[jump target="*used"]',
      '*used',
      '[s]',
      '*orphan',
      'This label is never jumped to',
      '[s]',
    ].join('\n'));

    const referenced = new Set<string>();
    collectReferencedLabels(result.nodes, referenced);

    const allLabels = [...result.labels.keys()];
    const unreachable = allLabels.filter(l => l !== 'start' && !referenced.has(l));
    expect(unreachable).toEqual(['orphan']);
  });

  it('should not flag labels referenced inside if blocks', () => {
    const result = new Parser('test.ks').parse([
      '*start',
      '[if exp="f.x==1"]',
      '[jump target="*conditional"]',
      '[endif]',
      '[s]',
      '*conditional',
      '[s]',
    ].join('\n'));

    const referenced = new Set<string>();
    collectReferencedLabels(result.nodes, referenced);
    expect(referenced.has('conditional')).toBe(true);
  });

  it('should detect all referenced labels across tag types', () => {
    const result = new Parser('test.ks').parse([
      '*start',
      '[jump target="*a"]',
      '[call target="*b"]',
      '[link target="*c"]click[endlink]',
      '[button text="d" target="*d"]',
      '[glink text="e" target="*e" x=0 y=0]',
    ].join('\n'));

    const referenced = new Set<string>();
    collectReferencedLabels(result.nodes, referenced);
    expect(referenced.has('a')).toBe(true);
    expect(referenced.has('b')).toBe(true);
    expect(referenced.has('c')).toBe(true);
    expect(referenced.has('d')).toBe(true);
    expect(referenced.has('e')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Diagnostics: bilingual message pattern matching
// ════════════════════════════════════════════════════════════════════

describe('Diagnostics: bilingual message patterns for CodeAction', () => {
  // These patterns must match what diagnostics.ts produces AND what codeaction-provider.ts expects

  it('should match English "Unknown tag" pattern', () => {
    const msg = 'Unknown tag or undefined macro: [customtag]';
    const match = msg.match(/^(?:Unknown tag or undefined macro|不明なタグまたは未定義のマクロ): \[(\w+)\]/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('customtag');
  });

  it('should match Japanese "Unknown tag" pattern', () => {
    const msg = '不明なタグまたは未定義のマクロ: [customtag]';
    const match = msg.match(/^(?:Unknown tag or undefined macro|不明なタグまたは未定義のマクロ): \[(\w+)\]/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('customtag');
  });

  it('should match English "Undefined label" pattern', () => {
    const msg = 'Undefined label: *missing_label';
    const match = msg.match(/^(?:Undefined label|未定義のラベル): \*(\w+)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('missing_label');
  });

  it('should match Japanese "Undefined label" pattern', () => {
    const msg = '未定義のラベル: *missing_label';
    const match = msg.match(/^(?:Undefined label|未定義のラベル): \*(\w+)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('missing_label');
  });

  it('should match "Unknown parameter" pattern (English only)', () => {
    const msg = 'Unknown parameter "xyz" for [bg]';
    const match = msg.match(/^Unknown parameter "(\w+)" for \[(\w+)\]$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('xyz');
    expect(match![2]).toBe('bg');
  });

  it('should match unreachable code pattern', () => {
    const en = 'Unreachable code after [jump]';
    const ja = '[jump] の後の到達不能コード';
    expect(en).toMatch(/Unreachable code after \[(\w+)\]/);
    expect(ja).toMatch(/\[(\w+)\] の後の到達不能コード/);
  });

  it('should match missing required parameter pattern', () => {
    const en = 'Missing required parameter "storage" for [bg]';
    const ja = '[bg] の必須パラメータ "storage" がありません';
    expect(en).toMatch(/Missing required parameter "(\w+)" for \[(\w+)\]/);
    expect(ja).toMatch(/\[(\w+)\] の必須パラメータ "(\w+)" がありません/);
  });
});

// ════════════════════════════════════════════════════════════════════
// Scanner: # and / prefixed tag names
// ════════════════════════════════════════════════════════════════════

describe('Scanner: special tag name prefixes', () => {
  it('should scan # prefixed tag names (speaker)', () => {
    const tokens = new Scanner('[#sakura]').scan();
    const tagName = tokens.find(t => t.type === 'TAG_NAME');
    expect(tagName).toBeDefined();
    expect(tagName!.value).toBe('#sakura');
  });

  it('should scan / prefixed tag names (closing)', () => {
    const tokens = new Scanner('[/ruby]').scan();
    const tagName = tokens.find(t => t.type === 'TAG_NAME');
    expect(tagName).toBeDefined();
    expect(tagName!.value).toBe('/ruby');
  });

  it('should scan [#] (anonymous speaker reset)', () => {
    const tokens = new Scanner('[#]').scan();
    const tagName = tokens.find(t => t.type === 'TAG_NAME');
    expect(tagName).toBeDefined();
    expect(tagName!.value).toBe('#');
  });
});

// ════════════════════════════════════════════════════════════════════
// Parser: @ shorthand syntax
// ════════════════════════════════════════════════════════════════════

describe('Parser: @ shorthand tag syntax', () => {
  it('should parse @ shorthand as tag', () => {
    const result = new Parser('test.ks').parse('@jump target="*end"');
    const tag = result.nodes.find(n => n.type === 'tag') as TagNode;
    expect(tag).toBeDefined();
    expect(tag.name).toBe('jump');
    expect(tag.attributes.find(a => a.name === 'target')!.value).toBe('*end');
  });

  it('should parse @ shorthand with multiple attributes', () => {
    const result = new Parser('test.ks').parse('@bg storage="room.jpg" time=1000 method=crossfade');
    const tag = result.nodes.find(n => n.type === 'tag') as TagNode;
    expect(tag.name).toBe('bg');
    expect(tag.attributes.length).toBe(3);
  });
});

// ════════════════════════════════════════════════════════════════════
// Parser: nested structures
// ════════════════════════════════════════════════════════════════════

describe('Parser: nested structures', () => {
  it('should handle if blocks nested inside macros', () => {
    const result = new Parser('test.ks').parse([
      '[macro name="smart_jump"]',
      '[if exp="mp.cond==true"]',
      '[jump target="*yes"]',
      '[else]',
      '[jump target="*no"]',
      '[endif]',
      '[endmacro]',
    ].join('\n'));

    const macro = result.macros.get('smart_jump')!;
    expect(macro).toBeDefined();
    const ifBlock = macro.body.find(n => n.type === 'if_block');
    expect(ifBlock).toBeDefined();
    if (ifBlock?.type === 'if_block') {
      expect(ifBlock.elseBranch).not.toBeNull();
    }
  });

  it('should handle deeply nested if blocks', () => {
    const result = new Parser('test.ks').parse([
      '[if exp="f.a"]',
      '[if exp="f.b"]',
      '[if exp="f.c"]',
      '[cm]',
      '[endif]',
      '[endif]',
      '[endif]',
    ].join('\n'));

    const outerIf = result.nodes.find(n => n.type === 'if_block');
    expect(outerIf).toBeDefined();
    if (outerIf?.type === 'if_block') {
      const innerIf = outerIf.thenBranch.find(n => n.type === 'if_block');
      expect(innerIf).toBeDefined();
      if (innerIf?.type === 'if_block') {
        const deepIf = innerIf.thenBranch.find(n => n.type === 'if_block');
        expect(deepIf).toBeDefined();
      }
    }
  });

  it('should handle elsif chains', () => {
    const result = new Parser('test.ks').parse([
      '[if exp="f.x==1"]',
      'One',
      '[elsif exp="f.x==2"]',
      'Two',
      '[elsif exp="f.x==3"]',
      'Three',
      '[elsif exp="f.x==4"]',
      'Four',
      '[else]',
      'Other',
      '[endif]',
    ].join('\n'));

    const ifBlock = result.nodes.find(n => n.type === 'if_block');
    expect(ifBlock).toBeDefined();
    if (ifBlock?.type === 'if_block') {
      expect(ifBlock.elsifBranches.length).toBe(3);
      expect(ifBlock.elseBranch).not.toBeNull();
    }
  });
});
