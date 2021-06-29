/*global Shiny,$
*
* quarto-observable-shiny.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

/*
 FIXME: The layout of this file is a little ugly because we don't want to
 expose Shiny.* to the module in every case, since sometimes we'll use
 this module without Shiny defined. We could make it cleaner by
 creating dummy classes in a separate import.
 */

import {
  Inspector,
  Library,
} from "https://cdn.skypack.dev/@observablehq/runtime";

import { button } from "https://cdn.skypack.dev/@observablehq/inputs";

const shinyInputVars = new Set();

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
  }

  lib.shinyInput = function () {
    return (name) => {
      shinyInputVars.add(name);
    };
  };

  lib.shinyOutput = function () {
    return function (name) {
      const dummySpan = document.createElement("div");
      dummySpan.id = name;
      dummySpan.classList.add("observablehq-variable-writer");
      window._ojs.shinyElementRoot.appendChild(dummySpan);
      return lib.Generators.observe((change) => {
        Shiny.outputBindings.register(
          new NamedVariableOutputBinding(name, change),
        );
      });
    };
  };
}

export class ShinyInspector extends Inspector {
  constructor(node) {
    super(node);
  }
  fulfilled(value, name) {
    if (shinyInputVars.has(name) && window.Shiny) {
      window.Shiny.setInputValue(name, value);
    }
    return super.fulfilled(value, name);
  }
}

const { Generators } = new Library();

class ObservableButtonInput /*extends ShinyInput*/ {
  find(_scope) {
    return document.querySelectorAll(".observablehq-inputs-button");
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

export function initObservableShinyRuntime() {
  class BindingAdapter extends Shiny.InputBinding {
    static value_sym = Symbol("value");
    static callback_sym = Symbol("callback");
    static instance_sym = Symbol("instance");
    static values = new WeakMap();

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
        el[BindingAdapter.value_sym] = value;
        el[BindingAdapter.callback_sym]();
      };
      const instance = this.x.init(el, changeHandler);
      el[BindingAdapter.instance_sym] = instance;
    }
    getValue(el) {
      return el[BindingAdapter.value_sym];
    }
    setValue(el, value) {
      el[BindingAdapter.value_sym] = value;
      el[BindingAdapter.instance_sym].onSetValue(value);
    }
    subscribe(el, callback) {
      el[BindingAdapter.callback_sym] = callback;
    }
    unsubscribe(el) {
      el[BindingAdapter.instance_sym].dispose();
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

  Shiny.inputBindings.register(new BindingAdapter(new ObservableButtonInput()));
  Shiny.outputBindings.register(new InspectorOutputBinding());

  return true;
}
