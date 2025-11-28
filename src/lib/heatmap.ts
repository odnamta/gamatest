/**
 * Heatmap intensity helper for study activity visualization.
 * Maps card review counts to color intensity levels.
 */

export type HeatmapIntensity = 0 | 1 | 2 | 3;

export interface DayData {
  date: string;      // ISO date string (YYYY-MM-DD)
  count: number;     // cards reviewed
  intensity: HeatmapIntensity;
}

/**
 * Generates an array of day data for the heatmap.
 * Days are ordered from oldest to newest (chronological order).
 * 
 * @param dayCount - Number of days to generate (e.g., 28 for mobile, 60 for desktop)
 * @param logMap - Map of date strings to card review counts
 * @returns Array of DayData ordered oldest to newest
 * 
 * Requirements: 1.4 - Days ordered from oldest to newest with most recent at end
 */
export function generateDayArray(
  dayCount: number,
  logMap: Map<string, number>
): DayData[] {
  const result: DayData[] = [];
  const today = new Date();
  
  // Generate days from (dayCount - 1) days ago to today
  // This ensures oldest day is first, newest (today) is last
  for (let i = dayCount - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = logMap.get(dateStr) || 0;
    
    result.push({
      date: dateStr,
      count,
      intensity: getHeatmapIntensity(count),
    });
  }
  
  return result;
}

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
