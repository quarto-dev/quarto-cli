import { GenericPrompt } from "./_generic_prompt.ts";
import {
  GenericSuggestions,
  GenericSuggestionsKeys,
  GenericSuggestionsOptions,
  GenericSuggestionsSettings,
} from "./_generic_suggestions.ts";
import { dim, normalize, underline } from "./deps.ts";

/** List prompt options. */
export interface ListOptions
  extends GenericSuggestionsOptions<string[], string> {
  /** Keymap to assign key names to prompt actions. */
  keys?: ListKeys;
  /** Change the list separator. Default is `,`. */
  separator?: string;
  /** Limit minimum allowed length of a tag. */
  minLength?: number;
  /** Limit maximum allowed length of a tag. */
  maxLength?: number;
  /** Limit minimum amount of entered tags. */
  minTags?: number;
  /** Limit maximum amount of entered tags. */
  maxTags?: number;
}

/** List prompt settings. */
interface ListSettings extends GenericSuggestionsSettings<string[], string> {
  separator: string;
  minLength: number;
  maxLength: number;
  minTags: number;
  maxTags: number;
  keys?: ListKeys;
}

/** List prompt keymap. */
export type ListKeys = GenericSuggestionsKeys;

/**
 * List prompt representation.
 *
 * ```ts
 * import { List } from "./mod.ts";
 *
 * const confirmed: Array<string> = await List.prompt("Enter some keywords");
 * ```
 */
export class List extends GenericSuggestions<string[], string> {
  protected readonly settings: ListSettings;

  /** Execute the prompt with provided options. */
  public static prompt(options: string | ListOptions): Promise<string[]> {
    return new this(options).prompt();
  }

  /**
   * Inject prompt value. If called, the prompt doesn't prompt for an input and
   * returns immediately the injected value. Can be used for unit tests or pre
   * selections.
   *
   * @param value Input value.
   */
  public static inject(value: string): void {
    GenericPrompt.inject(value);
  }

  constructor(options: string | ListOptions) {
    super();
    if (typeof options === "string") {
      options = { message: options };
    }
    this.settings = this.getDefaultSettings(options);
  }

  public getDefaultSettings(options: ListOptions): ListSettings {
    return {
      ...super.getDefaultSettings(options),
      separator: options.separator ?? ",",
      minLength: options.minLength ?? 0,
      maxLength: options.maxLength ?? Infinity,
      minTags: options.minTags ?? 0,
      maxTags: options.maxTags ?? Infinity,
    };
  }

  protected input(): string {
    const oldInput: string = this.inputValue;
    const tags: string[] = this.getTags(oldInput);
    const separator: string = this.settings.separator + " ";

    if (this.settings.files && tags.length > 1) {
      tags[tags.length - 2] = normalize(tags[tags.length - 2]);
    }

    this.inputValue = tags.join(separator);

    const diff = oldInput.length - this.inputValue.length;
    this.inputIndex -= diff;
    this.cursor.x -= diff;

    return tags
      .map((val: string) => underline(val))
      .join(separator) +
      dim(this.getSuggestion());
  }

  protected getTags(value: string = this.inputValue): Array<string> {
    return value.trim().split(this.regexp());
  }

  /** Create list regex.*/
  protected regexp(): RegExp {
    return new RegExp(
      this.settings.separator === " " ? ` +` : ` *${this.settings.separator} *`,
    );
  }

  protected success(value: string[]): string | undefined {
    this.saveSuggestions(...value);
    return super.success(value);
  }

  /** Get input value. */
  protected getValue(): string {
    // Remove trailing comma and spaces.
    const input = this.inputValue.replace(/,+\s*$/, "");

    if (!this.settings.files) {
      return input;
    }

    return this.getTags(input)
      .map(normalize)
      .join(this.settings.separator + " ");
  }

  protected getCurrentInputValue(): string {
    return this.getTags().pop() ?? "";
  }

  /** Add char. */
  protected addChar(char: string): void {
    switch (char) {
      case this.settings.separator:
        if (
          this.inputValue.length &&
          this.inputValue.trim().slice(-1) !== this.settings.separator
        ) {
          super.addChar(char);
        }
        this.suggestionsIndex = -1;
        this.suggestionsOffset = 0;
        break;
      default:
        super.addChar(char);
    }
  }

  /** Delete char left. */
  protected deleteChar(): void {
    if (this.inputValue[this.inputIndex - 1] === " ") {
      super.deleteChar();
    }
    super.deleteChar();
  }

  protected async complete(): Promise<string> {
    const tags = this.getTags().slice(0, -1);
    tags.push(await super.complete());
    return tags.join(this.settings.separator + " ");
  }

  /**
   * Validate input value.
   * @param value User input value.
   * @return True on success, false or error message on error.
   */
  protected validate(value: string): boolean | string {
    if (typeof value !== "string") {
      return false;
    }

    const values = this.transform(value);

    for (const val of values) {
      if (val.length < this.settings.minLength) {
        return `Value must be longer than ${this.settings.minLength} but has a length of ${val.length}.`;
      }
      if (val.length > this.settings.maxLength) {
        return `Value can't be longer than ${this.settings.maxLength} but has a length of ${val.length}.`;
      }
    }

    if (values.length < this.settings.minTags) {
      return `The minimum number of tags is ${this.settings.minTags} but got ${values.length}.`;
    }
    if (values.length > this.settings.maxTags) {
      return `The maximum number of tags is ${this.settings.maxTags} but got ${values.length}.`;
    }

    return true;
  }

  /**
   * Map input value to output value.
   * @param value Input value.
   * @return Output value.
   */
  protected transform(value: string): string[] {
    return this.getTags(value).filter((val) => val !== "");
  }

  /**
   * Format output value.
   * @param value Output value.
   */
  protected format(value: string[]): string {
    return value.join(`, `);
  }
}
