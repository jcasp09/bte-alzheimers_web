import { useEffect, useState } from 'react'
import { getThemeColor, subscribeToThemeChange } from '../../settings/theme'

/** Returns the resolved value of a theme CSS custom property and re-renders
 *  whenever the active theme changes. Each call subscribes once. */
export function useThemeColor(varName: string): string {
  const [color, setColor] = useState(() => getThemeColor(varName))
  useEffect(() => {
    return subscribeToThemeChange(() => {
      const next = getThemeColor(varName)
      if (next) setColor(next)
    })
  }, [varName])
  return color
}
