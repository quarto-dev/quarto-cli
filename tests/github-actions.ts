/*
 * github-actions.ts
 *
 * Utilities for GitHub Actions workflow commands
 * See: https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions
 */

export function isGitHubActions(): boolean {
  return Deno.env.get("GITHUB_ACTIONS") === "true";
}

export function isVerboseMode(): boolean {
  // Check if RUNNER_DEBUG is set (GitHub Actions debug mode)
  // or if QUARTO_TEST_VERBOSE is explicitly set
  return Deno.env.get("RUNNER_DEBUG") === "1" ||
         Deno.env.get("QUARTO_TEST_VERBOSE") === "true";
}

export interface AnnotationProperties {
  file?: string;
  line?: number;
  endLine?: number;
  title?: string;
}

export function escapeData(s: string): string {
  return s
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
}

export function escapeProperty(s: string): string {
  return s
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A")
    .replace(/,/g, "%2C");
}

function formatProperties(props: AnnotationProperties): string {
  const parts: string[] = [];
  if (props.file !== undefined) parts.push(`file=${escapeProperty(props.file)}`);
  if (props.line !== undefined) parts.push(`line=${props.line}`);
  if (props.endLine !== undefined) parts.push(`endLine=${props.endLine}`);
  if (props.title !== undefined) parts.push(`title=${escapeProperty(props.title)}`);
  return parts.length > 0 ? " " + parts.join(",") : "";
}

export function error(message: string, properties?: AnnotationProperties): void {
  if (!isGitHubActions()) return;
  const props = properties ? formatProperties(properties) : "";
  console.log(`::error${props}::${escapeData(message)}`);
}

export function warning(message: string, properties?: AnnotationProperties): void {
  if (!isGitHubActions()) return;
  const props = properties ? formatProperties(properties) : "";
  console.log(`::warning${props}::${escapeData(message)}`);
}

export function notice(message: string, properties?: AnnotationProperties): void {
  if (!isGitHubActions()) return;
  const props = properties ? formatProperties(properties) : "";
  console.log(`::notice${props}::${escapeData(message)}`);
}

export function startGroup(title: string): void {
  if (!isGitHubActions()) return;
  console.log(`::group::${escapeData(title)}`);
}

export function endGroup(): void {
  if (!isGitHubActions()) return;
  console.log("::endgroup::");
}

export function withGroup<T>(title: string, fn: () => T): T {
  startGroup(title);
  try {
    return fn();
  } finally {
    endGroup();
  }
}

export async function withGroupAsync<T>(title: string, fn: () => Promise<T>): Promise<T> {
  startGroup(title);
  try {
    return await fn();
  } finally {
    endGroup();
  }
}
