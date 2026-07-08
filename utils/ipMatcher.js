function parseIpv4(ip) {
  const parts = String(ip).trim().split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts;
}

function ipv4ToInt(parts) {
  return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function isValidIpv4(ip) {
  return parseIpv4(ip) !== null;
}

function isValidCidr(value) {
  const [ip, prefix] = String(value).trim().split('/');
  if (!prefix) {
    return isValidIpv4(ip);
  }

  const prefixNum = Number(prefix);
  if (!Number.isInteger(prefixNum) || prefixNum < 0 || prefixNum > 32) {
    return false;
  }

  return isValidIpv4(ip);
}

function ipMatchesCidr(ip, cidr) {
  const normalized = String(cidr).trim();
  if (!normalized.includes('/')) {
    return ip === normalized;
  }

  const [network, prefixStr] = normalized.split('/');
  const prefix = Number(prefixStr);
  const ipParts = parseIpv4(ip);
  const networkParts = parseIpv4(network);

  if (!ipParts || !networkParts) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToInt(ipParts) & mask) === (ipv4ToInt(networkParts) & mask);
}

function ipMatchesAllowlist(ip, entries = []) {
  const normalizedIp = String(ip || '').trim();
  if (!normalizedIp) {
    return false;
  }

  return entries.some((entry) => ipMatchesCidr(normalizedIp, entry.value || entry));
}

module.exports = {
  isValidIpv4,
  isValidCidr,
  ipMatchesCidr,
  ipMatchesAllowlist
};
