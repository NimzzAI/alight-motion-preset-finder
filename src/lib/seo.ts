import { siteConfig as site } from "../config/site";

export const absolute = (path: string) => new URL(path, site.url).href;

type PageSeo = { title: string; description: string; path: string };

export function pageHead({ title, description, path }: PageSeo) {
  const fullTitle = `${title} — ${site.name}`;
  const url = absolute(path);
  const image = absolute(site.images.og);

  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { name: "keywords", content: site.keywords.join(", ") },
      { name: "author", content: site.author },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: site.name },
      { property: "og:locale", content: site.locale },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: String(site.images.ogWidth) },
      { property: "og:image:height", content: String(site.images.ogHeight) },
      { property: "og:image:alt", content: site.images.ogAlt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: site.images.ogAlt },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export const structuredData = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: site.name,
  url: site.url,
  description: site.description,
  inLanguage: site.lang,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  image: absolute(site.images.og),
  author: { "@type": "Person", name: site.author },
  offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
});
