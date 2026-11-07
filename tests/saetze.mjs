/*
 * Sätze abhaken, wie man sie tippt – auch einseitige.
 *
 * Seit v255 hat ein Satz „je Bein" zwei Haken, links und rechts
 * (data-act="toggle-side"), und ist erst mit beiden einer. Tests, die einen
 * Satz einer Übung abhaken, gehen durch diese zwei Helfer – dann müssen sie
 * nicht wissen, ob die Übung gerade einseitig ist, und ein neuer Plan, der
 * eine andere Übung an diese Stelle setzt, bricht sie nicht.
 */

/** Satz `i` der Übung `id` abhaken – beide Seiten, wenn sie einseitig ist. Gab es einen Knopf? */
export async function satzTippen(page, id, i, warte = 60) {
  const ganz = page.locator(`[data-act="toggle-set"][data-ex="${id}"][data-i="${i}"]`);
  if (await ganz.count()) {
    await ganz.first().click();
    await page.waitForTimeout(warte);
    return true;
  }
  let da = false;
  for (const s of ['l', 'r']) {
    const b = page.locator(`[data-act="toggle-side"][data-ex="${id}"][data-i="${i}"][data-seite="${s}"][aria-pressed="false"]`);
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(warte);
      da = true;
    }
  }
  return da;
}

/** Den nächsten offenen Satz der Übung `id` abhaken. Gab es noch einen? */
export async function naechsterSatz(page, id, warte = 60) {
  const ganz = page.locator(`[data-act="toggle-set"][data-ex="${id}"][aria-pressed="false"]`);
  if (await ganz.count()) {
    await ganz.first().click();
    await page.waitForTimeout(warte);
    return true;
  }
  const seite = page.locator(`[data-act="toggle-side"][data-ex="${id}"][aria-pressed="false"]`);
  if (!(await seite.count())) return false;
  return satzTippen(page, id, await seite.first().getAttribute('data-i'), warte);
}
