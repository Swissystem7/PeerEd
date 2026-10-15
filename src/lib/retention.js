'use strict';
// PeerEd — explicit, immutable retention limits per data category (days). No category is retained indefinitely.

const RETENTION_POLICY = Object.freeze({
  profile: 730,
  match: 365
});

function getRetentionPolicy() {
  return RETENTION_POLICY;
}

module.exports = {
  getRetentionPolicy
};
