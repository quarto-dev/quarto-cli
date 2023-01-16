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
runPublishRecordTests();

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
runGetNextVersionTests();

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
runWriteTokenComparator();

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
      "parent/not-supported-child.xml",

      "knowledge-base.html",
      "team.xml",
      "agreements.html",
      "mission.xml",
      "ci-log.html",
    ];
    const expected = ["team.xml", "mission.xml"];

    check(fakeFileList, expected);
  });
};
runFilterFilesForUpdate();

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
runBuildContentCreate();

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
runGetTitle();

const runMergeSitePages = () => {
  const suiteLabel = (label: string) => `MergeSitePages_${label}`;

  unitTest(suiteLabel("basic_valid"), async () => {
    const shallowPages: ContentSummary[] = [
      {
        id: "123",
        title: "fake-title",
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
      },
      {
        id: "456",
        title: "fake-title2",
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
      },
      {
        id: "456",
        title: "fake-title2",
        metadata: {
          ["fake-key2"]: "fake-value2",
          ["fake-key3"]: "fake-value3",
        },
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
      },
      {
        id: "456",
        title: "fake-title2",
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
      },
      {
        id: "456",
        title: "fake-title2",
        metadata: {},
      },
    ];
    const result = mergeSitePages(shallowPages, contentProperties);
    assertEquals(expected, result);
  });
};
runMergeSitePages();

