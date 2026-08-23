import type { Metadata } from "next";
import { Suspense } from "react";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { SITE } from "@/lib/site";
import MobileNav from "@/components/MobileNav";
import GlobalTagBar from "@/components/GlobalTagBar";
import GlobalTagSidebar from "@/components/GlobalTagSidebar";
import Footer from "@/components/Footer";
import RouteProgress from "@/components/RouteProgress";
import { AdminChrome, AdminPadding } from "@/components/AdminAware";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: SITE.name,
  description: SITE.description,
  metadataBase: new URL(SITE.url),
  alternates: {
    canonical: SITE.url,
  },
  openGraph: {
    title: SITE.name,
    description: SITE.description,
    type: "website",
    url: SITE.url,
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteUrl = SITE.url.replace(/\/$/, "");
  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@id": `${siteUrl}/#website`,
    "@type": "WebSite",
    name: SITE.name,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: siteUrl,
  };

  return (
    <html lang="ja">
      <body className={`${spaceGrotesk.variable} ${plexMono.variable} antialiased`}>
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <AdminChrome>
          <MobileNav />
          <GlobalTagBar />
          <GlobalTagSidebar />
        </AdminChrome>
        <AdminPadding>{children}</AdminPadding>
        <AdminPadding>
          <Footer />
        </AdminPadding>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </body>
    </html>
  );
}
