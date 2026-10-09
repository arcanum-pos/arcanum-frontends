import { describe, expect, it } from 'vitest'
import { inviteText } from './invite-text'

const params = { orgName: 'Scouts Kabouterland', email: 'jan@example.test', loginUrl: 'https://pos.example.test/login' }

describe('inviteText', () => {
  it("says what the invite mail says, in Dutch, plus the address to sign in with", () => {
    expect(inviteText({ ...params, role: 'cashier', locale: 'nl' })).toBe(
      [
        'Je bent uitgenodigd om lid te worden van Scouts Kabouterland op Arcanum, als kassier.',
        '',
        'Meld je aan om je uitnodiging te activeren: https://pos.example.test/login',
        '',
        'Meld je aan met het e-mailadres jan@example.test.',
      ].join('\n')
    )
  })

  it("follows the organisation's language", () => {
    expect(inviteText({ ...params, role: 'admin', locale: 'fr' })).toContain('en tant qu’administrateur.')
    expect(inviteText({ ...params, role: 'cashier', locale: 'fr' })).toContain('activer votre invitation : https://')
    expect(inviteText({ ...params, role: 'admin', locale: 'en' })).toContain('as an administrator.')
  })

  it('falls back to Dutch without a (known) language', () => {
    expect(inviteText({ ...params, role: 'cashier' })).toContain('als kassier.')
    expect(inviteText({ ...params, role: 'cashier', locale: 'de' as never })).toContain('als kassier.')
  })
})
