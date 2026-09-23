import type { Metadata } from "next";
import { Cedarville_Cursive, Courier_Prime } from "next/font/google";
import "./globals.css";

const courierPrime = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-courier-prime",
});

const hand = Cedarville_Cursive({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-hand-face",
});

export const metadata: Metadata = {
  title: "Wikognito",
  description: "Guess words to reveal a redacted Wikipedia article",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${courierPrime.variable} ${hand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
