import { useEffect, useId, useRef } from "react";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { languageOptions } from "@/i18n";
import AccountSwitcher from "./AccountSwitcher";
import { AppVersion } from "./AppVersion";
import { Button } from "./Button";
import { Select } from "./Input";

export default function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const user = useQuery(api.auth.loggedInUser);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const languageId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onClose();
        }
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-gray-950/40"
    >
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <h2 id={titleId} className="text-lg font-semibold">
          {t("profileDrawer.title")}
        </h2>
        <Button
          type="button"
          variant="plain"
          size="sm"
          className="h-10 w-10 rounded-full p-0 text-gray-500 hover:bg-gray-100"
          aria-label={t("common.actions.close")}
          onClick={onClose}
        >
          <X size={20} aria-hidden />
        </Button>
      </div>
      <div className="space-y-6 p-5">
        <AccountSwitcher user={user ?? null} expanded />
        <div className="flex items-center justify-between gap-4">
          <label
            htmlFor={languageId}
            className="text-sm font-medium text-gray-700"
          >
            {t("settings.language.label")}
          </label>
          <Select
            id={languageId}
            className="max-w-40"
            value={i18n.resolvedLanguage ?? i18n.language}
            onChange={(event) => void i18n.changeLanguage(event.target.value)}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-4 text-xs text-gray-400">
          <span>English Punch</span>
          <AppVersion />
        </div>
      </div>
    </dialog>
  );
}
