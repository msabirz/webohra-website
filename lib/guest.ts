'use client';

/**
 * Client-generated identifier for guest Pin actions (FR-5b) — no account
 * needed. Lives only in this browser's localStorage, never sent anywhere
 * except as the anonymous key on listing_pins.user_id_or_session.
 */
const GUEST_ID_KEY = 'wb_guest_id';

export function getGuestId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}
