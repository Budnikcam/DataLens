/**
 * Optional local override for Sheets web-app URL.
 * Prefer publishing via editor → data.json sources.sheetsApiUrl
 * so all visitors get the same URL after one «Сохранить на сайт».
 *
 * Leave empty in git. Paste only for local experiments:
 *   window.DASHBOARD_CONFIG.sheetsApiUrl = "https://script.google.com/.../exec";
 */
window.DASHBOARD_CONFIG = {
  sheetsApiUrl: ""
};
