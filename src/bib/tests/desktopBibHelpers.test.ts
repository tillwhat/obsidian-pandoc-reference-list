import {
  mergeZoteroModifiedItems,
  normalizeAndValidateStyleUrl,
} from '../desktopBibHelpers';

describe('mergeZoteroModifiedItems', () => {
  it('replaces changed entries and adds new entries', () => {
    const changed = {
      id: 'changed',
      title: 'New title',
    };
    const added = {
      id: 'added',
      title: 'Added item',
    };

    const result = mergeZoteroModifiedItems(
      [{ id: 'changed', title: 'Old title' }],
      new Map([
        ['changed', changed],
        ['added', added],
      ])
    );

    expect(result).toEqual([changed, added]);
  });

  it('preserves a Zotero PDF attachment key on metadata refresh', () => {
    const changed = {
      id: 'changed',
      title: 'New title',
    };

    const result = mergeZoteroModifiedItems(
      [
        {
          id: 'changed',
          title: 'Old title',
          zoteroAttachmentKey: 'ATTACHMENT',
        } as any,
      ],
      new Map([['changed', changed]])
    );

    expect(result[0]).toMatchObject({
      id: 'changed',
      title: 'New title',
      zoteroAttachmentKey: 'ATTACHMENT',
    });
  });
});

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
