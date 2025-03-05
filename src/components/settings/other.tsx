import React from 'react'
import { useTranslation } from 'react-i18next'
import AdvancedSettings from './advancedSettings'
import MessageReceiverSetting from './messageReceiver'
import settingsStore from '@/features/stores/settings'

const Other = () => {
  const { t } = useTranslation()

  // 設定をJSON形式でダウンロードする関数
  const downloadSettings = () => {
    const settings = settingsStore.getState()
    const settingsJSON = JSON.stringify(settings, null, 2)
    
    // Electron環境なら直接ファイル保存、ブラウザ環境ならダウンロード
    if (window.electronAPI) {
      const success = window.electronAPI.saveSettingsFile(settings)
      if (success) {
        alert(t('設定ファイルを保存しました'))
      } else {
        alert(t('設定ファイルの保存に失敗しました'))
      }
    } else {
      // ブラウザ環境ではダウンロードダイアログを表示
      const blob = new Blob([settingsJSON], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'chatvrm-settings.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  // 設定ファイルをアップロードして適用する関数
  const uploadSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target?.result as string)
        settingsStore.setState(settings)
        // 成功メッセージ（アラートで表示）
        alert(t('設定を正常に読み込みました'))
      } catch (error) {
        console.error('設定ファイルの読み込みに失敗しました', error)
        // エラーメッセージ（アラートで表示）
        alert(t('設定ファイルの読み込みに失敗しました'))
      }
    }
    reader.readAsText(file)
  }

  return (
    <>
      <AdvancedSettings />
      <MessageReceiverSetting />
      
      {/* 設定の保存と読み込み */}
      <div className="mt-32">
        <h3 className="text-xl font-bold mb-16">{t('設定の保存と読み込み')}</h3>
        <div className="flex flex-col space-y-16">
          <div>
            <button
              className="py-8 px-16 bg-primary text-white rounded-8 hover:bg-primary-dark"
              onClick={downloadSettings}
            >
              {t('設定をファイルに保存')}
            </button>
            <p className="mt-8 text-sm text-gray-500">
              {t('現在の設定をJSONファイルとして保存します')}
            </p>
          </div>
          
          <div>
            <label className="inline-block py-8 px-16 bg-primary text-white rounded-8 hover:bg-primary-dark cursor-pointer">
              {t('設定ファイルを読み込む')}
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={uploadSettings}
              />
            </label>
            <p className="mt-8 text-sm text-gray-500">
              {t('保存した設定ファイルを読み込んで適用します')}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default Other
