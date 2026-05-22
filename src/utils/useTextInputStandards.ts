import { useEffect } from "react";

const TEXT_INPUT_TYPES = new Set(["", "text", "search"]);

const isEditableTextTarget = (target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement => {
  if (target instanceof HTMLTextAreaElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return TEXT_INPUT_TYPES.has(`${target.type || "text"}`.toLowerCase());
};

const enableTextAssistance = (element: HTMLInputElement | HTMLTextAreaElement) => {
  if (element.dataset.spellcheck === "false" || element.closest("[data-spellcheck='false']")) return;
  element.spellcheck = true;
  element.autocapitalize = "characters";
  element.setAttribute("lang", "es-GT");
};

export const useTextInputStandards = () => {
  useEffect(() => {
    document.documentElement.lang = "es-GT";

    const handleInput = (event: Event) => {
      if ((event as InputEvent).isComposing) return;
      if (!isEditableTextTarget(event.target)) return;
      enableTextAssistance(event.target);
    };

    const handleFocus = (event: FocusEvent) => {
      if (!isEditableTextTarget(event.target)) return;
      enableTextAssistance(event.target);
    };

    document.addEventListener("input", handleInput, true);
    document.addEventListener("focusin", handleFocus, true);

    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((element) => {
      if (isEditableTextTarget(element)) enableTextAssistance(element);
    });

    return () => {
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("focusin", handleFocus, true);
    };
  }, []);
};
