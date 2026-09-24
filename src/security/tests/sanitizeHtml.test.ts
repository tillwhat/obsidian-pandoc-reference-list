import {
  parseSanitizedHtmlFragment,
  stripNoPrintedFormToken,
} from '../sanitizeHtml';

function fragmentToHtml(fragment: DocumentFragment) {
  const wrap = document.createElement('div');
  wrap.append(fragment);
  return wrap.innerHTML;
}

describe('sanitizeHtml', () => {
  it('removes executable HTML', () => {
    const html = fragmentToHtml(
      parseSanitizedHtmlFragment(
        '<span onclick="alert(1)">safe</span><script>alert(1)</script>'
      )
    );

    expect(html).toBe('<span>safe</span>');
  });

  it('removes unsafe href protocols', () => {
    const html = fragmentToHtml(
      parseSanitizedHtmlFragment('<a href="javascript:alert(1)">x</a>')
    );

    expect(html).toBe('<a>x</a>');
  });

  it('keeps safe anchor URLs and hardens _blank links', () => {
    const html = fragmentToHtml(
      parseSanitizedHtmlFragment(
        '<a href="https://example.com" target="_blank">x</a>'
      )
    );

    expect(html).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>'
    );
  });

  it('strips [NO_PRINTED_FORM] marker only', () => {
    expect(stripNoPrintedFormToken('a [NO_PRINTED_FORM] b')).toBe('a b');
  });
});
