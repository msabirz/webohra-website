/**
 * Scrolls to and briefly highlights the first invalid field after a
 * failed form submit (2026-09-04, user's own ask — validation errors
 * "are not attention seeking, its suggestable to have kind of auto
 * scroll or highlight"). Plain DOM manipulation, not React state, so any
 * form can call this on its existing `id="..."` inputs without adding a
 * ref/highlight-state per field — matches `<Field htmlFor="x">` +
 * `<input id="x">`'s existing pairing already used throughout
 * components/form.tsx callers.
 *
 * `errorKeys` — the object keys of whatever error map the caller just
 * set (Object.keys(errors)); this only acts on the first one that's
 * actually reachable in the DOM (a dynamic/hidden field's error is still
 * shown inline, just nothing here to scroll to).
 */
export function scrollToFirstError(errorKeys: string[]): void {
  for (const key of errorKeys) {
    const el = document.getElementById(key);
    if (!el) continue;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
    setTimeout(() => {
      el.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
    }, 2200);
    if (typeof (el as HTMLElement & { focus?: () => void }).focus === 'function') {
      (el as HTMLElement).focus({ preventScroll: true });
    }
    return;
  }
}
