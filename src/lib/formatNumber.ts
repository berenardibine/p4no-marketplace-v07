/**
 * Format large numbers with k/M/B suffixes
 * @param num The number to format
 * @returns Formatted string (e.g., "1.2k", "3.5M")
 */
export const formatNumber = (num: number): string => {
  if (num < 1000) return num.toString();
  if (num < 1000000) {
    const formatted = (num / 1000).toFixed(1);
    return formatted.endsWith('.0') ? `${Math.floor(num / 1000)}k` : `${formatted}k`;
  }
  if (num < 1000000000) {
    const formatted = (num / 1000000).toFixed(2);
    return formatted.endsWith('.00') ? `${Math.floor(num / 1000000)}M` : `${formatted}M`;
  }
  const formatted = (num / 1000000000).toFixed(2);
  return formatted.endsWith('.00') ? `${Math.floor(num / 1000000000)}B` : `${formatted}B`;
};

/**
 * Format number with commas for display
 * @param num The number to format
 * @returns Formatted string with commas (e.g., "1,234,567")
 */
export const formatNumberWithCommas = (num: number): string => {
  return num.toLocaleString('en-US');
};
