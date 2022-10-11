/*
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */
import { unitTest } from "../test.ts";
import { assertEquals, assertThrows } from "testing/asserts.ts";
import {
  getMessageFromAPIError,
  isNotFound,
  isUnauthorized,
  tokenFilterOut,
  transformAtlassianDomain,
  validateEmail,
  validateServer,
  validateToken,
} from "../../src/publish/confluence/confluence.ts";
import { ApiError } from "../../src/publish/types.ts";
import { AccountTokenType } from "../../src/publish/provider.ts";

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
  const result = transformAtlassianDomain("https://something");
  const expected = "https://something/";
  assertEquals(expected, result);
});

unitTest("transformAtlassianDomain_partialPrefix", async () => {
  const result = transformAtlassianDomain("htt://something");
  const expected = "https://htt://something.atlassian.net/";
  assertEquals(expected, result);
});

unitTest("transformAtlassianDomain_addPrefixAndTrailing", async () => {
  const result = transformAtlassianDomain("something");
  const expected = "https://something.atlassian.net/";
  assertEquals(expected, result);
});

unitTest("validateServer_empty", async () => {
  const toCall = () => validateServer("");
  assertThrows(toCall, "");
});

unitTest("validateServer_valid", async () => {
  const result = validateServer("fake-domain");
  const expected = true;
  assertEquals(expected, result);
});

unitTest("validateServer_invalid", async () => {
  const result = validateServer("_!@ ... #");
  const expected = "Not a valid URL";
  assertEquals(expected, result);
});

unitTest("validateName_empty", async () => {
  const toCall = () => validateEmail("");
  assertThrows(toCall, "");
});

unitTest("validateName_valid", async () => {
  const result = validateEmail("al.manning@rstudio.com");
  const expected = true;
  assertEquals(expected, result);
});

unitTest("validateName_invalid_JustName", async () => {
  const result = validateEmail("al.manning");
  const expected = "Invalid email address";
  assertEquals(expected, result);
});

unitTest("validateToken_empty", async () => {
  const toCall = () => validateToken("");
  assertThrows(toCall, "");
});

unitTest("getMessageFromAPIError_null", async () => {
  const result = getMessageFromAPIError(null);
  const expected = "Unknown error";
  assertEquals(expected, result);
});

unitTest("getMessageFromAPIError_emptyString", async () => {
  const result = getMessageFromAPIError("");
  const expected = "Unknown error";
  assertEquals(expected, result);
});

unitTest("getMessageFromAPIError_APIError", async () => {
  const result = getMessageFromAPIError(new ApiError(123, "status-text"));
  const expected = "123 - status-text";
  assertEquals(expected, result);
});

unitTest("tokenFilterOut_sameToken", async () => {
  const fakeToken = {
    type: AccountTokenType.Environment,
    name: "fake-name",
    server: "fake-server",
    token: "fake-token",
  };

  const result = tokenFilterOut(fakeToken, fakeToken);
  const expected = false;
  assertEquals(expected, result);
});

unitTest("tokenFilterOut_differentToken", async () => {
  const fakeToken = {
    type: AccountTokenType.Environment,
    name: "fake-name",
    server: "fake-server",
    token: "fake-token",
  };

  const fakeToken2 = {
    type: AccountTokenType.Environment,
    name: "fake-name2",
    server: "fake-server2",
    token: "fake-token2",
  };

  const result = tokenFilterOut(fakeToken, fakeToken2);
  const expected = true;
  assertEquals(expected, result);
});

unitTest("isUnauthorized_EmptyError", async () => {
  const result = isUnauthorized(new Error());
  const expected = false;
  assertEquals(expected, result);
});

unitTest("isUnauthorized_401", async () => {
  const result = isUnauthorized(new ApiError(401, "fake-status"));
  const expected = true;
  assertEquals(expected, result);
});

unitTest("isUnauthorized_403", async () => {
  const result = isUnauthorized(new ApiError(403, "fake-status"));
  const expected = true;
  assertEquals(expected, result);
});

unitTest("isNotFound_Empty", async () => {
  const result = isNotFound(new Error());
  const expected = false;
  assertEquals(expected, result);
});

unitTest("isNotFound_404", async () => {
  const result = isNotFound(new ApiError(404, "fake-status"));
  const expected = true;
  assertEquals(expected, result);
});
