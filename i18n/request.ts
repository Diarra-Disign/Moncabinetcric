import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  // Les textes légaux vivent dans un catalogue distinct : ce sont de longs
  // documents dont la révision juridique suit son propre cycle, et qui
  // alourdiraient inutilement les catalogues d'interface.
  const [app, legal] = await Promise.all([
    import(`../messages/${locale}.json`),
    import(`../messages/legal.${locale}.json`)
  ]);

  return {
    locale,
    messages: {...app.default, ...legal.default}
  };
});

