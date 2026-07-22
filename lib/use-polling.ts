"use client";

import { useEffect, useState } from "react";

export function usePolling<T>(
  url: string | null,
  intervalMs = 5000,
): { data: T | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    const load = () =>
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [url, intervalMs, tick]);

  return { data, refresh: () => setTick((t) => t + 1) };
}
