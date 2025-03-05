const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// アプリのルートディレクトリを取得（Electronアプリの場合）
const appPath = process.cwd();

// 設定ファイルのパス
const settingsFilePath = path.join(appPath, 'chatvrm-settings.json');

// APIをブラウザ（Renderer Process）に公開
contextBridge.exposeInMainWorld('electronAPI', {
  // 設定ファイルが存在するか確認
  checkSettingsFileExists: () => {
    return fs.existsSync(settingsFilePath);
  },
  
  // 設定ファイルを読み込む
  loadSettingsFile: () => {
    try {
      if (fs.existsSync(settingsFilePath)) {
        const data = fs.readFileSync(settingsFilePath, 'utf8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('設定ファイルの読み込みエラー:', error);
      return null;
    }
  },
  
  // 設定ファイルを保存する
  saveSettingsFile: (settings) => {
    try {
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
      return true;
    } catch (error) {
      console.error('設定ファイルの保存エラー:', error);
      return false;
    }
  }
});
