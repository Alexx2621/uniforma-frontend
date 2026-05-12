import { useEffect } from "react";

const TEXT_INPUT_TYPES = new Set(["", "text", "search"]);

const isEditableTextTarget = (target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement => {
  if (target instanceof HTMLTextAreaElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return TEXT_INPUT_TYPES.has(`${target.type || "text"}`.toLowerCase());
};

const shouldSkipUppercase = (element: HTMLInputElement | HTMLTextAreaElement) =>
  element.readOnly ||
  element.disabled ||
  element.dataset.uppercase === "false" ||
  element.closest("[data-uppercase='false']");

const enableTextAssistance = (element: HTMLInputElement | HTMLTextAreaElement) => {
  if (element.dataset.spellcheck === "false" || element.closest("[data-spellcheck='false']")) return;
  element.spellcheck = true;
  element.autocapitalize = "characters";
  element.setAttribute("lang", "es-GT");
};

const uppercaseElementValue = (element: HTMLInputElement | HTMLTextAreaElement) => {
  if (shouldSkipUppercase(element)) return;

  const value = element.value;
  const upperValue = value.toLocaleUpperCase("es-GT");
  if (value === upperValue) return;

  const selectionStart = element.selectionStart;
  const selectionEnd = element.selectionEnd;
  element.value = upperValue;

  if (selectionStart !== null && selectionEnd !== null) {
    try {
      element.setSelectionRange(selectionStart, selectionEnd);
    } catch {
      // Some input implementations do not allow selection ranges.
    }
  }
};

export const useTextInputStandards = () => {
  useEffect(() => {
    document.documentElement.lang = "es-GT";

    const handleInput = (event: Event) => {
      if ((event as InputEvent).isComposing) return;
      if (!isEditableTextTarget(event.target)) return;
      enableTextAssistance(event.target);
      uppercaseElementValue(event.target);
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
