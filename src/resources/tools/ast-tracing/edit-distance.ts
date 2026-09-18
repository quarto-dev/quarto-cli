type Result = {
  type: "insert" | "delete" | "replace" | "begin";
  location: [number, number];
  newLocation: [number, number];
};

export const editDistance = (a: string[], b: string[]): Result[] => {
  type Edit = {
    type: "insert" | "delete" | "replace" | "begin";
    cost: number;
  };
  const result: Result[] = [];

  const dp: (Edit | undefined)[][] = [];
  for (let i = 0; i <= a.length; i++) {
    dp.push([]);
    for (let j = 0; j <= b.length; j++) {
      dp[i].push(undefined);
    }
  }
  dp[0][0] = { type: "begin", cost: 0 };
  for (let i = 1; i <= a.length; i++) {
    dp[i][0] = { type: "delete", cost: i };
  }
  for (let j = 1; j <= b.length; j++) {
    dp[0][j] = { type: "insert", cost: j };
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      const ops: Edit[] = [
        { type: "delete", cost: dp[i - 1][j]!.cost + 1 },
        { type: "insert", cost: dp[i][j - 1]!.cost + 1 },
        {
          type: "replace",
          cost: dp[i - 1][j - 1]!.cost + cost,
        },
      ];
      ops.sort((a, b) => a.cost - b.cost);
      dp[i][j] = ops[0];
    }
  }
  // build results array
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    const op = dp[i][j]!;
    const newLocation: [number, number] = [i, j];
    switch (op.type) {
      case "begin":
        throw new Error("should not happen");
      case "delete":
        i--;
        break;
      case "insert":
        j--;
        break;
      case "replace":
        i--;
        j--;
        break;
    }
    result.push({ type: op.type, location: [i, j], newLocation });
  }
  result.reverse();
  return result;
};
