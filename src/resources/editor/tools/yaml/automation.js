/*
* automation.js
*
* Entry point for YAML automation in the IDE. 
*
* In build-js, this gets concatenated with the iife bundle of
* tree-sitter to make yaml.js.
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { QuartoYamlEditorTools } from "./yaml-intelligence.js";

window.QuartoYamlEditorTools = QuartoYamlEditorTools;
