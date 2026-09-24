import { normalizeAndValidateStyleUrl } from '../desktopBibHelpers';

describe('normalizeAndValidateStyleUrl', () => {
  it('accepts HTTPS style URLs', () => {
    expect(
      normalizeAndValidateStyleUrl(
        'https://www.zotero.org/styles/chicago-author-date'
      ).toString()
    ).toBe('https://www.zotero.org/styles/chicago-author-date');
  });

  it('rejects non-HTTPS URLs', () => {
    expect(() =>
      normalizeAndValidateStyleUrl('http://www.zotero.org/styles/chicago')
    ).toThrow('Only HTTPS URLs are allowed');
  });

  it('rejects loopback and private network URLs', () => {
    expect(() =>
      normalizeAndValidateStyleUrl('https://127.0.0.1/styles/chicago')
    ).toThrow('Private or loopback IP addresses');
    expect(() =>
      normalizeAndValidateStyleUrl('https://192.168.1.10/styles/chicago')
    ).toThrow('Private or loopback IP addresses');
    expect(() =>
      normalizeAndValidateStyleUrl('https://localhost/styles/chicago')
    ).toThrow('Local hostnames are not allowed');
  });

  it('rejects credentialed URLs', () => {
    const credentialed = new URL('https://example.com/csl');
    credentialed.username = 'user';
    credentialed.password = 'pass';
    expect(() =>
      normalizeAndValidateStyleUrl(credentialed.toString())
    ).toThrow('must not include username or password');
  });
});
