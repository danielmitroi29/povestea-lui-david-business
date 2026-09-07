import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

/**
 * `metadataBase` este necesar pentru ca Next sa poata construi URL-uri absolute
 * (Open Graph, canonical). Valoarea vine dintr-o variabila publica, singura
 * categorie de env care poate ajunge in bundle-ul serializat catre client.
 * Daca lipseste sau e invalida, degradam controlat la `undefined` (Next revine
 * la comportamentul relativ) in loc sa aruncam si sa rupem build-ul.
 */
function resolveMetadataBase(): URL | undefined {
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!rawSiteUrl || rawSiteUrl.trim() === "") {
    return undefined;
  }

  try {
    return new URL(rawSiteUrl.trim());
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `[layout] NEXT_PUBLIC_SITE_URL are o valoare invalida ("${rawSiteUrl}"): ${reason}. ` +
        "Se continua fara metadataBase."
    );
    return undefined;
  }
}

const metadataBase = resolveMetadataBase();

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: {
    default: "Povestea Lui David – Povesti pentru Copii",
    template: "%s | Povestea Lui David",
  },
  description:
    "Genereaza povesti personalizate in limba romana pentru copiii tai",
  applicationName: "Povestea Lui David",
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "Povestea Lui David",
    title: "Povestea Lui David – Povesti pentru Copii",
    description:
      "Genereaza povesti personalizate in limba romana pentru copiii tai",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-black focus:shadow-lg focus:outline focus:outline-2 focus:outline-offset-2"
        >
          Sari la continut
        </a>
        {/*
          Container generic (div, nu <main>) ca sa nu duplicam landmark-ul
          principal daca paginile isi randeaza propriul <main>.
          tabIndex={-1} face tinta skip-link-ului focusabila programatic.
        */}
        <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
