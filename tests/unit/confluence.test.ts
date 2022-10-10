/*
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */
import { unitTest } from "../test.ts";
import { assertEquals, assertThrows } from "testing/asserts.ts";
import {
  transformAtlassianDomain,
  validateEmail,
  validateServer,
  validateToken
} from "../../src/publish/confluence/confluence.ts";

unitTest("transformAtlassianDomain_basic", async () => {
  const result = transformAtlassianDomain("fake-domain");
  const expected = "https://fake-domain.atlassian.net/";
  assertEquals(expected, result);
});

unitTest("transformAtlassianDomain_EmptyString", async () => {
  const result = transformAtlassianDomain("");
  const expected = "https://.atlassian.net/";
  assertEquals(expected, result);
});

unitTest("transformAtlassianDomain_addTrailing", async () => {
  const result = transformAtlassianDomain('https://something');
  const expected = "https://something/";
  assertEquals(expected, result);
});

unitTest("transformAtlassianDomain_partialPrefix", async () => {
  const result = transformAtlassianDomain('htt://something');
  const expected = "https://htt://something.atlassian.net/";
  assertEquals(expected, result);
});

unitTest("transformAtlassianDomain_addPrefixAndTrailing", async () => {
  const result = transformAtlassianDomain('something');
  const expected = "https://something.atlassian.net/";
  assertEquals(expected, result);
});

unitTest("validateServer_empty", async () => {
  const toCall = () => validateServer('');
  assertThrows(toCall, '');
});

unitTest("validateServer_valid", async () => {
  const result = validateServer('fake-domain');
  const expected = true;
  assertEquals(expected, result);
});

unitTest("validateServer_invalid", async () => {
  const result = validateServer('_!@ ... #');
  const expected = 'Not a valid URL';
  assertEquals(expected, result);
});

unitTest("validateName_empty", async () => {
  const toCall = () => validateEmail('');
  assertThrows(toCall, '');
});

unitTest("validateName_valid", async () => {
  const result = validateEmail('al.manning@rstudio.com');
  const expected = true;
  assertEquals(expected, result);
});

unitTest("validateName_invalid_JustName", async () => {
  const result = validateEmail('al.manning');
  const expected = 'Invalid email address';
  assertEquals(expected, result);
});

unitTest("validateToken_empty", async () => {
  const toCall = () => validateToken('');
  assertThrows(toCall, '');
});
