import { useEffect } from "react";

export function useBeforeUnload(
  shouldBlock: boolean,
) {
  useEffect(() => {
    if (!shouldBlock) {
      return;
    }

    const handleBeforeUnload = (
      event: BeforeUnloadEvent,
    ) => {
      event.preventDefault();

      event.returnValue = "";
    };

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload,
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload,
      );
    };
  }, [shouldBlock]);
}