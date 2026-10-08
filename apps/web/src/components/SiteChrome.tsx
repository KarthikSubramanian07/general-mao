import { Link } from "react-router-dom";
import { COFFEE_URL } from "../content/site.js";
import { Wordmark } from "./Seal.js";

/** The brand-register nav, shared by the landing page and the trust pages. */
export function SiteHeader({ onLanding = false }: { onLanding?: boolean }) {
  const anchor = (id: string) => (onLanding ? `#${id}` : `/#${id}`);
  return (
    <header className="landing__nav">
      {onLanding ? (
        <Wordmark />
      ) : (
        <Link to="/" aria-label="General Mao home">
          <Wordmark />
        </Link>
      )}
      <nav className="landing__navlinks">
        <a href={anchor("how")}>How it works</a>
        <a href={anchor("general")}>The General</a>
        <a href={anchor("faq")}>Questions</a>
        <Link className="btn btn--sm btn--primary" to="/play">
          Convene a table
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="landing__footer">
      <div className="landing__footer-inner">
        <Wordmark compact />
        <p className="gm-general">"The only rule I may tell you is this one."</p>
        <nav className="landing__footer-links" aria-label="Site">
          <Link to="/play">Convene a table</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/privacy">Privacy</Link>
          <a href={COFFEE_URL} target="_blank" rel="noreferrer">
            Buy the General a coffee
          </a>
          <span>MIT. Free forever.</span>
        </nav>
      </div>
    </footer>
  );
}
