import { useColorScheme } from './use-color-scheme';

const light = {
  isDark: false as const,
  bg:          '#f2f4f8',
  card:        '#ffffff',
  cardAlt:     '#fafafa',
  inputBg:     '#f2f4f8',
  text:        '#1a1a1a',
  textSec:     '#666666',
  textMuted:   '#888888',
  border:      '#dddddd',
  settingsBtn: '#f0f0f0',
  planActive:  '#e8f5e9',
  planEmpty:   '#fff3e0',
  rowSep:      '#eeeeee',
};

const dark = {
  isDark: true as const,
  bg:          '#111214',
  card:        '#1e2025',
  cardAlt:     '#252830',
  inputBg:     '#2a2d34',
  text:        '#f0f0f0',
  textSec:     '#9ba1a8',
  textMuted:   '#6b7280',
  border:      '#3a3d44',
  settingsBtn: '#2a2d34',
  planActive:  '#1a3520',
  planEmpty:   '#2d2718',
  rowSep:      '#2e3138',
};

export type AppColors = typeof light;

export function useAppColors(): AppColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}
