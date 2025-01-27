/*
 * perfetto-utils.ts
 *
 * Some utility functions for working with Perfetto traces.
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

type PerfettoTraceEvent = {
  ph: "B" | "E" | "X" | "I" | "C" | "S" | "F";
  ts: number;
  dur?: number;
  name?: string;
  cat?: string;
};

export function convertCombinedLuaProfileToCSV(
  profileName: string,
) {
  const combinedInformation = JSON.parse(
    Deno.readTextFileSync(profileName),
  );

  const lines: string[] = ["filter,name,time"];

  Object.entries(combinedInformation).forEach(([cat, data]) => {
    // deno-lint-ignore no-explicit-any
    Object.entries(data as any).forEach(([fileName, time]) => {
      lines.push(`${cat},${fileName},${time}`);
    });
  });
  Deno.writeTextFileSync(profileName, lines.join("\n"));
}

export function appendToCombinedLuaProfile(
  inputFileName: string,
  individualTraceFile: string,
  combinedInformationFile: string,
) {
  const individualTrace = JSON.parse(
    Deno.readTextFileSync(individualTraceFile),
  );
  let combinedInformation: Record<string, Record<string, number>> = {};
  try {
    combinedInformation = JSON.parse(
      Deno.readTextFileSync(combinedInformationFile),
    );
  } catch (_) {
    // ignore
  }

  const earliestBEventByCat: Record<string, number> = {};
  const latestEEventByCat: Record<string, number> = {};

  individualTrace.traceEvents.forEach((event: Record<string, unknown>) => {
    const e = event as PerfettoTraceEvent;
    if (e.cat && (e.ph === "B")) {
      if (
        earliestBEventByCat[e.cat] === undefined ||
        e.ts < earliestBEventByCat[e.cat]
      ) {
        earliestBEventByCat[e.cat] = e.ts;
      }
    } else if (e.cat && (e.ph === "E")) {
      if (
        latestEEventByCat[e.cat] === undefined ||
        e.ts > latestEEventByCat[e.cat]
      ) {
        latestEEventByCat[e.cat] = e.ts;
      }
    }
  });

  Object.entries(earliestBEventByCat).forEach(([cat, start]) => {
    if (latestEEventByCat[cat] === undefined) {
      console.error("No end event for category", cat);
      return;
    }

    if (!combinedInformation[cat]) {
      combinedInformation[cat] = {};
    }
    combinedInformation[cat][inputFileName] = latestEEventByCat[cat] - start;
  });
  Deno.writeTextFileSync(
    combinedInformationFile,
    JSON.stringify(combinedInformation, null, 2),
  );
}
