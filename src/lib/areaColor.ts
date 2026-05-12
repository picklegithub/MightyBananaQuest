/**
 * areaColor — theme-aware OKLCH area chip colours.
 *
 * Replaces hsl(hue, 40%, 92%) / hsl(hue, 55%, 38%) with OKLCH values that
 * stay perceptually consistent and adapt correctly in dark mode.
 *
 * Light:  bg L≈0.92, fg L≈0.40
 * Dark:   bg L≈0.23, fg L≈0.78
 */
export function areaColor(hue: number, variant: 'bg' | 'fg', isDark: boolean): string {
  if (isDark) {
    return variant === 'bg'
      ? `oklch(0.23 0.040 ${hue})`
      : `oklch(0.78 0.100 ${hue})`
  }
  return variant === 'bg'
    ? `oklch(0.92 0.030 ${hue})`
    : `oklch(0.40 0.110 ${hue})`
}
