import type { WaiterMessages } from './nl'

const en: WaiterMessages = {
  loading: 'Loading…',
  noAccess: 'You have no access to table service. Ask an admin to invite you (role Waiter).',
  noEvent: 'No event with an ordering mode "at the table". An admin sets that up in the event (Ordering modes).',
  chooseOrg: 'Which organisation?',
  chooseEvent: 'Which event?',
  tables: 'Tables',
  noTables: 'No tables yet. An admin makes them in the console (Tables).',
  states: { free: 'Free', occupied: 'Occupied', clearing: 'To clear' },
  back: 'Back',
  table: (name) => `Table ${name}`,
  seat: 'Seat guests',
  cleared: 'Cleared',
  order: 'Order',
  pay: 'Take payment',
  nothingYet: 'Nothing ordered yet.',
  toPay: 'To pay',
  less: (name) => `One ${name} less`,
  more: (name) => `One ${name} more`,
  send: (total) => `Send · ${total}`,
  paid: 'Paid',
  bancontact: 'Bancontact (QR on this screen)',
  scanBancontact: 'Let the guest scan this code with the Bancontact app.',
  sumup: (reader) => `SumUp · ${reader}`,
  onReader: (reader) => `The amount is on ${reader}. Let the guest pay.`,
  cashAtTill: (label) => `Cash? The guests pay at the till: tab "${label}".`,
}

export default en
