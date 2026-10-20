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

1. Für eine Partie allein **Allein gegen Bot** wählen und einen Namen eingeben. Der Bot übernimmt Spieler 2 und spielt auf mittlerem Niveau.
2. Für ein Spiel zu zweit wählen beide dieselbe Webseite und jeweils **Spieler 1** oder **Spieler 2**. Die Namen lassen sich dabei festlegen und Spielzüge werden live synchronisiert.
3. Zuschauer wählen **Zuschauer** und können die laufenden Spiele live ansehen. Sie können keine Spielzüge oder Neustarts auslösen.

Alle Besucher nutzen denselben gemeinsamen Spielbereich; Raumcodes oder Einladungen sind nicht erforderlich. Der Bot spielt Tic-Tac-Toe, Schiffe versenken, Yatzy, Find Match und Memory.

Für einen lokalen Test auf einem einzelnen Gerät kannst du `?test=local` an die Seitenadresse anhängen. Das ist kein Online-Multiplayer.
