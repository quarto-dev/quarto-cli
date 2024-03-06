import type { KeyCode } from "../keycode/mod.ts";
import { WidenType } from "./_utils.ts";
import { brightBlue, dim, green, red } from "./deps.ts";
import { Figures, getFiguresByKeys } from "./_figures.ts";
import {
  GenericList,
  GenericListKeys,
  GenericListOption,
  GenericListOptionGroup,
  GenericListOptionGroupSettings,
  GenericListOptions,
  GenericListOptionSettings,
  GenericListSeparatorOption,
  GenericListSettings,
  isOption,
  isOptionGroup,
} from "./_generic_list.ts";
import { GenericPrompt } from "./_generic_prompt.ts";

/** Checkbox prompt options. */
export interface CheckboxOptions<TValue>
  extends GenericListOptions<TValue, Array<TValue>, Array<TValue>> {
  /** Keymap to assign key names to prompt actions. */
  keys?: CheckboxKeys;
  /** An array of child options. */
  options: Array<
    | Extract<TValue, string | number>
    | Extract<WidenType<TValue>, string | number>
    | CheckboxOption<TValue>
    | CheckboxOptionGroup<TValue>
    | GenericListSeparatorOption
  >;
  /** If enabled, the user needs to press enter twice to submit. Default is `true`. */
  confirmSubmit?: boolean;
  /** Change check icon. Default is `green(Figures.TICK)`. */
  check?: string;
  /** Change uncheck icon. Default is `red(Figures.CROSS)`. */
  uncheck?: string;
  /** Change partial check icon. Default is `green(Figures.RADIO_ON)`. */
  partialCheck?: string;
  /** The minimum allowed options to select. Default is `0`. */
  minOptions?: number;
  /** The maximum allowed options to select. Default is `Infinity`. */
  maxOptions?: number;
}

/** Checkbox prompt settings. */
interface CheckboxSettings<TValue> extends
  GenericListSettings<
    TValue,
    Array<TValue>,
    Array<TValue>,
    CheckboxOptionSettings<TValue>,
    CheckboxOptionGroupSettings<TValue>
  > {
  confirmSubmit: boolean;
  check: string;
  uncheck: string;
  partialCheck: string;
  minOptions: number;
  maxOptions: number;
  keys: CheckboxKeys;
}

/** Checkbox option options. */
export interface CheckboxOption<TValue> extends GenericListOption<TValue> {
  /** Set checked status. */
  checked?: boolean;
  /** Change option icon. */
  icon?: boolean;
}

/** Checkbox option group options. */
export interface CheckboxOptionGroup<TValue>
  extends GenericListOptionGroup<TValue, CheckboxOption<TValue>> {
  /** Change option icon. */
  icon?: boolean;
}

/** Checkbox option settings. */
export interface CheckboxOptionSettings<TValue>
  extends GenericListOptionSettings<TValue> {
  checked: boolean;
  icon: boolean;
}

/** Checkbox option group settings. */
export interface CheckboxOptionGroupSettings<TValue>
  extends
    GenericListOptionGroupSettings<TValue, CheckboxOptionSettings<TValue>> {
  readonly checked: boolean;
  icon: boolean;
}

/** Checkbox prompt keymap. */
export interface CheckboxKeys extends GenericListKeys {
  /** Check/uncheck option keymap. Default is `["space"]`. */
  check?: Array<string>;
  checkAll?: Array<string>;
}

