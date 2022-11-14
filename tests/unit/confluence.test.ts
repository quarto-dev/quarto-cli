/*
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */
import { unitTest } from "../test.ts";
import { assertEquals, assertThrows } from "testing/asserts.ts";

import {
  buildContentCreate,
  buildPublishRecordForContent,
  confluenceParentFromString,
  buildSpaceChanges,
  filterFilesForUpdate,
  getMessageFromAPIError,
  getNextVersion,
  getTitle,
  isNotFound,
  isUnauthorized,
  mergeSitePages,
  tokenFilterOut,
  transformAtlassianDomain,
  validateEmail,
  validateServer,
  validateToken,
  wrapBodyForConfluence,
  writeTokenComparator,
  findPagesToDelete,
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
  ContentVersion,
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
      key: "fake-key",
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
      "https://allenmanning.atlassian.net/wiki/spaces/fake-key/pages/fake-id";
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
        metadata: {
          ["fake-key"]: "fake-value",
        },
      },
      {
        id: "456",
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
        metadata: {
          ["fake-key"]: "fake-value",
        },
      },
      {
        id: "456",
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
  };

  const fakeParent: ConfluenceParent = {
    space: "QUARTOCONF",
    parent: "8781825",
  };

  const fakeFile: SiteFileMetadata = {
    fileName: "fake-file-name",
    title: "fake-title",
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
      fakeParent,
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
        },
        status: "current",
        title: "fake-title",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      fakeParent,
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
        },
        status: "current",
        title: "fake-title2",
        type: "page",
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      fakeParent,
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
        metadata: { fileName: "fake-file-name" },
      },
    ];
    const actual: ConfluenceSpaceChange[] = buildSpaceChanges(
      fileMetadataList,
      fakeParent,
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
        metadata: { fileName: "fake-file-name" },
      },
      {
        id: "delete-me-file-id",
        metadata: { fileName: "delete-me-file-name" },
      },
    ];
    const expected = [
      {
        id: "delete-me-file-id",
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
        metadata: { fileName: "fake-file-name" },
      },
      {
        id: "delete-me-file-id",
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
      fakeParent,
      fakeSpace,
      existingSite
    );
    assertEquals(expected, actual);
  });
};
runFileMetadataToSpaceChanges();
