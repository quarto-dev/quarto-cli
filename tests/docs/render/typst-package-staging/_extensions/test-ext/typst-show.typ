// Import packages from extension's typst/packages/
#import "@preview/hello:0.1.0": greet
#import "@local/confetti:0.1.0": celebrate

// Apply standard article show rule
#show: doc => article(
  $if(title)$
  title: [$title$],
  $endif$
  doc,
)
