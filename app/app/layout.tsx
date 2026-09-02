import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aardehuizen · When to use your sun",
  description: "A simple widget for the earth houses in Olst: when the roof can run your machines.",
  appleWebApp: {
    capable: true,
    title: "Aardehuizen",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#eef3ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
