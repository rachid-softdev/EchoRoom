const GOODBYE_PHRASES = [
  // English
  'goodbye',
  'bye',
  'hang up',
  'end call',
  "i'm done",
  "that's all",
  'see you later',
  'talk to you later',
  'i have to go',
  'i gotta go',
  'bye bye',
  'catch you later',
  // French
  'au revoir',
  'salut',
  'à bientôt',
  'à plus tard',
  'c\'est tout',
  'je dois y aller',
  'je vous remercie',
  'merci',
  'bonne journée',
  'bonne soirée',
]

export function detectGoodbye(text: string): boolean {
  const normalized = text.toLowerCase().trim()

  return GOODBYE_PHRASES.some((phrase) => normalized.includes(phrase))
}
