import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Curriculum Integration Dashboard",
  description:
    "Interactive dashboard for Medical School Curriculum Integration Committee",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-western-bg">{children}</body>
    </html>
  );
}
