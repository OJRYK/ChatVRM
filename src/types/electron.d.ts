interface ElectronAPI {
  checkSettingsFileExists: () => boolean;
  loadSettingsFile: () => any;
  saveSettingsFile: (settings: any) => boolean;
}

interface Window {
  electronAPI?: ElectronAPI;
}
