// Post-build step: turn the Vite SPA into prerendered static pages.
//
//   dist/index.html            the landing page, fully rendered (hydrates on load)
//   dist/{about,contact,privacy}.html
//   dist/404.html              served by Pages with a real 404 status
//   dist/app.html              the untouched shell for /play, /t/:code, /watch/:code
//
// Run after `vite build` and `vite build --ssr src/entry-server.tsx --outDir dist-ssr`.

import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = `${root}dist/`;
const ssrDir = `${root}dist-ssr/`;

const { render, prerenderPages, organizationJsonLd, SITE_URL } = await import(
  `${ssrDir}entry-server.js`
);

const ROOT_RE = /<div id="root">[\s\S]*?<\/noscript>\s*<\/div>/;

const escapeAttr = (s) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`prerender: template is missing <meta ${attr}="${key}">`);
  return html.replace(re, `$1${escapeAttr(value)}$2`);
}

function withHead(html, page) {
  const org = JSON.stringify({ "@context": "https://schema.org", ...organizationJsonLd() });
  let out = html.replace(
    "</head>",
    `  <script type="application/ld+json">${org}</script>\n  </head>`,
  );
  if (!page) return out;

  const mdHref = page.path === "/" ? "/index.md" : `${page.path}.md`;
  if (page.indexable) {
    out = out.replace(
      "</head>",
      `  <link rel="alternate" type="text/markdown" href="${mdHref}" />\n  </head>`,
    );
  }
  if (page.title) {
    const url = `${SITE_URL}${page.path === "/" ? "/" : page.path}`;
    out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeText(page.title)}</title>`);
    out = setMeta(out, "name", "description", page.description);
    out = setMeta(out, "property", "og:title", page.title);
    out = setMeta(out, "property", "og:description", page.description);
    out = setMeta(out, "property", "og:url", url);
    out = setMeta(out, "name", "twitter:title", page.title);
    out = setMeta(out, "name", "twitter:description", page.description);
    out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  }
  if (!page.indexable) {
    out = out.replace(/\s*<link rel="canonical"[^>]*>/, "");
    out = setMeta(out, "name", "robots", "noindex,follow");
  }
  return out;
}

const template = await readFile(`${dist}index.html`, "utf8");
if (!ROOT_RE.test(template)) throw new Error("prerender: could not find #root in dist/index.html");

await writeFile(`${dist}app.html`, withHead(template, null));

for (const page of prerenderPages()) {
  const body = render(page.path);
  const html = withHead(template, page).replace(
    ROOT_RE,
    `<div id="root" data-prerendered>${body}</div>`,
  );
  await writeFile(`${dist}${page.file}`, html);
  console.log(`prerendered ${page.path.padEnd(9)} -> dist/${page.file} (${body.length} bytes)`);
}

await rm(ssrDir, { recursive: true, force: true });
