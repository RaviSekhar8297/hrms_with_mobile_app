import type { Metadata } from "next";
import "./globals.css";
import FetchPatcher from "./FetchPatcher";

export const metadata: Metadata = {
  title: "HRMS Portal",
  description: "Enterprise HR Management System Console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <FetchPatcher />
        {children}
      </body>
    </html>
  );
}

