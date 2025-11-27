/**
 * Heatmap intensity helper for study activity visualization.
 * Maps card review counts to color intensity levels.
 */

export type HeatmapIntensity = 0 | 1 | 2 | 3;

/**
 * Maps the number of cards reviewed to a heatmap color intensity level.
 * 
 * @param count - Number of cards reviewed
 * @returns Intensity level: 0 (empty), 1 (light), 2 (medium), 3 (dark)
 * 
 * Mapping:
 * - 0 cards → intensity 0 (empty)
 * - 1-5 cards → intensity 1 (light)
 * - 6-15 cards → intensity 2 (medium)
 * - 16+ cards → intensity 3 (dark)
 */
export function getHeatmapIntensity(count: number): HeatmapIntensity {
  if (count <= 0) {
    return 0;
  }
  if (count <= 5) {
    return 1;
  }
  if (count <= 15) {
    return 2;
  }
  return 3;
}
