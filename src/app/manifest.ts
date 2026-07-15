import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Friendszy",
    short_name: "Friendszy",
    description: "Fais de nouveaux amis autour de tes centres d'intérêt.",
    start_url: "/",
    display: "standalone",
    background_color: "#e8f8f5",
    theme_color: "#1ecfb0",
    lang: "fr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
