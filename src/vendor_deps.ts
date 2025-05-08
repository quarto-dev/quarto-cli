/*

These are special dependencies that need to be explicitly imported here
so that our vendoring process finds them. They're used in dynamic imports
that are not found by the static analysis of the vendoring process.

This is only used by vendor.sh and should not be imported by any other code.
*/

// for puppeteer
import { dirname, join, SEP } from "https://deno.land/std@0.93.0/path/mod.ts";
import puppeteer from "https://deno.land/x/puppeteer@9.0.2/mod.ts";
import _jszip from "https://dev.jspm.io/jszip@3.5.0";
// import * as _base64 from "https://deno.land/std@0.93.0/encoding/base64.ts";

// I don't quite understand why the import map is not resolving this one
import * as _base64_2 from "https://deno.land/std@0.196.0/encoding/base64.ts";
