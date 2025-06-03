# Website Issues & To-Do

## Critical / Blocking

1.  **Mobile Burger Menu Not Working**
    *   **Status:** Still not working despite DOCTYPE and CSP `connect-src` fixes.
    *   **Next Steps:**
        *   Investigate the `@import` rule in `style.css` (line 2677) as it might be affecting CSS parsing.
        *   If that doesn't help, re-verify JavaScript execution for the menu toggle, possibly by adding `console.log` statements within the event listener to confirm it's firing.

## CSS / Styling Issues

2.  **`@import` rule not at the top of `style.css`**
    *   **Location:** `style.css` line 2677.
    *   **Issue:** Violates CSS best practices; `@import` rules must precede all other rules (except `@charset` and `@layer`).
    *   **Next Step:** Read the content around this line in `style.css` and move the `@import` rule to the top of the file.

## Console Errors / Warnings (Potentially Non-Blocking for Menu)

3.  **Facebook Pixel `fbevents.js` Blocked**
    *   **Error:** `GET https://connect.facebook.net/en_US/fbevents.js net::ERR_BLOCKED_BY_CLIENT`
    *   **Status:** Still occurring. Likely due to ad blockers. CSP for `connect.facebook.net` is in `script-src`.
    *   **Next Step:** Acknowledge this is likely external; no direct code fix if CSP is correct.

4.  **`rt4oybt610` Uncaught TypeError**
    *   **Error:** `Cannot read properties of undefined (reading 'unshift')`
    *   **Status:** Still occurring. Possibly linked to GTM or other scripts not loading/initializing correctly.
    *   **Next Step:** May resolve if other script loading issues (like Facebook Pixel or issues caused by `@import` order) are fixed. Otherwise, might require GTM config check.

5.  **Clarity: `Error CL001: Multiple Clarity tags detected.`**
    *   **Status:** Still occurring.
    *   **Next Step:** If it persists after other fixes, investigate if GTM is also loading Clarity, or if the Clarity script tag is duplicated elsewhere.

6.  **Cookie Warnings (Third-Party Cookies / `SameSite`)**
    *   **Status:** Informational warnings about upcoming Chrome changes.
    *   **Next Step:** Primarily for future-proofing and ensuring services like Vimeo, Clarity, Google continue to work as third-party cookie policies evolve. Not an immediate bug fix unless directly causing a visible issue now.