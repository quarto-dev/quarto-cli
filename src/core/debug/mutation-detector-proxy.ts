/*
 * mutation-detector-proxy
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

export type DeepProxyChange = {
  type: "update" | "delete";
  path: (string | symbol)[];
  oldValue: unknown;
  newValue?: unknown;
};

export type OnChangeCallback = (change: DeepProxyChange) => void;

export function mutationDetectorProxy<T extends object>(
  obj: T,
  onChange: OnChangeCallback,
  path: (string | symbol)[] = [],
): T {
  return new Proxy(obj, {
    get(target: T, property: string | symbol): any {
      const value = Reflect.get(target, property);
      if (value && typeof value === "object") {
        return mutationDetectorProxy(
          value,
          onChange,
          [...path, property],
        );
      }
      return value;
    },

    set(target: T, property: string | symbol, value: any): boolean {
      const oldValue = Reflect.get(target, property);
      const result = Reflect.set(target, property, value);

      if (result) {
        onChange({
          type: "update",
          path: [...path, property],
          oldValue,
          newValue: value,
        });
      }

      return result;
    },

    deleteProperty(target: T, property: string | symbol): boolean {
      const oldValue = Reflect.get(target, property);
      const result = Reflect.deleteProperty(target, property);

      if (result) {
        onChange({
          type: "delete",
          path: [...path, property],
          oldValue,
        });
      }

      return result;
    },
  });
}
