// https://stackoverflow.com/a/68702966
export const longestCommonDirPrefix = (strs: string[]) => {
  if (strs.length === 0) return "";
  let prefix = strs.reduce((acc, str) => str.length < acc.length ? str : acc);

  for (const str of strs) {
    while (str.slice(0, prefix.length) != prefix) {
      prefix = prefix.slice(0, -1);
    }
  }
  prefix = prefix.slice(0, prefix.lastIndexOf("/") + 1);
  return prefix;
};
