import type { Metadata } from "next";
import { Heebo, Rubik } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-heebo",
  display: "swap",
});

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-rubik",
  display: "swap",
});

const TITLE = "הנחלה · מוצאים את השכונה שמתאימה למשפחה שלכם";
const DESCRIPTION =
  "בחירת שכונה למשפחות, לפי מה שחשוב לכם: מחירי עסקאות, בתי ספר, פארקים, ציון ירוק ובטיחות, ויועץ AI שמכיר את השכונות.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s · הנחלה",
  },
  description: DESCRIPTION,
  applicationName: "הנחלה",
  authors: [{ name: "הנחלה" }],
  keywords: [
    "מודיעין",
    "נדלן",
    "שכונות",
    "הנחלה",
    "Modi'in real estate",
    "neighborhood discovery",
    "Israel housing",
  ],
  openGraph: {
    type: "website",
    locale: "he_IL",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "הנחלה",
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
  themeColor: "#1F7A45",
  width: "device-width",
  initialScale: 1,
  // Lets safe-area-inset-* env vars resolve inside the notch on iOS so the
  // bottom drawer / carousel can pad themselves above the home indicator.
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${rubik.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
