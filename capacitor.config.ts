import type { CapacitorConfig } from "@capacitor/cli";

// CAP_ENV=dev → l'émulateur Android charge le serveur Next local
// (10.0.2.2 = loopback de la machine hôte vue depuis l'émulateur).
// Jamais de config dev en prod : sans CAP_ENV, on pointe sur friendszy.ca.
const isDev = process.env.CAP_ENV === "dev";

const config: CapacitorConfig = {
  appId: "ca.friendszy.app", // à confirmer avec le client avant publication
  appName: "Friendszy",
  // Requis par Capacitor même avec server.url (page de repli minimale, jamais servie en prod).
  webDir: "cap-www",
  server: {
    url: isDev ? "http://10.0.2.2:3000" : "https://friendszy.ca",
    cleartext: isDev,
    allowNavigation: ["friendszy.ca", "www.friendszy.ca"],
  },
  android: {
    webContentsDebuggingEnabled: isDev,
  },
};

export default config;
