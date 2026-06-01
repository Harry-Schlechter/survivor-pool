import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jim Olah Survivor Pool",
  description: "Jim Olah Survivor Pool — pick 'em, last one standing wins.",
};

// Mobile-first: lock the viewport so layouts size to the device width and tap
// zoom doesn't fight the UI.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b3d2e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
