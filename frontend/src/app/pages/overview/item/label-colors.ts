/** How a label chip is coloured: GitHub's colour as fill, and text that stays readable on it. */
export interface LabelColors {
  background: string;
  text: string;
}

/**
 * Pick dark or white text for a label colour ("d73a4a"), whichever has more contrast
 * (WCAG relative luminance), as GitHub does.
 */
export function labelColors(color: string): LabelColors {
  const background = `#${color}`;
  const darkTextWins =
    contrast(luminance(color), DARK_TEXT_LUMINANCE) >= contrast(luminance(color), 1);
  return {
    background,
    text: darkTextWins ? 'var(--hoot-on-label-dark)' : 'var(--hoot-on-label-light)',
  };
}

/** Luminance of #1f2328, the dark label text in `styles.css`. */
const DARK_TEXT_LUMINANCE = luminance('1f2328');

function luminance(color: string): number {
  const [red, green, blue] = [0, 2, 4].map((start) => {
    const channel = parseInt(color.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: number, second: number): number {
  const [lighter, darker] = first > second ? [first, second] : [second, first];
  return (lighter + 0.05) / (darker + 0.05);
}
