/*
 * codemod-deno-ral.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Rewrites `Deno.<api>` uses to the equivalent export of src/deno_ral/<module>.ts
 * and adds or merges the import; with --reverse, rewrites layer names back to
 * `Deno.*` (used by dev-docs/checklist-backport-a-pr.md). Dev tooling: run with
 *
 *   quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core [--dry-run]
 *
 * See dev-docs/runtime-migration/09-ral-fs-and-temp-layer.md for the rules.
 * This script lives outside the runtime boundary and may use Deno.* itself.
 */

import {
  type Identifier,
  type ImportDeclaration,
  type ImportSpecifier,
  Node,
  Project,
  type SourceFile,
  SyntaxKind,
  ts,
} from "npm:ts-morph@28.0.0";
import { dirname, join, relative, resolve } from "../src/deno_ral/path.ts";
import { walkSync } from "../src/deno_ral/fs.ts";
import { kSrcExclusions } from "./check-runtime-boundary.ts";

export type RuleName = "fs" | "temp" | "env" | "process" | "platform";

interface Member {
  to: string;
  callAfter?: boolean; // Deno.args -> args()
  reverseHint?: string; // never reversed; reported in `left` with this hint
}

interface Rule {
  module: string;
  members: Record<string, Member>; // Deno.<name> -> export
  types: Record<string, string>; // Deno.<T> (type position) -> export
  nested: Record<string, string>; // Deno.<a>.<b> -> export
}

const kFsNames = [
  "readTextFileSync", "readTextFile", "readFileSync", "readFile",
  "writeTextFileSync", "writeTextFile", "writeFileSync", "writeFile",
  "statSync", "stat", "lstatSync", "lstat", "mkdirSync", "mkdir",
  "removeSync", "remove", "renameSync", "rename", "copyFileSync", "copyFile",
  "readDirSync", "readDir", "symlinkSync", "symlink", "readLinkSync",
  "realPath", "chmodSync", "chmod", "utimeSync", "truncateSync",
  "open", "openSync", "create",
];

const same = (names: string[]): Record<string, Member> =>
  Object.fromEntries(names.map((n) => [n, { to: n }]));

export const kCanonicalReverseHint =
  "is not Deno.realPathSync on branches that load core/deno/monkey-patch.ts; use originalRealPathSync from deno_ral/original-real-path.ts";

export const RULES: Record<RuleName, Rule> = {
  fs: {
    module: "fs.ts",
    members: {
      ...same(kFsNames),
      realPathSync: { to: "canonicalPathSync", reverseHint: kCanonicalReverseHint },
    },
    types: { FileInfo: "FileInfo", DirEntry: "DirEntry", FsFile: "FsFile" },
    nested: {},
  },
  temp: {
    module: "temp.ts",
    members: same(["makeTempDirSync", "makeTempDir", "makeTempFileSync", "makeTempFile"]),
    types: { MakeTempOptions: "TempOptions" },
    nested: {},
  },
  env: {
    module: "env.ts",
    members: { env: { to: "env" } },
    types: {},
    nested: {},
  },
  process: {
    module: "process.ts",
    members: {
      ...same(["exit", "cwd", "chdir", "execPath"]),
      args: { to: "args", callAfter: true },
      pid: { to: "pid", callAfter: true },
    },
    types: {},
    nested: {},
  },
  platform: {
    module: "platform.ts",
    members: {},
    types: {},
    nested: { "build.os": "os", "build.arch": "arch" },
  },
};

/** Paths (relative to the repository root) the codemod never walks into. */
export const kCodemodExclusions: readonly string[] = [
  ...kSrcExclusions,
  // bundled for the browser; must not import deno_ral (src/core/lib/errors.ts:27-29)
  "src/core/lib",
  // run by `deno run` from share/tools without the import map; PR 25 allow-lists it
  "src/resources/tools/ast-diagram",
];

/** Repo-relative (`/`-separated) paths of files known to patch `Deno`, skipped
 *  after the write guard as a backstop (the guard is best-effort and frozen). */
export const kCodemodPatchFiles: readonly string[] = [
  // patches Deno.realPathSync and the read functions; PR 25 deletes the file
  "src/core/deno/monkey-patch.ts",
  // patches Deno.readTextFileSync to record file reads; PR 20b moves it to `onFileRead`
  "src/core/performance/metrics.ts",
];

