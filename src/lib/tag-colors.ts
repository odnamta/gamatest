/**
 * Tag Color Presets
 * Tailwind-based color classes for tag badges
 * Requirements: V5 Feature Set 1 - Tagging System
 */

export interface TagColor {
  name: string
  value: string
  bgClass: string
  textClass: string
}

export const TAG_COLORS: TagColor[] = [
  {
    name: 'Red',
    value: 'red',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-300',
  },
  {
    name: 'Orange',
    value: 'orange',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    textClass: 'text-orange-700 dark:text-orange-300',
  },
  {
    name: 'Yellow',
    value: 'yellow',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
    textClass: 'text-yellow-700 dark:text-yellow-300',
  },
  {
    name: 'Green',
    value: 'green',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-700 dark:text-green-300',
  },
  {
    name: 'Blue',
    value: 'blue',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-300',
  },
  {
    name: 'Purple',
    value: 'purple',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    textClass: 'text-purple-700 dark:text-purple-300',
  },
  {
    name: 'Pink',
    value: 'pink',
    bgClass: 'bg-pink-100 dark:bg-pink-900/30',
    textClass: 'text-pink-700 dark:text-pink-300',
  },
  {
    name: 'Gray',
    value: 'gray',
    bgClass: 'bg-slate-100 dark:bg-slate-700',
    textClass: 'text-slate-700 dark:text-slate-300',
  },
]

/**
 * Get color classes for a tag color value
 */
export function getTagColorClasses(colorValue: string): { bgClass: string; textClass: string } {
  const color = TAG_COLORS.find((c) => c.value === colorValue)
  if (color) {
    return { bgClass: color.bgClass, textClass: color.textClass }
  }
  // Default to gray
  return {
    bgClass: 'bg-slate-100 dark:bg-slate-700',
    textClass: 'text-slate-700 dark:text-slate-300',
  }
}
