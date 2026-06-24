const GeolocationService = require('../../services/geolocationService');

describe('GeolocationService', () => {
  beforeEach(() => {
    GeolocationService.clearCache();
    delete process.env.AUDIT_GEOLOCATION_ENABLED;
  });

  test('normalizeIp strips IPv4-mapped IPv6 prefix', () => {
    expect(GeolocationService.normalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1');
  });

  test('isPrivateIp detects loopback and RFC1918 ranges', () => {
    expect(GeolocationService.isPrivateIp('127.0.0.1')).toBe(true);
    expect(GeolocationService.isPrivateIp('10.0.0.5')).toBe(true);
    expect(GeolocationService.isPrivateIp('203.0.113.10')).toBe(false);
  });

  test('lookup returns null when geolocation is disabled', async () => {
    process.env.AUDIT_GEOLOCATION_ENABLED = 'false';
    const result = await GeolocationService.lookup('203.0.113.10');
    expect(result).toBeNull();
  });

  test('lookup returns null for private IPs without calling external API', async () => {
    process.env.AUDIT_GEOLOCATION_ENABLED = 'true';
    const fetchSpy = jest.spyOn(global, 'fetch');
    const result = await GeolocationService.lookup('127.0.0.1');
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test('lookup caches successful responses', async () => {
    process.env.AUDIT_GEOLOCATION_ENABLED = 'true';
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        country: 'United States',
        city: 'New York',
        lat: 40.7128,
        lon: -74.006
      })
    });

    const first = await GeolocationService.lookup('203.0.113.10');
    const second = await GeolocationService.lookup('203.0.113.10');

    expect(first.country).toBe('United States');
    expect(second.city).toBe('New York');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
  });
});