export interface Replacement {
  line: number;
  from: string;
  to: string;
}
export interface Collision {
  name: string;
  line: number;
  module: string;
  hint?: string;
}
export interface CodemodResult {
  file: string;
  replacements: Replacement[];
  collisions: Collision[];
  importsAdded: Record<string, string[]>;
  importsRemoved: Record<string, string[]>;
  left: Collision[];
  skipped?: string;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

export function collectFiles(dir: string, root = Deno.cwd()): string[] {
  const files: string[] = [];
  for (const entry of walkSync(dir, { includeDirs: false, exts: [".ts"], skip: [/node_modules/] })) {
    const rel = relative(root, resolve(entry.path)).replaceAll("\\", "/");
    if (kCodemodExclusions.some((e) => rel === e || rel.startsWith(e + "/"))) continue;
    if (rel.split("/").includes("node_modules")) continue;
    if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".ejs.ts")) continue;
    files.push(entry.path);
  }
  return files.sort();
}

function isDenoIdentifier(node: Node | undefined): boolean {
  return node !== undefined && Node.isIdentifier(node) && node.getText() === "Deno";
}

// How `Deno` is looked up at a location: `Deno.x` in an expression resolves
// the value; the left of a qualified type name (`Deno.FileInfo`) resolves the
// namespace. A binding of the other meaning does not shadow (a value-only
// parameter named Deno leaves `Deno.FileInfo` global; a local `type Deno`
// leaves `Deno.readTextFileSync()` global). Alias is in both: an import named
// Deno may carry either meaning, so it conservatively shadows.
const kValueMeaning = ts.SymbolFlags.Value | ts.SymbolFlags.Alias;
const kNamespaceMeaning = ts.SymbolFlags.Namespace | ts.SymbolFlags.Alias;

// The global `Deno` has no declaration under noLib (see newProject), so a
// `Deno` that resolves to a binding in scope with the given meaning shadows
// the global. getSymbolAtLocation is not enough: for the left of a qualified
// name it returns a transient symbol with no declarations even when a local
// `Deno` binding exists.
function denoBoundAt(node: Node, meaning: ts.SymbolFlags, checker: ts.TypeChecker): boolean {
  // excludeGlobals: a lib-provided global `Deno` must not count as a binding.
  return checker.resolveName("Deno", node.compilerNode, meaning, /*excludeGlobals*/ true) !==
    undefined;
}

function isGlobalDeno(
  node: Node | undefined,
  meaning: ts.SymbolFlags,
  checker: ts.TypeChecker,
): boolean {
  return isDenoIdentifier(node) && !denoBoundAt(node as Identifier, meaning, checker);
}

// A binding or a reference in scope, as opposed to a property name.
function isBindingOrReference(id: Node): boolean {
  const parent = id.getParent();
  if (!parent) return true;
  if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) return false;
  if (Node.isPropertyAssignment(parent) && parent.getNameNode() === id) return false;
  if (Node.isPropertySignature(parent) || Node.isMethodSignature(parent)) return false;
  if (Node.isPropertyDeclaration(parent) || Node.isMethodDeclaration(parent)) {
    return parent.getNameNode() !== id;
  }
  if (Node.isQualifiedName(parent) && parent.getRight() === id) return false;
  if (Node.isEnumMember(parent)) return false;
  // `a` in `import { a as b }` names the other module's export, not a binding here
  if (Node.isImportSpecifier(parent) && parent.getAliasNode() !== undefined &&
    parent.getNameNode() === id) return false;
  return true;
}

// Wrappers that leave the wrapped expression the same assignment target or
// receiver: `(x)`, `x as T`, `<T>x`, `x!`, `x satisfies T`.
function isTransparentWrapper(node: Node): boolean {
  return Node.isParenthesizedExpression(node) || Node.isAsExpression(node) ||
    Node.isTypeAssertion(node) || Node.isNonNullExpression(node) ||
    Node.isSatisfiesExpression(node);
}

function outermostWrapper(node: Node): Node {
  let outer = node;
  for (let p = outer.getParent(); p && isTransparentWrapper(p); p = p.getParent()) outer = p;
  return outer;
}

// The expression inside any transparent wrappers: `Object.assign` for
// `(Object.assign)`.
function unwrap(node: Node): Node {
  while (isTransparentWrapper(node)) {
    node = (node as Node & { getExpression(): Node }).getExpression();
  }
  return node;
}

