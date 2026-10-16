import * as d3 from "../src/index.mjs";
import it from "./fetch.mjs";
import assert from "assert";

const {resolveFrom} = d3;

it("resolveFrom() defaults to jsDelivr", async () => {
  const resolve1 = resolveFrom();
  assert.strictEqual(await resolve1("d3"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min.js");
  assert.strictEqual(await resolve1("d3/dist/d3.min.js"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min.js");
  assert.strictEqual(await resolve1("d3@7"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min.js");
  assert.strictEqual(await resolve1("d3@7/dist/d3.min.js"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min.js");
  assert.strictEqual(await resolve1("d3@7.4.4/dist/d3.min.js"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min.js");
  const resolve2 = resolveFrom(undefined);
  assert.strictEqual(await resolve2("d3@7.4.4/dist/d3.min.js"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min.js");
});

it("resolveFrom(origin) respects the specified origin", async () => {
  const resolve1 = resolveFrom("https://unpkg.com/");
  assert.strictEqual(await resolve1("d3"), "https://unpkg.com/d3@7.4.4/dist/d3.min.js");
  assert.strictEqual(await resolve1("d3/dist/d3.min.js"), "https://unpkg.com/d3@7.4.4/dist/d3.min.js");
  assert.strictEqual(await resolve1("d3@7"), "https://unpkg.com/d3@7.4.4/dist/d3.min.js");
  assert.strictEqual(await resolve1("d3@7/dist/d3.min.js"), "https://unpkg.com/d3@7.4.4/dist/d3.min.js");
  assert.strictEqual(await resolve1("d3@7.4.4/dist/d3.min.js"), "https://unpkg.com/d3@7.4.4/dist/d3.min.js");
  const resolve2 = resolveFrom("https://cdn.jsdelivr.net/npm/");
  assert.strictEqual(await resolve2("d3"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min.js");
  assert.strictEqual(await resolve2("d3/dist/d3.min.js"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min.js");
  assert.strictEqual(await resolve2("d3@7"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min.js");
  assert.strictEqual(await resolve2("d3@7/dist/d3.min.js"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min.js");
  assert.strictEqual(await resolve2("d3@7.4.4/dist/d3.min.js"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min.js");
});

it("resolveFrom(origin) requires the origin to have a trailing slash", async () => {
  assert.throws(() => resolveFrom("https://unpkg.com"), /origin lacks trailing slash/);
});

it("resolve(name) adds the file extension if necessary", async () => {
  const resolve = resolveFrom();
  assert.strictEqual(await resolve("d3/dist/d3"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.js");
  assert.strictEqual(await resolve("d3/dist/d3"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.js");
  assert.strictEqual(await resolve("d3@7.4.4/dist/d3"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.js");
});

it("resolve(name) does not add the file extension if not necessary", async () => {
  const resolve = resolveFrom();
  assert.strictEqual(await resolve("d3/dist/d3.js"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.js");
  assert.strictEqual(await resolve("d3/dist/d3.js"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.js");
  assert.strictEqual(await resolve("d3@7/dist/d3.min"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min");
  assert.strictEqual(await resolve("d3@7/dist/d3.min"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min");
  assert.strictEqual(await resolve("d3@7/dist/d3/"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3/");
  assert.strictEqual(await resolve("d3@7/dist/d3/"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3/");
  assert.strictEqual(await resolve("d3@7.4.4/dist/d3.js"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.js");
  assert.strictEqual(await resolve("d3@7.4.4/dist/d3.min"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3.min");
  assert.strictEqual(await resolve("d3@7.4.4/dist/d3/"), "https://cdn.jsdelivr.net/npm/d3@7.4.4/dist/d3/");
});

it("resolve(name) supports the browser entry point by default", async () => {
  const resolve = resolveFrom();
  assert.strictEqual(await resolve("simple-statistics"), "https://cdn.jsdelivr.net/npm/simple-statistics@6.0.0/dist/simple-statistics.min.js");
});

it("resolve(name) respects the specified main entry points, in order", async () => {
  const resolve1 = resolveFrom(undefined, ["main"]);
  assert.strictEqual(await resolve1("simple-statistics"), "https://cdn.jsdelivr.net/npm/simple-statistics@6.0.0/dist/simple-statistics.js");
  const resolve2 = resolveFrom(undefined, ["browser", "main"]);
  assert.strictEqual(await resolve2("simple-statistics"), "https://cdn.jsdelivr.net/npm/simple-statistics@6.0.0/dist/simple-statistics.min.js");
  const resolve3 = resolveFrom(undefined, ["main", "browser"]);
  assert.strictEqual(await resolve3("simple-statistics"), "https://cdn.jsdelivr.net/npm/simple-statistics@6.0.0/dist/simple-statistics.js");
});

it("resolve(name) ignores entry points that aren’t strings, and strips leading dot-slash", async () => {
  const resolve = resolveFrom();
  assert.strictEqual(await resolve("iconv-lite"), "https://cdn.jsdelivr.net/npm/iconv-lite@0.4.24/lib/index.js");
});

it("resolve(name, base) uses the base dependency version if a version is not specified", async () => {
  const resolve = resolveFrom();
  assert.strictEqual(await resolve("d3-array", "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.js"), "https://cdn.jsdelivr.net/npm/d3-array@3.1.6/dist/d3-array.min.js");
  assert.strictEqual(await resolve("d3-array/dist/d3-array.js", "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.js"), "https://cdn.jsdelivr.net/npm/d3-array@3.1.6/dist/d3-array.js");
});

it("resolve(name, base) ignores the base dependency version if a version is specified", async () => {
  const resolve = resolveFrom();
  assert.strictEqual(await resolve("d3-array@2", "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.js"), "https://cdn.jsdelivr.net/npm/d3-array@2.12.1/dist/d3-array.min.js");
  assert.strictEqual(await resolve("d3-array@2/dist/d3-array.js", "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.js"), "https://cdn.jsdelivr.net/npm/d3-array@2.12.1/dist/d3-array.js");
});
