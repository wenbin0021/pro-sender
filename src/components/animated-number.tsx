"use client";

import { useEffect, useState } from "react";

// Counts up from the current display value to `value` over `duration` seconds.
// Self-contained (no animation library) so it's resilient to React 19 strict
// mode's double-invoked effects.
export function AnimatedNumber({
  value,
  format,
  duration = 1.1,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const start = display;
    const startTime = performance.now();
    const ms = Math.max(1, duration * 1000);
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const t = Math.min((performance.now() - startTime) / ms, 1);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(start + (value - start) * eased);
      if (t < 1) requestAnimationFrame(tick);
      else setDisplay(value); // snap to the exact target at the end
    };
    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <>{format ? format(display) : Math.round(display).toLocaleString()}</>;
}
