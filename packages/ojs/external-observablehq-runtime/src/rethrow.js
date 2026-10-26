export function rethrow(error) {
  return () => {
    throw error;
  };
}
