import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aardehuizen",
    short_name: "Aardehuizen",
    description: "When to use your sun — a simple widget for the earth houses in Olst.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef3ee",
    theme_color: "#eef3ee",
    orientation: "portrait",
  };
}
