import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Med SaaS — Clinical Operating System",
    template: "%s · Med SaaS",
  },
  description:
    "Med SaaS is a premium clinical operating system for hospitals, specialty groups, and modern practices.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} ${instrument.variable} bg-[#F3F0EA] font-sans text-slate-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
