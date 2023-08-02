/*
 * devcontainer-types.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

export interface DevContainer {
  name: string;
  image: string;
  customizations?: {
    vscode?: {
      extensions?: string[];
    };
    codespaces?: {
      openFiles?: string[];
    };
  };
  features?: Record<string, Record<string, unknown>>;
  postCreateCommand?: string;
  postAttachCommand?: string;
  postStartCommand?: string;
  forwardPorts?: number[];
  portsAttributes?: Record<string, PortAttribute>;
  codespaces?: Record<string, unknown>;
  containerEnv?: Record<string, string>;
}

export interface PortAttribute {
  label: string;
  requireLocalPort: boolean;
  onAutoForward: string;
}

export interface ContainerContext {
  title: string;
  tools: Array<QuartoTool>;
  codeEnvironment: QuartoEditor;
  engines: string[];
  quarto: QuartoVersion;
  environments: string[];
  openFiles: string[];
  envVars: Record<string, string>;
}

export type QuartoEditor = "vscode" | "rstudio" | "jupyterlab";
export type QuartoVersion = "release" | "prerelease";
export type QuartoTool = "tinytex" | "chromium";
