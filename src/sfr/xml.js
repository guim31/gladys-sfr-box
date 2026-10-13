// -----------------------------------------------------------------------------
// Minimal reader for the XML answers of the SFR Box API.
//
// Every answer is a flat `<rsp stat="ok|fail">` envelope whose payload sits in
// the attributes of a few elements (`<system .../>`, `<host .../>`...): no
// text nodes, at most one level of nesting (`<wlan><wl0 .../></wlan>`). A tag
// scanner covers that without an XML dependency, and never resolves entities
// beyond the five predefined ones and numeric references (no DTD, no XXE).
// -----------------------------------------------------------------------------

const TAG = /<([A-Za-z_][\w.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/g;
const ATTRIBUTE = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const ENTITY = /&(?:#x([0-9a-fA-F]+)|#(\d+)|(amp|lt|gt|quot|apos));/g;
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(value) {
  return value.replace(ENTITY, (match, hex, dec, named) => {
    if (named) {
      return NAMED_ENTITIES[named];
    }
    const codePoint = hex ? parseInt(hex, 16) : Number(dec);
    return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
  });
}

function parseAttributes(source) {
  const attributes = {};
  for (const [, name, doubleQuoted, singleQuoted] of source.matchAll(ATTRIBUTE)) {
    attributes[name] = decodeEntities(doubleQuoted ?? singleQuoted);
  }
  return attributes;
}

/**
 * Read an API answer.
 * @param {string} text raw body
 * @returns {{ stat: string, error: { code: string, msg: string } | null, elements: Array<{ name: string, attributes: object }> }}
 *   `elements` lists every element inside `<rsp>`, in document order.
 */
export function parseResponse(text) {
  let body = String(text).replace(/<!--[\s\S]*?-->/g, '');
  // Firmware 3DCM020200r015 leaves `<dsl ...` unclosed and closes it with a
  // stray `</firewall>` (fixture of hacf-fr/sfrbox-api): same repair.
  if (body.includes('</firewall>') && body.includes('<dsl')) {
    body = body.replace('</firewall>', '/>');
  }
  const elements = [];
  for (const [, name, attributes] of body.matchAll(TAG)) {
    elements.push({ name, attributes: parseAttributes(attributes) });
  }
  const root = elements.shift();
  if (!root || root.name !== 'rsp') {
    return null;
  }
  const err = elements.find((element) => element.name === 'err');
  return {
    stat: root.attributes.stat ?? '',
    error: err ? { code: err.attributes.code ?? '', msg: err.attributes.msg ?? '' } : null,
    elements,
  };
}
