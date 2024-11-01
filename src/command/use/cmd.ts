/*
 * cmd.ts
 *
 * Copyright (C) 2021-2024 Posit Software, PBC
 */
import { TemplateCommand } from "./commands/template.ts";
import { BinderCommand } from "./commands/binder/binder.ts";

export const useCommands = [TemplateCommand, BinderCommand];
