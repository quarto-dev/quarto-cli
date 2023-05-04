import { unitTest } from "../test.ts";
import {buildGiscusThemeKeys, GiscusThemeToggleRecord} from "../../src/core/giscus.ts";
import { assertEquals } from "testing/asserts.ts";


const l = (label:string):string => `"Giscus buildThemeKeys: ${label}`;

unitTest(l('when empty'), async () => {
    const expected:GiscusThemeToggleRecord = {baseTheme: 'light', altTheme: 'dark'};
    const actual:GiscusThemeToggleRecord = buildGiscusThemeKeys(false, '');
    assertEquals(expected, actual);
});

unitTest(l('when empty, with dark default'), async () => {
    const expected:GiscusThemeToggleRecord = {baseTheme: 'dark', altTheme: 'light'};
    const actual:GiscusThemeToggleRecord = buildGiscusThemeKeys(true, '');
    assertEquals(expected, actual);
});

unitTest(l('when string theme'), async () => {
    const expected:GiscusThemeToggleRecord = {baseTheme: 'fake-theme-key', altTheme: 'fake-theme-key'};
    const actual:GiscusThemeToggleRecord = buildGiscusThemeKeys(false, 'fake-theme-key');
    assertEquals(expected, actual);
})

unitTest(l('when record theme'), async () => {
    const expected:GiscusThemeToggleRecord = {baseTheme: 'fake-theme-key-light', altTheme: 'fake-theme-key-dark'};
    const actual:GiscusThemeToggleRecord = buildGiscusThemeKeys(false, {light: 'fake-theme-key-light', dark: 'fake-theme-key-dark'});
    assertEquals(expected, actual);
});

unitTest(l('when record theme, with dark default'), async () => {
    const expected:GiscusThemeToggleRecord = {baseTheme: 'fake-theme-key-light', altTheme: 'fake-theme-key-dark'};

    const actual:GiscusThemeToggleRecord = buildGiscusThemeKeys(true, {light: 'fake-theme-key-dark', dark: 'fake-theme-key-light'});
    assertEquals(expected, actual);
});

unitTest(l('when record theme, with only light specified'), async () => {
    const expected:GiscusThemeToggleRecord = {baseTheme: 'fake-theme-key-light', altTheme: 'dark'};

    const actual:GiscusThemeToggleRecord = buildGiscusThemeKeys(false, {light: 'fake-theme-key-light'});
    assertEquals(expected, actual);
});