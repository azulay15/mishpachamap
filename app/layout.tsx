import type { Metadata } from "next";
import { Heebo, Inter } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-heebo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const TITLE = "MishpachaMap — אתרו את השכונה שמתאימה למשפחה שלכם";
const DESCRIPTION =
  "פלטפורמה לבחירת שכונה במודיעין: עסקאות נדל״ן, בתי ספר, פארקים, GreenScore — וקונסיירז' AI שיודע לדבר על השכונות.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s · MishpachaMap",
  },
  description: DESCRIPTION,
  applicationName: "MishpachaMap",
  authors: [{ name: "MishpachaMap" }],
  keywords: [
    "מודיעין",
    "נדלן",
    "שכונות",
    "MishpachaMap",
    "Modi'in real estate",
    "neighborhood discovery",
    "Israel housing",
  ],
  openGraph: {
    type: "website",
    locale: "he_IL",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "MishpachaMap",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport = {
  themeColor: "#FF6B00",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
