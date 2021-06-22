/*
* website-analytics.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Format } from "../../../config/format.ts";
import { Metadata } from "../../../config/metadata.ts";
import { sessionTempFile } from "../../../core/temp.ts";
import { kSite } from "./website-config.ts";
/*

<!-- Google Analytics -->
`<script>
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-XXXXX-Y', 'auto');
ga('send', {
  hitType: 'pageview',
  page: location.pathname,
  'anonymizeIp': true
});
</script>`
<!-- End Google Analytics -->

google-analytics: UA-xxxx (v3)
                  G-xxxxx (v4)

google-analytics:
  version: 3 | 4
  tracking-id: <>
  anonymize-ip: true | false

*/

const kGoogleAnalytics = "google-analytics";

// explicitly set version
const kVersion = "version";

// tracking id for google analytics
// GA3 calls this 'tracking id'
// GA4 calls this 'measurement id'
const kTrackingId = "tracking-id";

// GA3 supports anonymize ip as a setting
const kAnonymizeId = "anonymize-ip";

export function websiteAnalyticsExtras(format: Format) {
  // Find the ga tag
  const siteMeta = format.metadata[kSite] as Metadata;

  let gaMeta = format.metadata[kGoogleAnalytics];
  if (gaMeta === undefined && siteMeta && siteMeta[kGoogleAnalytics]) {
    gaMeta = siteMeta[kGoogleAnalytics];
  }

  if (gaMeta) {
    if (typeof (gaMeta) === "string") {
      const script = analyticsScript(gaMeta);
      if (script) {
        return scriptFile(script);
      } else {
        return undefined;
      }
    } else if (typeof (gaMeta) === "object") {
      const metadata = gaMeta as Record<string, unknown>;
      const version = metadata[kVersion] as number;
      const trackingId = metadata[kTrackingId] as string;
      const anonymize = !!metadata[kAnonymizeId];
      const script = analyticsScript(trackingId, version, anonymize);
      if (script) {
        return scriptFile(script);
      } else {
        return undefined;
      }
    }
  } else {
    return undefined;
  }
}

function scriptFile(script: string) {
  const gaScriptFile = sessionTempFile({ suffix: ".js" });
  Deno.writeTextFileSync(gaScriptFile, script);
  return gaScriptFile;
}

function analyticsScript(id: string, version?: number, anonymize?: boolean) {
  if ((version && version === 3) || id.startsWith("UA-")) {
    return ga3Script(id, anonymize);
  } else if ((version && version === 4) || id.startsWith("G-")) {
    return ga4Script(id, anonymize);
  } else {
    return undefined;
  }
}

function ga3Script(trackingId: string, anonymize = true) {
  return `
<script>
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

ga('create', '${trackingId}', 'auto');
ga('send', {
  hitType: 'pageview',
  'anonymizeIp': ${anonymize},
});
</script>`;
}

function ga4Script(analyticsId: string, anonymize = true) {
  return `
<script async src="https://www.googletagmanager.com/gtag/js?id=${analyticsId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${analyticsId}', { 'anonymize_ip': ${anonymize} });
</script>
`;
}
