import { isIP } from "node:net";

import ipaddr from "ipaddr.js";

/**
 * True only for public unicast addresses. Blocks loopback, private, link-local
 * (incl. cloud metadata 169.254.169.254), CGNAT, multicast, reserved, and IPv6
 * transition ranges that can embed private IPv4 (6to4, Teredo, NAT64).
 * IPv4-mapped IPv6 (::ffff:10.0.0.1) is checked as the embedded IPv4.
 */
export function isPublicIp(address: string): boolean {
  // Strict format check first: ipaddr.js also accepts legacy shorthand like "1.2.3".
  if (isIP(address) === 0) {
    return false;
  }
  return ipaddr.process(address).range() === "unicast";
}
