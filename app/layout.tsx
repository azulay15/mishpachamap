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

export const metadata: Metadata = {
  title: "MishpachaMap — אתרו את השכונה שמתאימה למשפחה שלכם",
  description:
    "פלטפורמה לבחירת שכונה במודיעין: עסקאות נדל״ן, בתי ספר, פארקים, GreenScore — וקונסיירז' AI שיודע לדבר על השכונות.",
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
