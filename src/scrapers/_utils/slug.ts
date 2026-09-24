export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function slugFromHref(href: string | undefined, fallback: string): string {
  if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
    const cleaned = href.split('?')[0].replace(/\/$/, '');
    const segments = cleaned.split('/').filter(Boolean);
    if (segments.length > 0) {
      const slug = segments[segments.length - 1]!.replace(/\.html$/, '');
      if (slug) return slug;
    }
  }
  return slugify(fallback);
}
