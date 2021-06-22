/*global Shiny,$*/

import {
  Inspector,
  Library,
} from "https://cdn.skypack.dev/@observablehq/runtime";

import {
  button
} from "https://cdn.skypack.dev/@observablehq/inputs";

export function initObservableShinyRuntime()
{
  if (window.Shiny === undefined) {
    console.warn("Shiny runtime not found; Shiny features won't work.");
    return false;
  }
  
  console.log("Initializing Shiny-Observable runtime");

  const {Generators} = new Library();

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

  class ObservableButtonInput /*extends ShinyInput*/ {
    find(scope) {
      return document.querySelectorAll(".observablehq-inputs-button");
    }

    init(el, change) {
      let btn = button(el.textContent);
      el.innerHTML = "";
      el.appendChild(btn);

      let obs = Generators.input(el.firstChild);
      (async function() {
        // throw away the first value, it doesn't count for buttons
        await obs.next().value;
        for (const x of obs) {
          change(await x);
        }
      })();
      // TODO: error handling

      return {
        onSetValue: (value) => {
        },
        dispose: () => {
          obs.return();
        }
      };
    }
  }

  Shiny.inputBindings.register(new BindingAdapter(new ObservableButtonInput()));

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
  Shiny.outputBindings.register(new InspectorOutputBinding());

  const runtime = window._ojs.runtime;
  const module = window._ojs.mainModule;
  const var_setter_map = new Map(); 

  class VariableOutputBinding extends Shiny.OutputBinding {
    find(scope) {
      return $(scope).find(".observablehq-variable-writer");
    }
    getId(el) {
      return el.id;
    }
    renderValue(el, data) {
      // TODO: Take advantage of Shiny's busy notification (showProgress) to
      // force this into pending
      var_setter_map.get(this.getId(el))(data);
    }
  }
  const vob = new VariableOutputBinding();
  Shiny.outputBindings.register(vob);

  $(document).on("shiny:bound", ".observablehq-variable-writer", e => {
    if (e.binding === vob) {
      const id = vob.getId(e.target);
      if (!var_setter_map.has(id)) {
        const obs = Generators.observe(change => {
          var_setter_map.set(id, change);
        });
        module.variable().define(id, obs);
      }
    }
  });


  class VariableInputBinding {
    find(scope) {
      return document.querySelectorAll(".observablehq-variable-reader");
    }
    getId(el) {
      return el.dataset.id;
    }
    init(el, change) {
      window._ojs.mainModule.variable({
        fulfilled: x => {
          Shiny.setInputValue(el.dataset.id, x);
        }
      }).define([el.dataset.id], val => val);
    }
  }

  class RawObservableInputBinding {
    find(scope) {
      return document.querySelectorAll("script[type='text/observable']");
    }

    init(el, change) {
      const id = el.id;
      const inputs = (el.dataset.inputs || "").split(/\s*,\s*/).filter(s => s.length > 0);
      const viewof = !!el.dataset.viewof;

      const func = eval(el.textContent);
      const div = document.createElement("div");
      el.parentElement.appendChild(div);
      const inspector = new Inspector(div);
      if (viewof) {
        window._ojs.mainModule.variable(inspector).define(id + "__view__", inputs, func);
        window._ojs.mainModule.variable().define(id, [id + "__view__"], x => Generators.input(x));
      } else {
        window._ojs.mainModule.variable(inspector).define(id, inputs, func);
      }
    }
  }
  Shiny.inputBindings.register(new BindingAdapter(new RawObservableInputBinding()));

  console.log("Observable-Shiny runtime initialized!");

  return true;
}



