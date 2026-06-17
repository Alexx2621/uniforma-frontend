import { useCallback, useRef, useState } from "react";

export function useSingleFlight<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult> | TResult,
) {
  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);

  const run = useCallback(
    async (...args: TArgs) => {
      if (runningRef.current) return undefined;
      runningRef.current = true;
      setRunning(true);
      try {
        return await action(...args);
      } finally {
        runningRef.current = false;
        setRunning(false);
      }
    },
    [action],
  );

  return { run, running };
}
