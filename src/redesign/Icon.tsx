export type IconName = 'dining' | 'shirt' | 'document' | 'wallet' | 'calendar' | 'target' | 'chart' | 'bank' | 'leaf' | 'layers' | 'house' | 'bolt' | 'heart' | 'subscription' | 'bag' | 'car' | 'more' | 'chevron' | 'refresh' | 'user' | 'menu' | 'close' | 'info';
const paths: Record<IconName, string> = {
  dining: 'M3 2v6c0 4 6 4 6 0V2M6 2v20M18 2c-5 4-5 10 0 10V2ZM18 12v10',
  shirt: 'm8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 5-8 5-8 0Z',
  document: 'M5 2h9l5 5v15H5V2ZM14 2v6h5M9 12h6M9 16h6',
  wallet: 'M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12v2M20 10h-6v5h6M16 12.5h.01',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1M8 2v6M16 2v6M4 10h16M8 14h2M14 14h2M8 17h2',
  target: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  chart: 'M4 20V11h3v9M10 20V4h3v16M16 20V8h3v12M21 20V2',
  bank: 'm2 9 10-6 10 6H2M4 12v7M9 12v7M15 12v7M20 12v7M2 22h20',
  leaf: 'M20 3C5 1 2 8 6 15c6 9 16 1 14-12M4 21 17 7M11 14l6 1',
  layers: 'm2 8 10-5 10 5-10 5-10-5M2 12l10 5 10-5M2 16l10 5 10-5',
  house: 'm2 11 10-9 10 9M5 9v12h5v-7h4v7h5V9',
  bolt: 'M13 2 5 14h7l-1 8 8-12h-7l1-8Z',
  heart: 'M12 21 3 12C-3 5 7-1 12 6c5-7 15-1 9 6l-9 9Z',
  subscription: 'M12 10C4 3 4 15 10 12M14 12c7-8-5-8-2-2M12 14c8 7 8-5 2-2M10 12c-7 8 5 8 2 2',
  bag: 'M5 7h14l2 14H3L5 7ZM8 8V5a4 4 0 0 1 8 0v3',
  car: 'm4 8 2-5h12l2 5M3 9h18v9H3V9ZM5 18v3M19 18v3M6 12h2M16 12h2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chevron: 'm9 5 7 7-7 7',
  refresh: 'M20 8a9 9 0 1 0 1 7M20 2v6h-6',
  user: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M3 22v-3c0-7 18-7 18 0v3',
  menu: 'M3 5h18M3 12h18M3 19h18',
  close: 'm5 5 14 14M19 5 5 19',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 11v6M12 7h.01',
};
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
export function categoryIcon(label: string): IconName {
  if (/horeca|restaurant|koffie|snack/i.test(label)) return 'dining';
  if (/kleding|schoen/i.test(label)) return 'shirt';
  if (/belasting|gemeente/i.test(label)) return 'document';
  if (/huur|alvast|hypotheek/i.test(label)) return 'house';
  if (/energie|stroom/i.test(label)) return 'bolt';
  if (/zorg|sauna|welzijn/i.test(label)) return 'heart';
  if (/abbo|abonne|simyo|telefoon|software|tool/i.test(label)) return 'subscription';
  if (/boodschap|winkel|spullen/i.test(label)) return 'bag';
  if (/tank|auto|vervoer/i.test(label)) return 'car';
  return 'more';
}
