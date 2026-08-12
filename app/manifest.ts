import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TollyRiddl",
    short_name: "TollyRiddl",
    description: "The daily Tollywood film riddle.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b17",
    theme_color: "#0b0b17",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
