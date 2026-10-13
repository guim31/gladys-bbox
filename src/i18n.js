// -----------------------------------------------------------------------------
// User-facing texts, in the four languages of the maintainer's integrations.
//
// German uses the familiar "du", Spanish the formal "usted" (test/i18n.test.js
// enforces both, and that no language is missing).
//
// Gladys localizes a multi-language object itself where it renders one
// (action results, connection status). Feature names and widget contents are
// plain strings built here: a device integration never receives the user's
// language, so feature names follow the `language` setting, and a widget picks
// the language Gladys sends with each request.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];
export const DEFAULT_LANGUAGE = 'fr';

export const TEXTS = {
  // Feature names, frozen by Gladys when the user adds the device.
  feature: {
    internet: {
      en: 'Internet connection',
      fr: 'Connexion Internet',
      de: 'Internetverbindung',
      es: 'Conexión a Internet',
    },
    line_sync: {
      en: 'Line synchronized',
      fr: 'Ligne synchronisée',
      de: 'Leitung synchronisiert',
      es: 'Línea sincronizada',
    },
    line_type: { en: 'Line type', fr: 'Type de ligne', de: 'Leitungstyp', es: 'Tipo de línea' },
    sync_down: {
      en: 'Synchronized download rate',
      fr: 'Débit synchronisé descendant',
      de: 'Synchronisierte Download-Rate',
      es: 'Velocidad sincronizada de bajada',
    },
    sync_up: {
      en: 'Synchronized upload rate',
      fr: 'Débit synchronisé montant',
      de: 'Synchronisierte Upload-Rate',
      es: 'Velocidad sincronizada de subida',
    },
    rate_down: {
      en: 'Download rate',
      fr: 'Débit descendant',
      de: 'Download-Rate',
      es: 'Velocidad de bajada',
    },
    rate_up: {
      en: 'Upload rate',
      fr: 'Débit montant',
      de: 'Upload-Rate',
      es: 'Velocidad de subida',
    },
    ipv4: {
      en: 'Public IPv4 address',
      fr: 'Adresse IPv4 publique',
      de: 'Öffentliche IPv4-Adresse',
      es: 'Dirección IPv4 pública',
    },
    ipv6: { en: 'IPv6 address', fr: 'Adresse IPv6', de: 'IPv6-Adresse', es: 'Dirección IPv6' },
    uptime: {
      en: 'Uptime (days)',
      fr: 'Durée de fonctionnement (jours)',
      de: 'Laufzeit (Tage)',
      es: 'Tiempo encendido (días)',
    },
    firmware: { en: 'Firmware', fr: 'Micrologiciel', de: 'Firmware', es: 'Firmware' },
    model: { en: 'Model', fr: 'Modèle', de: 'Modell', es: 'Modelo' },
    temperature: { en: 'Temperature', fr: 'Température', de: 'Temperatur', es: 'Temperatura' },
    wifi_24: { en: 'Wi-Fi 2.4 GHz', fr: 'Wi-Fi 2,4 GHz', de: 'WLAN 2,4 GHz', es: 'Wi-Fi 2,4 GHz' },
    wifi_5: { en: 'Wi-Fi 5 GHz', fr: 'Wi-Fi 5 GHz', de: 'WLAN 5 GHz', es: 'Wi-Fi 5 GHz' },
    wifi_guest: {
      en: 'Guest Wi-Fi',
      fr: 'Wi-Fi invité',
      de: 'Gäste-WLAN',
      es: 'Wi-Fi de invitados',
    },
    missed_calls: {
      en: 'Missed calls',
      fr: 'Appels manqués',
      de: 'Verpasste Anrufe',
      es: 'Llamadas perdidas',
    },
    connected_hosts: {
      en: 'Connected devices',
      fr: 'Appareils connectés',
      de: 'Verbundene Geräte',
      es: 'Dispositivos conectados',
    },
    presence: { en: 'Presence', fr: 'Présence', de: 'Anwesenheit', es: 'Presencia' },
  },

  // Connection status shown in the Configuration screen.
  status: {
    missing_password: {
      en: 'Enter the Bbox administrator password in the configuration.',
      fr: 'Saisissez le mot de passe administrateur de la Bbox dans la configuration.',
      de: 'Gib das Administratorpasswort der Bbox in der Konfiguration ein.',
      es: 'Introduzca la contraseña de administrador de la Bbox en la configuración.',
    },
    wrong_password: {
      en: 'The Bbox refused the password. Check it, then save the configuration again.',
      fr: 'La Bbox a refusé le mot de passe. Vérifiez-le, puis enregistrez à nouveau la configuration.',
      de: 'Die Bbox hat das Passwort abgelehnt. Prüfe es und speichere die Konfiguration erneut.',
      es: 'La Bbox rechazó la contraseña. Compruébela y guarde de nuevo la configuración.',
    },
    rate_limited: {
      en: 'The Bbox blocks logins after failed attempts. Next attempt in 15 minutes.',
      fr: 'La Bbox bloque les connexions après des échecs. Nouvel essai dans 15 minutes.',
      de: 'Die Bbox sperrt Anmeldungen nach Fehlversuchen. Nächster Versuch in 15 Minuten.',
      es: 'La Bbox bloquea los accesos tras varios fallos. Nuevo intento en 15 minutos.',
    },
    tls: {
      en: 'The Bbox certificate could not be verified. See the documentation, "Certificate" section.',
      fr: "Le certificat de la Bbox n'a pas pu être vérifié. Voir la documentation, section « Certificat ».",
      de: 'Das Zertifikat der Bbox konnte nicht geprüft werden. Siehe Dokumentation, Abschnitt „Zertifikat“.',
      es: 'No se pudo verificar el certificado de la Bbox. Consulte la documentación, sección «Certificado».',
    },
    unreachable: {
      en: 'The Bbox does not answer. Check its address in the configuration.',
      fr: 'La Bbox ne répond pas. Vérifiez son adresse dans la configuration.',
      de: 'Die Bbox antwortet nicht. Prüfe ihre Adresse in der Konfiguration.',
      es: 'La Bbox no responde. Compruebe su dirección en la configuración.',
    },
    api_error: {
      en: 'The Bbox answered with an error, check the integration logs.',
      fr: "La Bbox a répondu par une erreur, consultez les logs de l'intégration.",
      de: 'Die Bbox hat mit einem Fehler geantwortet, sieh in die Logs der Integration.',
      es: 'La Bbox respondió con un error, consulte los registros de la integración.',
    },
  },

  // Results of the manifest actions, shown under the button.
  action: {
    test_ok: {
      en: 'Connected to the Bbox {model} (firmware {firmware}). Internet: {internet}.',
      fr: 'Connecté à la Bbox {model} (micrologiciel {firmware}). Internet : {internet}.',
      de: 'Mit der Bbox {model} verbunden (Firmware {firmware}). Internet: {internet}.',
      es: 'Conectado a la Bbox {model} (firmware {firmware}). Internet: {internet}.',
    },
    reboot_unconfirmed: {
      en: 'Tick the confirmation box to restart the Bbox.',
      fr: 'Cochez la case de confirmation pour redémarrer la Bbox.',
      de: 'Setze das Bestätigungshäkchen, um die Bbox neu zu starten.',
      es: 'Marque la casilla de confirmación para reiniciar la Bbox.',
    },
    reboot_ok: {
      en: 'The Bbox is restarting: Internet and Wi-Fi are cut for about two minutes.',
      fr: 'La Bbox redémarre : Internet et le Wi-Fi sont coupés pendant environ deux minutes.',
      de: 'Die Bbox startet neu: Internet und WLAN sind etwa zwei Minuten lang unterbrochen.',
      es: 'La Bbox se está reiniciando: Internet y el Wi-Fi se cortan unos dos minutos.',
    },
  },

  // Words shared by the action results and the widget.
  word: {
    up: { en: 'connected', fr: 'connecté', de: 'verbunden', es: 'conectado' },
    down: { en: 'disconnected', fr: 'déconnecté', de: 'getrennt', es: 'desconectado' },
    on: { en: 'On', fr: 'Activé', de: 'An', es: 'Activado' },
    off: { en: 'Off', fr: 'Désactivé', de: 'Aus', es: 'Desactivado' },
    synced: { en: 'synchronized', fr: 'synchronisée', de: 'synchronisiert', es: 'sincronizada' },
    not_synced: {
      en: 'not synchronized',
      fr: 'non synchronisée',
      de: 'nicht synchronisiert',
      es: 'no sincronizada',
    },
    unknown: { en: 'unknown', fr: 'inconnu', de: 'unbekannt', es: 'desconocido' },
    days: { en: '{n} d', fr: '{n} j', de: '{n} T', es: '{n} d' },
  },

  // Dashboard widget.
  widget: {
    internet: { en: 'Internet', fr: 'Internet', de: 'Internet', es: 'Internet' },
    line: { en: 'Line', fr: 'Ligne', de: 'Leitung', es: 'Línea' },
    ipv4: { en: 'Public IPv4', fr: 'IPv4 publique', de: 'Öffentliche IPv4', es: 'IPv4 pública' },
    wifi_24: { en: 'Wi-Fi 2.4 GHz', fr: 'Wi-Fi 2,4 GHz', de: 'WLAN 2,4 GHz', es: 'Wi-Fi 2,4 GHz' },
    wifi_5: { en: 'Wi-Fi 5 GHz', fr: 'Wi-Fi 5 GHz', de: 'WLAN 5 GHz', es: 'Wi-Fi 5 GHz' },
    wifi_guest: { en: 'Guest Wi-Fi', fr: 'Wi-Fi invité', de: 'Gäste-WLAN', es: 'Wi-Fi invitados' },
    missed_calls: {
      en: 'Missed calls',
      fr: 'Appels manqués',
      de: 'Verpasste Anrufe',
      es: 'Llamadas perdidas',
    },
    uptime: { en: 'Uptime', fr: 'En marche depuis', de: 'Laufzeit', es: 'Encendida desde' },
    download: { en: 'Download', fr: 'Descendant', de: 'Download', es: 'Bajada' },
    upload: { en: 'Upload', fr: 'Montant', de: 'Upload', es: 'Subida' },
    devices: { en: 'Devices', fr: 'Appareils', de: 'Geräte', es: 'Dispositivos' },
    guest_on: {
      en: 'Turn on guest Wi-Fi',
      fr: 'Activer le Wi-Fi invité',
      de: 'Gäste-WLAN einschalten',
      es: 'Encender Wi-Fi invitados',
    },
    guest_off: {
      en: 'Turn off guest Wi-Fi',
      fr: 'Couper le Wi-Fi invité',
      de: 'Gäste-WLAN ausschalten',
      es: 'Apagar Wi-Fi invitados',
    },
    waiting: {
      en: 'Waiting for the first reading of the Bbox.',
      fr: 'En attente du premier relevé de la Bbox.',
      de: 'Warte auf die erste Abfrage der Bbox.',
      es: 'Esperando la primera lectura de la Bbox.',
    },
    unreachable: {
      en: 'The Bbox does not answer: values from the last reading.',
      fr: 'La Bbox ne répond pas : valeurs du dernier relevé.',
      de: 'Die Bbox antwortet nicht: Werte der letzten Abfrage.',
      es: 'La Bbox no responde: valores de la última lectura.',
    },
  },
};

/**
 * Pick the text of `language` in a multi-language object, English as a
 * fallback, and fill its `{name}` placeholders.
 */
export function t(entry, language, values = {}) {
  const text = entry[language] ?? entry.en;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    values[name] === undefined ? match : String(values[name]),
  );
}

/**
 * Fill the placeholders of every language of a multi-language object, for
 * the texts Gladys localizes itself (action results).
 */
export function format(entry, valuesByLanguage) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [language, t(entry, language, valuesByLanguage(language))]),
  );
}
