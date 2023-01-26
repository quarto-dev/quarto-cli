export const DELETE_DISABLED = false;

export const DESCENDANT_LIMIT = 500; // Render time would be the big worry here, we can consider paging in the future

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

export const VALID_DOMAINS = [
  "https://rstudiopbc-sandbox-249.atlassian.net/",
  "https://allenmanning.atlassian.net/",
];