// The `.x` or `[x]` access whose receiver is `node`, possibly wrapped
// (`(Deno as any).x`).
function accessOn(node: Node): Node | undefined {
  const receiver = outermostWrapper(node);
  const access = receiver.getParent();
  if (
    (Node.isPropertyAccessExpression(access) || Node.isElementAccessExpression(access)) &&
    access.getExpression() === receiver
  ) return access;
  return undefined;
}

// A use of `Deno` that is neither `Deno.x` nor a read of its type:
// `const d = Deno`, `f(Deno)`, `{ ...Deno }`, `const { x } = Deno`. What
// happens to Deno past such a use cannot be followed.
function isDenoEscape(id: Node): boolean {
  if (accessOn(id)) return false;
  const parent = outermostWrapper(id).getParent();
  if (!parent) return false;
  // `{ Deno }` is a use, although its name is also the property's name.
  if (Node.isShorthandPropertyAssignment(parent)) return true;
  // The name of a declaration (`type Deno = ...`) is not a use.
  if (
    !Node.isExpression(parent) &&
    ts.getNameOfDeclaration(parent.compilerNode as ts.Declaration) === id.compilerNode
  ) return false;
  return !Node.isTypeOfExpression(parent) && !Node.isQualifiedName(parent) &&
    !Node.isTypeQuery(parent) && !Node.isTypeReference(parent);
}

// The object and member name of `o.x`, `o["x"]` or o[`x`], the key possibly
// wrapped (`o[("x")]`).
function memberOf(node: Node | undefined): { object: Node; name: string } | undefined {
  if (Node.isPropertyAccessExpression(node)) {
    return { object: node.getExpression(), name: node.getName() };
  }
  if (!Node.isElementAccessExpression(node)) return undefined;
  const key = node.getArgumentExpression();
  const arg = key && unwrap(key);
  return Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg)
    ? { object: node.getExpression(), name: arg.getLiteralText() }
    : undefined;
}

// `globalThis.Deno`, `self["Deno"]`, ... when `id` is the global object.
const kGlobalObjects = ["globalThis", "self", "window"];
function globalObjectDeno(id: Node): Node | undefined {
  if (!kGlobalObjects.includes(id.getText())) return undefined;
  const access = accessOn(id);
  return memberOf(access)?.name === "Deno" ? access : undefined;
}

// Calls that replace or remove members of their first argument. A Map, so
// that an owner such as `constructor` finds no inherited entry.
const kMutators = new Map([
  ["Object", ["assign", "defineProperty", "defineProperties"]],
  ["Reflect", ["set", "defineProperty", "deleteProperty"]],
]);

// `Object.assign` when `node`, possibly wrapped, is the first argument of
// such a call (`Object.assign(Deno.build, ...)`), the callee and its owner
// possibly wrapped too (`(Object.assign)(...)`) and the callee possibly an
// element access (`Object["assign"](...)`).
function mutatorOf(node: Node): string | undefined {
  const arg = outermostWrapper(node);
  const call = arg.getParent();
  if (!Node.isCallExpression(call) || call.getArguments()[0] !== arg) return undefined;
  const callee = memberOf(unwrap(call.getExpression()));
  if (!callee) return undefined;
  const owner = unwrap(callee.object);
  if (!Node.isIdentifier(owner) || !kMutators.get(owner.getText())?.includes(callee.name)) {
    return undefined;
  }
  return call.getExpression().getText();
}

// The target of an assignment (`=`, `+=`, `&&=`, ...), `++`/`--`, `delete`,
// or a `for (x of/in ...)` head, directly or inside a destructuring pattern
// (`({ a: x } = o)`, `[x] = a`): rewriting it to an imported binding would
// not be valid.
function isWriteTarget(node: Node): boolean {
  let target = node;
  let parent = node.getParent();
  let inPattern = false;
  // Climb transparent wrappers and the literals that a destructuring pattern
  // is written with; whether the outermost literal is a pattern is decided below.
  while (parent) {
    if (Node.isArrayLiteralExpression(parent) || Node.isObjectLiteralExpression(parent)) {
      inPattern = true;
    } else if (
      !isTransparentWrapper(parent) && !Node.isSpreadElement(parent) &&
      !Node.isSpreadAssignment(parent) &&
      !(Node.isPropertyAssignment(parent) && parent.getInitializer() === target)
    ) break;
    target = parent;
    parent = parent.getParent();
  }
  if (!parent) return false;
  if ((Node.isForOfStatement(parent) || Node.isForInStatement(parent)) &&
    parent.getInitializer() === target) return true;
  if (inPattern) {
    return Node.isBinaryExpression(parent) && parent.getLeft() === target &&
      parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken;
  }
  if (Node.isBinaryExpression(parent)) {
    const op = parent.getOperatorToken().getKind();
    return parent.getLeft() === target &&
      op >= SyntaxKind.FirstAssignment && op <= SyntaxKind.LastAssignment;
  }
  if (Node.isPrefixUnaryExpression(parent) || Node.isPostfixUnaryExpression(parent)) {
    const op = parent.getOperatorToken();
    return op === SyntaxKind.PlusPlusToken || op === SyntaxKind.MinusMinusToken;
  }
  return Node.isDeleteExpression(parent);
}

