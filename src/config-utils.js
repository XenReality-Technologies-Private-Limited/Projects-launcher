// Encode a config object to a base64 URL-safe string.
export function encodeConfig(config) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(config))));
}

// Decode a base64 string back to a config object.
export function decodeConfig(token) {
  try {
    const json = decodeURIComponent(escape(atob(token)));
    const config = JSON.parse(json);
    if (!config.kpis || !Array.isArray(config.kpis)) throw new Error('Invalid config shape');
    return config;
  } catch (e) {
    throw new Error('Malformed dashboard URL');
  }
}
