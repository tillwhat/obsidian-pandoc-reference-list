const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'br',
  'div',
  'em',
  'i',
  'li',
  'ol',
  'p',
  'span',
  'strong',
  'sub',
  'sup',
  'ul',
]);

const DROP_WITH_CONTENT_TAGS = new Set([
  'iframe',
  'object',
  'script',
  'style',
  'svg',
  'math',
  'template',
]);

const GLOBAL_ALLOWED_ATTRIBUTES = new Set(['class', 'dir', 'lang']);
const ALLOWED_ANCHOR_ATTRIBUTES = new Set([
  'aria-label',
  'href',
  'rel',
  'target',
  'title',
]);
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'zotero:']);

function isSafeLink(href: string) {
  if (!href) return false;
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) return true;

  try {
    const url = new URL(trimmed);
    return SAFE_LINK_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

export function sanitizeElementTree(root: ParentNode) {
  const toProcess = Array.from(root.querySelectorAll('*'));
  for (const element of toProcess) {
    const tag = element.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      const parent = element.parentNode;
      if (!parent) continue;
      if (DROP_WITH_CONTENT_TAGS.has(tag)) {
        parent.removeChild(element);
      } else {
        parent.replaceChild(document.createTextNode(element.textContent || ''), element);
      }
      continue;
    }

    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase();
      if (attrName.startsWith('on')) {
        element.removeAttribute(attr.name);
        continue;
      }

      const isGlobal = GLOBAL_ALLOWED_ATTRIBUTES.has(attrName);
      const isAnchorAllowed =
        tag === 'a' && ALLOWED_ANCHOR_ATTRIBUTES.has(attrName);
      if (!isGlobal && !isAnchorAllowed) {
        element.removeAttribute(attr.name);
      }
    }

    if (tag === 'a') {
      const href = element.getAttribute('href');
      if (!href || !isSafeLink(href)) {
        element.removeAttribute('href');
      }

      if (element.getAttribute('target') === '_blank') {
        element.setAttribute('rel', 'noopener noreferrer');
      }
    }
  }
}

export function parseSanitizedHtmlFragment(html: string) {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  sanitizeElementTree(body);

  const fragment = document.createDocumentFragment();
  fragment.append(...Array.from(body.childNodes));
  return fragment;
}

export function stripNoPrintedFormToken(value: string) {
  return value.replace(/\[NO_PRINTED_FORM\] */g, '');
}
