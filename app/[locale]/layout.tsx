import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import {NextIntlClientProvider} from 'next-intl';
import {getMessages, setRequestLocale} from 'next-intl/server';
import {routing} from '@/lib/i18n/routing';
import {notFound} from 'next/navigation';
import {siteUrl} from '@/lib/site-url';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // SANS CETTE BASE, les adresses d'Open Graph et les canoniques restent
  // RELATIVES. Facebook, LinkedIn et les moteurs attendent une adresse
  // absolue : une valeur relative est ignorée, et l'aperçu de partage se
  // rabat sur ce qu'il trouve. La base vient de la même source que le plan de
  // site et les liens de courriel, donc elle suit le domaine sans qu'on ait à
  // y penser le jour du branchement.
  metadataBase: new URL(siteUrl()),
  // Les deux langues se déclarent mutuellement. Sans cela, Google traite la
  // version anglaise comme un doublon de la française plutôt que comme sa
  // traduction, et n'en montre qu'une aux deux publics.
  alternates: {
    languages: { fr: "/fr", en: "/en" },
  },
  title: {
    default: "moncabinetcric — Logiciel de Gestion pour Consultants en Immigration Canadienne CICC",
    template: "%s | moncabinetcric"
  },
  description: "Plateforme SaaS tout-en-un de gestion de cabinet pour consultants réglementés en immigration canadienne (RCIC / CICC) : suivi des dossiers, compte fidéicommis, portail client et automatisation des formulaires IRCC.",
  // ─── LES ICÔNES ──────────────────────────────────────────────────────────
  //
  // `app/favicon.ico` suffirait au navigateur : Next.js le sert seul, à la
  // racine, par convention de fichier. Les tailles sont déclarées en plus
  // parce qu'elles ne servent pas au même endroit — 16 px dans l'onglet,
  // 32 px dans la barre de favoris, 48 px dans un raccourci de bureau. Sans
  // elles, le système redimensionne le .ico et les traits fins de la lettre
  // bavent.
  //
  // `apple` est la seule qui manquait vraiment : sans elle, un iPhone qui
  // ajoute le site à son écran d'accueil fabrique une vignette en
  // photographiant la page.
  icons: {
    icon: [
      { url: "/marque/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/marque/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/marque/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/marque/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/marque/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/marque/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    title: "moncabinetcric — Gestion de Cabinet RCIC / CICC",
    description: "SaaS de gestion réglementaire et financière pour les consultants en immigration canadienne.",
    siteName: "moncabinetcric",
    type: "website",
    // L'APERÇU DE PARTAGE N'AVAIT AUCUNE IMAGE. Le titre et la description
    // étaient déclarés depuis le début, mais un lien partagé sur LinkedIn ou
    // dans une conversation s'affichait en texte nu — le format le moins
    // cliqué qui soit. 1200 × 630, la proportion qu'attendent Facebook,
    // LinkedIn et la plupart des messageries.
    images: [{
      url: "/marque/og-image.png",
      width: 1200,
      height: 630,
      alt: "moncabinetcric — logiciel de gestion pour consultants réglementés en immigration",
    }],
    locale: "fr_CA",
  },
  twitter: {
    card: "summary_large_image",
    title: "moncabinetcric",
    description: "Logiciel de gestion réglementé CICC pour consultants en immigration canadienne.",
    // 1200 × 600 : la proportion propre à X, distincte des 630 d'Open Graph.
    images: ["/marque/twitter-image.png"],
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
