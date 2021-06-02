export let css = `<style>
  pre.ojs-source {
    background-color: #eee;
  }
</style>
`;

export let imports = `
import { Interpreter } from 'https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler';
import { Inspector, Runtime } from 'https://cdn.skypack.dev/@observablehq/runtime';
`;

export let preamble = `
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
  let targetElement = document.body;

  function ourObserver() {
    return new Inspector(targetElement.appendChild(document.createElement("div")));
  }
  
  const interpreter = new Interpreter({ module: mainMod, observer: ourObserver });
  
  let result = {
    setTargetElement(el) {
      targetElement = el;
    },
    async interpret(src) {
      let sourceEl = createOJSSourceElement(targetElement, src);
      // immediately bind current value of targetElement to an IIFE
      // to avoid a race between quarto and the observable async runtime

      let iife = (function(target) {
        return () => new Inspector(target.appendChild(document.createElement("div")));
      })(targetElement);
      let result = await interpreter.module(src, undefined, iife);
      return result;
    }
  };
  
  return result;
}

window._ojsRuntime = createRuntime();
`;
