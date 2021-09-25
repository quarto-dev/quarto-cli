// deno-lint-ignore-file

window.QuartoEditorToolsYaml = {

  getCompletions: function(params) {

    const {
      location,  // "file" | "front-matter" | "cell"
      line,      // editing line up to the cursor
      code,      // full contents of the buffer
      position   // row/column of cursor (0-based)
    } = params;
   
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
    })
  }
}