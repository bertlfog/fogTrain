# TrainingApp

Eine offlinefähige Trainings-App als installierbare PWA. Übungen, Pläne,
Workouts und Bilder werden ausschließlich lokal im Browser gespeichert.

## Lokal starten

Voraussetzung: Node.js 22.12 oder neuer und npm.

```sh
npm ci
npm run dev
```

Vite zeigt nach dem Start die lokale Adresse im Terminal an.

## Prüf- und Build-Skripte

```sh
npm run typecheck    # TypeScript-Prüfung
npm run lint         # ESLint
npm run format:check # Formatierung prüfen
npm test             # Vitest-Unit-Tests
npm run build        # Produktions-Build nach dist/
npm run check:bundle # gzip-Größe des initialen JavaScript prüfen
npm run e2e          # Playwright gegen den Produktions-Build
```

`npm run e2e` startet selbst einen Build und einen lokalen Preview-Server.

## Backup und Daten

Die App speichert Daten in der IndexedDB dieses Browsers. Es gibt keine
Cloud-Synchronisierung und derzeit keinen Backup-Import. Unter **Einstellungen
→ Daten exportieren** kann jederzeit ein JSON-Backup mit Übungen, Bildern,
Plänen und Workouts erstellt werden. Backups regelmäßig außerhalb des Geräts
sichern, da Browserdaten bei Geräteverlust oder manuellem Löschen verloren gehen
können.

## Auf Android installieren

1. Die bereitgestellte HTTPS-App in Chrome öffnen und einmal laden.
2. Im Chrome-Menü **App installieren** oder **Zum Startbildschirm
   hinzufügen** wählen.
3. Die installierte App einmal online öffnen. Danach sind die App-Dateien für
   den Offline-Start vorgeladen.
4. Unter **Einstellungen** den angezeigten Speicherstatus prüfen und regelmäßig
   ein Backup exportieren.

Der Offline-Betrieb und die Installation sollten vor der produktiven Nutzung auf
dem tatsächlichen Android-Gerät geprüft werden. Der Browser kann App-Daten
weiterhin entfernen, etwa wenn der Nutzer Website-Daten manuell löscht.
