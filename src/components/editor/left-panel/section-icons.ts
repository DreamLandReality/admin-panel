export function getSectionIcon(id: string): string {
  const icons: Record<string, string> = {
    navigation: 'M3 12h18M3 6h18M3 18h18',
    hero: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z',
    properties: 'M3 5h18M3 10h18M3 15h18',
    'contact-form': 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    footer: 'M3 19h18M3 15h18M8 11h8',
    'error-page': 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    seo: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  }

  return icons[id] ?? 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
}
