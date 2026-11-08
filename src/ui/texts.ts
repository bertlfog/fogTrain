/**
 * Alle sichtbaren Texte der App an einer Stelle (SPEC N14: UI auf Deutsch,
 * keine Mehrsprachigkeit). Komponenten enthalten keine eigenen Textliterale.
 */
export const texts = {
  appName: "TrainingApp",

  common: {
    loading: "Wird geladen …",
    loadFailed:
      "Die Daten konnten nicht geladen werden. Bitte die Seite neu laden.",
  },

  storageUnavailable: {
    title: "Der lokale Speicher ist nicht verfügbar",
    hint: "Bitte die Seite neu laden oder den Browser-Speicher freigeben.",
  },

  update: {
    available: "Neue Version verfügbar.",
    action: "Aktualisieren",
  },

  nav: {
    label: "Hauptnavigation",
    start: "Start",
    exercises: "Übungen",
    plans: "Pläne",
    history: "Verlauf",
    settings: "Einstellungen",
  },

  start: {
    title: "TrainingApp",
    emptyTitle: "Noch kein Trainingsplan",
    emptyHint:
      "Lege zuerst Übungen an und stelle daraus einen Plan zusammen. Danach kannst du hier ein Training starten.",
    emptyAction: "Zu den Übungen",
    plansHeading: "Deine Pläne",
  },

  exercises: {
    title: "Übungen",
    emptyTitle: "Noch keine Übungen",
    emptyHint: "Hier erscheinen deine Physiotherapie- und Kräftigungsübungen.",
  },

  plans: {
    title: "Pläne",
    emptyTitle: "Noch keine Pläne",
    emptyHint:
      "Stelle aus deinen Übungen einen Trainingsplan zusammen, um ihn später mit einem Tipp zu starten.",
  },

  history: {
    title: "Verlauf",
    emptyTitle: "Noch keine Workouts",
    emptyHint: "Hier erscheinen deine abgeschlossenen Trainingseinheiten.",
    count: (n: number) => (n === 1 ? "1 Workout" : `${n} Workouts`),
  },

  settings: {
    title: "Einstellungen",
    storageHeading: "Speicher",
    storage: {
      pending: "Wird geprüft …",
      granted:
        "Dauerhaft gesichert. Android löscht deine Daten nicht automatisch.",
      denied:
        "Nicht dauerhaft gesichert. Bei knappem Speicher kann das Android-System Daten löschen.",
      unsupported: "Dieser Browser unterstützt keinen dauerhaften Speicher.",
    },
  },
} as const;
