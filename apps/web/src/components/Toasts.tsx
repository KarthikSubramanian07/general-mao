import type { Toast } from "../lib/useTable.js";

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast toast--${t.level}`}
          onClick={() => onDismiss(t.id)}
          title="Dismiss"
        >
          {(t.level === "penalty" || t.level === "verdict") && (
            <span className="toast__seal" aria-hidden="true">
              ✦
            </span>
          )}
          <span className="toast__text">{t.text}</span>
        </button>
      ))}
    </div>
  );
}
