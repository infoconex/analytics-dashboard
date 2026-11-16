import type { Page } from '@playwright/test';

/** Measurements from the rendered browser, not estimates from design tokens. */
export async function auditControls(page: Page) {
  return page.evaluate(() => {
    type RGB = [number, number, number, number];
    const rgb = (value: string): RGB | null => {
      const channels = value.match(/[\d.]+/g)?.map(Number);
      return channels && channels.length >= 3
        ? [channels[0]!, channels[1]!, channels[2]!, channels[3] ?? 1] : null;
    };
    const blend = (front: RGB, back: RGB): RGB => [
      front[0] * front[3] + back[0] * (1 - front[3]),
      front[1] * front[3] + back[1] * (1 - front[3]),
      front[2] * front[3] + back[2] * (1 - front[3]), 1,
    ];
    const background = (element: Element): RGB => {
      const ancestors: Element[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) ancestors.push(node);
      return ancestors.reverse().reduce<RGB>((paint, node) => {
        const layer = rgb(getComputedStyle(node).backgroundColor);
        return layer ? blend(layer, paint) : paint;
      }, [255, 255, 255, 1]);
    };
    const luminance = (value: RGB) => {
      const v = value.slice(0, 3).map(channel => {
        const normalized = channel / 255;
        return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
      });
      return v[0]! * .2126 + v[1]! * .7152 + v[2]! * .0722;
    };
    const ratio = (one: RGB, two: RGB) => {
      const [light, dark] = [luminance(one), luminance(two)].sort((a, b) => b - a);
      return Math.round(((light! + .05) / (dark! + .05)) * 100) / 100;
    };
    const selector = 'button,input,select,textarea,a[href],summary';
    const controls = [...document.querySelectorAll<HTMLElement>(selector)]
      .filter(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility === 'visible'
          && style.display !== 'none' && rect.right > 0 && rect.left < innerWidth
          && rect.bottom > 0 && rect.top < innerHeight;
      });
    const measurements = controls.map((element, index) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const bg = background(element);
      const fg = rgb(style.color);
      const edge = rgb(style.borderColor);
      const name = element.getAttribute('aria-label') ||
        (element instanceof HTMLInputElement ? element.labels?.[0]?.textContent?.trim() || element.placeholder : '') ||
        element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 85) || '';
      return {
        index, role: element.getAttribute('role') || element.tagName.toLowerCase(), name,
        className: typeof element.className === 'string' ? element.className : '',
        disabled: element.matches(':disabled'), selected: element.getAttribute('aria-pressed') || element.getAttribute('aria-selected'),
        width: Math.round(rect.width * 100) / 100, height: Math.round(rect.height * 100) / 100,
        center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        tooSmall: rect.width < 24 || rect.height < 24,
        textContrast: fg ? ratio(blend(fg, bg), bg) : null,
        borderContrast: style.borderStyle !== 'none' && parseFloat(style.borderWidth) > 0 && edge ? ratio(blend(edge, bg), bg) : null,
        outline: { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor },
        backgroundImage: style.backgroundImage === 'none' ? null : style.backgroundImage,
      };
    });
    const smallTargets = measurements.filter(item => item.tooSmall).map(item => {
      // WCAG 2.5.8 spacing exception: non-overlapping 24px diameter circles
      // centered on undersized targets; this is an approximation pending visual review.
      const overlapping = measurements.filter(other => other.index !== item.index
        && Math.hypot(other.center.x - item.center.x, other.center.y - item.center.y) < 24)
        .map(other => ({ name: other.name, role: other.role }));
      return { ...item, spacingExceptionCandidate: overlapping.length === 0, overlapping };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      forcedColors: matchMedia('(forced-colors: active)').matches,
      count: measurements.length, smallTargets, controls: measurements,
      horizontalDocumentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      note: 'Computed text ratios omit backgrounds with images, gradients, translucency, and text from descendants. Border ratios are diagnostic only; not every border is essential to identifying a control. Evaluate WCAG exceptions separately.',
    };
  });
}

export async function focusedControl(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const dialog = element.closest('dialog[open]');
    const topbar = document.querySelector('.topbar');
    const occlusionBoundary = dialog || topbar?.contains(element) ? 0 : (topbar?.getBoundingClientRect().bottom ?? 0);
    return {
      name: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 85),
      visibleFocus: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
      outlineColor: style.outlineColor, outlineWidth: style.outlineWidth,
      bounds: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
      occlusionBoundary,
      fullyUnobscured: rect.width > 0 && rect.height > 0 && rect.top >= occlusionBoundary + 1
        && rect.bottom <= innerHeight - 1 && rect.left >= 0 && rect.right <= innerWidth,
    };
  });
}
