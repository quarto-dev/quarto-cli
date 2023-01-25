/*
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */
import { unitTest } from "../test.ts";
import { assertEquals, assertThrows } from "testing/asserts.ts";

import {
  buildContentCreate,
  buildFileToMetaTable,
  buildPublishRecordForContent,
  buildSpaceChanges,
  capitalizeFirstLetter,
  confluenceParentFromString,
  FILE_FINDER,
  filterFilesForUpdate,
  findAttachments,
  findPagesToDelete,
  getMessageFromAPIError,
  getNextVersion,
  getTitle,
  isNotFound,
  isUnauthorized,
  LINK_FINDER,
  mergeSitePages,
  tokenFilterOut,
  transformAtlassianDomain,
  updateImagePaths,
  updateLinks,
  validateEmail,
  validateServer,
  validateToken,
  wrapBodyForConfluence,
  writeTokenComparator,
} from "../../src/publish/confluence/confluence-helper.ts";
import { ApiError, PublishRecord } from "../../src/publish/types.ts";
import {
  AccountToken,
  AccountTokenType,
  InputMetadata,
} from "../../src/publish/provider.ts";
import {
  ConfluenceParent,
  ConfluenceSpaceChange,
  Content,
  ContentBody,
  ContentChangeType,
  ContentCreate,
  ContentStatusEnum,
  ContentSummary,
  ContentUpdate,
  ContentVersion,
  ExtractedLink,
  PAGE_TYPE,
  SiteFileMetadata,
  SitePage,
  Space,
} from "../../src/publish/confluence/api/types.ts";

const RUN_ALL_TESTS = true;
const FOCUS_TEST = false;

const xtest = (
  name: string,
  ver: () => Promise<unknown> // VoidFunction,
) => {};
const test = FOCUS_TEST ? xtest : unitTest;
const otest = unitTest;

const buildFakeContent = (): Content => {
  return {
    id: "fake-id",
    type: "fake-type",
    status: "current",
    title: "fake-title",
    space: {
      key: "fake-space-key",
      id: "fake-space-id",
      homepage: {
        id: "fake-space-id",
        title: "fake-space-title",
      },
    },
    version: {
      number: 1,
    },
    ancestors: null,
    descendants: null,
    body: {
      storage: {
        value: "fake-body",
        representation: "raw",
      },
    },
  };
};

const FAKE_PARENT: ConfluenceParent = {
  space: "QUARTOCONF",
  parent: "8781825",
};

const runGeneralTests = () => {
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

  unitTest("confluenceParentFromString_empty", async () => {
    const result = confluenceParentFromString("");
    const expected = {
      space: "",
      parent: "",
    };
    assertEquals(expected, result);
  });

  unitTest("confluenceParentFromString_valid", async () => {
    const url =
      "https://allenmanning.atlassian.net/wiki/spaces/QUARTOCONF/pages/8781825/Markdown+Basics1";
    const result = confluenceParentFromString(url);
    const expected: ConfluenceParent = {
      space: "QUARTOCONF",
      parent: "8781825",
    };
    assertEquals(expected, result);
  });

  unitTest("confluenceParentFromString_valid_noParent", async () => {
    const url = "https://allenmanning.atlassian.net/wiki/spaces/QUARTOCONF";
    const result = confluenceParentFromString(url);
    const expected: ConfluenceParent = {
      space: "QUARTOCONF",
      parent: undefined,
    };
    assertEquals(expected, result);
  });

  unitTest("confluenceParentFromString_invalid_noSpace", async () => {
    const url = "https://allenmanning.atlassian.net/QUARTOCONF";
    const result = confluenceParentFromString(url);
    const expected = {
      space: "",
      parent: "",
    };
    assertEquals(expected, result);
  });

  unitTest("wrapBodyForConfluence_empty", async () => {
    const value = "";
    const result = wrapBodyForConfluence(value);
    const expected = {
      storage: {
        value: "",
        representation: "storage",
      },
    };
    assertEquals(expected, result);
  });
};

const runPublishRecordTests = () => {
  const fakeServer = "https://allenmanning.atlassian.net";

  const checkForContent = (
    expectedURL: string,
    expectedId: string,
    server: string = fakeServer,
    content: Content = buildFakeContent()
  ) => {
    const result = buildPublishRecordForContent(server, content);
    const expectedPublishRecord: PublishRecord = {
      id: expectedId,
      url: expectedURL,
    };
    const url: URL = new URL(expectedURL);
    const expected: [PublishRecord, URL] = [expectedPublishRecord, url];

    assertEquals(expected[0], result[0]);
    assertEquals(expected[1], result[1]);
  };

  const checkThrows = (
    server: string = fakeServer,
    content: Content = buildFakeContent()
  ) => {
    assertThrows(() => buildPublishRecordForContent(server, content));
  };

  unitTest("buildPublishRecord_validWithChecker", async () => {
    const expectedURL =
      "https://allenmanning.atlassian.net/wiki/spaces/fake-space-key/pages/fake-id";
    const expectedId = "fake-id";

    checkForContent(expectedURL, expectedId);
  });

  unitTest("buildPublishRecord_noIdThrows", async () => {
    const fakeContent = buildFakeContent();
    fakeContent.id = null;
    checkThrows(fakeServer, fakeContent);
  });

  unitTest("buildPublishRecord_noSpaceThrows", async () => {
    const fakeContent = buildFakeContent();
    fakeContent.space = null;
    checkThrows(fakeServer, fakeContent);
  });

  unitTest("buildPublishRecord_emptyServerThrows", async () => {
    checkThrows("");
  });

  const checkForParent = (
    expectedURL: string,
    expectedId: string,
    server: string = fakeServer,
    content: Content = buildFakeContent()
  ) => {
    const result = buildPublishRecordForContent(server, content);
    const expectedPublishRecord: PublishRecord = {
      id: expectedId,
      url: expectedURL,
    };
    const url: URL = new URL(expectedURL);
    const expected: [PublishRecord, URL] = [expectedPublishRecord, url];

    assertEquals(expected[0], result[0]);
    assertEquals(expected[1], result[1]);
  };
};

const runGetNextVersionTests = () => {
  const suiteLabel = (label: string) => `GetNextVersionTests_${label}`;

  const check = (previousPage: Content, expected: ContentVersion) => {
    const actual = getNextVersion(previousPage);
    assertEquals(expected, actual);
  };

  unitTest(suiteLabel("1to2"), async () => {
    const previousPage: Content = buildFakeContent();
    const expected: ContentVersion = { number: 2 };
    check(previousPage, expected);
  });

  unitTest(suiteLabel("Nullto1"), async () => {
    const previousPage: Content = buildFakeContent();
    previousPage.version = null;
    const expected: ContentVersion = { number: 1 };
    check(previousPage, expected);
  });
};

const runWriteTokenComparator = () => {
  const suiteLabel = (label: string) => `WriteTokenComparator_${label}`;

  const check = (
    aToken: AccountToken,
    bToken: AccountToken,
    expected: boolean
  ) => {
    const actual = writeTokenComparator(aToken, bToken);
    assertEquals(expected, actual);
  };

  unitTest(suiteLabel("allNotEqual"), async () => {
    check(
      {
        server: "a-server",
        name: "a-name",
        type: AccountTokenType.Authorized,
        token: "fake-token-a",
      },
      {
        server: "b-server",
        name: "b-name",
        type: AccountTokenType.Environment,
        token: "fake-token-b",
      },
      false
    );
  });

  unitTest(suiteLabel("nameNotEqual"), async () => {
    check(
      {
        server: "a-server",
        name: "different-a-name",
        type: AccountTokenType.Authorized,
        token: "fake-token-a",
      },
      {
        server: "a-server",
        name: "a-name",
        type: AccountTokenType.Authorized,
        token: "fake-token-a",
      },
      false
    );
  });

  unitTest(suiteLabel("serverNotEqual"), async () => {
    check(
      {
        server: "different-a-server",
        name: "a-name",
        type: AccountTokenType.Authorized,
        token: "fake-token-a",
      },
      {
        server: "a-server",
        name: "a-name",
        type: AccountTokenType.Authorized,
        token: "fake-token-a",
      },
      false
    );
  });

  unitTest(suiteLabel("typeNotEqual"), async () => {
    check(
      {
        server: "a-server",
        name: "a-name",
        type: AccountTokenType.Environment,
        token: "fake-token-a",
      },
      {
        server: "a-server",
        name: "a-name",
        type: AccountTokenType.Authorized,
        token: "fake-token-a",
      },
      true
    );
  });

  unitTest(suiteLabel("tokenNotEqual"), async () => {
    check(
      {
        server: "a-server",
        name: "a-name",
        type: AccountTokenType.Authorized,
        token: "differet-fake-token-a",
      },
      {
        server: "a-server",
        name: "a-name",
        type: AccountTokenType.Authorized,
        token: "fake-token-a",
      },
      true
    );
  });
};

