// sitemap.xml: <urlset> and <sitemapindex>, parsed with a tolerant regex
// (sitemaps are machine-generated and flat; an XML parser would be a new
// dependency for no gain). Gzipped sitemaps are not supported.

export interface SitemapDoc {
  /** Page URLs (<urlset><url><loc>). */
  pages: string[];
  /** Child sitemaps (<sitemapindex><sitemap><loc>). */
  sitemaps: string[];
}

export function parseSitemap(xml: string): SitemapDoc {
  const locs = (block: string) =>
    Array.from(block.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi), (m) => unescapeXml(m[1]!));
  const pages: string[] = [];
  const sitemaps: string[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) pages.push(...locs(m[1]!));
  for (const m of xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/gi)) sitemaps.push(...locs(m[1]!));
  return { pages, sitemaps };
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
