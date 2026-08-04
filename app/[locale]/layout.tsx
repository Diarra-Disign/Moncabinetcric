import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import {NextIntlClientProvider} from 'next-intl';
import {getMessages, setRequestLocale} from 'next-intl/server';
import {routing} from '@/lib/i18n/routing';
import {notFound} from 'next/navigation';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "moncabinetcric — Logiciel de Gestion pour Consultants en Immigration Canadienne CICC",
    template: "%s | moncabinetcric"
  },
  description: "Plateforme SaaS tout-en-un de gestion de cabinet pour consultants réglementés en immigration canadienne (RCIC / CICC) : suivi des dossiers, compte fidéicommis, portail client et automatisation des formulaires IRCC.",
  openGraph: {
    title: "moncabinetcric — Gestion de Cabinet RCIC / CICC",
    description: "SaaS de gestion réglementaire et financière pour les consultants en immigration canadienne.",
    siteName: "moncabinetcric",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "moncabinetcric",
    description: "Logiciel de gestion réglementé CICC pour consultants en immigration canadienne."
  }
};

export function generateStaticParams() {
  return routing.locales.map((locale: string) => ({locale}));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const {locale} = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }
  
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
