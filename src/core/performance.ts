/*
* performance.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

export function withTiming<T>(label: string, op: () => T) {
  console.time(label);
  try {
    return op();
  } finally {
    console.timeEnd(label);
  }
}

export function performanceStart() {
  performanceClear();
}

export function performanceMark(mark: string) {
  performance.mark(mark);
}

export function performanceEnd() {
  const marks = performance.getEntriesByType("mark");
  return marks.map((_entry, i) => {
    const markStart = marks[i].startTime;
    const markEnd = marks[i + 1] ? marks[i + 1].startTime : performance.now();
    return {
      name: marks[i].name,
      duration: markEnd - markStart,
    };
  });
}

function performanceClear() {
  performance.clearMarks();
  performance.clearMeasures();
}
