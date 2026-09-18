// src/core/api/register.ts
//
// Side-effect module that imports all namespace registrations
// This module has no exports - its purpose is to trigger registration
// of all QuartoAPI namespaces with the global registry.

import "./markdown-regex.ts";
import "./mapped-string.ts";
import "./jupyter.ts";
import "./format.ts";
import "./path.ts";
import "./system.ts";
import "./text.ts";
import "./console.ts";
import "./crypto.ts";