function resolvesToModule(
  sourceFile: SourceFile,
  specifier: string,
  ralDir: string,
  module: string,
): boolean {
  if (!specifier.startsWith(".")) return false;
  const target = resolve(join(resolve(ralDir), module)).replaceAll("\\", "/");
  const actual = resolve(join(dirname(sourceFile.getFilePath()), specifier))
    .replaceAll("\\", "/");
  return target === actual;
}

function importSpecifierFor(file: string, ralDir: string, module: string): string {
  let rel = relative(dirname(resolve(file)), join(resolve(ralDir), module));
  rel = rel.replaceAll("\\", "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function byName(a: string, b: string): number {
  return a.localeCompare(b, "en");
}

// The symbol an identifier refers to (the value symbol for `{ x }` shorthand).
function referencedDeclarations(id: Identifier, checker: ts.TypeChecker): ts.Declaration[] {
  const parent = id.getParent();
  const symbol = parent && Node.isShorthandPropertyAssignment(parent)
    ? checker.getShorthandAssignmentValueSymbol(parent.compilerNode)
    : checker.getSymbolAtLocation(id.compilerNode);
  return symbol?.declarations ?? [];
}

function specifierExport(spec: ts.ImportSpecifier): string {
  return (spec.propertyName ?? spec.name).text;
}

function newProject(): Project {
  return new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    // noLib: no lib.d.ts per file (speed); identifiers that resolve only to a
    // global then count as collisions, which is the conservative answer.
    compilerOptions: { allowImportingTsExtensions: true, noEmit: true, noLib: true },
  });
}

function emptyResult(file: string): CodemodResult {
  return { file, replacements: [], collisions: [], importsAdded: {}, importsRemoved: {}, left: [] };
}

