// Build-time prerender entry (see scripts/prerender.mjs). Renders the static
// public pages to HTML so their content exists without JavaScript; the client
// then hydrates the same markup.

import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { App } from "./App.js";
import { allDocs } from "./content/docs.js";
import { organizationJsonLd, SITE_URL } from "./content/site.js";

export interface PrerenderPage {
  /** URL path rendered. */
  path: string;
  /** Output file inside dist/. */
  file: string;
  /** Undefined keeps the template's <title> and description (the home page). */
  title?: string;
  description?: string;
  /** False for pages that must not be indexed (the 404 page). */
  indexable: boolean;
}

export function prerenderPages(): PrerenderPage[] {
  return [
    { path: "/", file: "index.html", indexable: true },
    ...allDocs().map((d) => ({
      path: d.path,
      file: `${d.path.slice(1)}.html`,
      title: d.metaTitle,
      description: d.description,
      indexable: true,
    })),
    {
      path: "/404",
      file: "404.html",
      title: "Not found, General Mao",
      description: "There is no page at this address on General Mao.",
      indexable: false,
    },
  ];
}

export function render(path: string): string {
  return renderToString(
    <StaticRouter location={path}>
      <App />
    </StaticRouter>,
  );
}

export { organizationJsonLd, SITE_URL };
