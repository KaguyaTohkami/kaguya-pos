import type { Metadata } from "next";
import "./globals.css";
import "./pos-overrides.css";

export const metadata: Metadata = {
  title: "POS",
  description: "POS System",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
