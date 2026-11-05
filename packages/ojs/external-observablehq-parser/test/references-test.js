import assert from "assert";
import {parseCell} from "@observablehq/parser";
import {Node} from "acorn";

function node(fields) {
  return Object.assign(Object.create(Node.prototype), fields);
}

it("finds references in expressions", () => {
  assert.deepStrictEqual(parseCell(`foo + bar`).references, [
    node({type: "Identifier", start: 0, end: 3, name: "foo"}),
    node({type: "Identifier", start: 6, end: 9, name: "bar"})
  ]);
});

it("finds references in blocks", () => {
  assert.deepStrictEqual(parseCell(`{ foo + bar; }`).references, [
    node({type: "Identifier", start: 2, end: 5, name: "foo"}),
    node({type: "Identifier", start: 8, end: 11, name: "bar"})
  ]);
});

it("finds viewof references", () => {
  assert.deepStrictEqual(parseCell(`viewof foo + bar`).references, [
    node({
      type: "ViewExpression",
      start: 0,
      end: 10,
      id: node({type: "Identifier", start: 7, end: 10, name: "foo"})
    }),
    node({type: "Identifier", start: 13, end: 16, name: "bar"})
  ]);
});

it("finds mutable references", () => {
  assert.deepStrictEqual(parseCell(`mutable foo + bar`).references, [
    node({
      type: "MutableExpression",
      start: 0,
      end: 11,
      id: node({type: "Identifier", start: 8, end: 11, name: "foo"})
    }),
    node({type: "Identifier", start: 14, end: 17, name: "bar"})
  ]);
});

it("finds multiple references", () => {
  assert.deepStrictEqual(parseCell(`cell = {
  const a = b + c;
  const d = c - b;
}`).references, [
    node({type: "Identifier", start: 21, end: 22, name: "b"}),
    node({type: "Identifier", start: 25, end: 26, name: "c"}),
    node({type: "Identifier", start: 40, end: 41, name: "c"}),
    node({type: "Identifier", start: 44, end: 45, name: "b"})
  ]);
});

it("doesn’t consider the identifier a reference", () => {
  assert.deepStrictEqual(parseCell(`foo = bar`).references, [
    node({type: "Identifier", start: 6, end: 9, name: "bar"})
  ]);
});

it("local variables can mask references", () => {
  assert.deepStrictEqual(parseCell(`{ let foo; foo + bar; }`).references, [
    node({type: "Identifier", start: 17, end: 20, name: "bar"})
  ]);
});

it("local variables can not mask references", () => {
  assert.deepStrictEqual(parseCell(`{ foo + bar; { let foo; } }`).references, [
    node({type: "Identifier", start: 2, end: 5, name: "foo"}),
    node({type: "Identifier", start: 8, end: 11, name: "bar"})
  ]);
});

it("function parameters can mask references", () => {
  assert.deepStrictEqual(parseCell(`foo => foo + bar`).references, [
    node({type: "Identifier", start: 13, end: 16, name: "bar"})
  ]);
});

it("function rest parameters can mask references", () => {
  assert.deepStrictEqual(parseCell(`(...foo) => foo + bar`).references, [
    node({type: "Identifier", start: 18, end: 21, name: "bar"})
  ]);
});

it("destructured variables can mask references", () => {
  assert.deepStrictEqual(parseCell(`{ let {foo} = null; foo + bar; }`).references, [
    node({type: "Identifier", start: 26, end: 29, name: "bar"})
  ]);
});

it("destructured rest variables can mask references", () => {
  assert.deepStrictEqual(parseCell(`{ let {...foo} = null; foo + bar; }`).references, [
    node({type: "Identifier", start: 29, end: 32, name: "bar"})
  ]);
});

it("ignores globals", () => {
  assert.deepStrictEqual(parseCell(`foo + bar`, {globals: ["foo"]}).references, [
    node({type: "Identifier", start: 6, end: 9, name: "bar"})
  ]);
});
