export interface VoiceEntry {
  displayName: string;
  providerVoiceId: string; // Base64 encoded original voice name
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
  { "displayName": "Skyblade", "providerVoiceId": "WmVwaHly", "voiceToken": "WmVwaHly", "enabled": true },
  { "displayName": "Night Spark", "providerVoiceId": "UHVjaw==", "voiceToken": "UHVjaw==", "enabled": true },
  { "displayName": "Shadow Ferryman", "providerVoiceId": "Q2hhcm9u", "voiceToken": "Q2hhcm9u", "enabled": true },
  { "displayName": "Moon Sentinel", "providerVoiceId": "THVuYQ==", "voiceToken": "THVuYQ==", "enabled": true },
  { "displayName": "Starflare", "providerVoiceId": "Tm92YQ==", "voiceToken": "Tm92YQ==", "enabled": true },
  { "displayName": "Core Guardian", "providerVoiceId": "S29yZQ==", "voiceToken": "S29yZQ==", "enabled": true },
  { "displayName": "Wolf Titan", "providerVoiceId": "RmVucmly", "voiceToken": "RmVucmly", "enabled": true },
  { "displayName": "Quantum Swan", "providerVoiceId": "TGVkYQ==", "voiceToken": "TGVkYQ==", "enabled": true },
  { "displayName": "Solar Judge", "providerVoiceId": "T3J1cw==", "voiceToken": "T3J1cw==", "enabled": true },
  { "displayName": "Echo Valkyrie", "providerVoiceId": "QW9lZGU=", "voiceToken": "QW9lZGU=", "enabled": true },
  { "displayName": "Crystal Oracle", "providerVoiceId": "Q2FsbGlycmhvZQ==", "voiceToken": "Q2FsbGlycmhvZQ==", "enabled": true },
  { "displayName": "Autono Star", "providerVoiceId": "QXV0b25vZQ==", "voiceToken": "QXV0b25vZQ==", "enabled": true },
  { "displayName": "Ice Colossus", "providerVoiceId": "RW5jZWxhZHVz", "voiceToken": "RW5jZWxhZHVz", "enabled": true },
  { "displayName": "Deep Horizon", "providerVoiceId": "SWFwZXR1cw==", "voiceToken": "SWFwZXR1cw==", "enabled": true },
  { "displayName": "Umbra Knight", "providerVoiceId": "VW1icmllbA==", "voiceToken": "VW1icmllbA==", "enabled": true },
  { "displayName": "Twin Nova", "providerVoiceId": "QWxnaWViYQ==", "voiceToken": "QWxnaWViYQ==", "enabled": true },
  { "displayName": "Mirror Phantom", "providerVoiceId": "RGVzcGluYQ==", "voiceToken": "RGVzcGluYQ==", "enabled": true },
  { "displayName": "Emerald Comet", "providerVoiceId": "RXJpbm9tZQ==", "voiceToken": "RXJpbm9tZQ==", "enabled": true },
  { "displayName": "Star Forge", "providerVoiceId": "QWxnZW5pYg==", "voiceToken": "QWxnZW5pYg==", "enabled": true },
  { "displayName": "Red Giant", "providerVoiceId": "UmFzYWxnZXRoaQ==", "voiceToken": "UmFzYWxnZXRoaQ==", "enabled": true },
  { "displayName": "Sea Warden", "providerVoiceId": "TGFvbWVkZWlh", "voiceToken": "TGFvbWVkZWlh", "enabled": true },
  { "displayName": "River Star", "providerVoiceId": "QWNoZXJuYXI=", "voiceToken": "QWNoZXJuYXI=", "enabled": true },
  { "displayName": "Orion Bolt", "providerVoiceId": "QWxuaWxhbQ==", "voiceToken": "QWxuaWxhbQ==", "enabled": true },
  { "displayName": "Crown Shield", "providerVoiceId": "U2NoZWRhcg==", "voiceToken": "U2NoZWRhcg==", "enabled": true },
  { "displayName": "Southern Cross", "providerVoiceId": "R2FjcnV4", "voiceToken": "R2FjcnV4", "enabled": true },
  { "displayName": "Bright Pulse", "providerVoiceId": "UHVjY2hlcnJpbWE=", "voiceToken": "UHVjY2hlcnJpbWE=", "enabled": true },
  { "displayName": "Silent Arrow", "providerVoiceId": "QWNoaXJk", "voiceToken": "QWNoaXJk", "enabled": true },
  { "displayName": "Libra Blade", "providerVoiceId": "WnViZW5lbGdlbnViaQ==", "voiceToken": "WnViZW5lbGdlbnViaQ==", "enabled": true },
  { "displayName": "Storm Herald", "providerVoiceId": "VmluZGVtaWF0cml4", "voiceToken": "VmluZGVtaWF0cml4", "enabled": true },
  { "displayName": "Lucky Signal", "providerVoiceId": "U2FkYWNoYmlh", "voiceToken": "U2FkYWNoYmlh", "enabled": true },
  { "displayName": "Rain Guardian", "providerVoiceId": "U2FkYWx0YWdlcg==", "voiceToken": "U2FkYWx0YWdlcg==", "enabled": true },
  { "displayName": "Arrow Crown", "providerVoiceId": "U3VsYWZhdA==", "voiceToken": "U3VsYWZhdA==", "enabled": true }
];

export function resolveVoiceToken(token: string): string {
  const normToken = token.trim();
  const entry = voiceRegistry.find(v => 
    v.voiceToken === normToken || 
    decodeBase64(v.providerVoiceId).toLowerCase() === normToken.toLowerCase() || 
    v.displayName.toLowerCase() === normToken.toLowerCase()
  );
  if (entry) {
    return decodeBase64(entry.providerVoiceId);
  }
  // If not found, try raw base64 decode mapping
  try {
    const decoded = decodeBase64(normToken);
    if (decoded && decoded.length > 1 && /^[a-zA-Z]+$/.test(decoded)) {
      return decoded;
    }
  } catch {
    // ignore
  }
  return 'Aoede'; // fallback
}

