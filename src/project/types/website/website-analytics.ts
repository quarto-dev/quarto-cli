/*
 * website-analytics.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { Document } from "../../../core/deno-dom.ts";
import { join } from "path/mod.ts";
import { kLang, kTitle } from "../../../config/constants.ts";
import { Format, Metadata } from "../../../config/types.ts";
import { projectTypeResourcePath } from "../../../core/resources.ts";
import { TempContext } from "../../../core/temp.ts";
import { ProjectContext } from "../../types.ts";
import { kWebsite } from "./website-constants.ts";
import {
  kHtmlEmptyPostProcessResult,
} from "../../../command/render/constants.ts";
import { HtmlPostProcessResult } from "../../../command/render/types.ts";
import { kLanguage } from "./listing/website-listing-shared.ts";

// tracking id for google analytics
// GA3 calls this 'tracking id'
// GA4 calls this 'measurement id'
export const kGoogleAnalytics = "google-analytics";
const kTrackingId = "tracking-id";
const kStorage = "storage";
const kAnonymizeIp = "anonymize-ip";
const kVersion = "version";

// Cookie consent properties
export const kCookieConsent = "cookie-consent";
const kCookieConsentType = "type";
const kCookieConsentStyle = "style";
const kCookieConsentPalette = "palette";
const kCookieConsentPolicyUrl = "policy-url";
const kCookiePrefsText = "prefs-text";

interface GaConfiguration {
  trackingId: string;
  storage: string;
  anonymizeIp: boolean;
  consent: boolean;
  version: number;
}

export type ConsentLevel =
  | "strictly-necessary"
  | "functionality"
  | "tracking"
  | "targeting";

interface CookieConsentConfiguration {
  siteName: string;
  type: string;
  style: string;
  palette: string;
  policyUrl?: string;
  language?: string;
}

export function scriptTagWithConsent(
  consentRequired: boolean,
  consentlevel: ConsentLevel,
  contents: string,
  src?: string,
) {
  const srcAttr = src ? ` src="${src}"` : "";
  if (consentRequired) {
    return `
<script type="text/plain" cookie-consent="${consentlevel}"${srcAttr}>
${contents}
</script>`;
  } else {
    return `
<script type="text/javascript"${srcAttr}>
${contents}
</script>`;
  }
}

// Generate the script to inject into the head for Google Analytics
export function websiteAnalyticsScriptFile(
  project: ProjectContext,
  temp: TempContext,
) {
  // Find the ga tag
  const siteMeta = project.config?.[kWebsite] as Metadata;

  // The google analytics metadata (either from the page or the site)
  // Deal with page and site options
  let gaConfig: GaConfiguration | undefined = undefined;

  if (siteMeta) {
    const siteGa = siteMeta[kGoogleAnalytics];
    if (typeof (siteGa) === "object") {
      const siteGaMeta = siteGa as Metadata;
      // Merge the site and page options and then layer over defaults
      const trackingId = siteGaMeta[kTrackingId] as string;
      const storage = siteGaMeta[kStorage] as string;
      const anonymizedIp = siteGaMeta[kAnonymizeIp] as boolean;
      const version = siteGaMeta[kVersion] as number;
      gaConfig = googleAnalyticsConfig(
        project,
        trackingId,
        storage,
        anonymizedIp,
        version,
      );
    } else if (siteGa && typeof (siteGa) === "string") {
      gaConfig = googleAnalyticsConfig(project, siteGa as string);
    }
  }

  // Generate the actual GA dependencies
  if (gaConfig) {
    const script = analyticsScript(gaConfig);
    if (script) {
      return scriptFile(script, temp);
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

// Generate the dependencies for cookie consent
// see: https://www.cookieconsent.com
export function cookieConsentDependencies(
  project: ProjectContext,
  format: Format,
  temp: TempContext,
) {
  const siteMeta = project.config?.[kWebsite] as Metadata;
  if (siteMeta) {
    // The site title
    const title = siteMeta[kTitle] as string || "";

    let configuration: CookieConsentConfiguration | undefined = undefined;
    let changePrefsText: string | undefined = undefined;
    const consent = siteMeta[kCookieConsent];
    if (typeof (consent) === "object") {
      const cookieMeta = consent as Metadata;
      configuration = cookieConsentConfiguration(
        title,
        cookieMeta[kCookieConsentType] as string,
        cookieMeta[kCookieConsentStyle] as string,
        cookieMeta[kCookieConsentPalette] as string,
        cookieMeta[kCookieConsentPolicyUrl] as string | undefined,
        cookieMeta[kLanguage] as string | undefined ||
          format.metadata[kLang] as string | undefined,
      );
      changePrefsText = cookieMeta[kCookiePrefsText] as string;
    } else if (consent) {
      // treat consent as a boolean
      configuration = cookieConsentConfiguration(
        title,
        undefined,
        undefined,
        undefined,
        undefined,
        format.metadata[kLang] as string | undefined,
      );
    }

    if (configuration) {
      // Resources
      const consentResourcesDir = join(
        projectTypeResourcePath("website"),
        "cookie-consent",
      );
      const name = "cookie-consent.js";
      const path = join(consentResourcesDir, name);
      const cssName = "cookie-consent.css";
      const cssPath = join(consentResourcesDir, cssName);

      // The dependency and script to inject
      return {
        scriptFile: scriptFile(
          cookieConsentScript(configuration),
          temp,
        ),
        dependency: {
          name: "cookie-consent",
          scripts: [{
            name,
            path,
          }],
          stylesheets: [{
            name: cssName,
            path: cssPath,
          }],
        },
        htmlPostProcessor: (doc: Document): Promise<HtmlPostProcessResult> => {
          const anchorId = "open_preferences_center";
          // See if there is already a prefs link - if there isn't,
          // inject one
          const prefsAnchor = doc.getElementById(anchorId);
          if (!prefsAnchor) {
            const footer = doc.querySelector(
              "div.nav-footer .nav-footer-center",
            );
            if (footer) {
              // The anchor
              const anchor = doc.createElement("a");
              anchor.setAttribute("href", "#");
              anchor.setAttribute("id", anchorId);
              anchor.innerHTML = changePrefsText ||
                "Cookie Preferences";

              // A div to hold it
              const anchorContainer = doc.createElement("div");
              anchorContainer.setAttribute("class", "cookie-consent-footer");
              anchorContainer.appendChild(anchor);

              // Add it to the footer
              footer.appendChild(anchorContainer);
            }
          }
          return Promise.resolve(kHtmlEmptyPostProcessResult);
        },
      };
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

// Whether or not cookie consent is enabled
export function cookieConsentEnabled(project: ProjectContext) {
  const siteMeta = project.config?.[kWebsite] as Metadata;
  if (siteMeta) {
    return !!siteMeta[kCookieConsent];
  } else {
    return false;
  }
}

// Provides a configuration with appropriate default values
function cookieConsentConfiguration(
  _siteName: string,
  type?: string,
  style?: string,
  palette?: string,
  policyUrl?: string,
  language?: string,
): CookieConsentConfiguration {
  return {
    siteName: "",
    type: type || "implied",
    style: style || "simple",
    palette: palette || "light",
    policyUrl,
    language,
  };
}

// Provides a configuration with appropriate default values
function googleAnalyticsConfig(
  project: ProjectContext,
  trackingId: string,
  storage?: string,
  anoymizeIp?: boolean,
  version?: number,
) {
  return {
    trackingId,
    consent: cookieConsentEnabled(project),
    storage: storage || "cookies",
    anonymizeIp: anoymizeIp === undefined ? true : !!anoymizeIp,
    version: version || (trackingId.startsWith("UA-") ? 3 : 4),
  };
}

// Gets the GA script for a given configuration
function analyticsScript(
  config: GaConfiguration,
) {
  if (config.version === 3) {
    return ga3Script(config);
  } else if (config.version === 4) {
    return ga4Script(config);
  } else {
    return undefined;
  }
}

function ga3Script(
  config: GaConfiguration,
) {
  const scripts: string[] = [];

  scripts.push(`
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');`);

  if (config.storage === "none") {
    scripts.push(
      `ga('create', '${config.trackingId}', { 'storage': 'none' });`,
    );
  } else {
    scripts.push(`ga('create', '${config.trackingId}', 'auto');`);
  }

  scripts.push(`
ga('send', {
  hitType: 'pageview',
  'anonymizeIp': ${config.anonymizeIp},
});`);

  return scriptTagWithConsent(
    !!config.consent,
    "tracking",
    scripts.join("\n"),
  );
}

function ga4Script(
  config: GaConfiguration,
) {
  const scripts = [];

  scripts.push(`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());`);

  if (config.storage === "none") {
    scripts.push(` 
  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'analytics_storage': 'denied'
  });`);
  }
  scripts.push(
    `gtag('config', '${config.trackingId}', { 'anonymize_ip': ${config.anonymizeIp}});`,
  );

  return [
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${config.trackingId}"></script>`,
    scriptTagWithConsent(
      !!config.consent,
      "tracking",
      scripts.join("\n"),
    ),
  ].join("\n");
}

function cookieConsentScript(
  config: CookieConsentConfiguration,
) {
  const consentLevels = (config.type === "implied")
    ? `["strictly-necessary","functionality","tracking","targeting"]`
    : `["strictly-necessary"]`;

  const privacyJs = config.policyUrl !== undefined
    ? `,\n"website_privacy_policy_url":"${config.policyUrl}"`
    : "";

  const language = config.language !== undefined
    ? `,\n"language":"${config.language}"`
    : "";

  return `
<script type="text/javascript" charset="UTF-8">
document.addEventListener('DOMContentLoaded', function () {
cookieconsent.run({
  "notice_banner_type":"${config.style}",
  "consent_type":"${config.type}",
  "palette":"${config.palette === "dark" ? "dark" : "light"}",
  "language":"en",
  "page_load_consent_levels":${consentLevels},
  "notice_banner_reject_button_hide":false,
  "preferences_center_close_button_hide":false,
  "website_name":"${config.siteName}"${privacyJs}
  ${language}
  });
});
</script> 
  `;
}

function scriptFile(script: string, temp: TempContext) {
  const gaScriptFile = temp.createFile({ suffix: "-lytics.js" });
  Deno.writeTextFileSync(gaScriptFile, script);
  return gaScriptFile;
}
