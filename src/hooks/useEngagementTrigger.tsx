/**
 * ENGAGEMENT-BASED PUSH PROMPTING IS PERMANENTLY DISABLED.
 *
 * The old implementation tracked public browsing (product/article views, visit
 * counts, time on site) in localStorage, patched history.pushState and used
 * timers to decide when to raise a notification prompt. Public browsing must
 * not drive notification generation or background activity, so this hook is now
 * an inert no-op. Do not reintroduce counters, timers or history patching here.
 */
export function useEngagementTrigger(_enabled: boolean): boolean {
  return false;
}

export function markPushPrompted() {}
export function markPushDismissed() {}
export function markPushDenied() {}
