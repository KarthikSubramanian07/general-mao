import { Fragment, useEffect } from "react";
import { SiteFooter, SiteHeader } from "../components/SiteChrome.js";
import type { Doc, Inline } from "../content/docs.js";
import { SITE_URL } from "../content/site.js";

/** A trust page (/about, /contact, /privacy) rendered from structured content. */
export function DocPage({ doc }: { doc: Doc }) {
  useEffect(() => {
    document.title = doc.metaTitle;
  }, [doc.metaTitle]);

  return (
    <div className="landing">
      <SiteHeader />
      <main className="doc">
        <p className="gm-label">{doc.eyebrow}</p>
        <h1 className="doc__title gm-general">{doc.title}</h1>
        <p className="doc__lede">
          <Inlines parts={doc.intro} />
        </p>
        {doc.sections.map((s) => (
          <section key={s.heading} className="doc__section">
            <h2 className="gm-general">{s.heading}</h2>
            {s.blocks.map((b, i) =>
              "p" in b ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
                <p key={i}>
                  <Inlines parts={b.p} />
                </p>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
                <ul key={i}>
                  {b.list.map((row, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
                    <li key={j}>
                      <Inlines parts={row} />
                    </li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}

function Inlines({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
          <Fragment key={i}>{p}</Fragment>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
          <a key={i} href={p.href.startsWith(SITE_URL) ? p.href.slice(SITE_URL.length) : p.href}>
            {p.text}
          </a>
        ),
      )}
    </>
  );
}
