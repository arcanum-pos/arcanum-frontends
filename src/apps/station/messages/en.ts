import type { StationMessages } from './nl'

const en: StationMessages = {
  title: 'Station screen',
  loading: 'Loading…',
  noStation: 'This screen isn’t linked to a station. Choose one in the console (Devices).',
  loadError: (error: string) => `Couldn’t load the tickets: ${error}`,
  onlyPaid: 'Paid only',
  showDelivered: 'Show delivered',
  columns: { ordered: 'Ordered', in_progress: 'In progress', ready: 'Ready', delivered: 'Delivered' },
  empty: 'Nothing',
  next: { ordered: 'Start', in_progress: 'Ready', ready: 'Delivered' },
  back: 'Back',
  unpaid: 'Not paid yet',
  onTab: 'On a tab',
  selfOrder: 'Self-order',
  ago: (minutes: number) => (minutes < 1 ? 'just now' : `${minutes} min ago`),
  voided: (count: number) => `${count} cancelled`,
  hiddenUnpaid: (count: number) => (count === 1 ? '1 unpaid order hidden' : `${count} unpaid orders hidden`),
  openPickup: 'Pickup screen',
  openPickupHint: 'Opens the screen for guests in a new window — drag it to a second screen.',
  pickupColumns: { received: 'Received', preparing: 'Being prepared', ready: 'Ready' },
  pickupNothing: 'Nothing yet',
  pickupReady: 'Collect your order here',
  soundOn: 'Turn sound on',
  soundOff: 'Turn sound off',
  soundTap: 'Tap to turn the sound on',
}

export default en
