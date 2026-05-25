export interface VoiceEntry {
  displayName: string;
  providerVoiceId: string; // Eburon internal identity token
  voiceToken: string;
  enabled: boolean;
}

// Helper to decode Base64 in both Browser and Node.js environments safely
export function decodeBase64(str: string): string {
  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return window.atob(str);
    }
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return str;
  }
}

export const voiceRegistry: VoiceEntry[] = [
  { "displayName": "Skyblade (Zephyr)", "providerVoiceId": "WmVwaHly", "voiceToken": "WmVwaHly", "enabled": true },
  { "displayName": "Night Spark (Puck)", "providerVoiceId": "UHVjaw==", "voiceToken": "UHVjaw==", "enabled": true },
  { "displayName": "Shadow Ferryman (Charon)", "providerVoiceId": "Q2hhcm9u", "voiceToken": "Q2hhcm9u", "enabled": true },
  { "displayName": "Moon Sentinel (Kore)", "providerVoiceId": "S29yZQ==", "voiceToken": "S29yZQ==", "enabled": true },
  { "displayName": "Starflare (Nova)", "providerVoiceId": "Tm92YQ==", "voiceToken": "Tm92YQ==", "enabled": true },
  { "displayName": "Core Guardian (Kore)", "providerVoiceId": "S29yZQ==", "voiceToken": "S29yZTI=", "enabled": true },
  { "displayName": "Wolf Titan (Fenrir)", "providerVoiceId": "RmVucmly", "voiceToken": "RmVucmly", "enabled": true },
  { "displayName": "Echo Valkyrie (Aoede)", "providerVoiceId": "QW9lZGU=", "voiceToken": "QW9lZGU=", "enabled": true }
];

export function resolveVoiceToken(token: string): string {
  const normToken = token.trim();
  const entry = voiceRegistry.find(v => 
    v.voiceToken === normToken || 
    v.displayName.toLowerCase() === normToken.toLowerCase()
  );
  if (entry) {
    return decodeBase64(entry.providerVoiceId);
  }
  return 'Aoede'; // fallback
}

