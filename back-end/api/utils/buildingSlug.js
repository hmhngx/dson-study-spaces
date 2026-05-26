/** Slug for static building names (matches front-end convertToIdFormat). */
function buildingSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[.,']/g, '')
    .replace(/[^a-z0-9-]/g, '');
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(String(value).trim());
}

module.exports = { buildingSlug, isUuid };
