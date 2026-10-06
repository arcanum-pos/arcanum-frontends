// Arcanum's manual, on its website (arcanum-bootstrapper's /docs, in the
// visitor's language). The same for every installation: the console links
// to it where a setting needs more than a line of explanation.
export const DOCS_URL = 'https://arcanum.kaboutersoft.be/docs'

export const docsUrl = (guide: 'sumup' | 'bancontact') => `${DOCS_URL}/${guide}`
