import { Capacitor } from '@capacitor/core'
import type { GameState } from './types'

const KEY = 'hexora_monetization'

/**
 * Leave these empty until the store accounts exist.
 * An empty rewarded unit, or a browser, uses the mock provider.
 * An empty RevenueCat key does the same for the Zen Pass.
 */
export const REWARDED_AD_UNIT_ID = ''
export const REVENUECAT_API_KEY = ''
export const ZEN_PASS_PRODUCT_ID = 'hexora_zen_pass'
export const ZEN_PASS_ENTITLEMENT = 'zen_pass'
export const ZEN_PASS_PRICE = '$2.99'

export interface MonetizationRecord {
  isZenPassUnlocked: boolean
}

export interface RewardedAdProvider {
  show: () => Promise<boolean>
}

export interface PurchaseProvider {
  purchaseZenPass: () => Promise<boolean>
  restore: () => Promise<boolean>
}

const empty = (): MonetizationRecord => ({ isZenPassUnlocked: false })

function read(): MonetizationRecord {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as Partial<MonetizationRecord>
    return { isZenPassUnlocked: parsed.isZenPassUnlocked === true }
  } catch {
    return empty()
  }
}

function write(record: MonetizationRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(record))
  } catch {
    // A full or private store should not crash the mosaic.
  }
}

export function loadMonetization(): MonetizationRecord {
  return read()
}

export function isZenPassUnlocked(): boolean {
  return read().isZenPassUnlocked
}

function nativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

function adsReady(): boolean {
  return nativeApp() && REWARDED_AD_UNIT_ID.length > 0
}

function billingReady(): boolean {
  return nativeApp() && REVENUECAT_API_KEY.length > 0
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/**
 * Mock rewarded video. Resolves true so the second-chance button can be tested
 * before `@capacitor-community/admob` is installed.
 */
async function mockRewarded(): Promise<boolean> {
  await wait(650)
  return true
}

/**
 * Live rewarded-ad slot.
 * Install `@capacitor-community/admob`, then replace this body:
 *
 *   import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob'
 *   await AdMob.initialize()
 *   await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_UNIT_ID })
 *   return await new Promise((resolve) => {
 *     const earned = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => resolve(true))
 *     const closed = AdMob.addListener(RewardAdPluginEvents.Dismissed, () => resolve(false))
 *     void AdMob.showRewardVideoAd().catch(() => resolve(false))
 *     void earned
 *     void closed
 *   })
 */
async function liveRewarded(): Promise<boolean> {
  return false
}

/**
 * Mock purchase. Unlocks the pass locally and never contacts a store.
 * Replace `livePurchase` once `@revenuecat/purchases-capacitor` is configured:
 *
 *   import { Purchases } from '@revenuecat/purchases-capacitor'
 *   await Purchases.configure({ apiKey: REVENUECAT_API_KEY })
 *   const offerings = await Purchases.getOfferings()
 *   const pack = offerings.current?.availablePackages.find((item) => item.identifier === ZEN_PASS_PRODUCT_ID)
 *   if (!pack) return false
 *   const { customerInfo } = await Purchases.purchasePackage({ aPackage: pack })
 *   return customerInfo.entitlements.active[ZEN_PASS_ENTITLEMENT] != null
 */
async function mockPurchase(): Promise<boolean> {
  await wait(280)
  write({ isZenPassUnlocked: true })
  return true
}

async function livePurchase(): Promise<boolean> {
  return false
}

async function liveRestore(): Promise<boolean> {
  return false
}

let rewarded: RewardedAdProvider = { show: () => (adsReady() ? liveRewarded() : mockRewarded()) }
let purchases: PurchaseProvider = {
  purchaseZenPass: () => (billingReady() ? livePurchase() : mockPurchase()),
  restore: async () => (billingReady() ? liveRestore() : read().isZenPassUnlocked),
}

export function setRewardedAdProvider(provider: RewardedAdProvider): void {
  rewarded = provider
}

export function setPurchaseProvider(provider: PurchaseProvider): void {
  purchases = provider
}

/** Resolves true only when the viewer earned the reward. */
export function showRewardedAd(): Promise<boolean> {
  if (isZenPassUnlocked()) return Promise.resolve(false)
  return rewarded.show()
}

export function purchaseZenPass(): Promise<boolean> {
  return purchases.purchaseZenPass().then((unlocked) => {
    if (unlocked) write({ isZenPassUnlocked: true })
    return read().isZenPassUnlocked
  })
}

export function restorePurchases(): Promise<boolean> {
  return purchases.restore().then((unlocked) => {
    write({ isZenPassUnlocked: unlocked })
    return unlocked
  })
}

/** Once per run. Harmony was 0; it returns at 30 and play continues. */
export function restoreHarmony(state: GameState): GameState {
  if (!state.gameOver || state.revived || state.victory) return state
  const harmony = Math.min(100, Math.max(0, state.harmony) + 30)
  return {
    ...state,
    harmony,
    gameOver: false,
    revived: true,
    log: 'A brief rest returns 30% harmony.',
  }
}
