import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.zentrofit.app"),

  title: {
    default: "ZentroFit",
    template: "%s | ZentroFit",
  },

  description:
    "AI-powered fitness platform for personalized workouts, nutrition guidance and progress tracking.",

  applicationName: "ZentroFit",
  manifest: "/manifest.json",

  keywords: [
    "fitness",
    "AI fitness coach",
    "workout planner",
    "nutrition",
    "meal scanner",
    "ZentroFit",
  ],

  authors: [
    {
      name: "ZentroFit",
    },
  ],

  creator: "ZentroFit",
  publisher: "ZentroFit",

  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ZentroFit",
  },

  icons: {
    icon: [
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.zentrofit.app",
    siteName: "ZentroFit",
    title: "ZentroFit",
    description:
      "AI-powered fitness platform for personalized workouts, nutrition guidance and progress tracking.",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "ZentroFit",
      },
    ],
  },

  twitter: {
    card: "summary",
    title: "ZentroFit",
    description:
      "AI-powered fitness platform for personalized workouts, nutrition guidance and progress tracking.",
    images: ["/icon-512.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: [
    {
      media: "(prefers-color-scheme: dark)",
      color: "#050507",
    },
    {
      media: "(prefers-color-scheme: light)",
      color: "#7c3aed",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="min-h-full bg-[#050507]"
      suppressHydrationWarning
    >
      <body className="min-h-dvh overflow-x-hidden bg-[#050507] text-white antialiased selection:bg-purple-500/30 selection:text-white">
        <div className="relative min-h-dvh">
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 top-0 z-[-1] h-72 bg-gradient-to-b from-purple-950/20 to-transparent"
          />

          {children}
        </div>
      </body>
    </html>
  );
}
