import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResponse } from "../lib/types";

export function useLookup<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const current = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  const run = useCallback(
    async (url: string) => {
      current.current?.abort();
      const ctrl = new AbortController();
      current.current = ctrl;
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const res = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
        const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
        if (!body) throw new Error("Server ngasih respons yang aneh, coba lagi.");
        if (!body.ok) throw new Error(body.error);
        setData(body.data);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
      } finally {
        if (current.current === ctrl) setLoading(false);
      }
    },
    [endpoint],
  );

  return { data, error, loading, elapsed, run };
}
