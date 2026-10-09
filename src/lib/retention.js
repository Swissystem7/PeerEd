'use strict';
// PeerEd — explicit, immutable retention limits per data category (days). No category is retained indefinitely.

const RETENTION_POLICY = Object.freeze({
  profile: 365,
  match: 180
});

function getRetentionPolicy() {
  return RETENTION_POLICY;
}

module.exports = {
  getRetentionPolicy
};
