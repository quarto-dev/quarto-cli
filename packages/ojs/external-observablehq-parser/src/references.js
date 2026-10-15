// Based on https://github.com/ForbesLindesay/acorn-globals
// Copyright (c) 2014 Forbes Lindesay
// https://github.com/ForbesLindesay/acorn-globals/blob/master/LICENSE

import {ancestor} from "acorn-walk";
import walk from "./walk.js";

function isScope(node) {
  return node.type === "FunctionExpression"
      || node.type === "FunctionDeclaration"
      || node.type === "ArrowFunctionExpression"
      || node.type === "Program";
}

function isBlockScope(node) {
  return node.type === "BlockStatement"
      || node.type === "ForInStatement"
      || node.type === "ForOfStatement"
      || node.type === "ForStatement"
      || isScope(node);
}

function declaresArguments(node) {
  return node.type === "FunctionExpression"
      || node.type === "FunctionDeclaration";
}

export default function findReferences(cell, globals) {
  const ast = {type: "Program", body: [cell.body]};
  const locals = new Map;
  const globalSet = new Set(globals);
  const references = [];

  function hasLocal(node, name) {
    const l = locals.get(node);
    return l ? l.has(name) : false;
  }

  function declareLocal(node, id) {
    const l = locals.get(node);
    if (l) l.add(id.name);
    else locals.set(node, new Set([id.name]));
  }

  function declareClass(node) {
    if (node.id) declareLocal(node, node.id);
  }

  function declareFunction(node) {
    node.params.forEach(param => declarePattern(param, node));
    if (node.id) declareLocal(node, node.id);
  }

  function declareCatchClause(node) {
    if (node.param) declarePattern(node.param, node);
  }

  function declarePattern(node, parent) {
    switch (node.type) {
      case "Identifier":
        declareLocal(parent, node);
        break;
      case "ObjectPattern":
        node.properties.forEach(node => declarePattern(node, parent));
        break;
      case "ArrayPattern":
        node.elements.forEach(node => node && declarePattern(node, parent));
        break;
      case "Property":
        declarePattern(node.value, parent);
        break;
      case "RestElement":
        declarePattern(node.argument, parent);
        break;
      case "AssignmentPattern":
        declarePattern(node.left, parent);
        break;
      default:
        throw new Error("Unrecognized pattern type: " + node.type);
    }
  }

  function declareModuleSpecifier(node) {
    declareLocal(ast, node.local);
  }

  ancestor(
    ast,
    {
      VariableDeclaration: (node, parents) => {
        let parent = null;
        for (let i = parents.length - 1; i >= 0 && parent === null; --i) {
          if (node.kind === "var" ? isScope(parents[i]) : isBlockScope(parents[i])) {
            parent = parents[i];
          }
        }
        node.declarations.forEach(declaration => declarePattern(declaration.id, parent));
      },
      FunctionDeclaration: (node, parents) => {
        let parent = null;
        for (let i = parents.length - 2; i >= 0 && parent === null; --i) {
          if (isScope(parents[i])) {
            parent = parents[i];
          }
        }
        declareLocal(parent, node.id);
        declareFunction(node);
      },
      Function: declareFunction,
      ClassDeclaration: (node, parents) => {
        let parent = null;
        for (let i = parents.length - 2; i >= 0 && parent === null; i--) {
          if (isScope(parents[i])) {
            parent = parents[i];
          }
        }
        declareLocal(parent, node.id);
      },
      Class: declareClass,
      CatchClause: declareCatchClause,
      ImportDefaultSpecifier: declareModuleSpecifier,
      ImportSpecifier: declareModuleSpecifier,
      ImportNamespaceSpecifier: declareModuleSpecifier
    },
    walk
  );

  function identifier(node, parents) {
    let name = node.name;
    if (name === "undefined") return;
    for (let i = parents.length - 2; i >= 0; --i) {
      if (name === "arguments") {
        if (declaresArguments(parents[i])) {
          return;
        }
      }
      if (hasLocal(parents[i], name)) {
        return;
      }
      if (parents[i].type === "ViewExpression") {
        node = parents[i];
        name = `viewof ${node.id.name}`;
      }
      if (parents[i].type === "MutableExpression") {
        node = parents[i];
        name = `mutable ${node.id.name}`;
      }
    }
    if (!globalSet.has(name)) {
      if (name === "arguments") {
        throw Object.assign(new SyntaxError(`arguments is not allowed`), {node});
      }
      references.push(node);
    }
  }

  ancestor(
    ast,
    {
      VariablePattern: identifier,
      Identifier: identifier
    },
    walk
  );

  function checkConst(node, parents) {
    if (!node) return;
    switch (node.type) {
      case "Identifier":
      case "VariablePattern": {
        for (const parent of parents) {
          if (hasLocal(parent, node.name)) {
            return;
          }
        }
        if (parents[parents.length - 2].type === "MutableExpression") {
          return;
        }
        throw Object.assign(new SyntaxError(`Assignment to constant variable ${node.name}`), {node});
      }
      case "ArrayPattern": {
        for (const element of node.elements) {
          checkConst(element, parents);
        }
        return;
      }
      case "ObjectPattern": {
        for (const property of node.properties) {
          checkConst(property, parents);
        }
        return;
      }
      case "Property": {
        checkConst(node.value, parents);
        return;
      }
      case "RestElement": {
        checkConst(node.argument, parents);
        return;
      }
    }
  }

  function checkConstArgument(node, parents) {
    checkConst(node.argument, parents);
  }

  function checkConstLeft(node, parents) {
    checkConst(node.left, parents);
  }

  ancestor(
    ast,
    {
      AssignmentExpression: checkConstLeft,
      AssignmentPattern: checkConstLeft,
      UpdateExpression: checkConstArgument,
      ForOfStatement: checkConstLeft,
      ForInStatement: checkConstLeft
    },
    walk
  );

  return references;
}
