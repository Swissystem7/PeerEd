'use strict';
// PeerEd - geographic region codes for the first municipality-scale deployment.
// CommonJS on purpose (see PURPOSE.md). No clock, no randomness, no network, no personal data.

const REGIONS = Object.freeze(['NORTH', 'HAIFA', 'CENTER', 'TEL_AVIV', 'JERUSALEM', 'SOUTH']);

// True only for a string that is exactly one of REGIONS.
function isRegion(code) {
  return typeof code === 'string' && REGIONS.indexOf(code) !== -1;
}

function getValidRegions() {
  return REGIONS;
}

// Trim + upper-case, then validate. Returns the code or null.
function normalizeRegion(input) {
  if (typeof input !== 'string') return null;
  const code = input.trim().toUpperCase();
  return isRegion(code) ? code : null;
}

module.exports = { REGIONS, isRegion, getValidRegions, normalizeRegion };
