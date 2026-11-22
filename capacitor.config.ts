import type { CapacitorConfig } from "@capacitor/cli";

// CAP_ENV=dev → l'app charge le serveur Next local de ta machine :
//   - émulateur Android : 10.0.2.2 (loopback de l'hôte vu depuis l'émulateur) ;
//   - vrai téléphone sur le même Wi-Fi : CAP_SERVER_URL=http://<IP-du-PC>:3000.
// Jamais de config dev en prod : sans CAP_ENV, on pointe sur friendszy.ca.
const isDev = process.env.CAP_ENV === "dev";
const devUrl = process.env.CAP_SERVER_URL || "http://10.0.2.2:3000";

const config: CapacitorConfig = {
  appId: "ca.friendszy.app", // à confirmer avec le client avant publication
  appName: "Friendszy",
  // Requis par Capacitor même avec server.url (page de repli minimale, jamais servie en prod).
  webDir: "cap-www",
  server: {
    url: isDev ? devUrl : "https://friendszy.ca",
    cleartext: isDev,
    allowNavigation: ["friendszy.ca", "www.friendszy.ca"],
  },
  android: {
    webContentsDebuggingEnabled: isDev,
  },
};

export default config;
