import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

import {
  getBuildKey,
  getTagVersion,
  resolveWithin,
} from '../release/release.utils';
import { sessionOutput } from './release-screenshots.constants';
import { installScreenshot } from './release-screenshots.fixture';
import type { ScreenshotOptions } from './release-screenshots.types';

export const captureScreenshots = async (
  options: ScreenshotOptions,
): Promise<void> => {
  const palette: unknown = await import(
    pathToFileURL(resolve(options.source, 'src/app/app.constants.ts')).href
  );
  const presets: unknown = await import(
    pathToFileURL(
      resolve(options.source, 'src/app/terminal-tab/terminal-tab.constants.ts'),
    ).href
  );
  if (
    typeof palette !== 'object' ||
    palette === null ||
    !('themes' in palette) ||
    typeof palette.themes !== 'object' ||
    palette.themes === null
  )
    throw new Error('Missing tagged app palettes — check app.constants.ts');
  if (
    typeof presets !== 'object' ||
    presets === null ||
    !('tabIcons' in presets) ||
    !Array.isArray(presets.tabIcons) ||
    presets.tabIcons.length < 4 ||
    !presets.tabIcons.every(
      (icon: unknown): boolean => typeof icon === 'string',
    )
  )
    throw new Error(
      'Missing tagged app tab icons — check terminal-tab.constants.ts',
    );
  const themes = Object.keys(palette.themes);
  if (
    !themes.length ||
    !themes.every((theme): boolean => /^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(theme))
  )
    throw new Error(
      'Invalid screenshot palette name — use alphanumeric theme names',
    );
  const assets = resolve(options.source, 'dist/tiii-terminal-app/browser');
  if (!(await Bun.file(resolve(assets, 'index.html')).exists()))
    throw new Error(
      'Missing terminal frontend — run the Tauri build before capturing screenshots',
    );
  await mkdir(options.output, { recursive: true });
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: async (request): Promise<Response> => {
      const path = decodeURIComponent(new URL(request.url).pathname);
      const file = Bun.file(
        resolveWithin(assets, path === '/' ? 'index.html' : `.${path}`),
      );
      return (await file.exists())
        ? new Response(file)
        : new Response('Not found', { status: 404 });
    },
  });
  try {
    const browser = await chromium.launch();
    try {
      for (const theme of themes) {
        const page = await browser.newPage({
          viewport: { width: 1280, height: 680 },
          deviceScaleFactor: 1,
        });
        await page.addInitScript(installScreenshot, {
          theme,
          version: getTagVersion(options.tag),
          platform: options.platform.name,
          shell: options.platform.shell,
          icons: presets.tabIcons.slice(0, 4) as string[],
          output: sessionOutput,
        });
        await page.goto(server.url.toString());
        await page
          .locator('.xterm-rows')
          .filter({ hasText: 'Ready when you are.' })
          .first()
          .waitFor();
        await page.locator('.xterm-helper-textarea').first().blur();
        const prefix = `terminal-${options.tag}-${getBuildKey(options.platform.name, options.architecture)}`;
        await page.screenshot({
          path: resolveWithin(
            options.output,
            `${prefix}-${theme.toLowerCase().replaceAll(' ', '-')}.png`,
          ),
          animations: 'disabled',
        });
        if (theme === themes[0]) {
          await page.getByLabel('Application menu').click();
          await page
            .getByRole('menuitem', { name: 'Settings', exact: true })
            .click();
          await page.getByRole('tab', { name: 'Theme', exact: true }).click();
          await page.screenshot({
            path: resolveWithin(options.output, `${prefix}-settings.png`),
            animations: 'disabled',
          });
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    await server.stop(true);
  }
};
