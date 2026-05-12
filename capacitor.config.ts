import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId:    'au.kemo.mightybananaquest',
  appName:  'MightyBananaQuest',
  webDir:   'dist',

  android: {
    // Keeps the splash screen matching the app's dark background
    backgroundColor: '#14110d',
  },

  // Disables the live-reload server pointer — APK runs from bundled assets
  server: {
    androidScheme: 'https',
  },
}

export default config
