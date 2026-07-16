import { useEffect, useRef } from "react";

/**
 * Scroll-reveal that enhances an already-visible default. Content is fully
 * visible without JS (the `.reveal` start state only applies once the `js` class
 * is on <html>), and honors prefers-reduced-motion. Each element reveals as it
 * enters the viewport; stagger via a `--reveal-delay` CSS var on the element.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("js");
    const root = ref.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      for (const el of targets) el.classList.add("is-visible");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    for (const el of targets) io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}
