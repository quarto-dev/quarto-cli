export function getenv(name: string, defaultValue?: string) {
  const value = Deno.env.get(name);
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Required environment variable ${name} not specified.`);
    } else {
      return defaultValue;
    }
  } else {
    return value;
  }
}
