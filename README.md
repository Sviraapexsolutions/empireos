# EmpireOS

Executive personal execution, multi-venture project management, habit tracking and AI accountability, for Sundaram Mahadeo Group.

- **Web app (iPhone / desktop):** https://sviraapexsolutions.github.io/empireos/
- **Android APK:** https://github.com/Sviraapexsolutions/empireos/releases/latest/download/EmpireOS.apk

## How it works

| Piece | Where |
|---|---|
| Data (tasks, ventures, habits, files metadata) | Firebase Auth + Firestore (`firebase-applet-config.json`) |
| Web hosting | GitHub Pages, deployed by `.github/workflows/deploy.yml` on every push to `main` |
| Android app | Capacitor wrapper that loads the live web app; built, signed and published to GitHub Releases by the same workflow |
| AI coach | Called directly from the app with an API key you enter in **Settings → AI Accountability Coach** (stored on that device only) |
| File attachments | Stored on the device that uploaded them (IndexedDB) |

## Install

- **iPhone:** open the web app link in Chrome or Safari → Share → **Add to Home Screen**.
- **Android:** download the APK link above, open it, allow "Install unknown apps" if asked.

## Local development

```bash
npm install
npm run dev     # http://localhost:3000
```

## One-time setup notes

- Firebase Console → Authentication → Settings → **Authorized domains**: add `sviraapexsolutions.github.io` (needed for Google sign-in on the web).
- Repo secrets `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` sign the APK so updates install over the old version. Keep a backup of the keystore — losing it means users must uninstall to update.
