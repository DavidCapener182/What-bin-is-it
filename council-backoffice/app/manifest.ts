import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "What Bin Council Console",
    short_name: "What Bin Console",
    description: "Secure council operations for What Bin resident services.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F2F2F7",
    theme_color: "#F2F2F7",
    orientation: "any",
    icons: [
      {
        src: "/pwa-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
