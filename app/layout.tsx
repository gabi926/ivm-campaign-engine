import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { requireAuth } from "@/app/_lib/auth";
import { PortalHeader } from "@/app/components/PortalHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Revenue Engine — IVM",
  description:
    "Multi-channel direct-response campaign generator. Powered by IVM and Claude.",
};

// Defense-in-depth auth check. The proxy already redirects unauthenticated
// requests, but server components also re-validate here so a misconfigured
// matcher can never leak a page render. requireAuth() calls getUser() which
// hits the auth server (not just the cookie), so spoofed cookies are
// rejected too.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuth();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-100 text-stone-900">
        <PortalHeader email={user.email ?? "(unknown)"} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
