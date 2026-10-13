import {leaflet as ll} from "./dependencies.js";

export async function leaflet(require) {
  const L = await require(ll.resolve());
  if (!L._style) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = await require.resolve(ll.resolve("dist/leaflet.css"));
    L._style = document.head.appendChild(link);
  }
  return L;
}
