/** Capture Ctrl+S even inside editors which stop keydown propagation. */
export function installModelSaveShortcut({ target, isEnabled, onSave, onError = console.error }) {
  let pending = false;
  let disposed = false;
  const handleKeyDown = event => {
    if (disposed || !isEnabled() || !event.ctrlKey || event.code !== "KeyS"
        || event.altKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat || pending) return;
    pending = true;
    // Invoke immediately so the caller captures the task before awaiting blur.
    try {
      Promise.resolve(onSave()).catch(onError).finally(() => { pending = false; });
    } catch (error) {
      pending = false;
      onError(error);
    }
  };
  target.addEventListener("keydown", handleKeyDown, true);
  return () => {
    disposed = true;
    target.removeEventListener("keydown", handleKeyDown, true);
  };
}
