// deno-lint-ignore-file

// The "filetype" passed to getCompletions and getLint indicates the 
// structure of the passed code buffer:
//
//   yaml      - standalone yaml file
//   script    - script that may have embedded YAML comments (e.g. #| foo: bar)
//   markdown  - markdown file that may have embedded YAML front matter as 
//               well as code chunks that include script w/ YAML

const Parser = window.TreeSitter;


let _schemas;
let _parser;

const core = window._quartoCoreLib;

async function getSchemas() {
  if (_schemas) {
    return _schemas;
  }
  const response = await fetch('/quarto/resources/editor/tools/yaml/quarto-json-schemas.json');
  _schemas = response.json();
  return _schemas;
}

async function getTreeSitter() {
  if (_parser) {
    return _parser;
  }
  
  const Parser = window.TreeSitter;
  
  await Parser.init();
  
  _parser = new Parser;
  const YAML = await Parser.Language.load('/quarto/resources/editor/tools/yaml/tree-sitter-yaml.wasm'); // FIXME
  
  _parser.setLanguage(YAML);
  return _parser;
};

function navigateSchema(schema, path)
{
  const refs = {};
  function inner(subSchema, index) {
    if (subSchema.$id) {
      refs[subSchema.$id] = subSchema;
    }
    if (subSchema.$ref) {
      if (refs[subSchema.$ref] === undefined) {
        throw new Error(`Internal error: schema reference ${subSchema.$ref} undefined`);
      }
      subSchema = refs[subSchema.$ref];
    }
    if (index == path.length) {
      return [subSchema];
    }
    const st = core.schemaType(subSchema);
    if (st === "object") {
      const key = path[index];
      if (subSchema.properties[key] === undefined) {
        return undefined;
      }
      return inner(subSchema.properties[key], index + 1);
    } else if (st === "array") {
      // arrays are uniformly typed, easy
      if (subSchema.items === undefined) {
        // no items schema, can't navigate to expected schema
        return undefined;
      }
      return inner(subSchema.items, index + 1);
    } else if (st === "anyOf") {
      return subSchema.anyOf.map(ss => inner(ss, index + 1)).filter(x => x !== undefined);
    } else if (st === "allOf") {
      // FIXME
      throw new Error("Internal error: don't know how to navigate allOf schema :(");
    } else if (st === "oneOf") {
      const result = subSchema.oneOf.map(ss => inner(ss, index + 1)).filter(x => x !== undefined);
      if (result.length !== 1) {
        return undefined;
      } else {
        return result;
      }
    } else {
      // we stop navigation short on YAML terminals
      return [subSchema];
    }
  };
  return inner(schema, 0);
}

function locateCursor(annotation, position)
{
  function locate(node, pathSoFar) {
    if (node.kind === "block_mapping" || node.kind === "flow_mapping") {
      for (let i = 0; i < node.components.length; i += 2) {
        const keyC = node.components[i],
              valueC = node.components[i+1];
        if (keyC.start <= position && position < keyC.end) {
          return [keyC.result, pathSoFar];
        } else if (valueC.start <= position && position < valueC.end) {
          return locate(valueC, [keyC.result, pathSoFar]);
        }
      }
      // FIXME: decide what to do if cursor lands exactly on ":"
      throw new Error("Internal error: cursor outside bounds in mapping locate?");
    } else if (node.kind === "block_sequence" || node.kind === "flow_sequence") {
      for (let i = 0; i < node.components.length; ++i) {
        const valueC = node.components[i];
        if (valueC.start <= position && position < valueC.end) {
          return locate(valueC, [i, pathSoFar]);
        }
        if (valueC.start > position) {
          // We went too far: that means we're caught in between entries. Assume
          // that we're inside the previous element but that we can't navigate any further
          // If we're at the beginning of the sequence, assume that we're done exactly here.
          if (i === 0) {
            return pathSoFar;
          } else {
            return [i-1, pathSoFar];
          }
        }
      }

      throw new Error("Internal error: cursor outside bounds in sequence locate?");
    } else {
      // can't navigate further, we're done.
      return pathSoFar;
    }
  }
  return locate(annotation, []).flat(Infinity).reverse();
}

window.QuartoYamlEditorTools = {

  getCompletions: async function(context) {

    debugger;

    const parser = await getTreeSitter();
    const schemas = await getSchemas();
    
    const {
      filetype,  // "yaml" | "script" | "markdown"
      line,      // editing line up to the cursor
      code,      // full contents of the buffer
      position   // row/column of cursor (0-based)
    } = context;

    const tree = parser.parse(code);
    console.log(tree.rootNode.toString());
    const doc = buildAnnotated(tree);
    const index = core.rowColToIndex(code)(position);
    console.log(doc);
    const path = locateCursor(doc, index);
    // FIXME CONTINUE HERE
    const matchingSchema = navigateSchema(
      schemas.config, path);
    
    console.log(matchingSchema.completions);

    return new Promise(function(resolve, reject) {

      // resolve no completions 
      // TODO: remove this code once real completions works
      resolve(null);
      return;

      // determine the target token (this will be what is substituted for)
      // e.g. here we just break on spaces but the real implementation will
      // be more syntax aware
      const token = line.split(" ").slice(-1)[0];

      // resolve completions
      resolve({

        // token to replace
        token: token,

        // array of completions
        completions: [
          {
            // subsitute 'value' for the token if this completion is accepted
            value: token + "foo",

            // additional documentation on this completion (can be null)
            description: "docs on foo"
          },
          {
            // value
            value: token + "bar",

            // documentation (note html is accepted)
            description: "docs on <b>bar</b>"
          }
        ],

        // is this cacheable for subsequent results that add to the token
        // see https://github.com/rstudio/rstudio/blob/main/src/gwt/src/org/rstudio/studio/client/workbench/views/console/shell/assist/CompletionCache.java
        cacheable: true,

        // should we automatically initiate another completion request when
        // this one is accepted (e.g. if we complete a yaml key and then
        // want to immediately show available values for that key)
        suggest_on_accept: false
      });
    });
  },

  getLint: function(context) {

    const {
      filetype,  // "yaml" | "script" | "markdown"
      line,      // editing line up to the cursor
      code,      // full contents of the buffer
      position   // row/column of cursor (0-based)
    } = context;

    return new Promise(function(resolve, reject) {

      // resolve no diagnostics 
      // TODO: remove this code once real diagnostics work
      resolve(null);
      return;

      // look for the word 'bolas' and mark it (note that the front
      // end already takes care of removing marks around the active
      // cursor so we can ignore the cursor and line context)
      const kBolas = "bolas";
      const lint = [];
      const lines = code.split("\n");
      for (var i = 0; i<lines.length; i++) {
        const line = lines[i];
        const pos = line.indexOf(kBolas);
        if (pos !== -1) {
          lint.push({
            "start.row": i,
            "start.column": pos,
            "end.row": i,
            "end.column": pos + kBolas.length,
            "text": "Don'tn let that guy in here!!",
            "type": "error"
          });
        }
      }
      resolve(lint);
    });
  }
};
