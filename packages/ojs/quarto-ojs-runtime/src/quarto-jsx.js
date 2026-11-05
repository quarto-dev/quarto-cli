import { escapeHtml } from "./escape.js";

function createHtmlElement(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs || {})) {
    el.setAttribute(key, val);
  }
  while (children.length) {
    const child = children.shift();
    if (Array.isArray(child)) {
      children.unshift(...child);
    } else if (child instanceof HTMLElement) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(escapeHtml(child)));
    }
  }
  return el;
}

function createNamespacedElement(ns, tag, attrs, ...children) {
  const el = document.createElementNS(ns.namespace, tag);
  for (const [key, val] of Object.entries(attrs || {})) {
    el.setAttribute(key, val);
  }
  while (children.length) {
    const child = children.shift();
    if (Array.isArray(child)) {
      children.unshift(...child);
    } else if (child instanceof HTMLElement || child instanceof ns.class) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(escapeHtml(child)));
    }
  }
  return el;
}

const resolver = {
  a: "svg",
  animate: "svg",
  animateMotion: "svg",
  animateTransform: "svg",
  circle: "svg",
  clipPath: "svg",
  defs: "svg",
  desc: "svg",
  discard: "svg",
  ellipse: "svg",
  feBlend: "svg",
  feColorMatrix: "svg",
  feComponentTransfer: "svg",
  feComposite: "svg",
  feConvolveMatrix: "svg",
  feDiffuseLighting: "svg",
  feDisplacementMap: "svg",
  feDistantLight: "svg",
  feDropShadow: "svg",
  feFlood: "svg",
  feFuncA: "svg",
  feFuncB: "svg",
  feFuncG: "svg",
  feFuncR: "svg",
  feGaussianBlur: "svg",
  feImage: "svg",
  feMerge: "svg",
  feMergeNode: "svg",
  feMorphology: "svg",
  feOffset: "svg",
  fePointLight: "svg",
  feSpecularLighting: "svg",
  feSpotLight: "svg",
  feTile: "svg",
  feTurbulence: "svg",
  filter: "svg",
  foreignObject: "svg",
  g: "svg",
  image: "svg",
  line: "svg",
  linearGradient: "svg",
  marker: "svg",
  mask: "svg",
  metadata: "svg",
  mpath: "svg",
  path: "svg",
  pattern: "svg",
  polygon: "svg",
  polyline: "svg",
  radialGradient: "svg",
  rect: "svg",
  script: "svg",
  set: "svg",
  stop: "svg",
  style: "svg",
  svg: "svg",
  switch: "svg",
  symbol: "svg",
  text: "svg",
  textPath: "svg",
  title: "svg",
  tspan: "svg",
  use: "svg",
  view: "svg",  
};

const nss = {
  "svg": { namespace: "http://www.w3.org/2000/svg", class: SVGElement }
};

function resolveCreator(tag) {
  const nsKey = resolver[tag];
  if (nsKey === undefined) {
    return createHtmlElement;
  }
  const namespace = nss[nsKey];

  return function(tag, attrs, ...children) {
    return createNamespacedElement(namespace, tag, attrs, ...children);
  }
}

export function createQuartoJsxShim()
{
  return {
    createElement(tag, attrs, ...children) {
      if (typeof tag === "function") {
        return tag({...attrs, children });
      }

      return resolveCreator(tag)(tag, attrs, ...children);
    }
  };
}