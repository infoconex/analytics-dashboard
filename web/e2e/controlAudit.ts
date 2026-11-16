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
    const openDialog = document.querySelector('dialog[open]');
    const controls = [...document.querySelectorAll<HTMLElement>(selector)]
      .filter(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (openDialog && !openDialog.contains(element)) return false;
        return rect.width > 0 && rect.height > 0 && style.visibility === 'visible'
          && style.display !== 'none';
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
        bounds: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
        center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        tooSmall: rect.width < 24 || rect.height < 24,
        textContrast: fg ? ratio(blend(fg, bg), bg) : null,
        borderContrast: style.borderStyle !== 'none' && parseFloat(style.borderWidth) > 0 && edge ? ratio(blend(edge, bg), bg) : null,
        outline: { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor },
        backgroundImage: style.backgroundImage === 'none' ? null : style.backgroundImage,
      };
    });
    const smallTargets = measurements.filter(item => item.tooSmall).map(item => {
      // The 24px circle cannot intersect a large target's rectangle, or the
      // corresponding 24px circle for another undersized target.
      const overlapping = measurements.filter(other => other.index !== item.index && (other.tooSmall
        ? Math.hypot(other.center.x - item.center.x, other.center.y - item.center.y) < 24
        : Math.hypot(
          Math.max(other.bounds.left - item.center.x, 0, item.center.x - other.bounds.right),
          Math.max(other.bounds.top - item.center.y, 0, item.center.y - other.bounds.bottom),
        ) < 12))
        .map(other => ({ name: other.name, role: other.role }));
      return { ...item, spacingExceptionCandidate: overlapping.length === 0, overlapping };
    });
    const textSamples = [...document.querySelectorAll<HTMLElement>('h1,h2,h3,p,label,small,strong,th,td,span')]
      .filter(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (openDialog && !openDialog.contains(element)) return false;
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility === 'visible'
          && [...element.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim());
      }).map(element => {
        const style = getComputedStyle(element);
        const fg = rgb(style.color);
        const bg = background(element);
        const size = parseFloat(style.fontSize);
        const weight = Number(style.fontWeight) || (style.fontWeight === 'bold' ? 700 : 400);
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        let complexBackground = false;
        for (let node: Element | null = element; node; node = node.parentElement) {
          const layer = getComputedStyle(node);
          if (layer.backgroundImage !== 'none' || Number(layer.opacity) < 1) complexBackground = true;
        }
        return {
          tag: element.tagName.toLowerCase(),
          text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 85),
          fontSize: size, fontWeight: weight,
          requiredRatio: large ? 3 : 4.5,
          computedRatio: fg ? ratio(blend(fg, bg), bg) : null,
          complexBackground,
        };
      });
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      forcedColors: matchMedia('(forced-colors: active)').matches,
      count: measurements.length, smallTargets, controls: measurements,
      textCount: textSamples.length,
      textContrastCandidates: textSamples.filter(sample => !sample.complexBackground && sample.computedRatio !== null
        && sample.computedRatio < sample.requiredRatio),
      textSamples,
      documentWidth: document.documentElement.scrollWidth,
      horizontalDocumentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      note: 'Computed text ratios are diagnostics for solid CSS backgrounds and direct text nodes, not antialiased pixels, gradients, SVG chart labels or every WCAG exception. Border ratios are diagnostic only; not every border is essential to identifying a control.',
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
