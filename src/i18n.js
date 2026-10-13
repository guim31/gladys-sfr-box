// -----------------------------------------------------------------------------
// Every text the container shows to a user, in the four languages of the
// project: English, French, German (informal "du") and Spanish (formal
// "usted"). test/i18n.test.js checks that none is missing, empty or too long.
//
// Gladys tells a device integration nothing about the user's language: the
// feature names (frozen when the device is created) follow the `language`
// field of the configuration. The widget receives the viewer's language, and
// the action messages are sent as multi-language objects the core picks from.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];
export const DEFAULT_LANGUAGE = 'en';

export const TEXTS = {
  // --- Feature names (≤ 40 characters) -------------------------------------
  feature_wan: {
    en: 'Internet connection',
    fr: 'Connexion Internet',
    de: 'Internetverbindung',
    es: 'Conexión a Internet',
  },
  feature_ipv6: {
    en: 'IPv6 connection',
    fr: 'Connexion IPv6',
    de: 'IPv6-Verbindung',
    es: 'Conexión IPv6',
  },
  feature_public_ip: {
    en: 'Public IPv4 address',
    fr: 'Adresse IPv4 publique',
    de: 'Öffentliche IPv4-Adresse',
    es: 'Dirección IPv4 pública',
  },
  feature_line_type: {
    en: 'Line type',
    fr: 'Type de ligne',
    de: 'Leitungstyp',
    es: 'Tipo de línea',
  },
  feature_line_dsl: {
    en: 'DSL line synchronized',
    fr: 'Ligne DSL synchronisée',
    de: 'DSL-Leitung synchronisiert',
    es: 'Línea DSL sincronizada',
  },
  feature_line_ftth: {
    en: 'Fibre line up',
    fr: 'Ligne fibre active',
    de: 'Glasfaserleitung aktiv',
    es: 'Línea de fibra activa',
  },
  feature_rate_down: {
    en: 'DSL download rate',
    fr: 'Débit DSL descendant',
    de: 'DSL-Downloadrate',
    es: 'Velocidad DSL de bajada',
  },
  feature_rate_up: {
    en: 'DSL upload rate',
    fr: 'Débit DSL montant',
    de: 'DSL-Uploadrate',
    es: 'Velocidad DSL de subida',
  },
  feature_attenuation_down: {
    en: 'Downstream attenuation',
    fr: 'Atténuation descendante',
    de: 'Dämpfung Downstream',
    es: 'Atenuación de bajada',
  },
  feature_attenuation_up: {
    en: 'Upstream attenuation',
    fr: 'Atténuation montante',
    de: 'Dämpfung Upstream',
    es: 'Atenuación de subida',
  },
  feature_noise_down: {
    en: 'Downstream noise margin',
    fr: 'Marge de bruit descendante',
    de: 'Störabstand Downstream',
    es: 'Margen de ruido de bajada',
  },
  feature_noise_up: {
    en: 'Upstream noise margin',
    fr: 'Marge de bruit montante',
    de: 'Störabstand Upstream',
    es: 'Margen de ruido de subida',
  },
  feature_uptime: {
    en: 'Box uptime',
    fr: 'Durée de fonctionnement',
    de: 'Betriebszeit der Box',
    es: 'Tiempo de funcionamiento',
  },
  feature_model: { en: 'Model', fr: 'Modèle', de: 'Modell', es: 'Modelo' },
  feature_firmware: { en: 'Firmware', fr: 'Firmware', de: 'Firmware', es: 'Firmware' },
  feature_temperature: {
    en: 'Box temperature',
    fr: 'Température de la box',
    de: 'Temperatur der Box',
    es: 'Temperatura del router',
  },
  feature_wifi: {
    en: 'Wi-Fi enabled',
    fr: 'Wi-Fi activé',
    de: 'WLAN aktiviert',
    es: 'Wi-Fi activado',
  },
  feature_presence: { en: 'Presence', fr: 'Présence', de: 'Anwesenheit', es: 'Presencia' },

  // --- Connection status (Configuration screen, ≤ 200 characters) ----------
  status_unreachable: {
    en: 'SFR Box unreachable at {host}: check the address in the configuration.',
    fr: 'SFR Box injoignable à l’adresse {host} : vérifiez l’adresse dans la configuration.',
    de: 'SFR Box unter {host} nicht erreichbar: Prüfe die Adresse in der Konfiguration.',
    es: 'SFR Box inaccesible en {host}: compruebe la dirección en la configuración.',
  },
  status_auth_rejected: {
    en: 'Password refused by the box: Wi-Fi state and reboot are unavailable.',
    fr: 'Mot de passe refusé par la box : état du Wi-Fi et redémarrage indisponibles.',
    de: 'Passwort von der Box abgelehnt: WLAN-Status und Neustart sind nicht verfügbar.',
    es: 'Contraseña rechazada por el router: estado del Wi-Fi y reinicio no disponibles.',
  },
  status_auth_button_only: {
    en: 'The box only accepts authentication by its button: Wi-Fi state and reboot are unavailable.',
    fr: 'La box n’accepte que l’authentification par bouton : état du Wi-Fi et redémarrage indisponibles.',
    de: 'Die Box erlaubt nur die Anmeldung per Taste: WLAN-Status und Neustart sind nicht verfügbar.',
    es: 'El router solo acepta la autenticación por botón: estado del Wi-Fi y reinicio no disponibles.',
  },

  // --- Configuration actions (shown under the buttons) ---------------------
  test_connected: {
    en: 'Connected to the box {model}, firmware {firmware}. Line: {line}. Internet: {internet}.',
    fr: 'Connecté à la box {model}, firmware {firmware}. Ligne : {line}. Internet : {internet}.',
    de: 'Mit der Box {model} verbunden, Firmware {firmware}. Leitung: {line}. Internet: {internet}.',
    es: 'Conectado al router {model}, firmware {firmware}. Línea: {line}. Internet: {internet}.',
  },
  test_auth_ok: {
    en: 'Password accepted: Wi-Fi state and reboot are available.',
    fr: 'Mot de passe accepté : état du Wi-Fi et redémarrage disponibles.',
    de: 'Passwort akzeptiert: WLAN-Status und Neustart sind verfügbar.',
    es: 'Contraseña aceptada: estado del Wi-Fi y reinicio disponibles.',
  },
  test_auth_none: {
    en: 'No password configured: Wi-Fi state and reboot are unavailable.',
    fr: 'Aucun mot de passe configuré : état du Wi-Fi et redémarrage indisponibles.',
    de: 'Kein Passwort konfiguriert: WLAN-Status und Neustart sind nicht verfügbar.',
    es: 'Ninguna contraseña configurada: estado del Wi-Fi y reinicio no disponibles.',
  },
  test_hosts: {
    en: 'Devices on the network: {count}.',
    fr: 'Appareils sur le réseau : {count}.',
    de: 'Geräte im Netzwerk: {count}.',
    es: 'Dispositivos en la red: {count}.',
  },
  test_hosts_unavailable: {
    en: 'The box does not give the list of connected devices.',
    fr: 'La box ne donne pas la liste des appareils connectés.',
    de: 'Die Box liefert keine Liste der verbundenen Geräte.',
    es: 'El router no proporciona la lista de dispositivos conectados.',
  },
  reboot_confirm_needed: {
    en: 'Tick the confirmation box to reboot the box.',
    fr: 'Cochez la case de confirmation pour redémarrer la box.',
    de: 'Hake das Bestätigungsfeld an, um die Box neu zu starten.',
    es: 'Marque la casilla de confirmación para reiniciar el router.',
  },
  reboot_started: {
    en: 'Reboot requested: the box and the Internet connection will be back in a few minutes.',
    fr: 'Redémarrage demandé : la box et la connexion Internet reviennent dans quelques minutes.',
    de: 'Neustart angefordert: Box und Internetverbindung sind in ein paar Minuten zurück.',
    es: 'Reinicio solicitado: el router y la conexión a Internet volverán en unos minutos.',
  },
  reboot_no_password: {
    en: 'Rebooting needs the administrator password of the box in the configuration.',
    fr: 'Le redémarrage nécessite le mot de passe administrateur de la box dans la configuration.',
    de: 'Für den Neustart braucht es das Administratorpasswort der Box in der Konfiguration.',
    es: 'El reinicio necesita la contraseña de administrador del router en la configuración.',
  },
  reboot_failed: {
    en: 'The box refused the reboot.',
    fr: 'La box a refusé le redémarrage.',
    de: 'Die Box hat den Neustart abgelehnt.',
    es: 'El router rechazó el reinicio.',
  },
  box_unreachable: {
    en: 'Box unreachable',
    fr: 'Box injoignable',
    de: 'Box nicht erreichbar',
    es: 'Router inaccesible',
  },

  // --- Widget (tile labels ≤ 24, status labels and values ≤ 40) ------------
  widget_download: { en: 'Download', fr: 'Descendant', de: 'Download', es: 'Bajada' },
  widget_upload: { en: 'Upload', fr: 'Montant', de: 'Upload', es: 'Subida' },
  widget_uptime: { en: 'Uptime', fr: 'Allumée depuis', de: 'Betriebszeit', es: 'Encendido' },
  widget_temperature: {
    en: 'Temperature',
    fr: 'Température',
    de: 'Temperatur',
    es: 'Temperatura',
  },
  widget_internet: { en: 'Internet', fr: 'Internet', de: 'Internet', es: 'Internet' },
  widget_ipv6: { en: 'IPv6', fr: 'IPv6', de: 'IPv6', es: 'IPv6' },
  widget_line_dsl: { en: 'DSL line', fr: 'Ligne DSL', de: 'DSL-Leitung', es: 'Línea DSL' },
  widget_line_ftth: {
    en: 'Fibre line',
    fr: 'Ligne fibre',
    de: 'Glasfaserleitung',
    es: 'Línea de fibra',
  },
  widget_wifi: { en: 'Wi-Fi', fr: 'Wi-Fi', de: 'WLAN', es: 'Wi-Fi' },
  widget_box: { en: 'SFR Box', fr: 'SFR Box', de: 'SFR Box', es: 'SFR Box' },
  widget_waiting: {
    en: 'Waiting for the first reading',
    fr: 'En attente du premier relevé',
    de: 'Warte auf die erste Messung',
    es: 'Esperando la primera lectura',
  },
  widget_reboot: {
    en: 'Reboot the box',
    fr: 'Redémarrer la box',
    de: 'Box neu starten',
    es: 'Reiniciar el router',
  },
  value_connected: { en: 'Connected', fr: 'Connectée', de: 'Verbunden', es: 'Conectada' },
  value_disconnected: {
    en: 'Disconnected',
    fr: 'Déconnectée',
    de: 'Getrennt',
    es: 'Desconectada',
  },
  value_synchronized: {
    en: 'Synchronized',
    fr: 'Synchronisée',
    de: 'Synchronisiert',
    es: 'Sincronizada',
  },
  value_not_synchronized: {
    en: 'Not synchronized',
    fr: 'Non synchronisée',
    de: 'Nicht synchronisiert',
    es: 'No sincronizada',
  },
  value_enabled: { en: 'Enabled', fr: 'Activé', de: 'Aktiviert', es: 'Activado' },
  value_disabled: { en: 'Disabled', fr: 'Désactivé', de: 'Deaktiviert', es: 'Desactivado' },
  value_unknown: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
  value_none: { en: 'None', fr: 'Aucune', de: 'Keine', es: 'Ninguna' },

  // --- Uptime, a widget value of 12 characters at most ({d} days, {h} hours, {m} minutes)
  duration_days: { en: '{d} d {h} h', fr: '{d} j {h} h', de: '{d} T {h} Std', es: '{d} d {h} h' },
  duration_long: { en: '{d} d', fr: '{d} j', de: '{d} T', es: '{d} d' },
  duration_hours: {
    en: '{h} h {m} min',
    fr: '{h} h {m} min',
    de: '{h} h {m} min',
    es: '{h} h {m} min',
  },
};

/** The supported language closest to `language` (`fr-FR` → `fr`), English otherwise. */
export function resolveLanguage(language) {
  const short = String(language ?? '')
    .slice(0, 2)
    .toLowerCase();
  return LANGUAGES.includes(short) ? short : DEFAULT_LANGUAGE;
}

// A variable is a value, or a function of the language for a value that is
// itself translated.
function fill(template, vars, language) {
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = typeof vars[name] === 'function' ? vars[name](language) : vars[name];
    return value === undefined || value === null ? match : String(value);
  });
}

/** One text in one language. */
export function t(key, language, vars = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    throw new Error(`Unknown text "${key}"`);
  }
  const resolved = resolveLanguage(language);
  return fill(entry[resolved], vars, resolved);
}

/** One text in every language, the multi-language object Gladys picks from. */
export function tAll(key, vars = {}) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, t(key, language, vars)]));
}
