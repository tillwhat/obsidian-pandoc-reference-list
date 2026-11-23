import {
  MOBILE_CACHE_FOLDER,
  MOBILE_CACHE_PATH,
  validateMobileCache,
} from './mobileCache';

const validCache = {
  version: 1,
  updatedAt: 1,
  bibliography: [{ id: 'key', title: 'Title' }],
  styles: { apa: '<style />' },
  locales: { 'en-US': '<locale />' },
};

describe('mobile bibliography cache', () => {
  it('uses a vault-visible cache folder', () => {
    expect(MOBILE_CACHE_FOLDER).toBe('_tillwhat-pandoc-reference-list');
    expect(MOBILE_CACHE_PATH).toBe(
      '_tillwhat-pandoc-reference-list/mobile-cache.json'
    );
  });

  it('accepts a versioned CSL cache', () => {
    expect(validateMobileCache(validCache)).toEqual(validCache);
  });

  it('rejects unsupported cache versions', () => {
    expect(() =>
      validateMobileCache({ ...validCache, version: 2 })
    ).toThrow('invalid or unsupported');
  });

  it('accepts entries without titles', () => {
    expect(
      validateMobileCache({
        ...validCache,
        bibliography: [{ id: 'key' }],
      }).bibliography
    ).toEqual([{ id: 'key' }]);
  });

  it('rejects entries without citekeys', () => {
    expect(() =>
      validateMobileCache({
        ...validCache,
        bibliography: [{ title: 'Title' }],
      })
    ).toThrow('invalid or unsupported');
  });
});
