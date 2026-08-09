import type { Metadata } from "next";
import { AppShell } from "./app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "买样前商品机会研究与验证系统",
  description: "Pre-Sample Product Opportunity Research & Validation System",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
