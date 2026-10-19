# Spieleportal mit Online-Multiplayer

GitHub Pages kann nur statische Dateien ausliefern. Es führt weder die API-Endpunkte noch den WebSocket-Spielserver aus. Für Partien zwischen zwei Geräten muss das Portal auf Cloudflare Pages laufen und mit dem Durable-Objects-Spielserver verbunden sein.

## Einmalige Einrichtung

### 1. Dateien zu GitHub hochladen

Lade den gesamten Inhalt dieses Ordners in das Repository hoch. Die `index.html`, `functions` und `backend` müssen im Hauptordner des Repositorys liegen.

### 2. Spielserver bereitstellen

Installiere Node.js, öffne PowerShell im Ordner `backend` und führe aus:

```powershell
npx wrangler@latest login
npx wrangler@latest deploy
```

Der Worker muss `spielportal-game-room` heißen. Das ist bereits in `backend/wrangler.toml` festgelegt.

### 3. Webseite und API auf Cloudflare Pages bereitstellen

Erstelle in Cloudflare unter **Workers & Pages** ein Pages-Projekt namens `spielportal-pages` und verbinde es mit deinem GitHub-Repository. Verwende den Hauptordner als Projektverzeichnis, keinen Build-Befehl und `.` als Ausgabeordner. Die Datei `wrangler.toml` enthält die Pages-Konfiguration und die Verbindung zum Spielserver.

Lege in den Pages-Projekteinstellungen unter **Settings → Variables and Secrets** ein Secret mit dem Namen `AUTH_SECRET` an. Verwende einen zufälligen, geheimen Wert mit mindestens 32 Zeichen. Speichere ihn nur bei Cloudflare, niemals in GitHub, und teile ihn nicht im Chat.

Öffne danach die von Cloudflare angezeigte `*.pages.dev`-Adresse. Die bisherige `*.github.io`-Adresse kann weiterhin die statische Seite anzeigen, aber dort funktioniert kein Multiplayer.

Cloudflare kann je nach Nutzung und aktuellen Tarifgrenzen zusätzliche Abrechnung oder die Aktivierung eines Tarifs verlangen. Prüfe die aktuellen Durable-Objects-Grenzen in deinem Cloudflare-Konto.

## Spielen

1. Auf Gerät 1 **Neuen Raum erstellen** wählen und den angezeigten 8-stelligen Raumcode teilen.
2. Auf Gerät 2 den Code eingeben und **Mit Raumcode beitreten** wählen.
3. Beide Geräte öffnen dasselbe Spiel. Spielzüge werden live über den Spielserver synchronisiert.

Der Raumcode ist die Einladung: Teile ihn nur mit der Person, mit der du spielen möchtest. Er ersetzt ein Passwort oder einen persönlichen Account.

Für einen lokalen Test auf einem einzelnen Gerät kannst du `?test=local` an die Seitenadresse anhängen. Das ist kein Online-Multiplayer.
