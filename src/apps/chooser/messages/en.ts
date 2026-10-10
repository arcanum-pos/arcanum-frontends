import type { ChooserMessages } from './nl'

const en: ChooserMessages = {
  title: 'What would you like to do?',
  pairTitle: 'Pair this device',
  pairHint: 'As a till or customer display, with a pairing code. An admin makes one in the console under Devices → Add device.',
  code: 'Pairing code',
  pair: 'Pair',
  busy: 'Working…',
  manageTitle: 'Management',
  manageHint: 'The console: menus, devices, users and reports.',
  manage: 'Go to the console',
  removed: 'This device is no longer paired (it was removed in the console). Pair it again with a new code.',
  pairedTitle: (name: string) => `This device is ${name}`,
  org: (name: string) => `Organisation: ${name}`,
  open: 'Open',
  replaceHint: 'You opened a pairing code. If you pair this browser with it, it stops being this device and you’ll have to pair that again later.',
  replaceYes: 'Pair with the new code',
  replaceNo: (name: string) => `No, open ${name}`,
  roles: { pos: 'a till', cfd: 'a customer display' },
}

export default en
