import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'

/** Redraw after React commits, including removal of the last visible layer.
 * Demand rendering otherwise can leave the previous frame on the canvas.
 */
export function SceneRefresh() {
  const invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => {
    invalidate()
  })
  return null
}
