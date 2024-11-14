export const formatBooleanOption = (optionName: string, value: boolean | undefined) =>
    value === undefined ? undefined : optionName;

export const formatStringOption = (optionName: string, value: string | boolean | number | undefined) =>
    value === undefined ? undefined : `${optionName}=${value}`;

export const formatArrayOption = (optionName: string, values: number[] | string[] | undefined) =>
    values === undefined ? undefined : values.map(value => formatStringOption(optionName, value)).join(' ');
