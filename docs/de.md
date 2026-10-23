# Bbox

Behalte deine Bbox von Bouygues Telecom in Gladys im Blick: Leitungs- und
Internetstatus, Datenraten, WLAN, verbundene Geräte und verpasste Anrufe. Alles
läuft über die lokale API der Box, ohne Cloud.

> **Ohne die Hardware entwickelt: Rückmeldungen willkommen.** Diese Integration
> wurde anhand der Dokumentation der Bbox-API und der freien Bibliotheken
> geschrieben, die sie nutzen, ohne eine Bbox zum Testen. Wenn auf deinem
> Modell ein Wert fehlt oder falsch aussieht, öffne ein Issue auf
> [GitHub](https://github.com/guim31/gladys-bbox/issues) mit dem Modell deiner
> Bbox und den Logs der Integration.

Unabhängige Integration, nicht mit Bouygues Telecom verbunden.

## Was du bekommst

Ein Gerät **Bbox** mit:

- **Internetverbindung** (verbunden oder nicht) und **Leitung synchronisiert**;
- **Leitungstyp** (FTTH, VDSL2, ADSL) und **synchronisierte Datenraten** für
  Upload und Download (Synchronisationsraten bei xDSL, von der Box angegebene
  Höchstrate bei Glasfaser);
- aktuelle **Download-Rate** und **Upload-Rate** in Mbit/s;
- **öffentliche IPv4-Adresse** und **IPv6-Adresse**;
- **Modell**, **Firmware**, **Laufzeit** (in Tagen) und, wenn das Modell sie
  liefert, **Temperatur**;
- **WLAN 2,4 GHz**, **WLAN 5 GHz** und, wenn das Modell es hat, **Gäste-WLAN**:
  Schalter, um sie von Gladys aus aus- oder wieder einzuschalten;
- **verpasste Anrufe** auf dem Festnetz, wenn die Box Telefonie hat;
- **verbundene Geräte**: ihre Anzahl.

Und, wenn du möchtest, ein **Anwesenheits**-Gerät für jedes Gerät, das die
Bbox kennt (Handy, Computer …), erkannt an seiner MAC-Adresse.

## Voraussetzungen

- Gladys 5.1 oder neuer.
- Gladys im lokalen Netzwerk der Bbox.
- Das **Administratorpasswort** der Bbox: das der Weboberfläche
  [mabbox.bytel.fr](https://mabbox.bytel.fr).

Modelle: Die Integration nutzt die lokale API, die alle Bbox von Bouygues
Telecom gemeinsam haben (`/api/v1`). Die Antworten, mit denen sie getestet
wurde, stammen von der Bbox Fibre (F@st5330b) und der Wi-Fi-6-Generation
(F@st5688b). Die Bbox Miami, Ultym, Must, Wi-Fi 6 und Wi-Fi 7 bieten dieselbe
API, aber keine wurde in echt ausprobiert: Deine Rückmeldungen zeigen, was
funktioniert.

## Konfiguration

1. Öffne den Tab **Konfiguration** der Integration.
2. **Adresse der Bbox**: `192.168.1.254` passt für fast alle Boxen. Wenn du das
   Netzwerk deiner Box geändert hast, trag ihre neue IP-Adresse ein.
3. **Administratorpasswort**: das der Weboberfläche der Box. Achtung: Mehrere
   falsche Passwörter sperren die Anmeldung an der Box eine Weile. Nach einer
   Ablehnung versucht es die Integration nicht mehr, bis du ein neues Passwort
   gespeichert hast.
4. **Abfrageintervall**: standardmäßig alle 60 Sekunden, nicht öfter.
5. **Sprache der Funktionsnamen**: Gladys behält den Namen einer Funktion,
   sobald das Gerät hinzugefügt ist. Wähle die Sprache, bevor du die Bbox
   hinzufügst.
6. Speichere und klicke dann auf **Verbindung testen**: Modell, Firmware und
   Internetstatus erscheinen unter der Schaltfläche.
7. Füge die Bbox im Tab **Entdecken** hinzu.

## Anwesenheit der verbundenen Geräte

Mit der Option **Verbundene Geräte anbieten (Anwesenheit)** erscheint jedes
Gerät, das die Bbox kennt, im Tab **Entdecken**. Füge die hinzu, deren
Anwesenheit du verfolgen willst, zum Beispiel deine Handys.

Wie die Bluetooth-Anwesenheit von Gladys ist das ein „gesehen um“-Sensor: Die
Bbox meldet das Gerät alle 5 Minuten, solange es verbunden ist, und sofort,
wenn es zurückkommt. In einer Szene betrachtet die Aktion **Anwesenheit von
Benutzern überprüfen** den Benutzer als weg, wenn keines seiner Geräte
innerhalb der gewählten Zeit gesehen wurde: Nimm 10 Minuten oder mehr.

Neuere Handys wechseln ihre MAC-Adresse von einem WLAN zum anderen („private“
oder „zufällige“ Adresse); im WLAN zu Hause bleibt sie meist gleich. Wenn ein
Handy unter mehreren Namen erscheint, schalte in seinen WLAN-Einstellungen die
private Adresse für das Netzwerk der Bbox aus.

## Aktionen

- **Verbindung testen**: liest die Bbox und zeigt ihr Modell, ihre Firmware und
  den Internetstatus.
- **Bbox neu starten**: Hake vor dem Klick „Ich bestätige den Neustart“ an.
  Internet, WLAN und Telefon sind etwa zwei Minuten lang unterbrochen, Gladys
  eingeschlossen, wenn es über das WLAN läuft.

## Szenen

Im Szeneneditor (Kategorie **Integrationen**):

- **Internetverbindung verloren**: Die Bbox hat ihre Internetverbindung
  verloren.
- **Internetverbindung wiederhergestellt**: Die Verbindung ist wieder da. Die folgenden
  Aktionen lesen die Dauer des Ausfalls in Minuten
  (`{{triggerEvent.data.downtime_minutes}}`) und die IPv4-Adresse
  (`{{triggerEvent.data.ipv4}}`).
- **Verpasster Anruf**: Ein Anruf auf dem Festnetz wurde nicht angenommen. Die
  Nummer des Anrufers steht in `{{triggerEvent.data.number}}`, wenn die
  Anrufliste der Box sie liefert.

Diese Auslöser vergleichen zwei Abfragen: Ein Ausfall, der kürzer als das
Abfrageintervall ist, kann unbemerkt bleiben. Eine Bbox, die gar nicht mehr
antwortet (Neustart, Kabel abgezogen), löst nichts aus: Gladys kann nicht
wissen, ob das Internet funktioniert.

Während eines Ausfalls hat auch Gladys kein Internet: Eine Benachrichtigung,
die über das Internet geht (Telegram …), kann nicht verschickt werden. Nimm
lieber eine lokale Aktion (Licht, Sirene) oder benachrichtige bei der
Wiederherstellung.

## Dashboard

Das Widget **Bbox** zeigt live die Datenraten und die Anzahl der verbundenen
Geräte, den Internet- und Leitungsstatus, die IPv4-Adresse, das WLAN und die
verpassten Anrufe. Seine Schaltfläche schaltet das Gäste-WLAN ein oder aus. Die
Einstellung **Angezeigte Zeilen** behält nur die Zeilen, die du ankreuzt; leer
gelassen, zeigt das Widget alles.

## Zertifikat

Die Bbox stellt ihre API über HTTPS mit einem Zertifikat für `mabbox.bytel.fr`
bereit. Diesen Namen kennt nur der DNS-Server der Box: Die Integration verbindet
sich deshalb mit der konfigurierten IP-Adresse, prüft das Zertifikat aber für
`mabbox.bytel.fr`, so wie es dein Browser tun würde.

Wenn der Verbindungsstatus einen **Zertifikatsfehler** meldet, liefert die Box
vermutlich eine unvollständige Zertifikatskette, die Browser selbst ergänzen,
die Integration aber nicht. Nur in diesem Fall stellst du **Zertifikatsprüfung**
auf **Nicht prüfen**. Der Verkehr bleibt in deinem lokalen Netzwerk, aber die
Integration kann nicht mehr garantieren, dass sie mit deiner Bbox spricht und
nicht mit einem anderen Gerät im Netzwerk. Melde es auch in einem Issue, mit
dem Modell deiner Box.

## Fehlerbehebung

- **„Die Bbox antwortet nicht“**: Prüfe die Adresse (standardmäßig
  `192.168.1.254`) und ob Gladys wirklich im Netzwerk der Box ist, nicht hinter
  einem anderen Router.
- **„Die Bbox hat das Passwort abgelehnt“**: Gib es erneut ein und speichere.
  Die Integration versucht es nicht von selbst noch einmal, um die Sperre der
  Box nicht zu verlängern.
- **„Die Bbox sperrt Anmeldungen“**: zu viele Fehlversuche, von Gladys oder
  anderswo. Die Integration wartet 15 Minuten, bevor sie es erneut versucht.
- **Ein Wert bleibt leer**: Dein Modell liefert ihn vielleicht nicht. Öffne ein
  Issue mit dem Modell der Box und den Logs.
- **WLAN ausschalten** von Gladys aus trennt auch Gladys, wenn es über dieses
  WLAN verbunden ist: Nimm lieber eine Kabelverbindung.