/**
 * Checkbox prompt representation.
 *
 * Simple prompt:
 *
 * ```ts
 * import { Checkbox } from "./mod.ts";
 *
 * const colors: Array<string> = await Checkbox.prompt({
 *   message: "Pick some colors",
 *   options: ["red", "green", "blue"],
 * });
 * ```
 *
 * Mixed option types:
 *
 * ```ts
 * import { Checkbox } from "./mod.ts";
 *
 * const values: Array<string | number> = await Checkbox.prompt<string | number>({
 *   message: "Pick some colors",
 *   options: [1, 2, "3", "4"],
 * });
 * ```
 *
 * None primitive option types:
 *
 * ```ts
 * import { Checkbox } from "./mod.ts";
 *
 * const dates: Array<Date> = await Checkbox.prompt({
 *   message: "Pick some dates",
 *   options: [
 *     {
 *       name: "Date 1",
 *       value: new Date(100000),
 *     },
 *     {
 *       name: "Date 2",
 *       value: new Date(200000),
 *     },
 *     {
 *       name: "Date 3",
 *       value: new Date(300000),
 *     },
 *   ],
 * });
 * ```
 *
 * Grouped options:
 *
 * ```ts
 * import { Checkbox } from "./mod.ts";
 *
 * const values = await Checkbox.prompt({
 *   message: "Select some values",
 *   options: [{
 *     name: "Group 1",
 *     options: ["foo", "bar", "baz"],
 *   }, {
 *     name: "Group 2",
 *     options: ["beep", "boop"],
 *   }],
 * });
 * ```
 */
export class Checkbox<TValue> extends GenericList<
  TValue,
  Array<TValue>,
  Array<TValue>,
  CheckboxOptionSettings<TValue>,
  CheckboxOptionGroupSettings<TValue>
