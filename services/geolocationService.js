const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

function isEnabled() {
  return process.env.AUDIT_GEOLOCATION_ENABLED === 'true';
}

function normalizeIp(ip) {
  if (!ip || typeof ip !== 'string') {
    return '';
  }

  const trimmed = ip.trim();
  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice(7);
  }

  return trimmed;
}

function isPrivateIp(ip) {
  if (!ip) {
    return true;
  }

  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true;
  }

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
  }

  const [a, b] = parts;
  return (
    a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a === 127
  );
}

function readCache(ip) {
  const entry = cache.get(ip);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(ip);
    return null;
  }

  return entry.value;
}

function writeCache(ip, value) {
  cache.set(ip, { value, cachedAt: Date.now() });
}

async function fetchGeolocation(ip) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city,lat,lon`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.status !== 'success') {
      return null;
    }

    return {
      country: data.country || undefined,
      city: data.city || undefined,
      coordinates: {
        latitude: typeof data.lat === 'number' ? data.lat : undefined,
        longitude: typeof data.lon === 'number' ? data.lon : undefined
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

class GeolocationService {
  static normalizeIp(ip) {
    return normalizeIp(ip);
  }

  static isPrivateIp(ip) {
    return isPrivateIp(normalizeIp(ip));
  }

  static clearCache() {
    cache.clear();
  }

  static async lookup(ip) {
    if (!isEnabled()) {
      return null;
    }

    const normalizedIp = normalizeIp(ip);
    if (!normalizedIp || isPrivateIp(normalizedIp)) {
      return null;
    }

    const cached = readCache(normalizedIp);
    if (cached !== null) {
      return cached;
    }

    try {
      const geolocation = await fetchGeolocation(normalizedIp);
      writeCache(normalizedIp, geolocation);
      return geolocation;
    } catch (err) {
      console.error('Geolocation lookup failed:', err.message);
      writeCache(normalizedIp, null);
      return null;
    }
  }
}

module.exports = GeolocationService;
