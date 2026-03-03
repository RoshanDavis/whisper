const colors = [
  'bg-contact-1',
  'bg-contact-2',
  'bg-contact-3',
  'bg-contact-4',
  'bg-contact-5',
  'bg-contact-6',
  'bg-contact-7',
  'bg-contact-8',
  'bg-contact-9',
  'bg-contact-10',
  'bg-contact-11',
  'bg-contact-12',
];

export function getContactColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
