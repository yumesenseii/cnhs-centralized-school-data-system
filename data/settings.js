export const settingsData = {
  menu: [
    { id: "school", label: "School Information", icon: "school" },
    { id: "account", label: "Personal Account", icon: "user" },
    { id: "appearance", label: "Appearance", icon: "palette" },
    { id: "security", label: "Security", icon: "lock" },
    { id: "system", label: "System Information", icon: "info" },
  ],
  school: {
    logoSrc: "/cnhs-logo.png",
    schoolName: "Cambaog National High School",
    schoolAddress: "Cambaog, Bustos, Bulacan",
    division: "Schools Division of Bulacan",
    schoolYear: "2025–2026",
  },
  // Personal Account + Security identity come from getAdminSettingsProfile().
  appearance: {
    themes: [
      { id: "light", label: "Light" },
      { id: "dark", label: "Dark" },
      { id: "system", label: "System Default" },
    ],
    sidebars: [
      { id: "expanded", label: "Expanded" },
      { id: "collapsed", label: "Collapsed" },
    ],
    fontSizes: [
      { id: "small", label: "Small" },
      { id: "medium", label: "Medium" },
      { id: "large", label: "Large" },
    ],
    selected: {
      theme: "light",
      sidebar: "expanded",
      fontSize: "medium",
    },
  },
  system: {
    systemName: "CNHS Centralized School Data System",
    researchTitle:
      "A Centralized School Data System for Generating Personalized Learning Plans for High School Students",
    version: "v1.0.0",
    databaseStatus: "Connected (Supabase)",
    deployment: "Local / Project deployment",
    lastUpdated: "Aug 2026",
    supportEmail: "support@cnhs.edu.ph",
  },
};
