import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en-GB">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F3F4F0" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#08212D" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="What Bin?" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root { min-height: 100%; background: #F3F4F0; }
          html { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif; }
          body {
            margin: 0;
            overscroll-behavior-y: none;
            -webkit-font-smoothing: antialiased;
            -webkit-text-size-adjust: 100%;
            text-rendering: optimizeLegibility;
          }
          button, input, textarea, select { font: inherit; }
          button:focus-visible,
          input:focus-visible,
          textarea:focus-visible,
          select:focus-visible,
          a:focus-visible,
          [role="button"]:focus-visible,
          [role="tab"]:focus-visible,
          [tabindex]:focus-visible {
            outline: 3px solid #087A70 !important;
            outline-offset: 3px !important;
          }
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              scroll-behavior: auto !important;
              transition-duration: 0.01ms !important;
            }
          }
          @media (prefers-reduced-transparency: reduce) {
            #app-material { backdrop-filter: none !important; background: #F9FBF9 !important; }
          }
          @media (prefers-contrast: more) {
            [role="button"], [role="tab"] { border-color: currentColor; }
          }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
