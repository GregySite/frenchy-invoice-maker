export interface ProviderField {
  key: string;
  label: string;
  type?: "text" | "password" | "email" | "checkbox";
  placeholder?: string;
}

export interface ProviderMeta {
  id: string;
  label: string;
  emoji: string;
  help: string;
  link?: string;
  fields: ProviderField[];
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "smartbee",
    label: "SmartBee",
    emoji: "🐝",
    help: '⚠️ Format API non confirmé avec le support SmartBee (limite connue : 600 documents/mois). Paramètres → "הגדרות API" → "הצגת טוקן"',
    link: "https://smartbee.co.il/pc/dealer/update-details/updateUser_api_configuration",
    fields: [{ key: "apiKey", label: "Clé API (Token)", type: "password" }],
  },
  {
    id: "greeninvoice",
    label: "Green Invoice (Morning)",
    emoji: "🟢",
    help: "Paramètres → Outils développeur → Clés API (ID + Secret)",
    link: "https://app.greeninvoice.co.il/settings/api",
    fields: [
      { key: "apiKeyId", label: "ID de la clé API", type: "text" },
      { key: "apiKeySecret", label: "Secret de la clé API", type: "password" },
      { key: "sandbox", label: "Mode test (sandbox, recommandé pour vos essais)", type: "checkbox" },
    ],
  },
  {
    id: "invoice4u",
    label: "Invoice4U",
    emoji: "🧾",
    help: "Utilisez l'email et le mot de passe de votre compte Invoice4U",
    link: "https://private.invoice4u.co.il/",
    fields: [
      { key: "email", label: "Email du compte", type: "email" },
      { key: "password", label: "Mot de passe", type: "password" },
    ],
  },
  {
    id: "icount",
    label: "iCount",
    emoji: "📘",
    help: "Identifiant société (cid), nom d'utilisateur et mot de passe iCount",
    link: "https://app.icount.co.il/",
    fields: [
      { key: "companyId", label: "Identifiant société (cid)", type: "text" },
      { key: "user", label: "Utilisateur", type: "text" },
      { key: "password", label: "Mot de passe", type: "password" },
    ],
  },
  {
    id: "invoicemaven",
    label: "Invoice Maven",
    emoji: "📗",
    help: "Créez une clé API depuis les paramètres de votre compte",
    link: "https://www.invoice-maven.co.il/",
    fields: [
      { key: "apiKey", label: "Clé API", type: "password" },
      { key: "testMode", label: "Mode test (documents de test, non enregistrés)", type: "checkbox" },
    ],
  },
];

export const providerLabel = (id: string) => PROVIDERS.find((p) => p.id === id)?.label ?? id;
export const providerEmoji = (id: string) => PROVIDERS.find((p) => p.id === id)?.emoji ?? "•";