const runFilterFilesForUpdate = () => {
  const suiteLabel = (label: string) => `FilterFilesForUpdate_${label}`;

  const check = (allFiles: string[], expected: string[]) => {
    const actual = filterFilesForUpdate(allFiles);
    assertEquals(expected, actual);
  };

  unitTest(suiteLabel("noFiles"), async () => {
    check([], []);
  });

  unitTest(suiteLabel("flatMixed"), async () => {
    const fakeFileList = [
      "knowledge-base.html",
      "team.xml",
      "agreements.html",
      "mission.xml",
      "ci-log.html",
    ];
    const expected = ["team.xml", "mission.xml"];

    check(fakeFileList, expected);
  });

  unitTest(suiteLabel("nestedMixed"), async () => {
    const fakeFileList = [
      "parent/child.xml",
      "knowledge-base.html",
      "team.xml",
      "agreements.html",
      "mission.xml",
      "ci-log.html",
    ];
    const expected = ["parent/child.xml", "team.xml", "mission.xml"];

    check(fakeFileList, expected);
  });
};

const runBuildContentCreate = () => {
  const suiteLabel = (label: string) => `BuildContentCreate_${label}`;

  unitTest(suiteLabel("minParams"), async () => {
    const expected: ContentCreate = {
      contentChangeType: ContentChangeType.create,
      fileName: "fake-file-name",
      title: "fake-title",
      type: PAGE_TYPE,
      space: {
        key: "fake-space-key",
        id: "fake-space-id",
        homepage: buildFakeContent(),
      },
      status: ContentStatusEnum.current,
      ancestors: null,
      body: {
        storage: {
          value: "fake-value",
          representation: "storage",
        },
      },
    };
    const fakeSpace: Space = {
      key: "fake-space-key",
      id: "fake-space-id",
      homepage: buildFakeContent(),
    };
    const fakeBody: ContentBody = {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    };
    const actual: ContentCreate = buildContentCreate(
      "fake-title",
      fakeSpace,
      fakeBody,
      "fake-file-name"
    );

    assertEquals(expected, actual);
  });

  unitTest(suiteLabel("allParams"), async () => {
    const expected: ContentCreate = {
      contentChangeType: ContentChangeType.create,
      fileName: "fake-filename",
      title: "fake-title",
      type: "fake-type",
      space: {
        key: "fake-space-key",
        id: "fake-space-id",
        homepage: buildFakeContent(),
      },
      status: ContentStatusEnum.deleted,
      ancestors: [
        {
          id: "fake-parent",
        },
      ],
      body: {
        storage: {
          value: "fake-value",
          representation: "storage",
        },
      },
    };

    const fakeSpace: Space = {
      key: "fake-space-key",
      id: "fake-space-id",
      homepage: buildFakeContent(),
    };
    const fakeBody: ContentBody = {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    };
    const actual: ContentCreate = buildContentCreate(
      "fake-title",
      fakeSpace,
      fakeBody,
      "fake-filename",
      "fake-parent",
      ContentStatusEnum.deleted,
      "fake-id",
      "fake-type"
    );

    assertEquals(expected, actual);
  });
};

const runGetTitle = () => {
  const suiteLabel = (label: string) => `GetTitle_${label}`;
  const fakeInputMetadata: Record<string, InputMetadata> = {
    "fake-file.qmd": {
      title: "fake-title1",
      author: "fake-author",
      date: "fake-date",
    },
    "fake-file2.qmd": {
      title: "fake-title2",
      author: "fake-author2",
      date: "fake-date2",
    },
  };

  unitTest(suiteLabel("valid"), async () => {
    const fileName = "fake-file.xml";
    const expected = "fake-title1";
    const result = getTitle(fileName, fakeInputMetadata);
    assertEquals(expected, result);
  });

  unitTest(suiteLabel("valid2"), async () => {
    const fileName = "fake-file2.xml";
    const expected = "fake-title2";
    const result = getTitle(fileName, fakeInputMetadata);
    assertEquals(expected, result);
  });

  unitTest(suiteLabel("no-match"), async () => {
    const fileName = "fake-file3.xml";
    const expected = "Fake-file3";
    const result = getTitle(fileName, fakeInputMetadata);
    assertEquals(expected, result);
  });

  unitTest(suiteLabel("no-match-empty"), async () => {
    const fileName = "";
    const expected = "";
    const result = getTitle(fileName, fakeInputMetadata);
    assertEquals(expected, result);
  });
};

const runMergeSitePages = () => {
  const suiteLabel = (label: string) => `MergeSitePages_${label}`;

  unitTest(suiteLabel("basic_valid"), async () => {
    const shallowPages: ContentSummary[] = [
      {
        id: "123",
        title: "fake-title",
        ancestors: [{ id: "fake-ancestor" }],
      },
    ];
    const contentProperties = [
      [
        {
          key: "fake-key",
          value: "fake-value",
        },
      ],
    ];
    const expected: SitePage[] = [
      {
        id: "123",
        title: "fake-title",
        ancestors: [{ id: "fake-ancestor" }],
        metadata: {
          ["fake-key"]: "fake-value",
        },
      },
    ];
    const result = mergeSitePages(shallowPages, contentProperties);
    assertEquals(expected, result);
  });

  unitTest(suiteLabel("basic_valid_2props"), async () => {
    const shallowPages: ContentSummary[] = [
      {
        id: "123",
        title: "fake-title",
        ancestors: [{ id: "fake-ancestor" }],
      },
    ];
    const contentProperties = [
      [
        {
          key: "fake-key",
          value: "fake-value",
        },
        {
          key: "fake-key2",
          value: "fake-value2",
        },
      ],
    ];
    const expected: SitePage[] = [
      {
        id: "123",
        title: "fake-title",
        metadata: {
          ["fake-key"]: "fake-value",
          ["fake-key2"]: "fake-value2",
        },
        ancestors: [{ id: "fake-ancestor" }],
      },
    ];
    const result = mergeSitePages(shallowPages, contentProperties);
    assertEquals(expected, result);
  });

  unitTest(suiteLabel("multiple_valid"), async () => {
    const shallowPages: ContentSummary[] = [
      {
        id: "123",
        title: "fake-title",
        ancestors: [{ id: "fake-ancestor" }],
      },
      {
        id: "456",
        title: "fake-title2",
        ancestors: [{ id: "fake-ancestor-2" }],
      },
    ];
    const contentProperties = [
      [
        {
          key: "fake-key",
          value: "fake-value",
        },
      ],
      [
        {
          key: "fake-key2",
          value: "fake-value2",
        },
        {
          key: "fake-key3",
          value: "fake-value3",
        },
      ],
    ];
    const expected: SitePage[] = [
      {
        id: "123",
        title: "fake-title",
        metadata: {
          ["fake-key"]: "fake-value",
        },
        ancestors: [{ id: "fake-ancestor" }],
      },
      {
        id: "456",
        title: "fake-title2",
        metadata: {
          ["fake-key2"]: "fake-value2",
          ["fake-key3"]: "fake-value3",
        },
        ancestors: [{ id: "fake-ancestor-2" }],
      },
    ];
    const result = mergeSitePages(shallowPages, contentProperties);
    assertEquals(expected, result);
  });

  unitTest(suiteLabel("not_matching"), async () => {
    const shallowPages: ContentSummary[] = [
      {
        id: "123",
        title: "fake-title",
        ancestors: [{ id: "fake-ancestor" }],
      },
      {
        id: "456",
        title: "fake-title2",
        ancestors: [{ id: "fake-ancestor-2" }],
      },
    ];
    const contentProperties = [
      [
        {
          key: "fake-key",
          value: "fake-value",
        },
      ],
    ];
    const expected: SitePage[] = [
      {
        id: "123",
        title: "fake-title",
        metadata: {
          ["fake-key"]: "fake-value",
        },
        ancestors: [{ id: "fake-ancestor" }],
      },
      {
        id: "456",
        title: "fake-title2",
        metadata: {},
        ancestors: [{ id: "fake-ancestor-2" }],
      },
    ];
    const result = mergeSitePages(shallowPages, contentProperties);
    assertEquals(expected, result);
  });
};

