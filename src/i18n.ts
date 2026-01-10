import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  languageLabels,
  languageLocales,
  resources,
  supportedLanguages,
  type SupportedLanguage,
} from "./i18n/resources";

const DEFAULT_LANGUAGE: SupportedLanguage = "en";

const normalizeLanguage = (language?: string | null): SupportedLanguage => {
  if (!language) {
    return DEFAULT_LANGUAGE;
  }
  const base = language.split("-")[0] as SupportedLanguage;
  return supportedLanguages.includes(base) ? base : DEFAULT_LANGUAGE;
};

const getInitialLanguage = (): SupportedLanguage => {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }
  const stored = window.localStorage.getItem("appLanguage");
  const browser = window.navigator.language;
  return normalizeLanguage(stored ?? browser);
};

export const languageOptions = supportedLanguages.map((value) => ({
  value,
  label: languageLabels[value],
}));

export const getLocaleForLanguage = (language?: string | null) =>
  languageLocales[normalizeLanguage(language)];

const initialLanguage = getInitialLanguage();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: supportedLanguages,
  interpolation: {
    escapeValue: false,
  },
});

if (typeof document !== "undefined") {
  document.documentElement.lang = initialLanguage;
}

if (typeof window !== "undefined") {
  i18n.on("languageChanged", (lng) => {
    const normalized = normalizeLanguage(lng);
    window.localStorage.setItem("appLanguage", normalized);
    if (typeof document !== "undefined") {
      document.documentElement.lang = normalized;
    }
  });
}

export default i18n;
