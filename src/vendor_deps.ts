/*

These are special dependencies that need to be explicitly imported here
so that our vendoring process finds them. They're used in dynamic imports
that are not found by the static analysis of the vendoring process.

This is only used by vendor.sh and should not be imported by any other code.
*/

// for puppeteer
import { dirname, join, SEP } from "https://deno.land/std@0.93.0/path/mod.ts";
