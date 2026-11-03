const original = Deno.readTextFileSync;
const D = Reflect.get(globalThis, "Deno");
D.readTextFileSync = (p: string) => "patched:" + original(p);
