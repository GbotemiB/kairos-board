// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isPublicIp } from "@/lib/scrape/ip";

describe("isPublicIp", () => {
  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111", "2001:4860:4860::8888"])(
    "allows the public address %s",
    (address) => {
      expect(isPublicIp(address)).toBe(true);
    },
  );

  it.each([
    ["loopback", "127.0.0.1"],
    ["loopback range", "127.10.20.30"],
    ["private 10/8", "10.0.0.1"],
    ["private 172.16/12", "172.16.5.4"],
    ["private 172.31", "172.31.255.255"],
    ["private 192.168/16", "192.168.1.1"],
    ["cloud metadata", "169.254.169.254"],
    ["link-local", "169.254.1.1"],
    ["CGNAT", "100.64.0.1"],
    ["unspecified", "0.0.0.0"],
    ["broadcast", "255.255.255.255"],
    ["multicast", "224.0.0.1"],
    ["IPv6 loopback", "::1"],
    ["IPv6 unspecified", "::"],
    ["IPv6 link-local", "fe80::1"],
    ["IPv6 unique local", "fc00::1"],
    ["IPv6 unique local fd", "fd12:3456::1"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped private", "::ffff:10.0.0.1"],
    ["IPv4-mapped metadata", "::ffff:169.254.169.254"],
    ["6to4 embedding a private IPv4", "2002:c0a8:0101::1"],
    ["NAT64 embedding a private IPv4", "64:ff9b::a00:1"],
    ["Teredo", "2001:0000:4136:e378:8000:63bf:3fff:fdd2"],
  ])("blocks %s (%s)", (_name, address) => {
    expect(isPublicIp(address)).toBe(false);
  });

  it.each(["", "localhost", "example.org", "999.1.1.1", "1.2.3", "not an ip"])(
    "rejects the non-IP value %j",
    (value) => {
      expect(isPublicIp(value)).toBe(false);
    },
  );
});

describe("isPublicIp strict parsing", () => {
  it.each(["0x7f.0.0.1", "0177.0.0.1", "2130706433", "127.1"])(
    "rejects the legacy IPv4 notation %s",
    (value) => {
      expect(isPublicIp(value)).toBe(false);
    },
  );
});
