import { Link } from "react-router-dom";
import { Seal } from "../components/Seal.js";

export function NotFound() {
  return (
    <main className="notfound">
      <Seal size={56} tone="penalty" />
      <h1 className="gm-general">No such table on the docket.</h1>
      <p style={{ color: "var(--gm-text-2)", maxWidth: "40ch" }}>
        The code you followed leads nowhere the General recognizes. Codes are six characters, and
        tables do not last forever.
      </p>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <Link className="btn btn--primary" to="/play">
          Convene a table
        </Link>
        <Link className="btn btn--ghost" to="/">
          Back to the front
        </Link>
      </div>
    </main>
  );
}
