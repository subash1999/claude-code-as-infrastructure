// Privacy firewall, the two enforcement points (Part 2).
//
// 1) selectPolicy(cwd): the working directory decides whether the session is
//    locked to a trusted vendor.
// 2) maybeWriteLearning(text): drop sensitive memory before it is ever stored.
//
// Everything here is a CONVENTION enforced in config code. There is nothing at
// the network layer. Describe sensitive folders by a neutral tag, never by what
// they contain.

// Mark folders sensitive by convention. Keep this list out of any public dump.
const SENSITIVE_PREFIXES = [
  "/work/notes/_private/",
  "/work/vault/",
  // add more by convention, not by category name
];

export function selectPolicy(cwd) {
  return SENSITIVE_PREFIXES.some((p) => cwd.startsWith(p)) ? "pii_safe" : "default";
}

// --- Memory drop ---------------------------------------------------------
// A Stop hook runs after each turn and may save "learnings". Classify first,
// and drop the sensitive tier before writing. Fail closed: if classification
// errors, drop rather than write.

function classify(text) {
  // Replace with a fast cheap classifier. Keep markers in a private file.
  try {
    if (looksSensitive(text)) return "private_high";
    if (looksPersonal(text)) return "private_medium";
    return "public_safe";
  } catch {
    return "private_high"; // fail closed
  }
}

export function maybeWriteLearning(text, store) {
  const tier = classify(text);
  if (tier === "private_high") {
    store.bumpDroppedCounter(); // count it, write nothing
    return;
  }
  store.write(text, { tier });
}

// Stubs, supply your own markers/model in a private module.
function looksSensitive(_t) { return false; }
function looksPersonal(_t) { return false; }