const runFileMetadataToSpaceChanges = () => {
  const suiteLabel = (label: string) => `FileMetadataToSpaceChanges_${label}`;

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

  unitTest(suiteLabel("no_files"), async () => {
    const fileMetadataList: SiteFileMetadata[] = [];
    const expected: ConfluenceSpaceChange[] = [];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      FAKE_PARENT,
      fakeSpace
    );
    assertEquals(expected, actual);
  });

  unitTest(suiteLabel("one_file"), async () => {
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

  unitTest(suiteLabel("two_files"), async () => {
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

  unitTest(suiteLabel("one_file_update"), async () => {
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

  unitTest(suiteLabel("one_file_update_matching"), async () => {
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

  unitTest(suiteLabel("findPagesToDelete"), async () => {
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
    const expected = [
      {
        id: "delete-me-file-id",
        title: "delete-me-title",
        metadata: { fileName: "delete-me-file-name" },
      },
    ];
    const actual = findPagesToDelete(fileMetadataList, existingSite);
    assertEquals(expected, actual);
  });

  unitTest(suiteLabel("one_file_delete"), async () => {
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
runFileMetadataToSpaceChanges();

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
runBuildFileToMetaTable();

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
runExtractLinks();

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
    expected: ConfluenceSpaceChange[],
    changes: ConfluenceSpaceChange[],
    fileMetadataTable: Record<string, SitePage>,
    server = "fake-server",
    parent = FAKE_PARENT
  ) => {
    const result = updateLinks(fileMetadataTable, changes, server, parent);
    assertEquals(expected, result);
  };

  unitTest(suiteLabel("no_files"), async () => {
    const changes: ConfluenceSpaceChange[] = [];
    const expected: ConfluenceSpaceChange[] = [];
    check(expected, changes, fileMetadataTable);
  });

  unitTest(suiteLabel("one_update_noLink"), async () => {
    const changes: ConfluenceSpaceChange[] = [UPDATE_NO_LINKS];
    const expected: ConfluenceSpaceChange[] = [UPDATE_NO_LINKS];
    check(expected, changes, fileMetadataTable);
  });

  unitTest(suiteLabel("one_update_link"), async () => {
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
    check(expected, changes, fileMetadataTable);
  });

  unitTest(suiteLabel("one_update_link_anchor"), async () => {
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
    check(expected, changes, fileMetadataTable);
  });

  unitTest(suiteLabel("one_change_several_update_links"), async () => {
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
    check(expected, changes, fileMetadataTable);
  });

  unitTest(suiteLabel("two_changes_several_update_links"), async () => {
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
    check(expected, changes, fileMetadataTable);
  });
};
runUpdateLinks();

const runFindAttachments = () => {
  const suiteLabel = (label: string) => `FindAttachments_${label}`;

  const check = (expected: string[], bodyValue: string) => {
    assertEquals(
      JSON.stringify(expected),
      JSON.stringify(findAttachments(bodyValue))
    );
  };

  unitTest(suiteLabel("empty"), async () => {
    const bodyValue: string = "";
    const expected: string[] = [];
    check(expected, bodyValue);
  });

  unitTest(suiteLabel("no_attachment"), async () => {
    const bodyValue: string = "fake body value";
    const expected: string[] = [];
    check(expected, bodyValue);
  });

  unitTest(suiteLabel("no_attachment_CDATA"), async () => {
    const bodyValue: string =
      "<ac:plain-text-body> <![CDATA[![Caption](elephant.png)]</ac:plain-text-body><ac:plain-text-body>]> </ac:plain-text-body>";
    const expected: string[] = [];
    check(expected, bodyValue);
  });

  unitTest(suiteLabel("single_image"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="elephant.png" ri:version-at-save="1" />';
    const expected: string[] = ["elephant.png"];
    check(expected, bodyValue);
  });

  unitTest(suiteLabel("two_images"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="fake-image.png" ri:version-at-save="1" /> <ri:attachment ri:filename="fake-image2.png" ri:version-at-save="1" />';
    const expected: string[] = ["fake-image.png", "fake-image2.png"];
    check(expected, bodyValue);
  });

  unitTest(suiteLabel("two_images_with_dupes"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="fake-image.png" ri:version-at-save="1" /> <ri:attachment ri:filename="fake-image.png" ri:version-at-save="1" /> <ri:attachment ri:filename="fake-image2.png" ri:version-at-save="1" />';
    const expected: string[] = ["fake-image.png", "fake-image2.png"];
    check(expected, bodyValue);
  });

  unitTest(suiteLabel("image_not_attachment"), async () => {
    const bodyValue: string = '"elephant.png"';
    const expected: string[] = [];
    check(expected, bodyValue);
  });

  unitTest(suiteLabel("two_images_with_dupes_invalids"), async () => {
    const bodyValue: string =
      '<ri:attachment ri:filename="fake-image.png" ri:version-at-save="1" /> <ri:attachment ri:filename="fake-image.png" ri:version-at-save="1" /> <ri:attachment ri:filename="fake-image2.png" ri:version-at-save="1" /> no-match.png "no-match.png"';
    const expected: string[] = ["fake-image.png", "fake-image2.png"];
    check(expected, bodyValue);
  });

  unitTest(suiteLabel("audio_file"), async () => {
    const DOUBLE_BRACKET = "]]";
    const bodyValue: string = `<ac:link><ri:attachment ri:filename="audio/2022-11-10-intro-psychological-safety.m4a"/><ac:plain-text-link-body><![CDATA[audio/2022-11-10-intro-psychological-safety.m4a${DOUBLE_BRACKET}></ac:plain-text-link-body></ac:link>`;
    const expected: string[] = [
      "audio/2022-11-10-intro-psychological-safety.m4a",
    ];
    check(expected, bodyValue);
  });
};
runFindAttachments();

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

  unitTest(suiteLabel("no_images"), async () => {
    const changes = UPDATE_NO_IMAGES;
    const expected = UPDATE_NO_IMAGES;
    check(expected, changes);
  });

  unitTest(suiteLabel("images-already-flattened"), async () => {
    const changes = UPDATE_ONE_FLAT_IMAGE;
    const expected = UPDATE_ONE_FLAT_IMAGE;
    check(expected, changes);
  });

  unitTest(suiteLabel("images-to-flatten"), async () => {
    const changes = UPDATE_ONE_TO_FLATTEN_IMAGE;
    const expected = UPDATE_ONE_FLAT_IMAGE;
    check(expected, changes);
  });
};
runUpdateImagePathsForContentBody();
