import { createContext, useContext, type ReactNode } from 'react';

export type UiLanguage = 'ja' | 'en';

const UI_LANGUAGE_STORAGE_KEY = 'webmugen.uiLanguage.v1';

type UiLanguageContextValue = {
  language: UiLanguage;
  text: (english: string, japanese: string) => string;
};

const UiLanguageContext = createContext<UiLanguageContextValue>({
  language: 'en',
  text: (english) => english,
});

export function UiLanguageProvider({ language, children }: { language: UiLanguage; children?: ReactNode }) {
  return (
    <UiLanguageContext.Provider value={{
      language,
      text: (english, japanese) => language === 'ja' ? japanese : english,
    }}>
      {children}
    </UiLanguageContext.Provider>
  );
}

export function useUiLanguage(): UiLanguageContextValue {
  return useContext(UiLanguageContext);
}

export function loadUiLanguage(): UiLanguage {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
  if (stored === 'ja' || stored === 'en') return stored;
  return window.navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function saveUiLanguage(language: UiLanguage): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
}
