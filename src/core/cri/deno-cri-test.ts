import { criClient } from "./cri.ts";

const m = await criClient();
await m.open("https://github.com");

/*const result = await m.client().Page.captureScreenshot({
  clip: { x: 0, y: 0, width: 300, height: 300, scale: 1 },
  fromSurface: true,
  captureBeyondViewport: true,
});
console.log(result);*/

const imgs = await m.docQuerySelectorAll("img");

console.log(imgs);

let i = 1;
for (const { data } of await m.screenshots("img", 1)) {
  Deno.writeFileSync(`image-${i}.png`, data);
  ++i;
}

await m.close();