const runBuildSpaceChanges = () => {
  const suiteLabel = (label: string) => `BuildSpaceChanges_${label}`;

  const fakeSpace: Space = {
    key: "fake-space-key",
    id: "fake-space-id",
    homepage: buildFakeContent(),
  };

  const fakeFile: SiteFileMetadata = {
    fileName: "fake-file-name",
    title: "fake-title",
    originalTitle: "fake-title-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeFileMatchingPage: SiteFileMetadata = {
    fileName: "fake-file-name",
    title: "fake-title",
    originalTitle: "fake-title-original",
    matchingPages: [
      {
        id: "123456",
        title: "fake-title-original",
      },
    ],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeFile2: SiteFileMetadata = {
    fileName: "fake-file-name2",
    title: "fake-title2",
    originalTitle: "fake-title2-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value2",
        representation: "storage",
      },
    },
  };

  test(suiteLabel("no_files"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [];
    const expected: ConfluenceSpaceChange[] = [];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("one_file"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeFile];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-file-name",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("two_files"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeFile, fakeFile2];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-file-name",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value2",
          },
        },
        fileName: "fake-file-name2",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title2",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("one_file_update"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeFile];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.update,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-file-name",
        status: "current",
        title: "fake-title",
        type: "page",
        id: "123456",
        version: null,
      },
    ];
    const existingSite: SitePage[] = [
      {
        id: "123456",
        title: "fake-title",
        metadata: { fileName: "fake-file-name" },
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("one_file_update_matching"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeFileMatchingPage];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.update,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-file-name",
        status: "current",
        title: "fake-title-original",
        type: "page",
        id: "123456",
        version: null,
      },
    ];
    const existingSite: SitePage[] = [
      {
        id: "123456",
        title: "fake-title",
        metadata: { fileName: "fake-file-name" },
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("findPagesToDelete"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeFile];
    const existingSite: SitePage[] = [
      {
        id: "fake-file-id",
        title: "fake-title",
        metadata: { fileName: "fake-file-name" },
        ancestors: [],
      },
      {
        id: "delete-me-file-id",
        title: "delete-me-title",
        metadata: { fileName: "delete-me-file-name" },
        ancestors: [],
      },
    ];
    const expected = [
      {
        id: "delete-me-file-id",
        title: "delete-me-title",
        metadata: { fileName: "delete-me-file-name" },
        ancestors: [],
      },
    ];
    const actual = findPagesToDelete(fileMetadataList, existingSite);
    assertEquals(expected, actual);
  });

  test(suiteLabel("one_file_delete"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeFile];
    const existingSite: SitePage[] = [
      {
        id: "fake-file-id",
        title: "fake-title",
        metadata: { fileName: "fake-file-name" },
      },
      {
        id: "delete-me-file-id",
        title: "delete-me-title",
        metadata: { fileName: "delete-me-file-name" },
      },
    ];
    const expected: ConfluenceSpaceChange[] = [
      {
        id: "delete-me-file-id",
        contentChangeType: ContentChangeType.delete,
      },
      {
        contentChangeType: ContentChangeType.update,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-file-name",
        status: "current",
        title: "fake-title",
        type: "page",
        id: "fake-file-id",
        version: null,
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );
    assertEquals(expected, actual);
  });
};

const runSpaceCreatesWithNesting = () => {
  const suiteLabel = (label: string) => `SpaceCreatesWithNesting_${label}`;

  const fakeSpace: Space = {
    key: "fake-space-key",
    id: "fake-space-id",
    homepage: buildFakeContent(),
  };

  const fakeFile: SiteFileMetadata = {
    fileName: "fake-file-name",
    title: "fake-title",
    originalTitle: "fake-title-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeNestedFile: SiteFileMetadata = {
    fileName: "fake-parent/fake-file-name",
    title: "fake-title",
    originalTitle: "fake-title-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeNestedFileWin: SiteFileMetadata = {
    fileName: "fake-parent\\fake-file-name",
    title: "fake-title",
    originalTitle: "fake-title-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeNestedFile2: SiteFileMetadata = {
    fileName: "fake-parent/fake-file-name2",
    title: "fake-title2",
    originalTitle: "fake-title2-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeNestedFile2Win: SiteFileMetadata = {
    fileName: "fake-parent\\fake-file-name2",
    title: "fake-title2",
    originalTitle: "fake-title2-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeNestedFile3: SiteFileMetadata = {
    fileName: "fake-parent2/fake-file-name3",
    title: "fake-title3",
    originalTitle: "fake-title3-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeNestedFile3Win: SiteFileMetadata = {
    fileName: "fake-parent2\\fake-file-name3",
    title: "fake-title3",
    originalTitle: "fake-title3-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeMultiNestedFile: SiteFileMetadata = {
    fileName:
      "fake-great-grand-parent/fake-grand-parent/fake-parent/fake-file-name",
    title: "fake-title",
    originalTitle: "fake-title-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeMultiNestedFileWin: SiteFileMetadata = {
    fileName:
      "fake-great-grand-parent\\fake-grand-parent\\fake-parent\\fake-file-name",
    title: "fake-title",
    originalTitle: "fake-title-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  test(suiteLabel("one_nested_file"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeNestedFile];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("one_nested_file_win"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeNestedFileWin];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("one_nested_file_add_back_empty_parent"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeNestedFile];
    const existingSite: SitePage[] = [
      {
        id: "fake-parent-id",
        title: "Fake-parent",
        metadata: { fileName: "fake-parent" },
      },
    ];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent-id",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("one_multi_nested_file"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeMultiNestedFile];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-great-grand-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-great-grand-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-great-grand-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-great-grand-parent/fake-grand-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-grand-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-great-grand-parent/fake-grand-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-great-grand-parent/fake-grand-parent/fake-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-great-grand-parent/fake-grand-parent/fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName:
          "fake-great-grand-parent/fake-grand-parent/fake-parent/fake-file-name",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );

    assertEquals(expected, actual);
  });

  test(suiteLabel("one_multi_nested_file_win"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeMultiNestedFileWin];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-great-grand-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-great-grand-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-great-grand-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-great-grand-parent/fake-grand-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-grand-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-great-grand-parent/fake-grand-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-great-grand-parent/fake-grand-parent/fake-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-great-grand-parent/fake-grand-parent/fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName:
          "fake-great-grand-parent/fake-grand-parent/fake-parent/fake-file-name",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );

    assertEquals(expected, actual);
  });

  test(suiteLabel("two_nested_files_same_parent"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [
      fakeNestedFile,
      fakeNestedFile2,
    ];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name2",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title2",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("two_nested_files_different_parent"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [
      fakeNestedFile,
      fakeNestedFile3,
    ];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent2",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent2",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent2",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent2/fake-file-name3",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title3",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("two_nested_files_different_parent_win"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [
      fakeNestedFileWin,
      fakeNestedFile3Win,
    ];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent2",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent2",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent2",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent2/fake-file-name3",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title3",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("three_nested_files_same_different_parent"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [
      fakeNestedFile,
      fakeNestedFile2,
      fakeNestedFile3,
    ];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name2",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title2",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent2",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent2",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent2",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent2/fake-file-name3",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title3",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("three_nested_files_same_different_parent_win"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [
      fakeNestedFileWin,
      fakeNestedFile2Win,
      fakeNestedFile3Win,
    ];
    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name2",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title2",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent2",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent2",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent2",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent2/fake-file-name3",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title3",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );
    assertEquals(expected, actual);
  });
};

