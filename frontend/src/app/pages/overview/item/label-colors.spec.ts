import { labelColors } from './label-colors';

describe('labelColors', () => {
  it('uses the label colour as background', () => {
    expect(labelColors('d73a4a').background).toBe('#d73a4a');
  });

  it.each([
    ['ededed', 'dark'],
    ['fbca04', 'dark'],
    ['a2eeef', 'dark'],
    ['0e8a16', 'light'],
    ['5319e7', 'light'],
    ['1d76db', 'light'],
  ])('label colour %s gets %s text', (color, text) => {
    expect(labelColors(color).text).toBe(`var(--hoot-on-label-${text})`);
  });
});
