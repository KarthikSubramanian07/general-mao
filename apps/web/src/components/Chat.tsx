import { type FormEvent, useEffect, useRef, useState } from "react";
import type { FeedItem } from "../lib/useTable.js";

export function Chat({
  feed,
  disabled,
  onSend,
}: {
  feed: FeedItem[];
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new feed length
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [feed.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  return (
    <section className="chat" aria-label="Table chat">
      <div className="chat__feed" ref={scrollRef}>
        {feed.map((item) => (
          <p key={item.id} className={`chat-line chat-line--${item.kind}`}>
            {item.kind === "chat" && <span className="chat-line__who">{item.name}</span>}
            {item.kind === "general" && <span className="chat-line__who">{item.name}:</span>}
            <span>{item.text}</span>
          </p>
        ))}
      </div>
      <form className="chat__form" onSubmit={submit}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? "Watching in silence" : "Speak, if you dare"}
          maxLength={280}
          disabled={disabled}
          aria-label="Say something to the table"
        />
        <button type="submit" className="btn btn--sm" disabled={disabled || !text.trim()}>
          Say
        </button>
      </form>
    </section>
  );
}
