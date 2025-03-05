import '@charcoal-ui/icons'
import type { AppProps } from 'next/app'
import React, { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'

import { isLanguageSupported } from '@/features/constants/settings'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import '@/styles/globals.css'
import migrateStore from '@/utils/migrateStore'
import i18n from '../lib/i18n'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Electron APIを使用して設定ファイルを読み込む
    const loadSettingsFromFile = async () => {
      if (window.electronAPI && window.electronAPI.checkSettingsFileExists()) {
        try {
          const settings = window.electronAPI.loadSettingsFile();
          if (settings) {
            // 読み込んだ設定を適用
            settingsStore.setState(settings);
            console.log('設定ファイルを読み込みました');
          }
        } catch (error) {
          console.error('設定ファイルの読み込みに失敗しました:', error);
        }
      }
    };

    // 初期化処理
    const initializeApp = () => {
      const hs = homeStore.getState();
      const ss = settingsStore.getState();

      // まず設定ファイルの読み込みを試みる
      loadSettingsFromFile();

      if (hs.userOnboarded) {
        i18n.changeLanguage(ss.selectLanguage);
        return;
      }

      migrateStore();

      const browserLanguage = navigator.language;
      const languageCode = browserLanguage.match(/^zh/i)
        ? 'zh'
        : browserLanguage.split('-')[0].toLowerCase();

      let language = ss.selectLanguage;
      if (!language) {
        language = isLanguageSupported(languageCode) ? languageCode : 'ja';
      }
      i18n.changeLanguage(language);
      settingsStore.setState({ selectLanguage: language });

      homeStore.setState({ userOnboarded: true });
    };

    initializeApp();
  }, []);

  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  )
}