function applyEdits(text: string, edits: Edit[]): string {
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = text;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

function renderImport(decl: ImportDeclaration, specifiers: string[], typeOnly: boolean): string {
  const def = decl.getDefaultImport()?.getText();
  const head = typeOnly ? "import type " : "import ";
  const named = specifiers.length > 0 ? `{ ${specifiers.join(", ")} }` : "";
  const clause = [def, named].filter((x) => x).join(", ");
  return `${head}${clause} from "${decl.getModuleSpecifierValue()}";`;
}

export function codemodFile(
  file: string,
  rules: RuleName[],
  options: { ralDir: string; dryRun: boolean; reverse?: boolean },
): CodemodResult {
  // Fast path: most files have nothing to rewrite; skip the type checker.
  const raw = Deno.readTextFileSync(file);
  if (!raw.includes(options.reverse ? "deno_ral/" : "Deno.")) {
    return emptyResult(file);
  }
  const project = newProject();
  const sourceFile = project.addSourceFileAtPath(file);
  const checker = project.getTypeChecker().compilerObject;
  const result = options.reverse
    ? reverseFile(sourceFile, rules, options.ralDir, checker)
    : forwardFile(sourceFile, rules, options.ralDir, checker);
  if (result.edits.length > 0 && !options.dryRun) {
    Deno.writeTextFileSync(file, applyEdits(sourceFile.getFullText(), result.edits));
  }
  return result.result;
}

function forwardFile(
  sourceFile: SourceFile,
  rules: RuleName[],
  ralDir: string,
  checker: ts.TypeChecker,
): { result: CodemodResult; edits: Edit[] } {
  const file = sourceFile.getFilePath();
  const result = emptyResult(file);
  const edits: Edit[] = [];
  const text = sourceFile.getFullText();

  // 1. Files that write to Deno.* (monkey patches, instrumentation) are left
  //    alone. The written node may be `Deno.x` or, for nested rules, `Deno.a.b`,
  //    with the receiver wrapped or not (`(Deno as any).x`, `Deno["x"]`). A
  //    write through a wrapped receiver counts too: the file's plain reads
  //    would otherwise become layer calls into the patched function. A file
  //    that uses Deno other than as `Deno.x` (an alias, an argument such as
  //    `Object.defineProperty(Deno, ...)`, `globalThis.Deno`) is left alone
  //    too, since writes past that use cannot be followed.
  //    The guard is best-effort and frozen: it does not see a write through
  //    `Reflect.get(globalThis, "Deno")`, a computed key `globalThis[k]`, or a
  //    comma-wrapped nested receiver `Object.assign((0, Deno.build), …)`. A
  //    file that patches `Deno` with a spelling the guard misses belongs on
  //    `kCodemodPatchFiles`, not in a wider guard.
  const skip = (reason: string, node: Node) => {
    result.skipped = `${reason} at line ${node.getStartLineNumber()}`;
    return { result, edits: [] };
  };
  for (const id of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const viaGlobal = globalObjectDeno(id);
    if (viaGlobal) return skip(`reaches Deno through ${viaGlobal.getText()}`, viaGlobal);
    if (!isBindingOrReference(id) || !isGlobalDeno(id, kValueMeaning, checker)) continue;
    if (isDenoEscape(id)) return skip("uses Deno other than as Deno.x", id);
    const access = accessOn(id);
    if (!access) continue;
    const nested = accessOn(access);
    const written = [access, ...(nested ? [nested] : [])].find(isWriteTarget);
    if (written) return skip(`assigns to ${written.getText()}`, written);
    const mutator = mutatorOf(access);
    if (mutator) return skip(`assigns to ${access.getText()} via ${mutator}`, access);
  }

  // Backstop, after the guard so a caught file keeps the guard's reason: skip
  // the files known to patch `Deno` even when the guard misses the write.
  const rel = relative(resolve(ralDir, "..", ".."), file).replaceAll("\\", "/");
  if (kCodemodPatchFiles.includes(rel)) {
    result.skipped = "listed in kCodemodPatchFiles";
    return { result, edits: [] };
  }

  const importDecls = sourceFile.getImportDeclarations();
  const declsFor = (module: string) =>
    importDecls.filter((d) =>
      resolvesToModule(sourceFile, d.getModuleSpecifierValue(), ralDir, module)
    );

  // 2. Existing local name for an export of a layer module (alias reuse).
  const existingLocal = (module: string, exportName: string, forType: boolean) => {
    for (const d of declsFor(module)) {
      for (const s of d.getNamedImports()) {
        if (s.getName() !== exportName) continue;
        if (!forType && (d.isTypeOnly() || s.isTypeOnly())) continue;
        return s.getAliasNode()?.getText() ?? exportName;
      }
    }
    return undefined;
  };

  // 3. Symbol-based collisions: does `local` refer to anything other than
  //    the layer export it would name?
  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
  const isLayerBinding = (decl: ts.Declaration, module: string, exportName: string, forType: boolean) => {
    if (!ts.isImportSpecifier(decl) || specifierExport(decl) !== exportName) return false;
    const importDecl = decl.parent.parent.parent;
    if (
      !ts.isImportDeclaration(importDecl) ||
      !ts.isStringLiteral(importDecl.moduleSpecifier) ||
      !resolvesToModule(sourceFile, importDecl.moduleSpecifier.text, ralDir, module)
    ) return false;
    // A type-only binding cannot back a value rewrite; merging would add a
    // second binding of the same name, so it conflicts instead of reusing.
    return forType || (!decl.isTypeOnly && !importDecl.importClause?.isTypeOnly);
  };
  const collisionCache = new Map<string, boolean>();
  const blocked = (local: string, module: string, exportName: string, forType: boolean): boolean => {
    const key = `${module}:${exportName}:${local}:${forType}`;
    const cached = collisionCache.get(key);
    if (cached !== undefined) return cached;
    let collision: Collision | undefined;
    for (const id of identifiers) {
      if (id.getText() !== local || !isBindingOrReference(id)) continue;
      const decls = referencedDeclarations(id, checker);
      const ok = decls.length > 0 && decls.every((d) => isLayerBinding(d, module, exportName, forType));
      if (!ok) {
        collision = { name: local, line: id.getStartLineNumber(), module };
        break;
      }
    }
    if (collision) result.collisions.push(collision);
    collisionCache.set(key, collision !== undefined);
    return collision !== undefined;
  };

  const wanted = new Map<string, { values: Set<string>; types: Set<string> }>();
  const want = (module: string, name: string, isType: boolean) => {
    const w = wanted.get(module) ?? { values: new Set(), types: new Set() };
    (isType ? w.types : w.values).add(name);
    wanted.set(module, w);
  };
  const replace = (node: Node, exportName: string, module: string, isType: boolean, suffix = "") => {
    const existing = existingLocal(module, exportName, isType);
    const local = existing ?? exportName;
    if (blocked(local, module, exportName, isType)) return false;
    const to = local + suffix;
    edits.push({ start: node.getStart(), end: node.getEnd(), text: to });
    result.replacements.push({ line: node.getStartLineNumber(), from: node.getText(), to });
    if (!existing) want(module, exportName, isType);
    return true;
  };

  // 4. Value positions: Deno.<name> and Deno.<a>.<b>.
  for (const pae of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (!isGlobalDeno(pae.getExpression(), kValueMeaning, checker)) continue;
    const name = pae.getName();
    const parent = pae.getParent();
    for (const ruleName of rules) {
      const rule = RULES[ruleName];
      if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === pae) {
        const to = rule.nested[`${name}.${parent.getName()}`];
        if (to) {
          replace(parent, to, rule.module, false);
          break;
        }
      }
      const member = rule.members[name];
      if (member) {
        replace(pae, member.to, rule.module, false, member.callAfter ? "()" : "");
        break;
      }
    }
  }

  // 5. Type positions: Deno.<T>.
  for (const ref of sourceFile.getDescendantsOfKind(SyntaxKind.TypeReference)) {
    const typeName = ref.getTypeName();
    if (
      !Node.isQualifiedName(typeName) ||
      !isGlobalDeno(typeName.getLeft(), kNamespaceMeaning, checker)
    ) continue;
    const name = typeName.getRight().getText();
    for (const ruleName of rules) {
      const rule = RULES[ruleName];
      const to = rule.types[name];
      if (!to) continue;
      replace(typeName, to, rule.module, true);
      break;
    }
  }

  if (edits.length === 0) {
    return { result, edits };
  }

  // 6. Imports: merge into an existing declaration or insert a new one.
  const newDecls: string[] = [];
  for (const [module, names] of wanted) {
    const decls = declsFor(module);
    const valueDecl = decls.find((d) => !d.isTypeOnly() && d.getNamespaceImport() === undefined);
    // Namespace imports (`import type * as fs`) are not merge targets:
    // rewriting one to named imports would break the existing `fs.X` uses.
    const typeDecl = decls.find((d) => d.isTypeOnly() && d.getNamespaceImport() === undefined);
    const values = [...names.values].sort(byName);
    const types = [...names.types].sort(byName);
    result.importsAdded[module] = [...values, ...types].sort(byName);
    const render = (existing: string[], add: string[]) =>
      [...existing, ...add].sort((a, b) =>
        byName(a.replace(/^type /, "").split(" as ")[0], b.replace(/^type /, "").split(" as ")[0])
      );
    if (values.length > 0 || (types.length > 0 && valueDecl && !typeDecl)) {
      const add = [...values, ...types.map((t) => `type ${t}`)];
      if (valueDecl) {
        const existing = valueDecl.getNamedImports().map((s) => s.getText());
        edits.push({
          start: valueDecl.getStart(),
          end: valueDecl.getEnd(),
          text: renderImport(valueDecl, render(existing, add), false),
        });
      } else {
        const spec = importSpecifierFor(sourceFile.getFilePath(), ralDir, module);
        newDecls.push(`import { ${render([], add).join(", ")} } from "${spec}";`);
      }
    } else if (types.length > 0) {
      if (typeDecl) {
        const existing = typeDecl.getNamedImports().map((s) => s.getText());
        edits.push({
          start: typeDecl.getStart(),
          end: typeDecl.getEnd(),
          text: renderImport(typeDecl, render(existing, types), true),
        });
      } else {
        const spec = importSpecifierFor(sourceFile.getFilePath(), ralDir, module);
        newDecls.push(`import type { ${types.join(", ")} } from "${spec}";`);
      }
    }
  }
  if (newDecls.length > 0) {
    if (importDecls.length > 0) {
      const last = importDecls[importDecls.length - 1];
      edits.push({ start: last.getEnd(), end: last.getEnd(), text: "\n" + newDecls.join("\n") });
    } else {
      const first = sourceFile.getStatements()[0];
      const pos = first ? first.getStart() : text.length;
      edits.push({ start: pos, end: pos, text: newDecls.join("\n") + "\n" });
    }
  }
  return { result, edits };
}

