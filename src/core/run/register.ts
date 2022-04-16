import { denoRunHandler } from "./deno.ts";
import { luaRunHandler } from "./lua.ts";
import { pythonRunHandler } from "./python.ts";
import { rRunHandler } from "./r.ts";
import { installRunHandler } from "./run.ts";

installRunHandler(denoRunHandler);
installRunHandler(luaRunHandler);
installRunHandler(pythonRunHandler);
installRunHandler(rRunHandler);
