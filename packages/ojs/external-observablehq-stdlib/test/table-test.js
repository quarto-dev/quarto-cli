import {
  coerceToType,
  getTypeValidator,
  inferSchema,
  makeQueryTemplate,
  __table,
  getSchema
} from "../src/table.js";
import assert from "assert";

export const EMPTY_TABLE_DATA = {
  source: {
    name: null,
    type: null
  },
  operations: {
    select: {
      columns: null
    },
    from: {
      table: null,
      mimeType: null
    },
    filter: [],
    sort: [],
    slice: {
      from: null,
      to: null
    }
  },
  ui: {
    showCharts: true
  }
};

const baseOperations = {
  ...EMPTY_TABLE_DATA.operations,
  select: {columns: ["col1", "col2"]},
  from: {
    table: "table1",
    mimeType: null
  }
};

function escape(identifier) {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

describe("makeQueryTemplate", () => {
  it("makeQueryTemplate null table", () => {
    const source = {};
    assert.throws(() => makeQueryTemplate(EMPTY_TABLE_DATA.operations, source), /missing from table/);
  });

  it("makeQueryTemplate no selected columns", () => {
    const source = {name: "db", dialect: "postgres"};
    const operationsColumnsEmpty = {...baseOperations, select: {columns: []}};
    assert.throws(() => makeQueryTemplate(operationsColumnsEmpty, source), /at least one column must be selected/);
  });

  it("makeQueryTemplate select all", () => {
    const source = {name: "db", dialect: "postgres"};
    const operationsColumnsNull = {...baseOperations, select: {columns: null}};
    assert.deepStrictEqual(makeQueryTemplate(operationsColumnsNull, source), [["SELECT * FROM table1"]]);
  });

  it("makeQueryTemplate invalid filter operation", () => {
    const source = {name: "db", dialect: "postgres"};
    const invalidFilters = [
      {
        type: "n",
        operands: [
          {type: "column", value: "col1"},
          {type: "resolved", value: "val1"}
        ]
      },
      {
        type: "eq",
        operands: [{type: "column", value: "col1"}]
      },
      {
        type: "lt",
        operands: [
          {type: "column", value: "col1"},
          {type: "resolved", value: "val1"},
          {type: "resolved", value: "val2"}
        ]
      }
    ];

    invalidFilters.map((filter) => {
      const operations = {
        ...baseOperations,
        filter: [filter]
      };
      assert.throws(() => makeQueryTemplate(operations, source), /Invalid filter operation/);
    });
  });

  it("makeQueryTemplate filter", () => {
    const source = {name: "db", dialect: "postgres"};
    const operations = {
      ...baseOperations,
      filter: [
        {
          type: "eq",
          operands: [
            {type: "column", value: "col1"},
            {type: "resolved", value: "val1"}
          ]
        }
      ]
    };

    const [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(parts.join("?"), "SELECT col1, col2 FROM table1\nWHERE col1 = ?");
    assert.deepStrictEqual(params, ["val1"]);
  });

  it("makeQueryTemplate filter and escape filters column", () => {
    const source = {name: "db", dialect: "postgres", escape: (i) => `_${i}_`};
    const operations = {
      ...baseOperations,
      filter: [
        {
          type: "eq",
          operands: [
            {type: "column", value: "col2"},
            {type: "resolved", value: "val1"}
          ]
        }
      ]
    };

    const [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(
      parts.join("?"),
      "SELECT _col1_, _col2_ FROM _table1_\nWHERE _col2_ = ?"
    );
    assert.deepStrictEqual(params, ["val1"]);
  });

  it("makeQueryTemplate filter and escape filters column only once", () => {
    const source = {name: "db", dialect: "postgres", escape: (i) => `_${i}_`};
    const operations = {
      ...baseOperations,
      filter: [
        {
          type: "eq",
          operands: [
            {type: "column", value: "col2"},
            {type: "resolved", value: "val1"}
          ]
        }
      ]
    };

    makeQueryTemplate(operations, source);
    const [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(
        parts.join("?"),
        "SELECT _col1_, _col2_ FROM _table1_\nWHERE _col2_ = ?"
    );
    assert.deepStrictEqual(params, ["val1"]);
  });

  it("makeQueryTemplate filter list", () => {
    const source = {name: "db", dialect: "postgres"};
    const operations = {
      ...baseOperations,
      filter: [
        {
          type: "in",
          operands: [
            {type: "column", value: "col1"},
            {type: "resolved", value: "val1"},
            {type: "resolved", value: "val2"},
            {type: "resolved", value: "val3"}
          ]
        },
        {
          type: "nin",
          operands: [
            {type: "column", value: "col1"},
            {type: "resolved", value: "val4"}
          ]
        }
      ]
    };

    const [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(parts.join("?"), "SELECT col1, col2 FROM table1\nWHERE col1 IN (?,?,?)\nAND col1 NOT IN (?)");
    assert.deepStrictEqual(params, ["val1", "val2", "val3", "val4"]);
  });

  it("makeQueryTemplate filter valid and not valid", () => {
    const source = {name: "db", dialect: "postgres"};
    const operations = {
      ...baseOperations,
      filter: [
        {
          type: "v",
          operands: [
            {type: "column", value: "col1"},
            {type: "primitive", value: "string"}
          ]
        },
        {
          type: "nv",
          operands: [
            {type: "column", value: "col2"},
            {type: "primitive", value: "number"}
          ]
        }
      ]
    };
    const [parts] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(parts.join("?"), "SELECT col1, col2 FROM table1\nWHERE col1 IS NOT NULL\nAND col2 IS NULL");
  });

  it("makeQueryTemplate select", () => {
    const source = {name: "db", dialect: "mysql"};
    const operations = {
      ...baseOperations,
      select: {
        columns: ["col1", "col2", "col3"]
      }
    };

    const [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(parts.join("?"), "SELECT col1, col2, col3 FROM table1");
    assert.deepStrictEqual(params, []);
  });

  it("makeQueryTemplate sort", () => {
    const source = {name: "db", dialect: "mysql"};
    const operations = {
      ...baseOperations,
      sort: [
        {column: "col1", direction: "asc"},
        {column: "col2", direction: "desc"}
      ]
    };

    const [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(parts.join("?"), "SELECT col1, col2 FROM table1\nORDER BY col1 ASC, col2 DESC");
    assert.deepStrictEqual(params, []);
  });

  it("makeQueryTemplate sort and escape sort column", () => {
    const source = {name: "db", dialect: "mysql", escape: (i) => `_${i}_`};
    const operations = {
      ...baseOperations,
      sort: [
        {column: "col1", direction: "asc"},
        {column: "col2", direction: "desc"}
      ]
    };

    const [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(
      parts.join("?"),
      "SELECT _col1_, _col2_ FROM _table1_\nORDER BY _col1_ ASC, _col2_ DESC"
    );
    assert.deepStrictEqual(params, []);
  });

  it("makeQueryTemplate slice", () => {
    const source = {name: "db", dialect: "mysql"};
    const operations = {...baseOperations};

    operations.slice = {from: 10, to: 20};
    let [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(parts.join("?"), "SELECT col1, col2 FROM table1\nLIMIT 10 OFFSET 10");
    assert.deepStrictEqual(params, []);

    operations.slice = {from: null, to: 20};
    [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(parts.join("?"), "SELECT col1, col2 FROM table1\nLIMIT 20");
    assert.deepStrictEqual(params, []);

    operations.slice = {from: 10, to: null};
    [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(parts.join("?"), `SELECT col1, col2 FROM table1\nLIMIT ${1e9} OFFSET 10`);
    assert.deepStrictEqual(params, []);
  });

  it("makeQueryTemplate select, sort, slice, filter indexed", () => {
    const source = {name: "db", dialect: "postgres"};
    const operations = {
      ...baseOperations,
      select: {
        columns: ["col1", "col2", "col3"]
      },
      sort: [{column: "col1", direction: "asc"}],
      slice: {from: 10, to: 100},
      filter: [
        {
          type: "gte",
          operands: [
            {type: "column", value: "col1"},
            {type: "resolved", value: "val1"}
          ]
        },
        {
          type: "eq",
          operands: [
            {type: "column", value: "col2"},
            {type: "resolved", value: "val2"}
          ]
        }
      ]
    };

    const [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(parts.join("?"), "SELECT col1, col2, col3 FROM table1\nWHERE col1 >= ?\nAND col2 = ?\nORDER BY col1 ASC\nLIMIT 90 OFFSET 10");
    assert.deepStrictEqual(params, ["val1", "val2"]);
  });

  it("makeQueryTemplate select, slice and escape column name with mssql syntax", () => {
    const source = {name: "db", dialect: "mssql", escape: (i) => `_${i}_`};
    const operations = {
      ...baseOperations,
      select: {
        columns: ["col1", "col2", "col3"]
      },
      slice: {to: 100}
    };

    const [parts] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(
      parts.join("?"),
      "SELECT _col1_, _col2_, _col3_ FROM _table1_\nORDER BY _col1_ ASC\nOFFSET 0 ROWS\nFETCH NEXT 100 ROWS ONLY"
    );
  });

  it("makeQueryTemplate select, sort, slice, filter indexed with mssql syntax", () => {
    const source = {name: "db", dialect: "mssql"};
    const operations = {
      ...baseOperations,
      select: {
        columns: ["col1", "col2", "col3"]
      },
      sort: [{column: "col2", direction: "desc"}],
      slice: {from: 10, to: 100},
      filter: [
        {
          type: "gte",
          operands: [
            {type: "column", value: "col1"},
            {type: "resolved", value: "val1"}
          ]
        },
        {
          type: "eq",
          operands: [
            {type: "column", value: "col2"},
            {type: "resolved", value: "val2"}
          ]
        }
      ]
    };

    const [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(parts.join("?"), "SELECT col1, col2, col3 FROM table1\nWHERE col1 >= ?\nAND col2 = ?\nORDER BY col2 DESC\nOFFSET 10 ROWS\nFETCH NEXT 90 ROWS ONLY");
    assert.deepStrictEqual(params, ["val1", "val2"]);
  });

  it("makeQueryTemplate throw if no columns are explicitly specified for mssql dialect", () => {
    const source = {name: "db", dialect: "mssql"};
    const operations = {
      ...baseOperations,
      select: {
        columns: null
      },
      sort: [],
      slice: {from: 10, to: 100}
    };

    assert.throws(() => {
      makeQueryTemplate(operations, source);
    }, Error);
  });

  it("makeQueryTemplate the sort and slice if no columns are explicitly BUT sort has value for mssql dialect", () => {
    const source = {name: "db", dialect: "mssql"};
    const operations = {
      ...baseOperations,
      select: {
        columns: null
      },
      sort: [{column: "col2", direction: "desc"}],
      slice: {from: 10, to: 100}
    };

    const [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(parts.join("?"), "SELECT * FROM table1\nORDER BY col2 DESC\nOFFSET 10 ROWS\nFETCH NEXT 90 ROWS ONLY");
    assert.deepStrictEqual(params, []);
  });

  it("makeQueryTemplate throw if no columns are explicitly specified for oracle dialect", () => {
    const source = {name: "db", dialect: "oracle"};
    const operations = {
      ...baseOperations,
      select: {
        columns: null
      },
      sort: [],
      slice: {from: 10, to: 100}
    };

    assert.throws(() => {
      makeQueryTemplate(operations, source);
    }, Error);
  });

  it("makeQueryTemplate select, sort, slice, filter indexed with oracle syntax", () => {
    const source = {name: "db", dialect: "oracle"};
    const operations = {
      ...baseOperations,
      select: {
        columns: ["col1", "col2", "col3"]
      },
      sort: [{column: "col2", direction: "desc"}],
      slice: {from: 10, to: 100},
      filter: [
        {
          type: "gte",
          operands: [
            {type: "column", value: "col1"},
            {type: "resolved", value: "val1"}
          ]
        },
        {
          type: "eq",
          operands: [
            {type: "column", value: "col2"},
            {type: "resolved", value: "val2"}
          ]
        }
      ]
    };

    const [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(
      parts.join("?"),
      "SELECT col1, col2, col3 FROM table1\nWHERE col1 >= ?\nAND col2 = ?\nORDER BY col2 DESC\nOFFSET 10 ROWS\nFETCH NEXT 90 ROWS ONLY"
    );
    assert.deepStrictEqual(params, ["val1", "val2"]);
  });

  it("makeQueryTemplate names", () => {
    const source = {name: "db", dialect: "mysql", escape};
    let operations = {
      ...baseOperations,
      select: {
        columns: ["col1", "col2", "col3"]
      },
      names: [
        {column: "col1", name: "name1"},
        {column: "col2", name: "name2"},
        {column: "col3", name: "name3"}
      ]
    };

    const [parts, ...params] = makeQueryTemplate(operations, source);
    assert.deepStrictEqual(parts.join("?"), "SELECT `col1` AS `name1`, `col2` AS `name2`, `col3` AS `name3` FROM `table1`");
    assert.deepStrictEqual(params, []);
  });
});

describe("__table", () => {
  let source;

  beforeEach(() => {
    source = [
      {a: 1, b: 2, c: 3},
      {a: 2, b: 4, c: 6},
      {a: 3, b: 6, c: 9}
    ];
    source.schema = [
      {name: "a", type: "integer", inferred: "integer"},
      {name: "b", type: "integer", inferred: "integer"},
      {name: "c", type: "integer", inferred: "integer"}
    ];
  });

  it("__table no operations", () => {
    assert.deepStrictEqual(
      __table(source, EMPTY_TABLE_DATA.operations),
      source
    );
  });

  it("__table columns", () => {
    const operationsNullColumns = {
      ...EMPTY_TABLE_DATA.operations,
      select: {columns: null}
    };
    assert.deepStrictEqual(__table(source, operationsNullColumns), source);
    const operationsEmptyColumns = {
      ...EMPTY_TABLE_DATA.operations,
      select: {columns: []}
    };
    const expectedEmpty = [{}, {}, {}];
    expectedEmpty.schema = [];
    expectedEmpty.fullSchema = source.schema;
    expectedEmpty.errors = new Map();
    assert.deepStrictEqual(
      __table(source, operationsEmptyColumns),
      expectedEmpty
    );
    const operationsSelectedColumns = {
      ...EMPTY_TABLE_DATA.operations,
      select: {columns: ["a"]}
    };
    const expectedSelected = [{a: 1}, {a: 2}, {a: 3}];
    expectedSelected.schema = [{name: "a", type: "integer", inferred: "integer"}];
    expectedSelected.fullSchema = source.schema;
    expectedSelected.errors = new Map();
    assert.deepStrictEqual(
      __table(source, operationsSelectedColumns),
      expectedSelected
    );
  });

  it("__table unknown filter", () => {
    const operations = {
      ...EMPTY_TABLE_DATA.operations,
      filter: [{type: "xyz", operands: [{type: "column", value: "a"}]}]
    };
    assert.throws(
      () => __table(source, operations),
      /unknown filter type: xyz/
    );
  });

  it("__table filter lt + gt", () => {
    const operationsEquals = {
      ...EMPTY_TABLE_DATA.operations,
      filter: [
        {
          type: "eq",
          operands: [
            {type: "column", value: "a"},
            {type: "resolved", value: 1}
          ]
        }
      ]
    };
    const expectedEq = [{a: 1, b: 2, c: 3}];
    expectedEq.schema = source.schema;
    expectedEq.fullSchema = source.schema;
    expectedEq.errors = new Map();
    assert.deepStrictEqual(__table(source, operationsEquals), expectedEq);
    const operationsComparison = {
      ...EMPTY_TABLE_DATA.operations,
      filter: [
        {
          type: "lt",
          operands: [
            {type: "column", value: "a"},
            {type: "resolved", value: 3}
          ]
        },
        {
          type: "gt",
          operands: [
            {type: "column", value: "b"},
            {type: "resolved", value: 2}
          ]
        }
      ]
    };
    const expectedLtGt = [{a: 2, b: 4, c: 6}];
    expectedLtGt.schema = source.schema;
    expectedLtGt.fullSchema = source.schema;
    expectedLtGt.errors = new Map();
    assert.deepStrictEqual(__table(source, operationsComparison), expectedLtGt);
  });

  it("__table filter lte + gte", () => {
    const operationsEquals = {
      ...EMPTY_TABLE_DATA.operations,
      filter: [
        {
          type: "eq",
          operands: [
            {type: "column", value: "a"},
            {type: "resolved", value: 1}
          ]
        }
      ]
    };
    const expectedEq = [{a: 1, b: 2, c: 3}];
    expectedEq.schema = source.schema;
    expectedEq.fullSchema = source.schema;
    expectedEq.errors = new Map();
    assert.deepStrictEqual(__table(source, operationsEquals), expectedEq);
    const operationsComparison = {
      ...EMPTY_TABLE_DATA.operations,
      filter: [
        {
          type: "lte",
          operands: [
            {type: "column", value: "a"},
            {type: "resolved", value: 2.5}
          ]
        },
        {
          type: "gte",
          operands: [
            {type: "column", value: "b"},
            {type: "resolved", value: 2.5}
          ]
        }
      ]
    };
    const expectedLteGte = [{a: 2, b: 4, c: 6}];
    expectedLteGte.schema = source.schema;
    expectedLteGte.fullSchema = source.schema;
    expectedLteGte.errors = new Map();
    assert.deepStrictEqual(
      __table(source, operationsComparison),
      expectedLteGte
    );
  });

  it("__table filter eq date", () => {
    const operationsEquals = {
      ...EMPTY_TABLE_DATA.operations,
      filter: [
        {
          type: "eq",
          operands: [
            {type: "column", value: "a"},
            {type: "resolved", value: new Date("2021-01-02")}
          ]
        }
      ]
    };
    const source = [
      {a: new Date("2021-01-01")},
      {a: new Date("2021-01-02")},
      {a: new Date("2021-01-03")}
    ];
    const expected = [{a: new Date("2021-01-02")}];
    expected.schema = [{name: "a", type: "date", inferred: "date"}];
    expected.fullSchema = expected.schema;
    expected.errors = new Map();
    assert.deepStrictEqual(__table(source, operationsEquals), expected);
  });

  it("__table sort", () => {
    const operationsDesc = {
      ...EMPTY_TABLE_DATA.operations,
      sort: [{column: "a", direction: "desc"}]
    };
    const expectedDesc = [
      {a: 3, b: 6, c: 9},
      {a: 2, b: 4, c: 6},
      {a: 1, b: 2, c: 3}
    ];
    expectedDesc.schema = source.schema;
    expectedDesc.fullSchema = source.schema;
    expectedDesc.errors = new Map();
    assert.deepStrictEqual(__table(source, operationsDesc), expectedDesc);
    const operationsAsc = {
      ...EMPTY_TABLE_DATA.operations,
      sort: [{column: "a", direction: "asc"}]
    };
    const expectedAsc = [
      {a: 1, b: 2, c: 3},
      {a: 2, b: 4, c: 6},
      {a: 3, b: 6, c: 9}
    ];
    expectedAsc.schema = source.schema;
    expectedAsc.fullSchema = source.schema;
    expectedAsc.errors = new Map();
    assert.deepStrictEqual(__table(source, operationsAsc), expectedAsc);
    const sourceExtended = [...source, {a: 1, b: 3, c: 3}, {a: 1, b: 5, c: 3}];
    const operationsMulti = {
      ...EMPTY_TABLE_DATA.operations,
      sort: [
        {column: "a", direction: "desc"},
        {column: "b", direction: "desc"}
      ]
    };
    const expectedExtended = [
      {a: 3, b: 6, c: 9},
      {a: 2, b: 4, c: 6},
      {a: 1, b: 5, c: 3},
      {a: 1, b: 3, c: 3},
      {a: 1, b: 2, c: 3}
    ];
    expectedExtended.schema = source.schema;
    expectedExtended.fullSchema = source.schema;
    expectedExtended.errors = new Map();
    assert.deepStrictEqual(
      __table(sourceExtended, operationsMulti),
      expectedExtended
    );
  });

  it("__table sort missing values", () => {
    const sourceWithMissing = [
      {a: 1}, {a: null}, {a: undefined}, {a: 10}, {a: 5}, {a: NaN}, {a: null}, {a: 20}
    ];
    const operationsDesc = {
      ...EMPTY_TABLE_DATA.operations,
      sort: [{column: "a", direction: "desc"}]
    };
    const expectedDesc = [
      {a: 20}, {a: 10}, {a: 5}, {a: 1}, {a: NaN}, {a: NaN}, {a: NaN}, {a: NaN}
    ];
    expectedDesc.schema = [{name: "a", type: "number", inferred: "number"}];
    expectedDesc.fullSchema = expectedDesc.schema;
    expectedDesc.errors = new Map();
    assert.deepStrictEqual(
      __table(sourceWithMissing, operationsDesc),
      expectedDesc
    );
    const operationsAsc = {
      ...EMPTY_TABLE_DATA.operations,
      sort: [{column: "a", direction: "asc"}]
    };
    const expectedAsc = [
      {a: 1}, {a: 5}, {a: 10}, {a: 20}, {a: NaN}, {a: NaN}, {a: NaN}, {a: NaN}
    ];
    expectedAsc.schema = [{name: "a", type: "number", inferred: "number"}];
    expectedAsc.fullSchema = expectedAsc.schema;
    expectedAsc.errors = new Map();
    assert.deepStrictEqual(
      __table(sourceWithMissing, operationsAsc),
      expectedAsc
    );
  });

  it("__table sort does not mutate input", () => {
    const operations = {
      ...EMPTY_TABLE_DATA.operations,
      sort: [{column: "a", direction: "desc"}]
    };
    const sorted = [
      {a: 3, b: 6, c: 9},
      {a: 2, b: 4, c: 6},
      {a: 1, b: 2, c: 3}
    ];
    sorted.schema = source.schema;
    sorted.fullSchema = source.schema;
    sorted.errors = new Map();
    assert.deepStrictEqual(__table(source, operations), sorted);
    const originalOrder = [
      {a: 1, b: 2, c: 3},
      {a: 2, b: 4, c: 6},
      {a: 3, b: 6, c: 9}
    ];
    originalOrder.schema = source.schema;
    assert.deepStrictEqual(source, originalOrder);
  });

  it("__table slice", () => {
    const operationsToNull = {
      ...EMPTY_TABLE_DATA.operations,
      slice: {from: 1, to: null}
    };
    const expectedToNull = [
      {a: 2, b: 4, c: 6},
      {a: 3, b: 6, c: 9}
    ];
    expectedToNull.schema = source.schema;
    expectedToNull.fullSchema = source.schema;
    expectedToNull.errors = new Map();
    assert.deepStrictEqual(__table(source, operationsToNull), expectedToNull);
    const operationsFromNull = {
      ...EMPTY_TABLE_DATA.operations,
      slice: {from: null, to: 1}
    };
    const expectedFromNull = [{a: 1, b: 2, c: 3}];
    expectedFromNull.schema = source.schema;
    expectedFromNull.fullSchema = source.schema;
    expectedFromNull.errors = new Map();
    assert.deepStrictEqual(
      __table(source, operationsFromNull),
      expectedFromNull
    );
    const operations = {
      ...EMPTY_TABLE_DATA.operations,
      slice: {from: 1, to: 2}
    };
    const expectedSlice = [{a: 2, b: 4, c: 6}];
    expectedSlice.schema = source.schema;
    expectedSlice.fullSchema = source.schema;
    expectedSlice.errors = new Map();
    assert.deepStrictEqual(__table(source, operations), expectedSlice);
  });

  it("__table retains schema and columns info", () => {
    source.columns = ["a", "b", "c"];
    assert.deepStrictEqual(
      __table(source, EMPTY_TABLE_DATA.operations).columns,
      ["a", "b", "c"]
    );
    source.schema = [
      {name: "a", type: "number", inferred: "number"},
      {name: "b", type: "number", inferred: "number"},
      {name: "c", type: "number", inferred: "number"}
    ];
    assert.deepStrictEqual(
      __table(source, EMPTY_TABLE_DATA.operations).schema,
      [
        {name: "a", type: "number", inferred: "number"},
        {name: "b", type: "number", inferred: "number"},
        {name: "c", type: "number", inferred: "number"}
      ]
    );
  });

  it("__table names", () => {
    const operations = {
      ...EMPTY_TABLE_DATA.operations,
      names: [{column: "a", name: "nameA"}]
    };
    const expected = [
      {nameA: 1, b: 2, c: 3},
      {nameA: 2, b: 4, c: 6},
      {nameA: 3, b: 6, c: 9}
    ];
    const schema = [
      {name: "nameA", type: "integer", inferred: "integer"},
      {name: "b", type: "integer", inferred: "integer"},
      {name: "c", type: "integer", inferred: "integer"}
    ];
    expected.schema = schema;
    expected.fullSchema = schema;
    expected.errors = new Map();
    assert.deepStrictEqual(__table(source, operations), expected);
    source.columns = ["a", "b", "c"];
  });

  it("__table type assertions", () => {
    const operations = {
      ...EMPTY_TABLE_DATA.operations,
      types: [{name: "a", type: "string"}]
    };
    const expected = [
      {a: "1", b: 2, c: 3},
      {a: "2", b: 4, c: 6},
      {a: "3", b: 6, c: 9}
    ];
    expected.schema = [
      {name: "a", type: "string", inferred: "integer"},
      {name: "b", type: "integer", inferred: "integer"},
      {name: "c", type: "integer", inferred: "integer"}
    ];
    expected.fullSchema = expected.schema;
    expected.errors = new Map();
    assert.deepStrictEqual(__table(source, operations), expected);
    source.columns = ["a", "b", "c"];
  });

  it("__table derived columns", () => {
    const operations = {
      ...EMPTY_TABLE_DATA.operations,
      derive: [{name: "d", value: (row) => row.a ** 2}]
    };
    const expected = [
      {a: 1, b: 2, c: 3, d: 1},
      {a: 2, b: 4, c: 6, d: 4},
      {a: 3, b: 6, c: 9, d: 9}
    ];
    expected.schema = [
      {name: "a", type: "integer", inferred: "integer"},
      {name: "b", type: "integer", inferred: "integer"},
      {name: "c", type: "integer", inferred: "integer"},
      {name: "d", type: "integer", inferred: "integer"}
    ];
    expected.fullSchema = expected.schema;
    expected.errors = new Map();
    assert.deepStrictEqual(__table(source, operations), expected);
  });

  it("__table derived columns with errors", () => {
    const functionWithError = (row) => row.a.b.c;
    const operations = {
      ...EMPTY_TABLE_DATA.operations,
      derive: [{name: "d", value: functionWithError}]
    };
    let error;
    try {
      functionWithError(source[0]);
    } catch (e) {
      error = e;
    }
    const expected = [
      {a: 1, b: 2, c: 3, d: undefined},
      {a: 2, b: 4, c: 6, d: undefined},
      {a: 3, b: 6, c: 9, d: undefined}
    ];
    expected.schema = [
      {name: "a", type: "integer", inferred: "integer"},
      {name: "b", type: "integer", inferred: "integer"},
      {name: "c", type: "integer", inferred: "integer"},
      {name: "d", type: "other", inferred: "other"}
    ];
    expected.fullSchema = expected.schema;
    expected.errors = new Map([["d", [{index: 0, error}, {index: 1, error}, {index: 2, error}]]]);
    assert.deepStrictEqual(__table(source, operations), expected);
  });
});

describe("getTypeValidator filters accurately", () => {
  let source = [
    {label: "string", value: "string"},
    {label: "object", value: {}},
    {label: "buffer", value: new ArrayBuffer()},
    {label: "boolean", value: true},
    {label: "array", value: [1, 2, 3]},
    {label: "number", value: 10.1},
    {label: "integer", value: 10},
    {label: "date", value: new Date(1)},
    // eslint-disable-next-line no-undef
    {label: "bigint", value: BigInt(10)},
    {label: "null", value: null},
    {label: "NaN", value: NaN},
    {label: "undefined"}
   ];

  it("filters strings", () => {
    const isValid = getTypeValidator("string");
    assert.deepStrictEqual(source.filter(d => isValid(d.value)), [{label: "string", value: "string"}]);
  });

  it("filters buffers", () => {
    const isValid = getTypeValidator("buffer");
    assert.deepStrictEqual(source.filter(d => isValid(d.value)), [{label: "buffer", value: new ArrayBuffer()}]);
  });

  it("filters numbers", () => {
    const isValid = getTypeValidator("number");
    assert.deepStrictEqual(source.filter(d => isValid(d.value)), [{label: "number", value: 10.1}, {label: "integer", value: 10}]);
  });

  it("filters integers", () => {
    const isValid = getTypeValidator("integer");
    assert.deepStrictEqual(
      source.filter((d) => isValid(d.value)),
      [{label: "integer", value: 10}]
    );
  });

  it("filters booleans", () => {
    const isValid = getTypeValidator("boolean");
    assert.deepStrictEqual(source.filter(d => isValid(d.value)), [{label: "boolean", value: true}]);
  });

  it("filters arrays", () => {
    const isValid = getTypeValidator("array");
    assert.deepStrictEqual(source.filter(d => isValid(d.value)), [{label: "array", value: [1, 2, 3]}]);
  });

  it("filters dates", () => {
    const isValid = getTypeValidator("date");
    assert.deepStrictEqual(source.filter(d => isValid(d.value)), [{label: "date", value: new Date(1)}]);
  });

  it("filters BigInts", () => {
    const isValid = getTypeValidator("bigint");
    // eslint-disable-next-line no-undef
    assert.deepStrictEqual(source.filter(d => isValid(d.value)), [{label: "bigint", value: BigInt(10)}]);
  });

  it("filters objects", () => {
    const isValid = getTypeValidator("object");
    assert.deepStrictEqual(source.filter(d => isValid(d.value)),
      [
        {label: "object", value: {}},
        {label: "buffer", value: new ArrayBuffer()},
        {label: "array", value: [1, 2, 3]},
        {label: "date", value: new Date(1)}]
    );
  });

  it("filters other", () => {
    const isValid = getTypeValidator("other");
    assert.deepStrictEqual(source.filter(d => isValid(d.value)),
    [
      {label: "string", value: "string"},
      {label: "object", value: {}},
      {label: "buffer", value: new ArrayBuffer()},
      {label: "boolean", value: true},
      {label: "array", value: [1, 2, 3]},
      {label: "number", value: 10.1},
      {label: "integer", value: 10},
      {label: "date", value: new Date(1)},
      // eslint-disable-next-line no-undef
      {label: "bigint", value: BigInt(10)},
      {label: "NaN", value: NaN}
    ]
    );
  });
});

describe("inferSchema", () => {
  it("infers schema", () => {
    assert.deepStrictEqual(
      inferSchema(
        [
          {a: 1, b: 2, c: 3},
          {a: "", b: 4, c: 6},
          {a: "", b: 6, c: 9}
        ]
      ),
      [
        {name: "a", type: "integer", inferred: "integer"},
        {name: "b", type: "integer", inferred: "integer"},
        {name: "c", type: "integer", inferred: "integer"}
      ]
    );
  });

  it("infers numbers", () => {
    assert.deepStrictEqual(
      inferSchema([{a: 1.2}, {a: 3.4}, {a: 5.67}]),
      [{name: "a", type: "number", inferred: "number"}]
    );
  });

  it("infers booleans", () => {
    assert.deepStrictEqual(
      inferSchema([{a: "true"}, {a: false}, {a: "false"}]),
      [{name: "a", type: "boolean", inferred: "boolean"}]
    );
  });

  it("infers dates", () => {
    assert.deepStrictEqual(
      inferSchema(
        [{a: "1/2/20"}, {a: "2020-11-12 12:23:00"}, {a: new Date()}, {a: "2020-01-12"}]
      ),
      [{name: "a", type: "date", inferred: "date"}]
    );
  });

  it("infers strings", () => {
    assert.deepStrictEqual(
      inferSchema([{a: "cat"}, {a: "dog"}, {a: "1,000"}, {a: "null"}]),
      [{name: "a", type: "string", inferred: "string"}]
    );
    assert.deepStrictEqual(
      inferSchema([{a: "10n"}, {a: "22n"}, {a: "0n"}]), // not considered bigints
      [{name: "a", type: "string", inferred: "string"}]
    );
  });

  it("infers arrays", () => {
    assert.deepStrictEqual(
      inferSchema([{a: ["cat"]}, {a: ["dog"]}, {a: []}]),
      [{name: "a", type: "array", inferred: "array"}]
    );
  });

  it("infers objects", () => {
    assert.deepStrictEqual(
      inferSchema([{a: {d: ["cat"]}}, {a: {d: "dog"}}, {a: {d: 12}}]),
      [{name: "a", type: "object", inferred: "object"}]
    );
  });

  it("infers bigints", () => {
    assert.deepStrictEqual(
      inferSchema([{a: 10n}, {a: 22n}, {a: 1n}]),
      [{name: "a", type: "bigint", inferred: "bigint"}]
    );
  });

  it("infers buffers", () => {
    assert.deepStrictEqual(
      inferSchema([{a: new ArrayBuffer()}, {a: new ArrayBuffer()}]),
      [{name: "a", type: "buffer", inferred: "buffer"}]
    );
  });

  it("infers other", () => {
    assert.deepStrictEqual(
      inferSchema([{a: Symbol("a")}, {a: Symbol("b")}]),
      [{name: "a", type: "other", inferred: "other"}]
    );
    assert.deepStrictEqual(
      inferSchema([{a: null}, {a: null}]),
      [{name: "a", type: "other", inferred: "other"}]
    );
  });

  it("infers mixed integers and numbers as numbers", () => {
    assert.deepStrictEqual(
      inferSchema([0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 3, 4, 5].map((x) => ({x}))),
      [{name: "x", type: "number", inferred: "number"}]
    );
  });

  it("infers mixed integers and NaNs as numbers", () => {
    assert.deepStrictEqual(
      inferSchema([NaN, NaN, NaN, 1, 2, 3, 4, 5].map((x) => ({x}))),
      [{name: "x", type: "number", inferred: "number"}]
    );
  });

  it("infers mixed integers and strings as integers", () => {
    assert.deepStrictEqual(
      inferSchema(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "x"].map((x) => ({x}))),
      [{name: "x", type: "integer", inferred: "integer"}]
    );
  });

  it("infers boolean-ish strings and strings as strings", () => {
    assert.deepStrictEqual(
      inferSchema(["true", "false", "pants on fire"].map((x) => ({x}))),
      [{name: "x", type: "string", inferred: "string"}]
    );
  });

  it("infers boolean-ish strings and strings as booleans", () => {
    assert.deepStrictEqual(
      inferSchema(["true", "false", "true", "false", "true", "false", "true", "false", "true", "false", "pants on fire"].map((x) => ({x}))),
      [{name: "x", type: "boolean", inferred: "boolean"}]
    );
  });

  it("infers booleans and strings as booleans", () => {
    assert.deepStrictEqual(
      inferSchema([true, false, true, false, true, false, true, false, true, false, "pants on fire"].map((x) => ({x}))),
      [{name: "x", type: "boolean", inferred: "boolean"}]
    );
  });

  it("infers numbers and strings as numbers", () => {
    assert.deepStrictEqual(
      inferSchema([0.1, 0.2, 0.1, 0.2, 0.1, 0.2, 0.1, 0.2, 0.1, 0.2, "x"].map((x) => ({x}))),
      [{name: "x", type: "number", inferred: "number"}]
    );
  });

  it("infers number-ish strings and strings as numbers", () => {
    assert.deepStrictEqual(
      inferSchema(["0.1", "0.2", "0.1", "0.2", "0.1", "0.2", "0.1", "0.2", "0.1", "0.2", "x"].map((x) => ({x}))),
      [{name: "x", type: "number", inferred: "number"}]
    );
  });
});

describe("coerceToType", () => {
  it("coerces to integer", () => {
    // "integer" is not a target type for coercion, but can be inferred. So it
    // will be handled as an alias for "number".
    assert.deepStrictEqual(coerceToType("1.2", "integer"), 1.2);
    assert.deepStrictEqual(coerceToType(" 1.2", "integer"), 1.2);
    assert.deepStrictEqual(coerceToType(" 1.2 ", "integer"), 1.2);
    assert.deepStrictEqual(coerceToType(1.2, "integer"), 1.2);
    assert.deepStrictEqual(coerceToType("10", "integer"), 10);
    assert.deepStrictEqual(coerceToType(0, "integer"), 0);
    assert.deepStrictEqual(coerceToType("A", "integer"), NaN);
    assert.deepStrictEqual(coerceToType("", "integer"), NaN);
    assert.deepStrictEqual(coerceToType(" ", "integer"), NaN);
    assert.deepStrictEqual(coerceToType(null, "integer"), NaN);
  });

  it("coerces to number", () => {
    assert.deepStrictEqual(coerceToType("1.2", "number"), 1.2);
    assert.deepStrictEqual(coerceToType(" 1.2", "number"), 1.2);
    assert.deepStrictEqual(coerceToType(" 1.2 ", "number"), 1.2);
    assert.deepStrictEqual(coerceToType(0, "number"), 0);
    assert.deepStrictEqual(coerceToType("", "number"), NaN);
    assert.deepStrictEqual(coerceToType(" ", "number"), NaN);
    assert.deepStrictEqual(coerceToType("A", "number"), NaN);
    assert.deepStrictEqual(coerceToType(null, "number"), NaN);
    assert.deepStrictEqual(coerceToType(undefined, "number"), NaN);
    assert.deepStrictEqual(coerceToType({a: 1}, "number"), NaN);
  });

  it("coerces to boolean", () => {
    assert.deepStrictEqual(coerceToType("true", "boolean"), true);
    assert.deepStrictEqual(coerceToType("True   ", "boolean"), true);
    assert.deepStrictEqual(coerceToType(true, "boolean"), true);
    assert.deepStrictEqual(coerceToType("False", "boolean"), false);
    assert.deepStrictEqual(coerceToType(false, "boolean"), false);
    assert.deepStrictEqual(coerceToType(1, "boolean"), true);
    assert.deepStrictEqual(coerceToType(2, "boolean"), true);
    assert.deepStrictEqual(coerceToType(0, "boolean"), false);
    assert.deepStrictEqual(coerceToType({}, "boolean"), true);
    assert.deepStrictEqual(coerceToType(new Date(), "boolean"), true);
    assert.deepStrictEqual(coerceToType("A", "boolean"), null);
    assert.deepStrictEqual(coerceToType("", "boolean"), null);
    assert.deepStrictEqual(coerceToType(" ", "boolean"), null);
    assert.deepStrictEqual(coerceToType(null, "boolean"), null);
    assert.deepStrictEqual(coerceToType(undefined, "boolean"), undefined);
  });

  it("coerces to date", () => {
    const invalidDate = new Date(NaN);
    assert.deepStrictEqual(
      coerceToType("12/12/2020", "date"),
      new Date("12/12/2020")
    );
    // with whitespace
    assert.deepStrictEqual(
      coerceToType("12/12/2020  ", "date"),
      new Date("12/12/2020")
    );
    assert.deepStrictEqual(
      coerceToType("2022-01-01T12:34:00Z", "date"),
      new Date("2022-01-01T12:34:00Z")
    );
    assert.deepStrictEqual(
      coerceToType({a: 1}, "date").toString(),
      invalidDate.toString()
    );
    assert.deepStrictEqual(
      coerceToType(true, "date").toString(),
      invalidDate.toString()
    );
    assert.deepStrictEqual(
      coerceToType("2020-1-12", "date").toString(),
      invalidDate.toString()
    );
    assert.deepStrictEqual(
      coerceToType(1675356739000, "date"),
      new Date(1675356739000)
    );
    assert.deepStrictEqual(coerceToType(undefined, "date"), undefined);
    assert.deepStrictEqual(coerceToType(null, "date"), null);
    assert.deepStrictEqual(coerceToType("", "date"), null);
    assert.deepStrictEqual(coerceToType(" ", "date"), null);
    assert.deepStrictEqual(coerceToType({toString: () => " "}, "date").toString(), invalidDate.toString());
    assert.deepStrictEqual(coerceToType({toString: () => "2020-01-01"}, "date"), new Date("2020-01-01"));
  });

  it("coerces to string", () => {
    assert.deepStrictEqual(coerceToType(true, "string"), "true");
    assert.deepStrictEqual(coerceToType(false, "string"), "false");
    assert.deepStrictEqual(coerceToType(10, "string"), "10");
    assert.deepStrictEqual(coerceToType({a: 1}, "string"), "[object Object]");
    assert.deepStrictEqual(coerceToType(0, "string"), "0");
    assert.deepStrictEqual(coerceToType("", "string"), "");
    assert.deepStrictEqual(coerceToType(" ", "string"), " ");
    assert.deepStrictEqual(coerceToType(" foo", "string"), " foo");
    assert.deepStrictEqual(coerceToType(" foo ", "string"), " foo ");
    assert.deepStrictEqual(coerceToType(null, "string"), null);
    assert.deepStrictEqual(coerceToType(undefined, "string"), undefined);
    assert.deepStrictEqual(coerceToType(NaN, "string"), "NaN");
  });

  it("coerces to bigint", () => {
    assert.deepStrictEqual(coerceToType("32", "bigint"), 32n);
    assert.deepStrictEqual(coerceToType(" 32", "bigint"), 32n);
    assert.deepStrictEqual(coerceToType(32n, "bigint"), 32n);
    assert.deepStrictEqual(coerceToType(0, "bigint"), 0n);
    assert.deepStrictEqual(coerceToType(false, "bigint"), 0n);
    assert.deepStrictEqual(coerceToType(true, "bigint"), 1n);
    assert.deepStrictEqual(coerceToType(null, "bigint"), null);
    assert.deepStrictEqual(coerceToType(undefined, "bigint"), undefined);
    assert.deepStrictEqual(coerceToType(1.1, "bigint"), undefined);
    assert.deepStrictEqual(coerceToType("1.1", "bigint"), undefined);
    assert.deepStrictEqual(coerceToType(" 32n", "bigint"), undefined);
    assert.deepStrictEqual(coerceToType("A", "bigint"), undefined);
    assert.deepStrictEqual(coerceToType("", "bigint"), undefined);
    assert.deepStrictEqual(coerceToType(" ", "bigint"), undefined);
    assert.deepStrictEqual(coerceToType(NaN, "bigint"), undefined);
  });

  it("coerces to array", () => {
    // "array" is not a target type for coercion, but can be inferred.
    assert.deepStrictEqual(coerceToType([1, 2, 3], "array"), [1, 2, 3]);
    assert.deepStrictEqual(coerceToType(null, "array"), null);
    assert.deepStrictEqual(coerceToType(undefined, "array"), undefined);
  });

  it("coerces to object", () => {
    // "object" is not a target type for coercion, but can be inferred.
    assert.deepStrictEqual(coerceToType({a: 1, b: 2}, "object"), {a: 1, b: 2});
    assert.deepStrictEqual(coerceToType(null, "object"), null);
    assert.deepStrictEqual(coerceToType(undefined, "object"), undefined);
  });

  it("coerces to buffer", () => {
    // "buffer" is not a target type for coercion, but can be inferred.
    assert.deepStrictEqual(
      coerceToType(new ArrayBuffer(), "buffer"),
      new ArrayBuffer()
    );
    assert.deepStrictEqual(coerceToType("A", "buffer"), "A");
    assert.deepStrictEqual(coerceToType(null, "buffer"), null);
    assert.deepStrictEqual(coerceToType(undefined, "buffer"), undefined);
  });

  it("coerces to other", () => {
    // "other" is not a target type for coercion, but can be inferred.
    assert.deepStrictEqual(coerceToType(0, "other"), 0);
    assert.deepStrictEqual(coerceToType("a", "other"), "a");
    assert.deepStrictEqual(coerceToType(null, "other"), null);
    assert.deepStrictEqual(coerceToType(undefined, "other"), undefined);
  });

  // Note: if type is "raw", coerceToType() will not be called. Instead, values
  // will be returned from coerceRow().
});

describe("getSchema", () => {
  let source;

  beforeEach(() => {
    source = [
      {a: 1, b: "foo"},
      {a: 2, b: "bar"}
    ];
    source.schema = [
      {name: "a", type: "integer", inferred: "integer"},
      {name: "b", type: "string", inferred: "string"}
    ];
  });


  it("respects schema from source, if one exists", () => {
    const {schema, inferred} = getSchema(source);
    assert.strictEqual(inferred, false);
    assert.strictEqual(schema, source.schema);
  });

  it("infers schema if source has no schema", () => {
    source.schema = undefined;
    const {schema, inferred} = getSchema(source);
    assert.strictEqual(inferred, true);
    assert.deepStrictEqual(schema,[
      {name: "a", type: "integer", inferred: "integer"},
      {name: "b", type: "string", inferred: "string"}
    ]);
  });

  it("infers schema if schema is invalid", () => {
    source.schema = ["number"];
    const {schema, inferred} = getSchema(source);
    assert.strictEqual(inferred, true);
    assert.deepStrictEqual(schema,[
      {name: "a", type: "integer", inferred: "integer"},
      {name: "b", type: "string", inferred: "string"}
    ]);
  });
});
