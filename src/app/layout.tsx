import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Geist_Mono, Libre_Franklin, Source_Sans_3 } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { brand } from "@/lib/brand";
import { getUserLocale } from "@/i18n/locale";
import "./globals.css";

// Libre Franklin + Source Sans 3 are the two families UAM actually ships.
// See docs/design-system.md §3.1 for why Montserrat was dropped.
const libreFranklin = Libre_Franklin({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    title: t("appName"),
    description: t("appName"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getUserLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      data-brand={brand}
      suppressHydrationWarning
      className={`${sourceSans.variable} ${libreFranklin.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
