/**
 * TyranoScript AST types
 */

export interface Position {
  line: number;   // 0-based
  column: number; // 0-based
}

export interface Range {
  start: Position;
  end: Position;
}

export type NodeType =
  | 'tag'
  | 'label'
  | 'text'
  | 'comment'
  | 'iscript'
  | 'html'
  | 'macro_def'
  | 'if_block'
  | 'ignore_block';

export interface TagAttribute {
  name: string;
  value: string | undefined; // undefined for boolean attrs like [s cond="..."]
  range: Range;
  nameRange: Range;
  valueRange?: Range;
}

export interface BaseNode {
  type: NodeType;
  range: Range;
  file: string;
}

export interface TagNode extends BaseNode {
  type: 'tag';
  name: string;
  nameRange: Range;
  attributes: TagAttribute[];
}

export interface LabelNode extends BaseNode {
  type: 'label';
  name: string;
  nameRange: Range;
}

export interface TextNode extends BaseNode {
  type: 'text';
  content: string;
}

export interface CommentNode extends BaseNode {
  type: 'comment';
  content: string;
}

export interface IScriptNode extends BaseNode {
  type: 'iscript';
  scriptContent: string;
  scriptRange: Range;
}

export interface HtmlNode extends BaseNode {
  type: 'html';
  htmlContent: string;
  htmlRange: Range;
}

export interface MacroDefNode extends BaseNode {
  type: 'macro_def';
  name: string;
  nameRange: Range;
  body: ScenarioNode[];
}

export interface IfBlockNode extends BaseNode {
  type: 'if_block';
  condition: string;
  thenBranch: ScenarioNode[];
  elsifBranches: Array<{ condition: string; body: ScenarioNode[] }>;
  elseBranch: ScenarioNode[] | null;
}

export interface IgnoreBlockNode extends BaseNode {
  type: 'ignore_block';
  body: ScenarioNode[];
}

export type ScenarioNode =
  | TagNode
  | LabelNode
  | TextNode
  | CommentNode
  | IScriptNode
  | HtmlNode
  | MacroDefNode
  | IfBlockNode
  | IgnoreBlockNode;

export interface ParsedScenario {
  file: string;
  nodes: ScenarioNode[];
  labels: Map<string, LabelNode>;
  macros: Map<string, MacroDefNode>;
  errors: ParseError[];
}

export interface ParseError {
  message: string;
  range: Range;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Project-wide index
 */
export interface ProjectIndex {
  scenarios: Map<string, ParsedScenario>;
  /** label_name -> { file, node } */
  globalLabels: Map<string, { file: string; node: LabelNode }[]>;
  /** macro_name -> { file, node } */
  globalMacros: Map<string, { file: string; node: MacroDefNode }>;
  /** All variable references found: f.xxx, sf.xxx, tf.xxx */
  variables: Map<string, VariableInfo[]>;
}

export interface VariableInfo {
  scope: 'f' | 'sf' | 'tf' | 'mp';
  name: string;
  file: string;
  range: Range;
  usage: 'read' | 'write';
}

/**
 * Tags whose `target` attribute references a label (e.g., `*label_name`).
 * Used by CodeLens, Rename, CallHierarchy, Diagnostics, etc. to find label references.
 */
export const LABEL_REF_TAGS = new Set([
  'jump', 'call', 'link', 'button', 'glink', 'clickable', 'sleepgame', 'dialog',
]);
