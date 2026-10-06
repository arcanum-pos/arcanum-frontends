import type { ChooserMessages } from './nl'

export default {
  whichOrg: 'Which organisation is this device for?',
  whichRole: 'What is this device?',
  org: (name: string) => `Organisation: ${name}`,
  roles: {
    pos: { title: 'Till', hint: 'Sell vouchers and create payments' },
    cfd: { title: 'Customer display', hint: 'Shows QR codes and the payment status to the customer' },
  },
} satisfies ChooserMessages
