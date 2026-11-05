import assert from "assert";
import {__query} from "../src/table.js";
import it, {invalidator} from "./invalidation.js";

describe("__query.sql", () => {
  it("evaluates using db.sql with the expected parameters", async () => {
    const [invalidation] = invalidator();
    const data = [{x: 1}, {x: 2}];
    let args;
    const db = {
      async sql() {
        args = Array.from(arguments);
        return data;
      }
    };
    assert.strictEqual(await __query.sql(db, invalidation)`SELECT * FROM data WHERE ${1}`, data);
    assert.deepStrictEqual(args, [[`SELECT * FROM data WHERE `, ``], 1]);
  });

  it("evaluates using db.query and db.queryTag with the expected parameters", async () => {
    const [invalidation] = invalidator();
    const data = [{x: 1}, {x: 2}];
    let queryTagArgs;
    let querySource;
    let queryParameters;
    const db = {
      queryTag(strings, ...args) {
        queryTagArgs = Array.from(arguments);
        return [strings.join("?"), args];
      },
      async query(source, parameters) {
        querySource = source;
        queryParameters = parameters;
        return data;
      }
    };
    assert.strictEqual(await __query.sql(db, invalidation)`SELECT * FROM data WHERE ${1}`, data);
    assert.deepStrictEqual(queryTagArgs, [[`SELECT * FROM data WHERE `, ""], 1]);
    assert.strictEqual(querySource, `SELECT * FROM data WHERE ?`);
    assert.deepStrictEqual(queryParameters, [1]);
  });

  it("evaluates using db.queryStream and db.queryTag with the expected parameters", async () => {
    const [invalidation] = invalidator();
    const data1 = [{x: 1}, {x: 2}];
    const data2 = [{x: 3}, {x: 4}];
    const schema = [{name: "x", type: "number", nullable: false}];
    let queryTagArgs;
    let querySource;
    let queryParameters;
    const db = {
      queryTag(strings, ...args) {
        queryTagArgs = Array.from(arguments);
        return [strings.join("?"), args];
      },
      async queryStream(source, parameters) {
        querySource = source;
        queryParameters = parameters;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          schema,
          async *readRows() {
            await new Promise((resolve) => setTimeout(resolve, 100));
            yield data1;
            await new Promise((resolve) => setTimeout(resolve, 100));
            yield data2;
          }
        };
      }
    };
    let i = 0;
    let previousResult;
    for await (const result of await __query.sql(db, invalidation)`SELECT * FROM data WHERE ${1}`) {
      switch (++i) {
        case 1:
          previousResult = result;
          assert.deepStrictEqual(result, Object.assign([...data1], {done: false, error: null, schema}));
          break;
        case 2:
          assert.strictEqual(result, previousResult);
          assert.deepStrictEqual(result, Object.assign([...data1, ...data2], {done: true, error: null, schema}));
          break;
        default:
          assert.fail("unexpected batch");
      }
    }
    assert.strictEqual(i, 2);
    assert.deepStrictEqual(queryTagArgs, [[`SELECT * FROM data WHERE `, ""], 1]);
    assert.strictEqual(querySource, `SELECT * FROM data WHERE ?`);
    assert.deepStrictEqual(queryParameters, [1]);
  });

  it("sends an abort signal to db.query when the invalidation promise resolves", async () => {
    const [invalidation, invalidate] = invalidator();
    const data = [{x: 1}, {x: 2}];
    let queryOptions;
    const db = {
      queryTag(strings, ...args) {
        return [strings.join("?"), args];
      },
      async query(source, parameters, options) {
        queryOptions = options;
        return data;
      }
    };
    assert.strictEqual(await __query.sql(db, invalidation)`SELECT * FROM data WHERE ${1}`, data);
    assert.strictEqual(queryOptions.signal.aborted, false);
    await invalidate();
    assert.strictEqual(queryOptions.signal.aborted, true);
  });
});
