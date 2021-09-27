// deno-lint-ignore-file

// The "filetype" passed to getCompletions and getLint indicates the 
// structure of the passed code buffer:
//
//   yaml      - standalone yaml file
//   script    - script that may have embedded YAML comments (e.g. #| foo: bar)
//   markdown  - markdown file that may have embedded YAML front matter as 
//               well as code chunks that include script w/ YAML

window.QuartoYamlEditorTools = {

  getCompletions: function(context) {

    const {
      filetype,  // "yaml" | "script" | "markdown"
      line,      // editing line up to the cursor
      code,      // full contents of the buffer
      position   // row/column of cursor (0-based)
    } = context;
   
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
      })
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