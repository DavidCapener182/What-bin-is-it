import type { Metadata, Viewport } from "next";

import { PwaRegistration } from "@/components/pwa-registration";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Council Console | What Bin Is It Tonight?",
    template: "%s | What Bin Council Console",
  },
  description: "Private council operations console for resident waste-service communications.",
  applicationName: "What Bin Council Console",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "What Bin Console",
  },
  icons: {
    icon: "/pwa-icon/192",
    apple: "/pwa-icon/192",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#F2F2F7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
