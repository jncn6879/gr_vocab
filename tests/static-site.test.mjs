import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds a GitHub Pages-ready Lexi app", async () => {
  const [html, page, workflow] = await Promise.all([
    readFile(new URL("../dist/index.html", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8"),
  ]);
  assert.match(html, /Lexi — Your Greek vocabulary/);
  assert.match(page, /localStorage/);
  assert.match(page, /Single word/);
  assert.match(page, /Export history/);
  assert.match(page, /Add to my history/);
  assert.match(page, /Math\.max\(existing\.wrongCount/);
  assert.match(page, /I got it wrong/);
  assert.match(workflow, /deploy-pages@v4/);
  await access(new URL("../dist/og.png", import.meta.url));
});
