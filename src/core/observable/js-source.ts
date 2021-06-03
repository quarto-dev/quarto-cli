export let css = `<style type="text/css">
  pre.ojs-source {
    background-color: #eee;
  }

  span.ojs-inline span div {
    display: inline-block;
  }
</style>
`;

export let imports = `
import { Interpreter } from 'https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler';
import { Inspector, Runtime } from 'https://cdn.skypack.dev/@observablehq/runtime';
`;

export let preamble = `
let css = "span.ojs-inline span div { display: inline-block; }";
let cssEl = document.createElement("style");
cssEl.setAttribute("type", "text/css");
cssEl.innerText = css;
document.head.appendChild(cssEl);

function createOJSSourceElement(el, src)
{
  let sourceEl = document.createElement("pre");
  sourceEl.setAttribute("class", "ojs-source");
  sourceEl.innerText = src.trim();
  el.appendChild(sourceEl);
  return sourceEl;
}

export function createRuntime()
{
  const runtime = new Runtime();
  const mainMod = runtime.module();

  function ourObserver() {
    return new Inspector(targetElement.appendChild(document.createElement("div")));
  }
  
  const interpreter = new Interpreter({ module: mainMod, observer: ourObserver });
  
  let result = {
    async interpret(src, targetElement, inline) {
      let observer = () => new Inspector(targetElement.appendChild(document.createElement(inline ? "span" : "div")));
      let result = await interpreter.module(src, undefined, observer);
      return result;
    }
  };
  
  return result;
}

window._ojsRuntime = createRuntime();
`;
