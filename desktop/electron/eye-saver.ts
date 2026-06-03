import type { WebContents } from 'electron';

const EYE_SAVER_ELEMENT_ID = '__gimme_job_eye_saver';

/**
 * Run `fn` with the eye-saver stylesheet temporarily disabled. The
 * vision pipeline (page-context capture for the agent, screenshot_region
 * tool calls) needs the page in its native colors so the model isn't
 * fed a dim teal monochrome render of the form. The dimming is restored
 * in `finally` even when `fn` throws so a failed capture never leaves
 * the user staring at unstyled Greenhouse forms.
 */
export async function withAssistEyeSaverDisabled<T>(
  webContents: WebContents,
  fn: () => Promise<T>,
): Promise<T> {
  const wasActive = await webContents
    .executeJavaScript(
      `(function(){
         var el = document.getElementById(${JSON.stringify(EYE_SAVER_ELEMENT_ID)});
         if (!el || el.disabled) return false;
         el.disabled = true;
         return true;
       })()`,
      true,
    )
    .catch(() => false);
  if (wasActive) {
    // One frame is enough for Chromium to recompute style + paint
    // without the eye-saver overrides.
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  try {
    return await fn();
  } finally {
    if (wasActive) {
      await webContents
        .executeJavaScript(
          `(function(){
             var el = document.getElementById(${JSON.stringify(EYE_SAVER_ELEMENT_ID)});
             if (el) el.disabled = false;
           })()`,
          true,
        )
        .catch(() => undefined);
    }
  }
}