> {
  protected readonly settings: CheckboxSettings<TValue>;
  protected options: Array<
    CheckboxOptionSettings<TValue> | CheckboxOptionGroupSettings<TValue>
  >;
  protected listIndex: number;
  protected listOffset: number;
  private confirmSubmit = false;

  /**
   * Execute the prompt with provided options.
   *
   * @param options Checkbox options.
   */
  public static prompt<TValue>(
    options: CheckboxOptions<TValue>,
  ): Promise<Array<WidenType<TValue>>> {
    return new this(options).prompt() as Promise<Array<WidenType<TValue>>>;
  }

  /**
   * Create list separator.
   *
   * @param label Separator label.
   */

  /**
   * Inject prompt value. If called, the prompt doesn't prompt for an input and
   * returns immediately the injected value. Can be used for unit tests or pre
   * selections.
   *
   * @param value Input value.
   */
  public static inject<TValue>(value: Array<TValue>): void {
    GenericPrompt.inject(value);
  }

  constructor(options: CheckboxOptions<TValue>) {
    super();
    this.settings = this.getDefaultSettings(options);
    this.options = this.settings.options.slice();
    this.listIndex = this.getListIndex();
    this.listOffset = this.getPageOffset(this.listIndex);
  }

  public getDefaultSettings(
    options: CheckboxOptions<TValue>,
  ): CheckboxSettings<TValue> {
    const settings = super.getDefaultSettings(options);
    return {
      confirmSubmit: true,
      ...settings,
      check: options.check ?? green(Figures.TICK),
      uncheck: options.uncheck ?? red(Figures.CROSS),
      partialCheck: options.partialCheck ?? green(Figures.RADIO_ON),
      minOptions: options.minOptions ?? 0,
      maxOptions: options.maxOptions ?? Infinity,
      options: this.mapOptions(options, options.options),
      keys: {
        check: ["space"],
        checkAll: ["a"],
        ...(settings.keys ?? {}),
        open: options.keys?.open ?? ["right"],
        back: options.keys?.back ?? ["left", "escape"],
      },
    };
  }

  /** Map string option values to options and set option defaults. */
  protected mapOptions(
    promptOptions: CheckboxOptions<TValue>,
    options: Array<
      | Extract<TValue, string | number>
      | Extract<WidenType<TValue>, string | number>
      | CheckboxOption<TValue>
      | CheckboxOptionGroup<TValue>
      | GenericListSeparatorOption
    >,
  ): Array<
    CheckboxOptionSettings<TValue> | CheckboxOptionGroupSettings<TValue>
  > {
    return options.map((option) =>
      typeof option === "string" || typeof option === "number"
        ? this.mapOption(
          promptOptions,
          { value: option as TValue },
        )
        : isCheckboxOptionGroup(option)
        ? this.mapOptionGroup(promptOptions, option)
        : this.mapOption(promptOptions, option)
    );
  }

  protected mapOption(
    options: CheckboxOptions<TValue>,
    option: CheckboxOption<TValue> | GenericListSeparatorOption,
  ): CheckboxOptionSettings<TValue> {
    if (isOption(option)) {
      return {
        ...super.mapOption(options, option),
        checked: typeof option.checked === "undefined" && options.default &&
            options.default.indexOf(option.value) !== -1
          ? true
          : !!option.checked,
        icon: typeof option.icon === "undefined" ? true : option.icon,
      };
    } else {
      return {
        ...super.mapOption(options, option),
        checked: false,
        icon: false,
      };
    }
  }

  protected mapOptionGroup(
    promptOptions: CheckboxOptions<TValue>,
    option: CheckboxOptionGroup<TValue>,
  ): CheckboxOptionGroupSettings<TValue> {
    const options = this.mapOptions(promptOptions, option.options);
    return {
      ...super.mapOptionGroup(promptOptions, option, false),
      get checked() {
        return areAllChecked(options);
      },
      options,
      icon: typeof option.icon === "undefined" ? true : option.icon,
    };
  }

  protected match(): void {
    super.match();
    if (this.isSearching()) {
      this.selectSearch();
    }
  }

  protected getListItemIcon(
    option:
      | CheckboxOptionSettings<TValue>
      | CheckboxOptionGroupSettings<TValue>,
  ): string {
    return this.getCheckboxIcon(option) + super.getListItemIcon(option);
  }

  private getCheckboxIcon(
    option:
      | CheckboxOptionSettings<TValue>
      | CheckboxOptionGroupSettings<TValue>,
  ): string {
    if (!option.icon) {
      return "";
    }
    const icon = option.checked
      ? this.settings.check + " "
      : isOptionGroup(option) && areSomeChecked(option.options)
      ? this.settings.partialCheck + " "
      : this.settings.uncheck + " ";

    return option.disabled ? dim(icon) : icon;
  }

  /** Get value of checked options. */
  protected getValue(): Array<TValue> {
    return flatOptions<
      TValue,
      CheckboxOptionSettings<TValue>,
      CheckboxOptionGroupSettings<TValue>
    >(
      this.settings.options,
    )
      .filter((option) => option.checked)
      .map((option) => option.value);
  }

  /**
   * Handle user input event.
   * @param event Key event.
   */
  protected async handleEvent(event: KeyCode): Promise<void> {
    const hasConfirmed: boolean = this.confirmSubmit;
    this.confirmSubmit = false;

    switch (true) {
      case this.isKey(this.settings.keys, "check", event) &&
        !this.isSearchSelected():
        this.checkValue();
        break;
      case this.isKey(this.settings.keys, "submit", event):
        await this.submit(hasConfirmed);
        break;

      case event.ctrl && this.isKey(this.settings.keys, "checkAll", event):
        this.checkAllOption();
        break;
      default:
        await super.handleEvent(event);
    }
  }

  protected hint(): string | undefined {
    if (this.confirmSubmit) {
      const info = this.isBackButton(this.selectedOption)
        ? ` To leave the current group press ${
          getFiguresByKeys(this.settings.keys.back ?? []).join(", ")
        }.`
        : isOptionGroup(this.selectedOption)
        ? ` To open the selected group press ${
          getFiguresByKeys(this.settings.keys.open ?? []).join(", ")
        }.`
        : ` To check or uncheck the selected option press ${
          getFiguresByKeys(this.settings.keys.check ?? []).join(", ")
        }.`;

      return this.settings.indent +
        brightBlue(
          `Press ${
            getFiguresByKeys(this.settings.keys.submit ?? [])
          } again to submit.${info}`,
        );
    }

    return super.hint();
  }

  protected async submit(hasConfirmed?: boolean): Promise<void> {
    if (
      !hasConfirmed &&
      this.settings.confirmSubmit &&
      !this.isSearchSelected()
    ) {
      this.confirmSubmit = true;
      return;
    }

    await super.submit();
  }

  /** Check selected option. */
  protected checkValue(): void {
    const option = this.options.at(this.listIndex);
    if (!option) {
      this.setErrorMessage("No option available to select.");
      return;
    } else if (option.disabled) {
      this.setErrorMessage("This option is disabled and cannot be changed.");
      return;
    }
    this.checkOption(option, !option.checked);
  }

  private checkOption(
    option:
      | CheckboxOptionSettings<TValue>
      | CheckboxOptionGroupSettings<TValue>,
    checked: boolean,
  ) {
    if (isOption(option)) {
      option.checked = checked;
    } else {
      for (const childOption of option.options) {
        this.checkOption(childOption, checked);
      }
    }
  }

  private checkAllOption() {
    const checked = this.options.some((option) => option.checked);

    for (const option of this.options) {
      this.checkOption(option, !checked);
    }
  }

  /**
   * Validate input value.
   * @param value User input value.
   * @return True on success, false or error message on error.
   */
  protected validate(value: Array<TValue>): boolean | string {
    const options = flatOptions<
      TValue,
      CheckboxOptionSettings<TValue>,
      CheckboxOptionGroupSettings<TValue>
    >(this.settings.options);

    const isValidValue = Array.isArray(value) &&
      value.every((val) =>
        options.findIndex((option: CheckboxOptionSettings<TValue>) =>
          option.value === val
        ) !== -1
      );

    if (!isValidValue) {
      return false;
    }

    if (value.length < this.settings.minOptions) {
      return `The minimum number of options is ${this.settings.minOptions} but got ${value.length}.`;
    }
    if (value.length > this.settings.maxOptions) {
      return `The maximum number of options is ${this.settings.maxOptions} but got ${value.length}.`;
    }

    return true;
  }

  /**
   * Map input value to output value.
   * @param value Input value.
   * @return Output value.
   */
  protected transform(value: Array<TValue>): Array<TValue> {
    return value;
  }

  /**
   * Format output value.
   * @param value Output value.
   */
  protected format(value: Array<TValue>): string {
    return value.map((val) =>
      this.settings.format?.(val) ?? this.getOptionByValue(val)?.name ??
        String(val)
    ).join(", ");
  }
}

