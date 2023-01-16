/*
* ci-info.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
* Copyright (c) 2016-2021 Thomas Watson Steen
*
* Adapted from: https://github.com/watson/ci-info
*/

export function runningInCI() {
  // check generic env vars
  if (
    [
      "CI", // Travis CI, CircleCI, Cirrus CI, Gitlab CI, // Appveyor, CodeShip, dsari
      "CONTINUOUS_INTEGRATION", // Travis CI, Cirrus CI
      "BUILD_NUMBER", // Jenkins, TeamCity
      "RUN_ID", // TaskCluster, dsari
    ]
      .some(checkEnv)
  ) {
    return true;
  }

  // check database of vendor-specific env vars
  return vendors.some((vendor) => {
    const envs = Array.isArray(vendor.env) ? vendor.env : [vendor.env];
    return envs.some(checkEnv);
  });
}

function checkEnv(obj: string | Record<string, string>) {
  if (typeof obj === "string") {
    return !!Deno.env.get(obj);
  } else {
    return Object.keys(obj).every(function (k) {
      return Deno.env.get(k) === obj[k];
    });
  }
}

// from https://github.com/watson/ci-info/blob/master/vendors.json

interface CIVendor {
  name: string;
  constant: string;
  env: string | string[] | Record<string, string>;
  pr?: string | Record<string, string | string[]>;
}

const vendors: CIVendor[] = [
  {
    "name": "AppVeyor",
    "constant": "APPVEYOR",
    "env": "APPVEYOR",
    "pr": "APPVEYOR_PULL_REQUEST_NUMBER",
  },
  {
    "name": "Azure Pipelines",
    "constant": "AZURE_PIPELINES",
    "env": "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI",
    "pr": "SYSTEM_PULLREQUEST_PULLREQUESTID",
  },
  {
    "name": "Appcircle",
    "constant": "APPCIRCLE",
    "env": "AC_APPCIRCLE",
  },
  {
    "name": "Bamboo",
    "constant": "BAMBOO",
    "env": "bamboo_planKey",
  },
  {
    "name": "Bitbucket Pipelines",
    "constant": "BITBUCKET",
    "env": "BITBUCKET_COMMIT",
    "pr": "BITBUCKET_PR_ID",
  },
  {
    "name": "Bitrise",
    "constant": "BITRISE",
    "env": "BITRISE_IO",
    "pr": "BITRISE_PULL_REQUEST",
  },
  {
    "name": "Buddy",
    "constant": "BUDDY",
    "env": "BUDDY_WORKSPACE_ID",
    "pr": "BUDDY_EXECUTION_PULL_REQUEST_ID",
  },
  {
    "name": "Buildkite",
    "constant": "BUILDKITE",
    "env": "BUILDKITE",
    "pr": { "env": "BUILDKITE_PULL_REQUEST", "ne": "false" },
  },
  {
    "name": "CircleCI",
    "constant": "CIRCLE",
    "env": "CIRCLECI",
    "pr": "CIRCLE_PULL_REQUEST",
  },
  {
    "name": "Cirrus CI",
    "constant": "CIRRUS",
    "env": "CIRRUS_CI",
    "pr": "CIRRUS_PR",
  },
  {
    "name": "AWS CodeBuild",
    "constant": "CODEBUILD",
    "env": "CODEBUILD_BUILD_ARN",
  },
  {
    "name": "Codefresh",
    "constant": "CODEFRESH",
    "env": "CF_BUILD_ID",
    "pr": { "any": ["CF_PULL_REQUEST_NUMBER", "CF_PULL_REQUEST_ID"] },
  },
  {
    "name": "Codeship",
    "constant": "CODESHIP",
    "env": { "CI_NAME": "codeship" },
  },
  {
    "name": "Drone",
    "constant": "DRONE",
    "env": "DRONE",
    "pr": { "DRONE_BUILD_EVENT": "pull_request" },
  },
  {
    "name": "dsari",
    "constant": "DSARI",
    "env": "DSARI",
  },
  {
    "name": "GitHub Actions",
    "constant": "GITHUB_ACTIONS",
    "env": "GITHUB_ACTIONS",
    "pr": { "GITHUB_EVENT_NAME": "pull_request" },
  },
  {
    "name": "GitLab CI",
    "constant": "GITLAB",
    "env": "GITLAB_CI",
    "pr": "CI_MERGE_REQUEST_ID",
  },
  {
    "name": "GoCD",
    "constant": "GOCD",
    "env": "GO_PIPELINE_LABEL",
  },
  {
    "name": "LayerCI",
    "constant": "LAYERCI",
    "env": "LAYERCI",
    "pr": "LAYERCI_PULL_REQUEST",
  },
  {
    "name": "Hudson",
    "constant": "HUDSON",
    "env": "HUDSON_URL",
  },
  {
    "name": "Jenkins",
    "constant": "JENKINS",
    "env": ["JENKINS_URL", "BUILD_ID"],
    "pr": { "any": ["ghprbPullId", "CHANGE_ID"] },
  },
  {
    "name": "Magnum CI",
    "constant": "MAGNUM",
    "env": "MAGNUM",
  },
  {
    "name": "Netlify CI",
    "constant": "NETLIFY",
    "env": "NETLIFY",
    "pr": { "env": "PULL_REQUEST", "ne": "false" },
  },
  {
    "name": "Nevercode",
    "constant": "NEVERCODE",
    "env": "NEVERCODE",
    "pr": { "env": "NEVERCODE_PULL_REQUEST", "ne": "false" },
  },
  {
    "name": "Render",
    "constant": "RENDER",
    "env": "RENDER",
    "pr": { "IS_PULL_REQUEST": "true" },
  },
  {
    "name": "Sail CI",
    "constant": "SAIL",
    "env": "SAILCI",
    "pr": "SAIL_PULL_REQUEST_NUMBER",
  },
  {
    "name": "Semaphore",
    "constant": "SEMAPHORE",
    "env": "SEMAPHORE",
    "pr": "PULL_REQUEST_NUMBER",
  },
  {
    "name": "Screwdriver",
    "constant": "SCREWDRIVER",
    "env": "SCREWDRIVER",
    "pr": { "env": "SD_PULL_REQUEST", "ne": "false" },
  },
  {
    "name": "Shippable",
    "constant": "SHIPPABLE",
    "env": "SHIPPABLE",
    "pr": { "IS_PULL_REQUEST": "true" },
  },
  {
    "name": "Solano CI",
    "constant": "SOLANO",
    "env": "TDDIUM",
    "pr": "TDDIUM_PR_ID",
  },
  {
    "name": "Strider CD",
    "constant": "STRIDER",
    "env": "STRIDER",
  },
  {
    "name": "TaskCluster",
    "constant": "TASKCLUSTER",
    "env": ["TASK_ID", "RUN_ID"],
  },
  {
    "name": "TeamCity",
    "constant": "TEAMCITY",
    "env": "TEAMCITY_VERSION",
  },
  {
    "name": "Travis CI",
    "constant": "TRAVIS",
    "env": "TRAVIS",
    "pr": { "env": "TRAVIS_PULL_REQUEST", "ne": "false" },
  },
  {
    "name": "Vercel",
    "constant": "VERCEL",
    "env": "NOW_BUILDER",
  },
  {
    "name": "Visual Studio App Center",
    "constant": "APPCENTER",
    "env": "APPCENTER_BUILD_ID",
  },
];
