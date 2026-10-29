// Facts about the site itself, shared by the React pages, the build-time
// prerender, the edge Markdown responses, and the JSON-LD. One source of truth so
// the HTML a person sees and the Markdown an agent reads never disagree.

export const SITE_URL = "https://general-mao.pages.dev";
export const SITE_NAME = "General Mao";

/** The public game API (Cloudflare Worker). */
export const PUBLIC_API = "https://general-mao-api.karthik-e5e.workers.dev";

export const REPO_URL = "https://github.com/KarthikSubramanian07/general-mao";
export const ISSUES_URL = `${REPO_URL}/issues`;
export const COFFEE_URL = "https://buymeacoffee.com/winnerkarthik";

/**
 * Public contact details. `email` and `address` are deliberately empty until the
 * owner chooses what to publish; every consumer (Contact page, Markdown,
 * Organization JSON-LD) picks them up automatically once they are set.
 */
export interface PostalAddress {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry: string;
}

export const CONTACT: { email: string | null; address: PostalAddress | null } = {
  email: null,
  address: null,
};

/** schema.org Organization for the people behind the game. */
export function organizationJsonLd(): Record<string, unknown> {
  const contactPoint: Record<string, unknown> = {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: ISSUES_URL,
    availableLanguage: "en",
  };
  if (CONTACT.email) contactPoint.email = CONTACT.email;

  const org: Record<string, unknown> = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/og.png`,
    description:
      "General Mao makes a free online version of the card game Mao, refereed by an AI that invents secret rules and never explains them.",
    sameAs: [REPO_URL],
    contactPoint,
  };
  if (CONTACT.address) org.address = { "@type": "PostalAddress", ...CONTACT.address };
  return org;
}
