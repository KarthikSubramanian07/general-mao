/** Skip to the main landmark. Visible only on keyboard focus. */
export function SkipLink({ href = "#main" }: { href?: string }) {
  return (
    <a className="skip-link" href={href}>
      Skip to main content
    </a>
  );
}
