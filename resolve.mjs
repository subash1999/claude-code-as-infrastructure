#!/usr/bin/env node
// Minimal slot resolver (Part 1 + Part 2).
//
// resolve(slot, { policy }) returns the model a capability slot points to.
// - Walks the fallback chain if the current model is unhealthy.
// - Under the "pii_safe" policy, blocks any slot whose vendor is not on the
//   pii_safe trusted_vendors allowlist (the firewall enforcement from Part 2).
//
// Run: node resolve.mjs cheap_bulk           -> resolves normally
//      node resolve.mjs cheap_bulk pii_safe  -> blocked (vendor not trusted)

import { readFileSync } from "node:fs";
import { parse } from "yaml"; // npm i yaml  (or swap for any YAML parser)

const registry = parse(readFileSync(new URL("./model-registry.example.yaml", import.meta.url))).capabilities;

class RoutingBlocked extends Error {}

function healthy(slot) {
  return (slot.health?.error_rate_24h ?? 0) < 0.2 && slot.health?.trust !== "low";
}

export function resolve(slotName, { policy = "default" } = {}) {
  const slot = registry[slotName];
  if (!slot) throw new Error(`unknown slot: ${slotName}`);

  // Firewall: in a sensitive session, only trusted vendors may resolve.
  if (policy === "pii_safe") {
    const allowed = registry.pii_safe.trusted_vendors;
    if (!allowed.includes(slot.vendor)) {
      throw new RoutingBlocked(`${slotName} blocked: vendor "${slot.vendor}" not in pii_safe allowlist ${JSON.stringify(allowed)}`);
    }
  }

  if (healthy(slot)) return slot.current;
  for (const candidate of slot.fallback ?? []) return candidate; // first healthy-by-assumption fallback
  return slot.current; // nothing better, return current anyway
}

// CLI demo
if (import.meta.url === `file://${process.argv[1]}`) {
  const [slot, policy = "default"] = process.argv.slice(2);
  try {
    console.log(`${slot} (${policy}) -> ${resolve(slot, { policy })}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
