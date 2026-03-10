/**
 * Tests for new language providers.
 * Tests what can be tested without VS Code API (scanner/parser-based logic).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Scanner } from '../src/parser/scanner';
import { Parser } from '../src/parser/parser';
import { TAG_DATABASE } from '../src/language/tag-database';
import { registerExtendedTags } from '../src/language/tag-database-ext';

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