interface ReverseTarget {
  value?: string; // replacement for a value reference
  call?: string; // replacement for `name()` (callAfter members)
  type?: string; // replacement for a type reference
  hint?: string; // never reversed; reported in `left` with this hint
}

function reverseTable(rule: Rule): Record<string, ReverseTarget> {
  const table: Record<string, ReverseTarget> = {};
  for (const [deno, m] of Object.entries(rule.members)) {
    table[m.to] = m.reverseHint
      ? { hint: m.reverseHint }
      : m.callAfter
      ? { call: `Deno.${deno}` }
      : { value: `Deno.${deno}` };
  }
  for (const [deno, to] of Object.entries(rule.types)) {
    table[to] = { ...table[to], type: `Deno.${deno}` };
  }
  for (const [deno, to] of Object.entries(rule.nested)) {
    table[to] = { value: `Deno.${deno}` };
  }
  return table;
}

function reverseFile(
  sourceFile: SourceFile,
  rules: RuleName[],
  ralDir: string,
  checker: ts.TypeChecker,
): { result: CodemodResult; edits: Edit[] } {
  const result = emptyResult(sourceFile.getFilePath());
  const edits: Edit[] = [];
  const text = sourceFile.getFullText();
  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
  const localExports = sourceFile.getExportDeclarations()
    .filter((d) => !d.hasModuleSpecifier())
    .flatMap((d) => d.getNamedExports());

  for (const decl of sourceFile.getImportDeclarations()) {
    const ruleName = rules.find((r) =>
      resolvesToModule(sourceFile, decl.getModuleSpecifierValue(), ralDir, RULES[r].module)
    );
    if (!ruleName) continue;
    const rule = RULES[ruleName];
    const table = reverseTable(rule);
    const removed: ImportSpecifier[] = [];
    for (const spec of decl.getNamedImports()) {
      const target = table[spec.getName()];
      if (!target) continue;
      const local = spec.getAliasNode()?.getText() ?? spec.getName();
      const refs = identifiers.filter((id) =>
        id.getText() === local && isBindingOrReference(id) &&
        id !== spec.getNameNode() && id !== spec.getAliasNode() &&
        referencedDeclarations(id, checker).includes(spec.compilerNode)
      );
      // `export { x }` / `export { x as y }` re-exports the binding itself and
      // has no `Deno.*` spelling; keep the import (reported in `left`).
      const reexport = localExports.find((e) =>
        checker.getExportSpecifierLocalTargetSymbol(e.compilerNode)?.declarations
          ?.includes(spec.compilerNode)
      );
      if (target.hint) {
        // Never reversed (the `Deno.*` spelling means something else on some
        // branches); keep the import and report in `left` with the hint. The
        // line is the first use of the binding, counting a re-export as a
        // use, or the specifier's line when nothing uses it.
        const uses = [...(reexport ? [reexport] : []), ...refs];
        const line = uses.length
          ? Math.min(...uses.map((n) => n.getStartLineNumber()))
          : spec.getStartLineNumber();
        result.left.push({ name: local, line, module: rule.module, hint: target.hint });
        continue;
      }
      if (reexport) {
        result.left.push({ name: local, line: reexport.getStartLineNumber(), module: rule.module });
        continue;
      }
      const specEdits: Edit[] = [];
      const specReplacements: Replacement[] = [];
      let complete = true;
      for (const id of refs) {
        const parent = id.getParent()!;
        let node: Node = id;
        let to: string | undefined;
        const isType = Node.isTypeReference(parent) && parent.getTypeName() === id;
        if (denoBoundAt(id, isType ? kNamespaceMeaning : kValueMeaning, checker)) {
          // The introduced `Deno.*` would name the local binding, not the
          // runtime global; keep the import (reported in `left`).
          to = undefined;
        } else if (isType) {
          to = target.type;
        } else if (target.call) {
          if (Node.isCallExpression(parent) && parent.getExpression() === id &&
            parent.getArguments().length === 0) {
            node = parent;
            to = target.call;
          }
        } else {
          to = target.value;
        }
        if (to === undefined) {
          complete = false;
          result.left.push({ name: local, line: id.getStartLineNumber(), module: rule.module });
          break;
        }
        // A shorthand property (`{ os }`) cannot take a dotted value; expand
        // it to an explicit assignment, keeping the property name.
        if (Node.isShorthandPropertyAssignment(parent)) {
          node = parent;
          to = `${id.getText()}: ${to}`;
        }
        specEdits.push({ start: node.getStart(), end: node.getEnd(), text: to });
        specReplacements.push({ line: node.getStartLineNumber(), from: node.getText(), to });
      }
      if (complete) {
        edits.push(...specEdits);
        result.replacements.push(...specReplacements);
        removed.push(spec);
      }
    }
    if (removed.length === 0) continue;
    result.importsRemoved[rule.module] = removed.map((s) => s.getName()).sort(byName);
    const keep = decl.getNamedImports().filter((s) => !removed.includes(s));
    if (keep.length === 0 && !decl.getDefaultImport() && !decl.getNamespaceImport()) {
      let end = decl.getEnd();
      if (text.startsWith("\r\n", end)) end += 2;
      else if (text.startsWith("\n", end)) end += 1;
      edits.push({ start: decl.getStart(), end, text: "" });
    } else {
      edits.push({
        start: decl.getStart(),
        end: decl.getEnd(),
        text: renderImport(decl, keep.map((s) => s.getText()), decl.isTypeOnly()),
      });
    }
  }
  return { result, edits };
}