function areSomeChecked<TValue>(
  options: Array<
    CheckboxOptionSettings<TValue> | CheckboxOptionGroupSettings<TValue>
  >,
): boolean {
  return options.some((option) =>
    isOptionGroup(option) ? areSomeChecked(option.options) : option.checked
  );
}

function areAllChecked<TValue>(
  options: Array<
    CheckboxOptionSettings<TValue> | CheckboxOptionGroupSettings<TValue>
  >,
): boolean {
  return options.every((option) =>
    isOptionGroup(option) ? areAllChecked(option.options) : option.checked
  );
}

function flatOptions<
  TValue,
  TOption extends GenericListOptionSettings<TValue>,
  TGroup extends GenericListOptionGroupSettings<TValue, TOption>,
>(
  options: Array<TOption | TGroup>,
): Array<TOption> {
  return flat(options);

  function flat(
    options: Array<TOption | TGroup>,
    indentLevel = 0,
    opts: Array<TOption> = [],
  ): Array<TOption> {
    for (const option of options) {
      option.indentLevel = indentLevel;
      if (isOption(option)) {
        opts.push(option);
      }
      if (isOptionGroup(option)) {
        flat(option.options, ++indentLevel, opts);
      }
    }

    return opts;
  }
}

export function isCheckboxOptionGroup(
  option: unknown,
  // deno-lint-ignore no-explicit-any
): option is CheckboxOptionGroup<any> {
  return isOptionGroup(option);
}

/**
 * Checkbox options type.
 * @deprecated Use `Array<string | CheckboxOption>` instead.
 */
export type CheckboxValueOptions = Array<string | CheckboxOption<string>>;

/**
 * Checkbox option settings type.
 * @deprecated Use `Array<CheckboxOptionSettings | CheckboxOptionGroupSettings>` instead.
 */
export type CheckboxValueSettings = Array<
  CheckboxOptionSettings<string> | CheckboxOptionGroupSettings<string>
>;