const runSpaceUpdatesWithNesting = () => {
  const suiteLabel = (label: string) => `SpaceUpdatesWithNesting_${label}`;

  const fakeSpace: Space = {
    key: "fake-space-key",
    id: "fake-space-id",
    homepage: buildFakeContent(),
  };

  const fakeNestedFile: SiteFileMetadata = {
    fileName: "fake-parent/fake-file-name.xml",
    title: "fake-title",
    originalTitle: "fake-title-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeNestedFile2: SiteFileMetadata = {
    fileName: "fake-parent/fake-file-name2.xml",
    title: "fake-title2",
    originalTitle: "fake-title2-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeNestedFile3: SiteFileMetadata = {
    fileName: "fake-parent2/fake-file-name3.xml",
    title: "fake-title3",
    originalTitle: "fake-title3-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeMultiNestedFile: SiteFileMetadata = {
    fileName:
      "fake-great-grand-parent/fake-grand-parent/fake-parent/fake-file-name.xml",
    title: "fake-title",
    originalTitle: "fake-title-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeMultiNestedFileWin: SiteFileMetadata = {
    fileName:
      "fake-great-grand-parent\\fake-grand-parent\\fake-parent\\fake-file-name.xml",
    title: "fake-title",
    originalTitle: "fake-title-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  test(suiteLabel("one_nested_file_update"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeNestedFile];

    const existingSite = [
      {
        id: "123456",
        title: "fake-title",
        metadata: { fileName: "fake-parent/fake-file-name.xml" },
        ancestors: [{ id: "fake-parent-id" }, { id: "fake-grand-parent-id" }],
      },
      {
        title: "Fake Parent",
        id: "fake-parent-id",
        metadata: { editor: "v2", fileName: "fake-parent" },
        ancestors: [{ id: "fake-grand-parent-id" }],
      },
    ];

    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.update,
        ancestors: [
          {
            id: "fake-parent-id",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name.xml",
        status: "current",
        title: "fake-title",
        type: "page",
        id: "123456",
        version: null,
      },
    ];

    assertEquals(findPagesToDelete(fileMetadataList, existingSite), []);

    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );

    assertEquals(expected, actual);
  });

  test(suiteLabel("one_multi-nested_file_update"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeMultiNestedFile];

    const existingSite = [
      {
        id: "123456",
        title: "fake-title",
        metadata: {
          fileName:
            "fake-great-grand-parent/fake-grand-parent/fake-parent/fake-file-name.xml",
        },
        ancestors: [
          { id: "fake-parent-id" },
          { id: "fake-grand-parent-id" },
          { id: "fake-great-grand-parent-id" },
        ],
      },
      {
        title: "Fake Parent",
        id: "fake-parent-id",
        metadata: {
          editor: "v2",
          fileName: "fake-great-grand-parent/fake-grand-parent/fake-parent",
        },
        ancestors: [
          { id: "fake-grand-parent-id" },
          { id: "fake-great-grand-parent-id" },
        ],
      },
      {
        title: "Fake Grand Parent",
        id: "fake-grand-parent-id",
        metadata: {
          editor: "v2",
          fileName: "fake-great-grand-parent/fake-grand-parent",
        },
        ancestors: [{ id: "fake-great-grand-parent-id" }],
      },
      {
        title: "Fake Great Grand Parent",
        id: "fake-great-grand-parent-id",
        metadata: { editor: "v2", fileName: "fake-great-grand-parent" },
        ancestors: [{ id: "fake-great-grand-parent-id" }],
      },
    ];

    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.update,
        ancestors: [
          {
            id: "fake-parent-id",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName:
          "fake-great-grand-parent/fake-grand-parent/fake-parent/fake-file-name.xml",
        status: "current",
        title: "fake-title",
        type: "page",
        id: "123456",
        version: null,
      },
    ];

    const pagesToDelete = findPagesToDelete(fileMetadataList, existingSite);

    assertEquals(pagesToDelete, []);

    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );

    assertEquals(expected, actual);
  });

  test(suiteLabel("one_multi-nested_file_update_win"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeMultiNestedFileWin];

    const existingSite = [
      {
        id: "123456",
        title: "fake-title",
        metadata: {
          fileName:
            "fake-great-grand-parent/fake-grand-parent/fake-parent/fake-file-name.xml",
        },
        ancestors: [
          { id: "fake-parent-id" },
          { id: "fake-grand-parent-id" },
          { id: "fake-great-grand-parent-id" },
        ],
      },
      {
        title: "Fake Parent",
        id: "fake-parent-id",
        metadata: {
          editor: "v2",
          fileName: "fake-great-grand-parent/fake-grand-parent/fake-parent",
        },
        ancestors: [
          { id: "fake-grand-parent-id" },
          { id: "fake-great-grand-parent-id" },
        ],
      },
      {
        title: "Fake Grand Parent",
        id: "fake-grand-parent-id",
        metadata: {
          editor: "v2",
          fileName: "fake-great-grand-parent/fake-grand-parent",
        },
        ancestors: [{ id: "fake-great-grand-parent-id" }],
      },
      {
        title: "Fake Great Grand Parent",
        id: "fake-great-grand-parent-id",
        metadata: { editor: "v2", fileName: "fake-great-grand-parent" },
        ancestors: [{ id: "fake-great-grand-parent-id" }],
      },
    ];

    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.update,
        ancestors: [
          {
            id: "fake-parent-id",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName:
          "fake-great-grand-parent/fake-grand-parent/fake-parent/fake-file-name.xml",
        status: "current",
        title: "fake-title",
        type: "page",
        id: "123456",
        version: null,
      },
    ];

    const pagesToDelete = findPagesToDelete(fileMetadataList, existingSite);

    assertEquals(pagesToDelete, []);

    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );

    assertEquals(expected, actual);
  });

  test(suiteLabel("two_nested_files_same_parent"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [
      fakeNestedFile,
      fakeNestedFile2,
    ];
    const existingSite = [
      {
        id: "fake-title-id",
        title: "fake-title",
        metadata: { fileName: "fake-parent/fake-file-name.xml" },
        ancestors: [{ id: "fake-parent-id" }, { id: "fake-grand-parent-id" }],
      },
      {
        id: "fake-title2-id",
        title: "fake-title2",
        metadata: { fileName: "fake-parent/fake-file-name2.xml" },
        ancestors: [{ id: "fake-parent-id" }, { id: "fake-grand-parent-id" }],
      },
      {
        title: "Fake Parent",
        id: "fake-parent-id",
        metadata: { editor: "v2", fileName: "fake-parent" },
        ancestors: [{ id: "fake-grand-parent-id" }],
      },
    ];

    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.update,
        ancestors: [
          {
            id: "fake-parent-id",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name.xml",
        status: "current",
        title: "fake-title",
        type: "page",
        id: "fake-title-id",
        version: null,
      },
      {
        contentChangeType: ContentChangeType.update,
        ancestors: [
          {
            id: "fake-parent-id",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name2.xml",
        status: "current",
        title: "fake-title2",
        type: "page",
        id: "fake-title2-id",
        version: null,
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );
    assertEquals(expected, actual);
  });

  test(suiteLabel("three_nested_files_same_different_parent"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [
      fakeNestedFile,
      fakeNestedFile2,
      fakeNestedFile3,
    ];

    const existingSite = [
      {
        id: "fake-title-id",
        title: "fake-title",
        metadata: { fileName: "fake-parent/fake-file-name.xml" },
        ancestors: [{ id: "fake-parent-id" }, { id: "fake-grand-parent-id" }],
      },
      {
        id: "fake-title2-id",
        title: "fake-title2",
        metadata: { fileName: "fake-parent/fake-file-name2.xml" },
        ancestors: [{ id: "fake-parent-id" }, { id: "fake-grand-parent-id" }],
      },
      {
        id: "fake-title3-id",
        title: "fake-title3",
        metadata: { fileName: "fake-parent2/fake-file-name3.xml" },
        ancestors: [{ id: "fake-parent2-id" }, { id: "fake-grand-parent-id" }],
      },
      {
        title: "Fake Parent",
        id: "fake-parent-id",
        metadata: { editor: "v2", fileName: "fake-parent" },
        ancestors: [{ id: "fake-grand-parent-id" }],
      },
      {
        title: "Fake Parent2",
        id: "fake-parent2-id",
        metadata: { editor: "v2", fileName: "fake-parent2" },
        ancestors: [{ id: "fake-grand-parent-id" }],
      },
    ];

    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.update,
        ancestors: [
          {
            id: "fake-parent-id",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name.xml",
        status: "current",
        title: "fake-title",
        type: "page",
        id: "fake-title-id",
        version: null,
      },
      {
        contentChangeType: ContentChangeType.update,
        ancestors: [
          {
            id: "fake-parent-id",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name2.xml",
        status: "current",
        title: "fake-title2",
        type: "page",
        id: "fake-title2-id",
        version: null,
      },
      {
        contentChangeType: ContentChangeType.update,
        ancestors: [
          {
            id: "fake-parent2-id",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent2/fake-file-name3.xml",
        status: "current",
        title: "fake-title3",
        type: "page",
        id: "fake-title3-id",
        version: null,
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );
    assertEquals(expected, actual);
  });
};

const runSpaceUpdatesWithNestedMoves = () => {
  const suiteLabel = (label: string) => `SpaceUpdatesWithNesting_${label}`;

  const fakeSpace: Space = {
    key: "fake-space-key",
    id: "fake-space-id",
    homepage: buildFakeContent(),
  };

  const fakeNestedFile: SiteFileMetadata = {
    fileName: "fake-parent/fake-file-name.xml",
    title: "fake-title",
    originalTitle: "fake-title-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeRootFile: SiteFileMetadata = {
    fileName: "fake-file-name.xml",
    title: "fake-title",
    originalTitle: "fake-title-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeNestedFile2: SiteFileMetadata = {
    fileName: "fake-parent/fake-file-name2.xml",
    title: "fake-title2",
    originalTitle: "fake-title2-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeNestedFile3: SiteFileMetadata = {
    fileName: "fake-parent2/fake-file-name3.xml",
    title: "fake-title3",
    originalTitle: "fake-title3-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  const fakeMultiNestedFile: SiteFileMetadata = {
    fileName: "fake-parent/fake-inner-parent/fake-file-name.xml",
    title: "fake-multi-nested-title",
    originalTitle: "fake-multi-nested-title-original",
    matchingPages: [],
    contentBody: {
      storage: {
        value: "fake-value",
        representation: "storage",
      },
    },
  };

  unitTest(suiteLabel("move_from_root_to_nested_parent"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [fakeNestedFile];
    const existingSite = [
      {
        id: "fake-title-id",
        title: "fake-title",
        metadata: { fileName: "fake-file-name.xml" },
        ancestors: [{ id: "fake-grand-parent-id" }],
      },
    ];

    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.delete,
        id: "fake-title-id",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "8781825",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "Fake-parent",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name.xml",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );
    assertEquals(expected, actual);
  });

  unitTest(suiteLabel("add_file_existing_parent"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [
      fakeNestedFile,
      fakeNestedFile2,
    ];
    const existingSite = [
      {
        id: "fake-title-id",
        title: "fake-title",
        metadata: { fileName: "fake-parent/fake-file-name.xml" },
        ancestors: [{ id: "fake-grand-parent-id" }, { id: "fake-parent-id" }],
      },
      {
        title: "Fake Parent",
        id: "fake-parent-id",
        metadata: { editor: "v2", fileName: "fake-parent" },
        ancestors: [{ id: "fake-grand-parent-id" }],
      },
    ];

    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.update,
        id: "fake-title-id",
        version: null,
        title: "fake-title",
        type: "page",
        status: "current",
        ancestors: [{ id: "fake-parent-id" }],
        body: { storage: { value: "fake-value", representation: "storage" } },
        fileName: "fake-parent/fake-file-name.xml",
      },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent-id",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name2.xml",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title2",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );
    assertEquals(expected, actual);
  });

  unitTest(suiteLabel("from_root_to_existing_parent"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [
      fakeNestedFile,
      fakeNestedFile2,
    ];
    const existingSite = [
      {
        id: "fake-title-id",
        title: "fake-title",
        metadata: { fileName: "fake-file-name.xml" },
        ancestors: [{ id: "fake-grand-parent-id" }],
      },
      {
        id: "fake-title2-id",
        title: "fake-title",
        metadata: { fileName: "fake-parent/fake-file-name2.xml" },
        ancestors: [{ id: "fake-grand-parent-id" }, { id: "fake-parent-id" }],
      },
      {
        title: "Fake Parent",
        id: "fake-parent-id",
        metadata: { editor: "v2", fileName: "fake-parent" },
        ancestors: [{ id: "fake-grand-parent-id" }],
      },
    ];

    const expected: ConfluenceSpaceChange[] = [
      { contentChangeType: ContentChangeType.delete, id: "fake-title-id" },
      {
        contentChangeType: ContentChangeType.create,
        ancestors: [
          {
            id: "fake-parent-id",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-file-name.xml",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
      {
        contentChangeType: ContentChangeType.update,
        id: "fake-title2-id",
        version: null,
        title: "fake-title2",
        type: "page",
        status: "current",
        ancestors: [{ id: "fake-parent-id" }],
        body: { storage: { value: "fake-value", representation: "storage" } },
        fileName: "fake-parent/fake-file-name2.xml",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );
    assertEquals(expected, actual);
  });

  unitTest(suiteLabel("create_in_nested_parent"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [
      fakeNestedFile,
      fakeMultiNestedFile,
    ];
    const existingSite = [
      {
        id: "fake-title-id",
        title: "fake-title",
        metadata: { fileName: "fake-parent/fake-file-name.xml" },
        ancestors: [{ id: "fake-grand-parent-id" }, { id: "fake-parent-id" }],
      },
      {
        title: "Fake Parent",
        id: "fake-parent-id",
        metadata: { editor: "v2", fileName: "fake-parent" },
        ancestors: [{ id: "fake-grand-parent-id" }],
      },
    ];

    const expected: ConfluenceSpaceChange[] = [
      {
        contentChangeType: ContentChangeType.update,
        id: "fake-title-id",
        version: null,
        title: "fake-title",
        type: "page",
        status: "current",
        ancestors: [{ id: "fake-parent-id" }],
        body: { storage: { value: "fake-value", representation: "storage" } },
        fileName: "fake-parent/fake-file-name.xml",
      },
      {
        contentChangeType: ContentChangeType.create,
        title: "Fake-inner-parent",
        type: "page",
        ancestors: [
          {
            id: "fake-parent-id",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "",
          },
        },
        fileName: "fake-parent/fake-inner-parent",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
      },
      {
        contentChangeType: ContentChangeType.create,
        title: "fake-multi-nested-title",
        type: "page",
        ancestors: [
          {
            id: "fake-parent/fake-inner-parent",
          },
        ],
        body: {
          storage: {
            representation: "storage",
            value: "fake-value",
          },
        },
        fileName: "fake-parent/fake-inner-parent/fake-file-name.xml",
        space: {
          key: "fake-space-key",
          id: "fake-space-id",
          homepage: buildFakeContent(),
        },
        status: "current",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace,
      existingSite
    );
    assertEquals(expected, actual);
  });
};

const runBuildFileToMetaTable = () => {
  const suiteLabel = (label: string) => `BuildFileToMetaTable_${label}`;

  const fakeSite: SitePage[] = [
    {
      title: "Issue Triage",
      id: "19890180",
      metadata: {
        fileName: "triage.xml",
      },
    },
    {
      title: "Release Planning",
      id: "19890228",
      metadata: { fileName: "release-planning.xml" },
    },
    {
      title: "Team",
      id: "19857455",
      metadata: { fileName: "team.xml" },
    },
  ];

  const fakeSite_ONE: SitePage[] = [
    {
      title: "Issue Triage",
      id: "19890180",
      metadata: {
        fileName: "triage.xml",
      },
    },
  ];

  const check = (expected: Record<string, SitePage>, site: SitePage[]) => {
    assertEquals(expected, buildFileToMetaTable(site));
  };

  unitTest(suiteLabel("no_files"), async () => {
    const expected = {};
    const site: SitePage[] = [];
    check(expected, site);
  });

  unitTest(suiteLabel("one_file"), async () => {
    const expected = {
      ["triage.qmd"]: {
        title: "Issue Triage",
        id: "19890180",
        metadata: {
          fileName: "triage.xml",
        },
      },
    };
    check(expected, fakeSite_ONE);
  });

  unitTest(suiteLabel("multiple"), async () => {
    const expected = {
      ["release-planning.qmd"]: {
        title: "Release Planning",
        id: "19890228",
        metadata: { fileName: "release-planning.xml" },
      },
      ["team.qmd"]: {
        title: "Team",
        id: "19857455",
        metadata: { fileName: "team.xml" },
      },
      ["triage.qmd"]: {
        title: "Issue Triage",
        id: "19890180",
        metadata: {
          fileName: "triage.xml",
        },
      },
    };
    check(expected, fakeSite);
  });
};

const runExtractLinks = () => {
  const suiteLabel = (label: string) => `ExtractLinks_${label}`;

  const extractLinks = (value: string): ExtractedLink[] => {
    const links: string[] = value.match(LINK_FINDER) ?? [];
    const extractedLinks: ExtractedLink[] = links.map(
      (link: string): ExtractedLink => {
        const fileMatches = link.match(FILE_FINDER);
        const file = fileMatches ? fileMatches[0] ?? "" : "";
        return { link, file: `${file}.qmd` };
      }
    );
    return extractedLinks;
  };

  const check = (expected: ExtractedLink[], value: string) => {
    assertEquals(expected, extractLinks(value));
  };

  unitTest(suiteLabel("empty_string"), async () => {
    const value = "";
    const expected: ExtractedLink[] = [];
    check(expected, value);
  });

  unitTest(suiteLabel("three_links"), async () => {
    const value =
      "<a href='no-replace.qmd'/>no</a> content content <a href='team.qmd#Fake-Anchor'>team</a> content content <a href='zqmdzz.qmd'>team</a>";
    const expected: ExtractedLink[] = [
      { link: "href='no-replace.qmd'", file: "no-replace.qmd" },
      { link: "href='team.qmd#Fake-Anchor'", file: "team.qmd" },
      { link: "href='zqmdzz.qmd'", file: "zqmdzz.qmd" },
    ];
    check(expected, value);
  });

  unitTest(suiteLabel("three_links_messy"), async () => {
    const value =
      "no-replace.qmd <a href='no-replace.qmd'/>no</a> no-replace.qmd content content <a href='team.qmd#Fake-Anchor'>team</a> content content <a href='zqmdzz.qmd'>team</a> qmd.qmd <a href='team.txt'>team</a>";
    const expected: ExtractedLink[] = [
      { link: "href='no-replace.qmd'", file: "no-replace.qmd" },
      { link: "href='team.qmd#Fake-Anchor'", file: "team.qmd" },
      { link: "href='zqmdzz.qmd'", file: "zqmdzz.qmd" },
    ];
    check(expected, value);
  });
};

const runUpdateLinks = () => {
  const suiteLabel = (label: string) => `UpdateLinks_${label}`;

  const fileMetadataTable = {
    ["release-planning.qmd"]: {
      title: "Release Planning",
      id: "19890228",
      metadata: { fileName: "release-planning.xml" },
    },
    ["team.qmd"]: {
      title: "Team",
      id: "19857455",
      metadata: { fileName: "team.xml" },
    },
    ["triage.qmd"]: {
      title: "Issue Triage",
      id: "19890180",
      metadata: {
        fileName: "triage.xml",
      },
    },
    ["authoring/hello-world5.qmd"]: {
      title: "Hello World5",
      id: "43417628",
      metadata: { editor: "v2", fileName: "authoring/hello-world5.xml" },
    },
  };

  const UPDATE_NO_LINKS: ContentUpdate = {
    contentChangeType: ContentChangeType.update,
    id: "19890228",
    version: null,
    title: "Release Planning",
    type: "page",
    status: "current",
    ancestors: [{ id: "19759105" }],
    body: {
      storage: {
        value: "no links",
        representation: "storage",
      },
    },
    fileName: "release-planning.xml",
  };

  const UPDATE_LINKS_ONE: ContentUpdate = {
    contentChangeType: ContentChangeType.update,
    id: "19890228",
    version: null,
    title: "Release Planning",
    type: "page",
    status: "current",
    ancestors: [{ id: "19759105" }],
    body: {
      storage: {
        value:
          "<a href='no-replace.qmd'/>no</a> content content <a href='team.qmd'>team</a> content content <a href='zqmdzz.qmd'>team</a>",
        representation: "storage",
      },
    },
    fileName: "release-planning.xml",
  };

  const UPDATE_LINKS_ONE_NESTED_DOT_SLASH: ContentUpdate = {
    contentChangeType: ContentChangeType.update,
    id: "43778049",
    version: null,
    title: "Links2",
    type: "page",
    status: "current",
    ancestors: [{ id: "42336414" }],
    body: {
      storage: {
        value: `<a href='./hello-world5.qmd'>Hello World 5</a>`,
        representation: "storage",
      },
    },
    fileName: "authoring/links2.xml",
  };

  const UPDATE_LINKS_ONE_NESTED: ContentUpdate = {
    contentChangeType: ContentChangeType.update,
    id: "43778049",
    version: null,
    title: "Links2",
    type: "page",
    status: "current",
    ancestors: [{ id: "42336414" }],
    body: {
      storage: {
        value: `<a href='hello-world5.qmd'>Hello World 5</a>`,
        representation: "storage",
      },
    },
    fileName: "authoring/links2.xml",
  };

  const UPDATE_LINKS_ONE_NESTED_ABS: ContentUpdate = {
    contentChangeType: ContentChangeType.update,
    id: "43778049",
    version: null,
    title: "Links2",
    type: "page",
    status: "current",
    ancestors: [{ id: "42336414" }],
    body: {
      storage: {
        value: `<a href='/release-planning.qmd'>Release Planning</a>`,
        representation: "storage",
      },
    },
    fileName: "authoring/links2.xml",
  };

  const UPDATE_LINKS_ONE_ANCHOR: ContentUpdate = {
    contentChangeType: ContentChangeType.update,
    id: "19890228",
    version: null,
    title: "Release Planning",
    type: "page",
    status: "current",
    ancestors: [{ id: "19759105" }],
    body: {
      storage: {
        value:
          "<a href='no-replace.qmd'/>no</a> content content <a href='team.qmd#Fake-Anchor'>team</a> content content <a href='zqmdzz.qmd'>team</a>",
        representation: "storage",
      },
    },
    fileName: "release-planning.xml",
  };

  const UPDATE_LINKS_SEVERAL: ContentUpdate = {
    contentChangeType: ContentChangeType.update,
    id: "19890228",
    version: null,
    title: "Release Planning",
    type: "page",
    status: "current",
    ancestors: [{ id: "19759105" }],
    body: {
      storage: {
        value:
          "<a href='no-replace.qmd'/>not-found</a> content content <a href='team.qmd'>teamz</a> content content <a href='zqmdzz.qmd'>not-found</a> <a href='release-planning.qmd'>Do the Release Planning</a> and then triage.qmd .qmd <a href='triage.qmd'>triage.qmd</a>",
        representation: "storage",
      },
    },
    fileName: "release-planning.xml",
  };

  const check = (
    expectedPass1Changes: ConfluenceSpaceChange[],
    changes: ConfluenceSpaceChange[],
    fileMetadataTable: Record<string, SitePage>,
    server = "fake-server",
    parent = FAKE_PARENT,
    expectedPass2Changes: ConfluenceSpaceChange[] = []
  ) => {
    const { pass1Changes, pass2Changes } = updateLinks(
      fileMetadataTable,
      changes,
      server,
      parent
    );

    assertEquals(expectedPass1Changes, pass1Changes);
    assertEquals(expectedPass2Changes, pass2Changes);
  };

  test(suiteLabel("no_files"), async () => {
    const changes: ConfluenceSpaceChange[] = [];
    const expected: ConfluenceSpaceChange[] = [];
    check(expected, changes, fileMetadataTable);
  });

  test(suiteLabel("one_update_noLink"), async () => {
    const changes: ConfluenceSpaceChange[] = [UPDATE_NO_LINKS];
    const expected: ConfluenceSpaceChange[] = [UPDATE_NO_LINKS];
    check(expected, changes, fileMetadataTable);
  });

  test(suiteLabel("one_update_link"), async () => {
    const changes: ConfluenceSpaceChange[] = [UPDATE_LINKS_ONE];
    const rootURL = "fake-server/wiki/spaces/QUARTOCONF/pages";
    const expectedUpdate: ContentUpdate = {
      ...UPDATE_LINKS_ONE,
      body: {
        storage: {
          value: `<a href=\'no-replace.qmd\'/>no</a> content content <a href=\'fake-server/wiki/spaces/QUARTOCONF/pages/19857455/Team\'>team</a> content content <a href=\'zqmdzz.qmd\'>team</a>`,
          representation: "storage",
        },
      },
    };
    const expected: ConfluenceSpaceChange[] = [expectedUpdate];
    const expectedPass2Changes: ConfluenceSpaceChange[] = [expectedUpdate];
    check(
      expected,
      changes,
      fileMetadataTable,
      "fake-server",
      FAKE_PARENT,
      expectedPass2Changes
    );
  });

  test(suiteLabel("one_update_link_nested_dot_slash"), async () => {
    const changes: ConfluenceSpaceChange[] = [
      UPDATE_LINKS_ONE_NESTED_DOT_SLASH,
    ];
    const rootURL = "fake-server/wiki/spaces/QUARTOCONF/pages";
    const expectedUpdate: ContentUpdate = {
      ...UPDATE_LINKS_ONE_NESTED_DOT_SLASH,
      body: {
        storage: {
          value: `<a href=\'fake-server/wiki/spaces/QUARTOCONF/pages/43417628/Hello%20World5\'>Hello World 5</a>`,
          representation: "storage",
        },
      },
    };
    const expected: ConfluenceSpaceChange[] = [expectedUpdate];
    check(expected, changes, fileMetadataTable);
  });

  test(suiteLabel("one_update_link_nested_relative"), async () => {
    const changes: ConfluenceSpaceChange[] = [UPDATE_LINKS_ONE_NESTED];
    const rootURL = "fake-server/wiki/spaces/QUARTOCONF/pages";
    const expectedUpdate: ContentUpdate = {
      ...UPDATE_LINKS_ONE_NESTED,
      body: {
        storage: {
          value: `<a href=\'fake-server/wiki/spaces/QUARTOCONF/pages/43417628/Hello%20World5\'>Hello World 5</a>`,
          representation: "storage",
        },
      },
    };
    const expected: ConfluenceSpaceChange[] = [expectedUpdate];
    check(expected, changes, fileMetadataTable);
  });

  test(suiteLabel("one_update_link_nested_absolute"), async () => {
    const changes: ConfluenceSpaceChange[] = [UPDATE_LINKS_ONE_NESTED_ABS];
    const rootURL = "fake-server/wiki/spaces/QUARTOCONF/pages";
    const expectedUpdate: ContentUpdate = {
      ...UPDATE_LINKS_ONE_NESTED_ABS,
      body: {
        storage: {
          value: `<a href=\'fake-server/wiki/spaces/QUARTOCONF/pages/19890228/Release%20Planning\'>Release Planning</a>`,
          representation: "storage",
        },
      },
    };
    const expected: ConfluenceSpaceChange[] = [expectedUpdate];
    check(expected, changes, fileMetadataTable);
  });

  test(suiteLabel("one_update_link_anchor"), async () => {
    const changes: ConfluenceSpaceChange[] = [UPDATE_LINKS_ONE_ANCHOR];
    const rootURL = "fake-server/wiki/spaces/QUARTOCONF/pages";
    const expectedUpdate: ContentUpdate = {
      ...UPDATE_LINKS_ONE,
      body: {
        storage: {
          value:
            "<a href='no-replace.qmd'/>no</a> content content <a href='fake-server/wiki/spaces/QUARTOCONF/pages/19857455/Team#Fake-Anchor'>team</a> content content <a href='zqmdzz.qmd'>team</a>",
          representation: "storage",
        },
      },
    };
    const expected: ConfluenceSpaceChange[] = [expectedUpdate];
    const expectedSecondPassChanges: ConfluenceSpaceChange[] = [expectedUpdate];
    check(
      expected,
      changes,
      fileMetadataTable,
      "fake-server",
      FAKE_PARENT,
      expectedSecondPassChanges
    );
  });

  test(suiteLabel("one_change_several_update_links"), async () => {
    const changes: ConfluenceSpaceChange[] = [UPDATE_LINKS_SEVERAL];
    const rootURL = "fake-server/wiki/spaces/QUARTOCONF/pages";
    const expectedUpdate: ContentUpdate = {
      ...UPDATE_LINKS_ONE,
      body: {
        storage: {
          value: `<a href='no-replace.qmd'/>not-found</a> content content <a href='fake-server/wiki/spaces/QUARTOCONF/pages/19857455/Team'>teamz</a> content content <a href='zqmdzz.qmd'>not-found</a> <a href='fake-server/wiki/spaces/QUARTOCONF/pages/19890228/Release%20Planning'>Do the Release Planning</a> and then triage.qmd .qmd <a href='fake-server/wiki/spaces/QUARTOCONF/pages/19890180/Issue%20Triage'>triage.qmd</a>`,
          representation: "storage",
        },
      },
    };
    const expected: ConfluenceSpaceChange[] = [expectedUpdate];
    const expectedSecondPassChanges: ConfluenceSpaceChange[] = [expectedUpdate];
    check(
      expected,
      changes,
      fileMetadataTable,
      "fake-server",
      FAKE_PARENT,
      expectedSecondPassChanges
    );
  });

  test(suiteLabel("two_changes_several_update_links"), async () => {
    const changes: ConfluenceSpaceChange[] = [
      UPDATE_LINKS_SEVERAL,
      UPDATE_LINKS_ONE,
    ];
    const rootURL = "fake-server/wiki/spaces/QUARTOCONF/pages";
    const expectedUpdateSeveralLinks: ContentUpdate = {
      ...UPDATE_LINKS_ONE,
      body: {
        storage: {
          value: `<a href='no-replace.qmd'/>not-found</a> content content <a href='fake-server/wiki/spaces/QUARTOCONF/pages/19857455/Team'>teamz</a> content content <a href='zqmdzz.qmd'>not-found</a> <a href='fake-server/wiki/spaces/QUARTOCONF/pages/19890228/Release%20Planning'>Do the Release Planning</a> and then triage.qmd .qmd <a href='fake-server/wiki/spaces/QUARTOCONF/pages/19890180/Issue%20Triage'>triage.qmd</a>`,
          representation: "storage",
        },
      },
    };

    const expectedUpdateOneLink: ContentUpdate = {
      ...UPDATE_LINKS_ONE,
      body: {
        storage: {
          value: `<a href='no-replace.qmd'/>no</a> content content <a href='fake-server/wiki/spaces/QUARTOCONF/pages/19857455/Team'>team</a> content content <a href='zqmdzz.qmd'>team</a>`,
          representation: "storage",
        },
      },
    };
    const expected: ConfluenceSpaceChange[] = [
      expectedUpdateSeveralLinks,
      expectedUpdateOneLink,
    ];
    const expectedSecondPassChanges: ConfluenceSpaceChange[] = [
      expectedUpdateSeveralLinks,
      expectedUpdateOneLink,
    ];
    check(
      expected,
      changes,
      fileMetadataTable,
      "fake-server",
      FAKE_PARENT,
      expectedSecondPassChanges
    );
  });
};

const runFindAttachments = () => {
  const suiteLabel = (label: string) => `FindAttachments_${label}`;

  const check = (
    expected: string[],
    bodyValue: string,
    filePaths: string[] = [],
    path: string = ""
  ) => {
    assertEquals(
      JSON.stringify(expected),
      JSON.stringify(findAttachments(bodyValue, filePaths, path))
    );
  };

  test(suiteLabel("empty"), async () => {
    const bodyValue: string = "";
    const expected: string[] = [];
    check(expected, bodyValue);
  });

  test(suiteLabel("no_attachment"), async () => {
    const bodyValue: string = "fake body value";
    const expected: string[] = [];
    check(expected, bodyValue);
  });

  test(suiteLabel("no_attachment_CDATA"), async () => {
    const bodyValue: string =
      "<ac:plain-text-body> <![CDATA[![Caption](elephant.png)]</ac:plain-text-body><ac:plain-text-body>]> </ac:plain-text-body>";
    const expected: string[] = [];
    check(expected, bodyValue);
  });

  test(suiteLabel("single_image"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="elephant.png" ri:version-at-save="1" />';
    const expected: string[] = ["elephant.png"];
    check(expected, bodyValue);
  });

  test(suiteLabel("single_image_lookup"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="elephant.png" ri:version-at-save="1" />';
    const filePaths: string[] = ["fake-path/elephant.png"];
    const expected: string[] = ["elephant.png"];
    check(expected, bodyValue, filePaths);
  });

  test(suiteLabel("single_image_lookup_full_path"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="computations-r_files/figure-publish/fig-airquality-1.png" ri:version-at-save="1" />';
    const filePaths: string[] = [
      "computations/r/computations-r_files/figure-publish/fig-airquality-1.png",
    ];
    const expected: string[] = [
      "computations/r/computations-r_files/figure-publish/fig-airquality-1.png",
    ];
    check(expected, bodyValue, filePaths, "computations/r/index.xml");
  });

  test(suiteLabel("single_image_lookup_full_path_win"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="computations-r_files/figure-publish/fig-airquality-1.png" ri:version-at-save="1" />';
    const filePaths: string[] = [
      "computations\\r\\computations-r_files\\figure-publish\\fig-airquality-1.png",
    ];
    const expected: string[] = [
      "computations\\r\\computations-r_files\\figure-publish\\fig-airquality-1.png",
    ];
    check(expected, bodyValue, filePaths, "computations\\r\\index.xml");
  });

  test(suiteLabel("single_with_same_name_nested_win"), async () => {
    const filePaths: string[] = [
      "folder\\images\\elephant.png",
      "images\\elephant.png",
    ];
    const bodyValue: string =
      '<ri:attachment ri:filename="images/elephant.png" />';
    const expected: string[] = ["images\\elephant.png"];
    const path = "index.xml";
    check(expected, bodyValue, filePaths, path);
  });

  test(suiteLabel("single_with_same_name_nested_win2"), async () => {
    const filePaths: string[] = [
      "folder\\images\\elephant.png",
      "images\\elephant.png",
    ];
    const bodyValue: string =
      '<ri:attachment ri:filename="images/elephant.png" />';
    const expected: string[] = ["folder\\images\\elephant.png"];
    const path = "folder\\index.xml";
    check(expected, bodyValue, filePaths, path);
  });

  test(suiteLabel("single_with_same_name_nested"), async () => {
    const filePaths: string[] = [
      "images/elephant.png",
      "folder/images/elephant.png",
    ];
    const bodyValue: string =
      '<ri:attachment ri:filename="images/elephant.png" />';
    const expected: string[] = ["images/elephant.png"];
    const path = "index.xml";
    check(expected, bodyValue, filePaths, path);
  });

  test(suiteLabel("single_image_lookup_relative_path"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="elephant.png" ri:version-at-save="1" />';
    const filePaths: string[] = [
      "images/elephant.png",
      "parent/inner-parent/elephant.png",
    ];
    const path = "parent/inner-parent/hello-world3.xml";
    const expected: string[] = ["parent/inner-parent/elephant.png"];
    check(expected, bodyValue, filePaths, path);
  });

  test(suiteLabel("single_image_lookup_relative_path_win"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="elephant.png" ri:version-at-save="1" />';
    const filePaths: string[] = [
      "images\\elephant.png",
      "parent\\inner-parent\\elephant.png",
    ];
    const path = "parent\\inner-parent\\hello-world3.xml";
    const expected: string[] = ["parent\\inner-parent\\elephant.png"];
    check(expected, bodyValue, filePaths, path);
  });

  test(suiteLabel("single_image_lookup_relative_path_win2"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="images/elephant.png" ri:version-at-save="1" />';
    const filePaths: string[] = ["folder\\images\\elephant.png"];
    const path = "folder/index.xml";
    const expected: string[] = ["folder\\images\\elephant.png"];
    check(expected, bodyValue, filePaths, path);
  });

  test(suiteLabel("single_image_lookup_dupe_name"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="elephant.png" ri:version-at-save="1" />';
    const filePaths: string[] = [
      "fake-path/elephant.png",
      "fake-path2/elephant.png",
    ];
    const filePath = "fake-path2/file.xml";
    const expected: string[] = ["fake-path2/elephant.png"];
    check(expected, bodyValue, filePaths, filePath);
  });

  test(suiteLabel("single_image_lookup_bad_paths"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="elephant.png" ri:version-at-save="1" />';
    const filePaths: string[] = [
      "fake-path-fail/elephant.png",
      "fake-path2-fail/elephant.png",
    ];
    const filePath = "fake-path2/file.xml";
    const expected: string[] = ["elephant.png"];
    check(expected, bodyValue, filePaths, filePath);
  });

  test(suiteLabel("two_images"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="fake-image.png" ri:version-at-save="1" /> <ri:attachment ri:filename="fake-image2.png" ri:version-at-save="1" />';
    const expected: string[] = ["fake-image.png", "fake-image2.png"];
    check(expected, bodyValue);
  });

  test(suiteLabel("two_images_with_dupes"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="fake-image.png" ri:version-at-save="1" /> <ri:attachment ri:filename="fake-image.png" ri:version-at-save="1" /> <ri:attachment ri:filename="fake-image2.png" ri:version-at-save="1" />';
    const expected: string[] = ["fake-image.png", "fake-image2.png"];
    check(expected, bodyValue);
  });

  test(suiteLabel("image_not_attachment"), async () => {
    const bodyValue: string = '"elephant.png"';
    const expected: string[] = [];
    check(expected, bodyValue);
  });

  test(suiteLabel("two_images_with_dupes_invalids"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="fake-image.png" ri:version-at-save="1" /> <ri:attachment ri:filename="fake-image.png" ri:version-at-save="1" /> <ri:attachment ri:filename="fake-image2.png" ri:version-at-save="1" /> no-match.png "no-match.png"';
    const expected: string[] = ["fake-image.png", "fake-image2.png"];
    check(expected, bodyValue);
  });

  test(suiteLabel("audio_file"), async () => {
    const DOUBLE_BRACKET = "]]";
    const bodyValue: string = `<ac:link><ri:attachment ri:filename="audio/2022-11-10-intro-psychological-safety.m4a"/><ac:plain-text-link-body><![CDATA[audio/2022-11-10-intro-psychological-safety.m4a${DOUBLE_BRACKET}></ac:plain-text-link-body></ac:link>`;
    const expected: string[] = [
      "audio/2022-11-10-intro-psychological-safety.m4a",
    ];
    check(expected, bodyValue);
  });
};

const runUpdateImagePathsForContentBody = () => {
  const suiteLabel = (label: string) =>
    `UpdateImagePathsForContentBody_${label}`;

  const UPDATE_NO_IMAGES: ContentBody = {
    storage: {
      value: "no-images",
      representation: "raw",
    },
  };

  const UPDATE_ONE_FLAT_IMAGE: ContentBody = {
    storage: {
      value:
        '<ri:attachment ri:filename="elephant.png" ri:version-at-save="1" />',
      representation: "raw",
    },
  };
  const UPDATE_ONE_TO_FLATTEN_IMAGE: ContentBody = {
    storage: {
      value:
        '<ri:attachment ri:filename="a/b/c/elephant.png" ri:version-at-save="1" />',
      representation: "raw",
    },
  };

  const check = (expected: ContentBody, bodyValue: ContentBody) => {
    assertEquals(expected, updateImagePaths(bodyValue));
  };

  test(suiteLabel("no_images"), async () => {
    const changes = UPDATE_NO_IMAGES;
    const expected = UPDATE_NO_IMAGES;
    check(expected, changes);
  });

  test(suiteLabel("images-already-flattened"), async () => {
    const changes = UPDATE_ONE_FLAT_IMAGE;
    const expected = UPDATE_ONE_FLAT_IMAGE;
    check(expected, changes);
  });

  test(suiteLabel("images-to-flatten"), async () => {
    const changes = UPDATE_ONE_TO_FLATTEN_IMAGE;
    const expected = UPDATE_ONE_FLAT_IMAGE;
    check(expected, changes);
  });
};

const runCapFirstLetter = () => {
  const suiteLabel = (label: string) => `CapFirstLetter_${label}`;
  test(suiteLabel("basic"), async () => {
    assertEquals("A", capitalizeFirstLetter("a"));
  });

  test(suiteLabel("basic_space"), async () => {
    assertEquals("A b", capitalizeFirstLetter("a b"));
  });

  test(suiteLabel("empty"), async () => {
    assertEquals("", capitalizeFirstLetter(""));
  });

  test(suiteLabel("empty2"), async () => {
    assertEquals("", capitalizeFirstLetter());
  });
};

if (RUN_ALL_TESTS) {
  runGeneralTests();
  runFilterFilesForUpdate();
  runBuildSpaceChanges();
  runSpaceCreatesWithNesting();
  runSpaceUpdatesWithNesting();
  runMergeSitePages();
  runPublishRecordTests();
  runGetNextVersionTests();
  runWriteTokenComparator();
  runBuildContentCreate();
  runGetTitle();
  runBuildFileToMetaTable();
  runExtractLinks();
  runUpdateLinks();
  runFindAttachments();
  runUpdateImagePathsForContentBody();
  runCapFirstLetter();
} else {
  runUpdateLinks();
}
