// electron-builder afterPack hook: strip Chromium locale .pak files down to
// English only. Chromium ships ~55 locales (~40 MB); we keep en-US. These are
// plain data files (not in the asar, not integrity-checked), so removing the
// unused ones is safe and shrinks the installer noticeably.
const fs = require('node:fs');
const path = require('node:path');

const KEEP = new Set(['en-US.pak']);

exports.default = async function afterPack(context) {
  const localesDir = path.join(context.appOutDir, 'locales');
  if (!fs.existsSync(localesDir)) return;
  let removed = 0;
  for (const file of fs.readdirSync(localesDir)) {
    if (file.endsWith('.pak') && !KEEP.has(file)) {
      fs.rmSync(path.join(localesDir, file));
      removed++;
    }
  }
  console.log(`  • afterPack: removed ${removed} unused locale files (kept en-US)`);
};
