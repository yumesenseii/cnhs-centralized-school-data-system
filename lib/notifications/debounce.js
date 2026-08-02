/**
 * Trailing-edge debounce. Marking many notifications as read emits one
 * Realtime event per row, so refetches are collapsed into a single call.
 */
export function debounce(fn, wait = 250) {
  let timer = null;

  function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  }

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return debounced;
}
