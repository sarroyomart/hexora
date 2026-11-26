import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { PlacementEffects } from './engine'

async function pulse(run: () => Promise<void>): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform()) return
    await run()
  } catch {
    // Browsers and WebViews without a haptic engine stay silent.
  }
}

/** Light tick when a finger snaps onto a legal hex, or a quiet tile lands. */
export function hapticLight(): void {
  void pulse(() => Haptics.impact({ style: ImpactStyle.Light }))
}

/** Success pulse for a multi-tile synergy or a seasonal cycle. */
export function hapticSuccess(): void {
  void pulse(() => Haptics.notification({ type: NotificationType.Success }))
}

/** Warning pulse for flood, drought, landslide, or extinction. */
export function hapticWarning(): void {
  void pulse(() => Haptics.notification({ type: NotificationType.Warning }))
}

export function hapticForPlacement(effects: PlacementEffects): void {
  const drought = effects.banner === 'Drought' || effects.detail === 'Drought'
  if (effects.imbalances.length > 0 || drought) {
    hapticWarning()
    return
  }
  if (effects.bounty || effects.rescue || effects.milestone || effects.surge || effects.points >= 4) {
    hapticSuccess()
    return
  }
  hapticLight()
}
