const PREFIXES = [
  'Alpine',
  'Velvet',
  'Billy',
  'Neon',
  'Pygmy',
  'Cosmic',
  'Solar',
  'Turbo',
  'Shadow',
  'Golden',
  'Silver',
  'Mystic',
  'Retro',
  'Thunder',
  'Frosty',
  'Brave',
  'Wild',
  'Chill',
  'Starry',
  'Zen',
  'Hyper',
  'Pixel',
];

const GOAT_TERMS = [
  'Goat',
  'Kid',
  'Nomad',
  'Ibex',
  'Ace',
  'Billy',
  'Climber',
  'Ranger',
  'Captain',
  'Champion',
  'Hero',
  'Scout',
  'Hopper',
  'Rider',
  'Voyager',
  'Maverick',
  'Pilot',
];

export function generateRandomGoatUsername(): string {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const term = GOAT_TERMS[Math.floor(Math.random() * GOAT_TERMS.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${prefix}${term}${num}`;
}

export function getSavedUsername(): string {
  if (typeof window === 'undefined') return 'AlpineGoat42';
  try {
    const saved = localStorage.getItem('goatparty_username');
    if (saved && saved.trim()) {
      return saved.trim();
    }
    const fresh = generateRandomGoatUsername();
    localStorage.setItem('goatparty_username', fresh);
    return fresh;
  } catch {
    return generateRandomGoatUsername();
  }
}

export function saveUsername(username: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('goatparty_username', username.trim());
  } catch (e) {
    console.error('Failed to save username to localStorage', e);
  }
}
