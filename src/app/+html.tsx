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
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F1F4F8" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0D1522" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="What Bin?" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root {
            width: 100%;
            height: 100%;
            min-height: 100%;
          }
          html, body { background: #F7F9FC; }
          #root { background: #F1F4F8; }
          /* Match the compact navigation breakpoint. These headers remain in
             flex flow, so their full padded height also positions the content. */
          @media (max-width: 719px) {
            #resident-screen-header, #today-hero, #today-setup-hero {
              -webkit-backdrop-filter: none !important;
              backdrop-filter: none !important;
            }
            #resident-screen-header, #today-header-inset {
              /* Replace SafeAreaView's inline inset, never add a second one.
                 CSS reserves this space before the provider measures on web. */
              padding-top: calc(env(safe-area-inset-top, 0px) + 12px) !important;
            }
          }
          @supports (height: 100dvh) {
            html, body, #root {
              height: 100dvh;
              min-height: 100dvh;
            }
          }
          @media (display-mode: standalone) {
            html, body, #root {
              height: 100vh;
              min-height: 100vh;
            }
          }
          @supports (height: 100lvh) {
            @media (display-mode: standalone) {
              html, body, #root {
                height: 100lvh;
                min-height: 100lvh;
              }
            }
          }
          @media (prefers-color-scheme: dark) {
            html, body { background: #18263B; }
            #root { background: #0D1522; }
          }
          html { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif; }
          body {
            margin: 0;
            overscroll-behavior-y: none;
            -webkit-font-smoothing: antialiased;
            -webkit-text-size-adjust: 100%;
            text-rendering: optimizeLegibility;
          }
          button, input, textarea, select { font: inherit; }
          input, textarea { caret-color: #245BC5; }
          ::selection { background: #D5E4FF; color: #18263B; }
          [role="button"], [role="tab"], a { -webkit-tap-highlight-color: transparent; }
          @media (hover: hover) {
            [role="button"]:not([aria-disabled="true"]):hover,
            [role="tab"]:hover { filter: brightness(0.96); }
          }
          button:focus-visible,
          input:focus-visible,
          textarea:focus-visible,
          select:focus-visible,
          a:focus-visible,
          [role="button"]:focus-visible,
          [role="tab"]:focus-visible,
          [tabindex]:focus-visible {
            outline: 3px solid #245BC5 !important;
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
            #app-material { backdrop-filter: none !important; background: #F7F9FC !important; }
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
