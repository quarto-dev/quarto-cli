# @quarto/external-observablehq-parser: A fork of @observablehq/parser

Changes from the original:

- add back `parseModule`, since that's required by Quarto's OJS runtime.

(Original README.md follows.)

# @observablehq/parser

To parse a cell:

```js
import {parseCell} from "@observablehq/parser";

const cell = parseCell(`hello = "world"`);
```

## Examples

(In these examples, the *node*.start and *node*.end indexes into the *input* string are not shown for brevity. If *options*.locations is true, *node*.loc will also be populated with the line and column numbers.)

An expression cell (where [*cell*.body](#cell_body) is a type of expression):

```js
1 + 2
```

```json
{
  "type": "Cell",
  "id": null,
  "async": false,
  "generator": false,
  "body": {
    "type": "BinaryExpression",
    "left": {
      "type": "Literal",
      "value": 1,
      "raw": "1"
    },
    "operator": "+",
    "right": {
      "type": "Literal",
      "value": 2,
      "raw": "2"
    }
  }
}
```

A block cell (where [*cell*.body](#cell_body) is a BlockStatement):

```js
{
  return 1 + 2;
}
```

```json
{
  "type": "Cell",
  "id": null,
  "async": false,
  "generator": false,
  "body": {
    "type": "BlockStatement",
    "body": [
      {
        "type": "ReturnStatement",
        "argument": {
          "type": "BinaryExpression",
          "left": {
            "type": "Literal",
            "value": 1,
            "raw": "1"
          },
          "operator": "+",
          "right": {
            "type": "Literal",
            "value": 2,
            "raw": "2"
          }
        }
      }
    ]
  }
}
```

An empty cell (where [*cell*.body](#cell_body) is null):

```js
```

```json
{
  "type": "Cell",
  "id": null,
  "async": false,
  "generator": false,
  "body": null
}
```

A named expression cell (where [*cell*.id](#cell_id) is an Identifier):

```js
foo = 42
```

```json
{
  "type": "Cell",
  "id": {
    "type": "Identifier",
    "name": "foo"
  },
  "async": false,
  "generator": false,
  "body": {
    "type": "Literal",
    "value": 42,
    "raw": "42"
  }
}
```

A named block cell (where [*cell*.id](#cell_id) is an Identifier):

```js
foo = {
  return 42;
}
```

```json
{
  "type": "Cell",
  "id": {
    "type": "Identifier",
    "name": "foo"
  },
  "async": false,
  "generator": false,
  "body": {
    "type": "BlockStatement",
    "body": [
      {
        "type": "ReturnStatement",
        "argument": {
          "type": "Literal",
          "value": 42,
          "raw": "42"
        }
      }
    ]
  }
}
```

An asynchronous expression cell (where [*cell*.async](#cell_async) is true):

```js
2 * await value
```

```json
{
  "type": "Cell",
  "id": null,
  "async": true,
  "generator": false,
  "body": {
    "type": "BinaryExpression",
    "left": {
      "type": "Literal",
      "value": 2,
      "raw": "2"
    },
    "operator": "*",
    "right": {
      "type": "AwaitExpression",
      "argument": {
        "type": "Identifier",
        "name": "value"
      }
    }
  }
}
```

A generator expression cell (where [*cell*.generator](#cell_generator) is true):

```js
yield* [1, 2, 3]
```

```json
{
  "type": "Cell",
  "id": null,
  "async": false,
  "generator": true,
  "body": {
    "type": "YieldExpression",
    "delegate": true,
    "argument": {
      "type": "ArrayExpression",
      "elements": [
        {
          "type": "Literal",
          "value": 1,
          "raw": "1"
        },
        {
          "type": "Literal",
          "value": 2,
          "raw": "2"
        },
        {
          "type": "Literal",
          "value": 3,
          "raw": "3"
        }
      ]
    }
  }
}
```

A viewof expression cell (where [*cell*.id](#cell_id) is a [ViewExpression](#viewexpression)):

```js
viewof x = DOM.range()
```

```json
{
  "type": "Cell",
  "id": {
    "type": "ViewExpression",
    "id": {
      "type": "Identifier",
      "name": "x"
    }
  },
  "async": false,
  "generator": false,
  "body": {
    "type": "CallExpression",
    "callee": {
      "type": "MemberExpression",
      "object": {
        "type": "Identifier",
        "name": "DOM"
      },
      "property": {
        "type": "Identifier",
        "name": "range"
      },
      "computed": false
    },
    "arguments": []
  }
}
```

A viewof reference within an expression cell (where [*cell*.body](#cell_body) contains a [ViewExpression](#viewexpression)):

```js
viewof x.tagName
```

```json
{
  "type": "Cell",
  "id": null,
  "async": false,
  "generator": false,
  "body": {
    "type": "MemberExpression",
    "object": {
      "type": "ViewExpression",
      "id": {
        "type": "Identifier",
        "name": "x"
      }
    },
    "property": {
      "type": "Identifier",
      "name": "tagName"
    },
    "computed": false
  }
}
```

An import cell (where [*cell*.body](#cell_body) is an [ImportDeclaration](#importdeclaration)):

```js
import {foo} from "module"
```

```json
{
  "type": "Cell",
  "id": null,
  "async": false,
  "generator": false,
  "body": {
    "type": "ImportDeclaration",
    "specifiers": [
      {
        "type": "ImportSpecifier",
        "view": false,
        "imported": {
          "type": "Identifier",
          "name": "foo"
        },
        "local": {
          "type": "Identifier",
          "name": "foo"
        }
      }
    ],
    "source": {
      "type": "Literal",
      "value": "module",
      "raw": "\"module\""
    }
  }
}
```

Importing a view (where [*specifier*.view](#specifier_view) is true):

```js
import {viewof foo} from "module"
```

```json
{
  "type": "Cell",
  "id": null,
  "async": false,
  "generator": false,
  "body": {
    "type": "ImportDeclaration",
    "specifiers": [
      {
        "type": "ImportSpecifier",
        "view": true,
        "imported": {
          "type": "Identifier",
          "name": "foo"
        },
        "local": {
          "type": "Identifier",
          "name": "foo"
        }
      }
    ],
    "source": {
      "type": "Literal",
      "value": "module",
      "raw": "\"module\""
    }
  }
}
```

Importing a view imports both the view symbol (`viewof foo`) and the value symbol (`foo`). Likewise, if the specified view is renamed during import (*e.g.*, `viewof foo as bar`), both the view symbol and the value symbol are renamed (*e.g.*, `viewof bar` and `bar`).

Importing with injection (where [*declaration*.injections](#declaration_injections) is present):

```js
import {chart} with {sales as data} from "@mbostock/d3-bar-chart"
```

```json
{
  "type": "Cell",
  "id": null,
  "async": false,
  "generator": false,
  "body": {
    "type": "ImportDeclaration",
    "specifiers": [
      {
        "type": "ImportSpecifier",
        "view": false,
        "imported": {
          "type": "Identifier",
          "name": "chart"
        },
        "local": {
          "type": "Identifier",
          "name": "chart"
        }
      }
    ],
    "injections": [
      {
        "type": "ImportSpecifier",
        "view": false,
        "imported": {
          "type": "Identifier",
          "name": "sales"
        },
        "local": {
          "type": "Identifier",
          "name": "data"
        }
      }
    ],
    "source": {
      "type": "Literal",
      "value": "@mbostock/d3-bar-chart",
      "raw": "\"@mbostock/d3-bar-chart\""
    }
  }
}
```

For an injection, *specifier*.imported and *specifier*.local are reversed compared to a normal specifier: they are from the perspective of the imported module rather than the importing module. So in the example above, the importing module’s variable *sales* is injected into the imported module (the chart), replacing the variable *data*.

Injecting a view injects both the view symbol (`viewof foo`) and the value symbol (`foo`). Likewise, if the specified view is renamed during injection (*e.g.*, `viewof foo as bar`), both the view symbol and the value symbol are renamed (*e.g.*, `viewof bar` and `bar`).

## API Reference

<a href="#parseCell" name="parseCell">#</a> <b>parseCell</b>(<i>input</i>[, <i>options</i>]) [<>](https://github.com/observablehq/parser/blob/main/src/parse.js "Source")

Returns a [cell](#cell).

<a href="#peekId" name="peekId">#</a> <b>peekId</b>(<i>input</i>) [<>](https://github.com/observablehq/parser/blob/main/src/peek.js "Source")

Tries to find the ID of a cell given a snippet of its contents, and returns it as a string if found.

### Cell

<a href="#cell_id" name="cell_id">#</a> <i>cell</i>.<b>id</b>

The name of the cell: null if the cell is anonymous; otherwise an Identifier or a ViewExpression.

<a href="#cell_body" name="cell_body">#</a> <i>cell</i>.<b>body</b>

The body of the cell: null for an empty cell; an ImportDeclaration for an import cell; otherwise a BlockStatement or an expression node.

<a href="#cell_async" name="cell_async">#</a> <i>cell</i>.<b>async</b>

A boolean indicating whether the cell body is asynchronous (*i.e.*, whether it contains an `await` statement). False for import and empty cells.

<a href="#cell_generator" name="cell_generator">#</a> <i>cell</i>.<b>generator</b>

A boolean indicating whether the cell body is a generator (*i.e.*, whether it contains a `yield` statement). False for import and empty cells.

### ViewExpression

<a href="#view_id" name="view_id">#</a> <i>view</i>.<b>id</b>

The view identifier: an Identifier.

### ImportDeclaration

<a href="#declaration_injections" name="declaration_injections">#</a> <i>declaration</i>.<b>injections</b>

An array of ImportSpecifier nodes, if the import declaration has a `with` clause, and otherwise null.

### ImportSpecifier

<a href="specifier_view" name="specifier_view">#</a> <i>specifier</i>.<b>view</b>

A boolean indicating whether the import specifies a view.
