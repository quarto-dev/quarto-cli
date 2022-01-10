/*global Shiny, $
*
* quarto-observable-shiny.js
*
* Copyright (C) 2021 RStudio, PBC
*/

import {
  Inspector
} from "https://cdn.skypack.dev/@observablehq/runtime@4.18.3";

import {
  button
} from "https://cdn.skypack.dev/@observablehq/inputs@0.10.4";

// see ojs-bundle.js for why we're importing from ./stdlib.js and not skypack.
import {
  FileAttachments, Library
} from "./stdlib.js";

import {
  QuartoInspector
} from "./quarto-inspector.js";

//////////////////////////////////////////////////////////////////////////////

const shinyInputVars = new Set();
let shinyInitialValue = {};

export function extendObservableStdlib(lib) {
  class NamedVariableOutputBinding extends Shiny.OutputBinding {
    constructor(name, change) {
      super();
      this._name = name;
      this._change = change;
    }
    find(scope) {
      return $(scope).find("#" + this._name);
    }
    getId(el) {
      return el.id;
    }
    renderValue(_el, data) {
      this._change(data);
    }
    onValueError(el, err) {
      const group = `Shiny error in ${el.id}`;
      console.groupCollapsed(`%c${group}`, "color:red");
      console.log(`${err.message}`);
      console.log(`call: ${err.call}`);
      console.groupEnd(group);
    }
  }

  $(document).on("shiny:connected", function (_event) {
    Object.entries(shinyInitialValue).map(([k, v]) => {
      window.Shiny.setInputValue(k, v);
    });
    shinyInitialValue = {};
  });

  lib.shinyInput = function () {
    return (name) => {
      shinyInputVars.add(name);
      window._ojs.ojsConnector.mainModule.value(name)
        .then((val) => {
          if (window.Shiny && window.Shiny.setInputValue) {
            window.Shiny.setInputValue(name, val);
          } else {
            shinyInitialValue[name] = val;
          }
        });
    };
  };

  lib.shinyOutput = function () {
    return function (name) {
      const dummySpan = document.createElement("div");
      dummySpan.id = name;
      dummySpan.classList.add("ojs-variable-writer");
      window._ojs.shinyElementRoot.appendChild(dummySpan);
      return lib.Generators.observe((change) => {
        Shiny.outputBindings.register(
          new NamedVariableOutputBinding(name, change),
        );
      });
    };
  };
}

export class ShinyInspector extends QuartoInspector {
  constructor(node) {
    super(node);
  }
  fulfilled(value, name) {
    if (shinyInputVars.has(name) && window.Shiny) {
      if (window.Shiny.setInputValue === undefined) {
        shinyInitialValue[name] = value;
      } else {
        window.Shiny.setInputValue(name, value);
      }
    }
    return super.fulfilled(value, name);
  }
}

const { Generators } = new Library();

class OjsButtonInput /*extends ShinyInput*/ {
  find(_scope) {
    return document.querySelectorAll(".ojs-inputs-button");
  }

  init(el, change) {
    const btn = button(el.textContent);
    el.innerHTML = "";
    el.appendChild(btn);

    const obs = Generators.input(el.firstChild);
    (async function () {
      // throw away the first value, it doesn't count for buttons
      await obs.next().value;
      for (const x of obs) {
        change(await x);
      }
    })();
    // TODO: error handling

    return {
      onSetValue: (_value) => {
      },
      dispose: () => {
        obs.return();
      },
    };
  }
}

export function initOjsShinyRuntime() {
  const valueSym = Symbol("value");
  const callbackSym = Symbol("callback");
  const instanceSym = Symbol("instance");
  // const values = new WeakMap(); // unused?

  class BindingAdapter extends Shiny.InputBinding {
    constructor(x) {
      super();
      this.x = x;
    }

    find(scope) {
      const matches = this.x.find(scope);
      return $(matches);
    }
    getId(el) {
      if (this.x.getId) {
        return this.x.getId(el);
      } else {
        return super.getId(el);
      }
    }
    initialize(el) {
      const changeHandler = (value) => {
        el[valueSym] = value;
        el[callbackSym]();
      };
      const instance = this.x.init(el, changeHandler);
      el[instanceSym] = instance;
    }
    getValue(el) {
      return el[valueSym];
    }
    setValue(el, value) {
      el[valueSym] = value;
      el[instanceSym].onSetValue(value);
    }
    subscribe(el, callback) {
      el[callbackSym] = callback;
    }
    unsubscribe(el) {
      el[instanceSym].dispose();
    }
  }

  class InspectorOutputBinding extends Shiny.OutputBinding {
    find(scope) {
      return $(scope).find(".observablehq-inspector");
    }
    getId(el) {
      return el.id;
    }
    renderValue(el, data) {
      (new Inspector(el)).fulfilled(data);
    }
  }

  if (window.Shiny === undefined) {
    console.warn("Shiny runtime not found; Shiny features won't work.");
    return false;
  }

  Shiny.inputBindings.register(new BindingAdapter(new OjsButtonInput()));
  Shiny.outputBindings.register(new InspectorOutputBinding());

  // Handle requests from the server to export Shiny outputs to ojs.
  Shiny.addCustomMessageHandler("ojs-export", ({ name }) => {
    window._ojs.ojsConnector.mainModule.redefine(
      name,
      window._ojs.ojsConnector.library.shinyOutput()(name),
    );
    // shinyOutput() creates an output DOM element, but we have to cause it to
    // be actually bound. I don't love this code being here, I'd prefer if we
    // could receive Shiny outputs without using output bindings at all (for
    // this case, not for things that truly are DOM-oriented outputs).
    Shiny.bindAll(document.body);
  });

  return true;
}
