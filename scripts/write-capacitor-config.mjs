// Writes capacitor.config.json for the Android wrapper.
// Usage: CAP_SERVER_URL=https://user.github.io/empireos/ node scripts/write-capacitor-config.mjs
import { writeFileSync } from 'node:fs';

const serverUrl = process.env.CAP_SERVER_URL;
if (!serverUrl) {
  console.error('CAP_SERVER_URL is required');
  process.exit(1);
}
const host = new URL(serverUrl).host;

const config = {
  appId: 'com.smgroup.empireos',
  appName: 'EmpireOS',
  webDir: 'dist',
  server: {
    // The APK loads the live web app, so web updates reach Android instantly.
    url: serverUrl,
    cleartext: false,
    allowNavigation: [host, '*.firebaseapp.com', '*.googleapis.com'],
  },
  android: {
    appendUserAgent: 'EmpireOSAndroid',
    backgroundColor: '#F7F8FA',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_empireos',
      iconColor: '#C8902E',
    },
  },
};

writeFileSync('capacitor.config.json', JSON.stringify(config, null, 2) + '\n');
console.log('capacitor.config.json written for', serverUrl);
