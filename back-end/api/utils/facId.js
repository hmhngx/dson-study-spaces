/**
 * Extract Dickinson faculty profile fac= query param from a profile URL.
 */
function extractFacId(url) {
  if (url == null || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const fac = new URL(trimmed).searchParams.get('fac');
    return fac && String(fac).trim() !== '' ? String(fac).trim() : null;
  } catch {
    return null;
  }
}

module.exports = { extractFacId };
