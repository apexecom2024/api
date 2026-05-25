export interface ModelEntry {
  publicName: string;
  publicModelId: string;
  provider: string;
  providerModelId: string;
  status: 'whitelisted' | 'deprecated';
  owner: string;
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

export const modelRegistry: ModelEntry[] = [
  {
    publicName: "Pluto 1.0",
    publicModelId: "pluto-1.0-live",
    provider: "Z29vZ2xlLWdlbWluaS1saXZlLWF1ZGlv",
    providerModelId: "Z2VtaW5pLTIuNS1mbGFzaC1uYXRpdmUtYXVkaW8tcHJldmlldy0wOS0yMDI1",
    status: "whitelisted",
    owner: "Eburon AI"
  }
];

export function resolveModelId(publicModelId: string): string | null {
  const entry = modelRegistry.find(m => m.publicModelId === publicModelId);
  if (entry && entry.status === 'whitelisted') {
    return decodeBase64(entry.providerModelId);
  }
  return null;
}

