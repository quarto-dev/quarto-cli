import { existsSync, ensureDirSync } from "https://deno.land/std/fs/mod.ts";
import { join } from "https://deno.land/std/"../../../../../src/deno_ral/path.ts"";

const kNewFiles = [{file: "test1.qmd", title: "First Doc"}, {file: "test2.qmd", title: "Second Doc"}];

const fileContents = (title: string, filename: string) => {
    return `
---
title: ${title}
author: Charles Teague
date: today
---

## Hello There!

{{< lipsum 2 >}}

## File Info

Filename: ${filename}
`;
}

ensureDirSync("sidebar");
for (const newFile of kNewFiles) {
    
    const path = join("sidebar", newFile.file);
    if (existsSync(path)) {
        Deno.removeSync(path);
    }    
    Deno.writeTextFileSync(path, fileContents(newFile.title, newFile.file));
}

