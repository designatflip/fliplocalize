"use client";

import { useCallback, useEffect, useRef, type TextareaHTMLAttributes } from "react";

export default function AutoGrowTextarea({ onInput, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  return (
    <textarea
      ref={ref}
      {...props}
      className={`resize-none overflow-hidden ${className}`}
      onInput={(e) => {
        resize();
        onInput?.(e);
      }}
    />
  );
}
