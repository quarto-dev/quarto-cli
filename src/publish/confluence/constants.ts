export const DELETE_DISABLED = false;

export const EXIT_ON_ERROR = false;

export const DESCENDANT_PAGE_SIZE = 200; // Undocumented limit, any size over 200 will be reduced to 200 on the back-end

export const MAX_PAGES_TO_LOAD = 100; //We will cap you at 200k pages or in case the Confluence APIs have a bug and always return results

export const V2EDITOR_METADATA = {
  metadata: {
    properties: {
      editor: {
        value: "v2",
      },
    },
  },
};

export const DELETE_SLEEP_MILLIS = 1000; //TODO replace with polling

// Empirically determined delay to avoid Confluence 500 errors on concurrent attachment updates
export const ATTACHMENT_UPLOAD_DELAY_MS = 800;

export const CAN_SET_PERMISSIONS_DISABLED = "CONFLUENCE_LOCAL_STORAGE_CAN_SET_PERMISSIONS_DISABLED";

export const CAN_SET_PERMISSIONS_ENABLED_CACHED = "CONFLUENCE_LOCAL_STORAGE_CAN_SET_PERMISSIONS_ENABLED_CACHED"
