import {constant} from "./constant.js";
import {RuntimeError} from "./errors.js";
import {identity} from "./identity.js";
import {rethrow} from "./rethrow.js";
import {Variable, TYPE_DUPLICATE, TYPE_IMPLICIT, TYPE_NORMAL, no_observer, variable_stale} from "./variable.js";

export const variable_variable = Symbol("variable");
export const variable_invalidation = Symbol("invalidation");
export const variable_visibility = Symbol("visibility");

export function Module(runtime, builtins = []) {
  Object.defineProperties(this, {
    _runtime: {value: runtime},
    _scope: {value: new Map},
    _builtins: {value: new Map([
      ["@variable", variable_variable],
      ["invalidation", variable_invalidation],
      ["visibility", variable_visibility],
      ...builtins
    ])},
    _source: {value: null, writable: true}
  });
}

Object.defineProperties(Module.prototype, {
  _resolve: {value: module_resolve, writable: true, configurable: true},
  redefine: {value: module_redefine, writable: true, configurable: true},
  define: {value: module_define, writable: true, configurable: true},
  derive: {value: module_derive, writable: true, configurable: true},
  import: {value: module_import, writable: true, configurable: true},
  value: {value: module_value, writable: true, configurable: true},
  variable: {value: module_variable, writable: true, configurable: true},
  builtin: {value: module_builtin, writable: true, configurable: true}
});

function module_redefine(name) {
  const v = this._scope.get(name);
  if (!v) throw new RuntimeError(`${name} is not defined`);
  if (v._type === TYPE_DUPLICATE) throw new RuntimeError(`${name} is defined more than once`);
  return v.define.apply(v, arguments);
}

function module_define() {
  const v = new Variable(TYPE_NORMAL, this);
  return v.define.apply(v, arguments);
}

function module_import() {
  const v = new Variable(TYPE_NORMAL, this);
  return v.import.apply(v, arguments);
}

function module_variable(observer, options) {
  return new Variable(TYPE_NORMAL, this, observer, options);
}

async function module_value(name) {
  let v = this._scope.get(name);
  if (!v) throw new RuntimeError(`${name} is not defined`);
  if (v._observer === no_observer) {
    v = this.variable(true).define([name], identity);
    try {
      return await module_revalue(this._runtime, v);
    } finally {
      v.delete();
    }
  } else {
    return module_revalue(this._runtime, v);
  }
}

// If the variable is redefined before its value resolves, try again.
async function module_revalue(runtime, variable) {
  await runtime._compute();
  try {
    return await variable._promise;
  } catch (error) {
    if (error === variable_stale) return module_revalue(runtime, variable);
    throw error;
  }
}

function module_derive(injects, injectModule) {
  const map = new Map();
  const modules = new Set();
  const copies = [];

  // Given a module, derives an alias of that module with an initially-empty
  // definition. The variables will be copied later in a second pass below.
  function alias(source) {
    let target = map.get(source);
    if (target) return target;
    target = new Module(source._runtime, source._builtins);
    target._source = source;
    map.set(source, target);
    copies.push([target, source]);
    modules.add(source);
    return target;
  }

  // Inject the given variables as reverse imports into the derived module.
  const derive = alias(this);
  for (const inject of injects) {
    const {alias, name} = typeof inject === "object" ? inject : {name: inject};
    derive.import(name, alias == null ? name : alias, injectModule);
  }

  // Iterate over all the variables (currently) in this module. If any
  // represents an import-with (i.e., an import of a module with a _source), the
  // transitive import-with must be copied, too, as direct injections may affect
  // transitive injections. Note that an import-with can only be created with
  // module.derive and hence it’s not possible for an import-with to be added
  // later; therefore we only need to apply this check once, now.
  for (const module of modules) {
    for (const [name, variable] of module._scope) {
      if (variable._definition === identity) { // import
        if (module === this && derive._scope.has(name)) continue; // overridden by injection
        const importedModule = variable._inputs[0]._module;
        if (importedModule._source) alias(importedModule);
      }
    }
  }

  // Finally, with the modules resolved, copy the variable definitions.
  for (const [target, source] of copies) {
    for (const [name, sourceVariable] of source._scope) {
      const targetVariable = target._scope.get(name);
      if (targetVariable && targetVariable._type !== TYPE_IMPLICIT) continue; // preserve injection
      if (sourceVariable._definition === identity) { // import
        const sourceInput = sourceVariable._inputs[0];
        const sourceModule = sourceInput._module;
        target.import(sourceInput._name, name, map.get(sourceModule) || sourceModule);
      } else { // non-import
        target.define(name, sourceVariable._inputs.map(variable_name), sourceVariable._definition);
      }
    }
  }

  return derive;
}

function module_resolve(name) {
  let variable = this._scope.get(name), value;
  if (!variable) {
    variable = new Variable(TYPE_IMPLICIT, this);
    if (this._builtins.has(name)) {
      variable.define(name, constant(this._builtins.get(name)));
    } else if (this._runtime._builtin._scope.has(name)) {
      variable.import(name, this._runtime._builtin);
    } else {
      try {
        value = this._runtime._global(name);
      } catch (error) {
        return variable.define(name, rethrow(error));
      }
      if (value === undefined) {
        this._scope.set(variable._name = name, variable);
      } else {
        variable.define(name, constant(value));
      }
    }
  }
  return variable;
}

function module_builtin(name, value) {
  this._builtins.set(name, value);
}

function variable_name(variable) {
  return variable._name;
}
