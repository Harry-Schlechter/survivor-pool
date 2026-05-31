import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Survivor Pool",
  description: "NFL survivor pool — pick 'em, last one standing wins.",
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
