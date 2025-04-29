import { existsSync } from "stdlib/fs";

const kDraftsFile = "_drafts.yml";

if (existsSync(kDraftsFile)) {
    Deno.removeSync(kDraftsFile);
}