function parseArgs(argv: string[]) {
  const opts = {
    rules: [] as RuleName[],
    dirs: [] as string[],
    files: [] as string[],
    dryRun: false,
    reverse: false,
    ralDir: join(Deno.cwd(), "src", "deno_ral"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--reverse") opts.reverse = true;
    else if (a === "--rules") opts.rules = argv[++i].split(",") as RuleName[];
    else if (a === "--dir") opts.dirs.push(argv[++i]);
    else if (a === "--file") opts.files.push(argv[++i]);
    else if (a === "--ral-dir") opts.ralDir = resolve(argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  if (opts.rules.length === 0) throw new Error("--rules is required");
  for (const r of opts.rules) {
    if (!(r in RULES)) {
      throw new Error(`unknown rule: ${r} (expected ${Object.keys(RULES).join(", ")})`);
    }
  }
  if (opts.dirs.length + opts.files.length === 0) {
    throw new Error("--dir or --file is required");
  }
  return opts;
}

if (import.meta.main) {
  const opts = parseArgs(Deno.args);
  const files = [...opts.files, ...opts.dirs.flatMap((d) => collectFiles(d))];
  let rewritten = 0, replacements = 0, withCollisions = 0, skipped = 0, left = 0;
  for (const file of files) {
    const r = codemodFile(file, opts.rules, {
      ralDir: opts.ralDir,
      dryRun: opts.dryRun,
      reverse: opts.reverse,
    });
    const rel = relative(Deno.cwd(), file).replaceAll("\\", "/");
    if (r.skipped) {
      skipped++;
      console.log(`${rel}: skipped: ${r.skipped}`);
      continue;
    }
    for (const c of r.collisions) {
      console.log(
        `${rel}:${c.line}: collision: local binding '${c.name}' conflicts with deno_ral/${c.module}; left as Deno.*`,
      );
    }
    for (const c of r.left) {
      console.log(
        `${rel}:${c.line}: left: '${c.name}' (deno_ral/${c.module}) ${c.hint ?? "has a use --reverse cannot express"}; edit by hand`,
      );
    }
    if (r.collisions.length > 0) withCollisions++;
    left += r.left.length;
    if (r.replacements.length > 0) {
      rewritten++;
      replacements += r.replacements.length;
      const changes = Object.entries(opts.reverse ? r.importsRemoved : r.importsAdded)
        .map(([m, n]) => `${m}: ${n.join(", ")}`).join("; ");
      const verb = opts.reverse ? "import removed" : "import";
      console.log(`${rel}: ${r.replacements.length} replacement(s)${changes ? `, ${verb} ${changes}` : ""}`);
      if (opts.dryRun) {
        for (const rep of r.replacements) console.log(`  ${rel}:${rep.line}: ${rep.from} → ${rep.to}`);
      }
    }
  }
  console.log(
    `Summary: ${files.length} files scanned, ${rewritten} ${opts.dryRun ? "would be " : ""}rewritten, ${replacements} replacements, ${withCollisions} with collisions, ${skipped} skipped${opts.reverse ? `, ${left} left` : ""}`,
  );
}
