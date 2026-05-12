import React from 'react'

/** True = show category hue colours; false = monochrome (B&W) */
export const ColorModeContext = React.createContext<boolean>(true)
export const useIsColorful = () => React.useContext(ColorModeContext)

/** Reactive dark-mode flag — observes data-theme on <html>. */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = React.useState(
    () => document.documentElement.dataset.theme === 'dark'
  )
  React.useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.dataset.theme === 'dark')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}
