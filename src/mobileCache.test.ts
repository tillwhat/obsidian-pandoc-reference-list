import { validateMobileCache } from './mobileCache';

const validCache = {
  version: 1,
  updatedAt: 1,
  bibliography: [{ id: 'key', title: 'Title' }],
  styles: { apa: '<style />' },
  locales: { 'en-US': '<locale />' },
};

describe('mobile bibliography cache', () => {
  it('accepts a versioned CSL cache', () => {
    expect(validateMobileCache(validCache)).toEqual(validCache);
  });

  it('rejects unsupported cache versions', () => {
    expect(() =>
      validateMobileCache({ ...validCache, version: 2 })
    ).toThrow('invalid or unsupported');
  });

  it('rejects entries without citekeys and titles', () => {
    expect(() =>
      validateMobileCache({
        ...validCache,
        bibliography: [{ id: 'key' }],
      })
    ).toThrow('invalid or unsupported');
  });
});
