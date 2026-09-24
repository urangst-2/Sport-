# Bilanz: Anleitung

## Bereitstellung (einmalig, Computer empfohlen)
1. Kostenloses GitHub-Konto anlegen, neues öffentliches Repository erstellen.
2. Alle Dateien dieses Ordners hochladen (Add file, Upload files).
3. Settings, Pages: Branch main, Ordner root. Nach kurzer Zeit erscheint die Adresse https://NAME.github.io/REPO/ (HTTPS).
4. Auf dem iPhone in Safari öffnen, Teilen, Zum Home-Bildschirm. Danach die App vom Home-Bildschirm starten.
5. Einmal mit Internet öffnen, dann im Flugmodus testen.

Das Repository enthält nur den App-Code. Deine Daten entstehen erst auf dem iPhone und liegen nur im Browserspeicher dort. Updates: neue Dateien hochladen und in sw.js die Zahl in `bilanz-v1` erhöhen; vorhandene Einträge bleiben erhalten.

Hinweis: Speicher von Safari-Tab und Home-Bildschirm-App können getrennt sein. Gib deine Daten daher erst in der Home-Bildschirm-App ein.

## Bedienung
Ersteinrichtung unter Heute. Ernährung: Eintrag mit kcal pro 100 g und Menge oder mit Gesamt-kcal. Training: Workout mit Übungen und Sätzen; ohne Dauer bleibt der Verbrauch unbekannt. Gewicht unter Fortschritt. Sicherung (JSON) unter Einstellungen, bitte regelmäßig exportieren.

## Nicht enthalten
Rezepte, Barcode-Scan, Online-Lebensmittelsuche mit Schalter, Kopieren von Mahlzeiten oder Tagen, Vorlagen, Körpermaße, freie Zeiträume (fest 7/30/90/365 Tage).

## Getestet
Per Node: Syntax, Zahleneingabe mit Komma, Datumsrechnung, Kalorienformeln, Trainingsschätzung. Statisch geprüft: keine Emojis, keine Netzwerkaufrufe im App-Code.
Nicht getestet, bitte auf dem iPhone prüfen: Anzeige, Service Worker und Offline-Start, IndexedDB, Export und Import (Teilen-Dialog), Home-Bildschirm-Installation unter iOS 26, Tastaturverhalten. Die Anforderungen von iOS 26 an Web-Apps habe ich nicht anhand der Apple-Dokumentation geprüft.
