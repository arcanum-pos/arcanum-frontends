// The admin console's "catalog" texts (Menukaarten, one menukaart,
// Producten, menukaart import/export) — the source of truth; fr.ts and
// en.ts must match this shape (see src/shared/i18n).
//
// Not in here, on purpose: the menukaart file format (menu-sheet.ts /
// menu-files.ts — column headers, sheet names, the Uitleg sheet, file
// names). A file exported in one language must import in every other.
const nl = {
  // Shared buttons and labels
  name: 'Naam',
  actions: 'Acties',
  edit: 'Bewerken',
  rename: 'Hernoemen',
  remove: 'Verwijderen',
  add: 'Toevoegen',
  save: 'Opslaan',
  create: 'Aanmaken',
  cancel: 'Annuleren',
  archive: 'Archiveren',
  restore: 'Terugzetten',
  import: 'Importeren',
  defaultBadge: 'Standaard',
  moveUp: (name: string) => `${name} omhoog`,
  moveDown: (name: string) => `${name} omlaag`,

  // Notices of the screens' own (the server's come as they are)
  exportFailed: (error: string) => `Exporteren mislukt: ${error}`,
  invalidPrice: (name: string) => `Ongeldige prijs voor ${name} — gebruik bv. 2,50`,
  invalidQuickQuantities: 'Snelknoppen: maximaal 10 hele getallen tussen 1 en 999, gescheiden door komma’s',

  // Menukaarten (list)
  catalogsTitle: 'Menukaarten',
  catalogsIntro: 'Welke producten de kassa verkoopt, aan welke prijs en in welke groepen.',
  downloadTemplate: 'Sjabloon downloaden',
  newCatalog: 'Nieuwe menukaart',
  catalogsLoadFailed: (error: string) => `Kon menukaarten niet laden: ${error}`,
  productsColumn: 'Producten',
  noCatalogs: 'Nog geen menukaarten. De eerste wordt automatisch de standaard.',
  duplicate: 'Dupliceren',
  makeDefault: 'Standaard maken',
  newCatalogDescription: 'Bv. per seizoen of per evenement. Nadien voeg je groepen en producten toe.',
  renameCatalog: 'Menukaart hernoemen',
  duplicateCatalog: 'Menukaart dupliceren',
  duplicateDescription: 'Een onafhankelijke kopie met dezelfde groepen en prijzen — bv. voor een nieuw seizoen.',
  copyName: 'Naam van de kopie',
  // Only a suggestion in the name field — whatever's confirmed is stored.
  copyOf: (name: string) => `${name} (kopie)`,

  // One menukaart
  catalog: 'Menukaart',
  addSection: 'Groep toevoegen',
  editorIntro: 'Groepen zijn de knoppenblokken op de kassa. Prijzen gelden alleen op deze menukaart.',
  catalogLoadFailed: (error: string) => `Kon menukaart niet laden: ${error}`,
  noSections: 'Nog geen groepen. Voeg er een toe, bv. “Drank”.',
  emptySection: 'Nog geen producten in deze groep.',
  addSectionDescription: 'Een knoppenblok op de kassa, bv. Drank, Eten of Bonnen.',
  renameSection: 'Groep hernoemen',
  deleteSectionTitle: (name: string) => `Groep “${name}” verwijderen?`,
  deleteSectionDescription: (count: number) => count === 1
      ? 'Het product in deze groep verdwijnt van deze menukaart. Het product zelf blijft bestaan.'
      : `De ${count} producten in deze groep verdwijnen van deze menukaart. De producten zelf blijven bestaan.`,
  noCategory: 'Geen categorie',
  archivedEntry: 'Gearchiveerd product — niet op de kassa',
  priceOf: (name: string) => `Prijs ${name}`,
  quickQuantitiesOf: (name: string) => `Snelknoppen ${name}`,
  quickQuantitiesPlaceholder: 'snelknoppen, bv. 5, 10',
  visible: 'Zichtbaar',
  visibleOf: (name: string) => `Zichtbaar ${name}`,
  allOnCatalog: 'Alle producten staan al op deze menukaart — maak nieuwe aan onder Producten.',
  addProductTo: (section: string) => `Product toevoegen aan ${section}`,
  addProductPlaceholder: 'Product toevoegen…',
  newEntryPrice: (section: string) => `Prijs nieuw product ${section}`,

  // Export / import
  export: 'Exporteren',
  importInto: (name: string) => `Importeren in ${name}`,
  importCatalog: 'Menukaart importeren',
  importReplaceDescription:
    'Het bestand vervangt de groepen, de volgorde en de prijzen van deze menukaart. Producten worden nooit verwijderd — ze kunnen op andere menukaarten staan — en een lege Categorie, Station, BTW of Code laat een bestaand product ongewijzigd.',
  importNewDescription: 'Maakt een nieuwe menukaart uit het bestand. Bestaande producten worden herkend op code of naam en hergebruikt.',
  importFile: 'Bestand (.xlsx of .csv)',
  importName: 'Naam van de nieuwe menukaart',
  ignoredColumns: (headers: string) => `Genegeerde kolommen: ${headers}`,
  importHasErrors: 'Het bestand bevat fouten — er is niets gewijzigd. Pas het bestand aan en probeer opnieuw.',
  previewCounts: (rows: number, groups: number) => `${rows} ${rows === 1 ? 'rij' : 'rijen'} in ${groups} groep${groups === 1 ? '' : 'en'}.`,
  noChanges: ' Geen wijzigingen.',
  unchangedLines: (count: number) => `${count} ${count === 1 ? 'lijn' : 'lijnen'} ongewijzigd.`,
  otherFile: 'Ander bestand',
  apply: 'Toepassen',
  readingFile: 'Bestand lezen…',
  showPreview: 'Voorbeeld bekijken',
  previewSections: {
    newCategories: 'Nieuwe categorieën',
    newStations: 'Nieuwe stations',
    newProducts: 'Nieuwe producten',
    newVariants: 'Nieuwe varianten',
    updatedProducts: 'Productwijzigingen',
    priceChanges: 'Prijswijzigingen',
    added: 'Toegevoegd aan deze menukaart',
    removed: 'Verwijderd van deze menukaart',
  },
  // The server's error text, with the sheet row it's about.
  rowError: (row: number, message: string) => `Rij ${row}: ${message}`,
  // Problems found before the file goes to the server (menu-sheet.ts).
  sheetEmpty: 'Het bestand is leeg.',
  sheetMissingColumns: (columns: string[]) =>
    `Verplichte kolom${columns.length > 1 ? 'men ontbreken' : ' ontbreekt'}: ${columns.join(', ')}. De eerste niet-lege rij moet de kolomnamen bevatten.`,
  sheetNoRows: 'Geen rijen gevonden onder de kolomnamen.',
  sheetTooManyRows: (max: number, count: number) => `Maximaal ${max} rijen per menukaart (dit bestand heeft er ${count}).`,
  sheetUnreadable: 'Kon dit bestand niet lezen. Gebruik een .xlsx- of .csv-bestand.',

  // Producten
  productsTitle: 'Producten',
  productsIntro: (org: string | null) => `Wat ${org ?? 'deze organisatie'} verkoopt. Prijzen stel je per menukaart in.`,
  // Split around the three bold terms (categoryTerm, stationTerm, sectionTerm).
  conceptsCategory: ' = wat het is, voor rapporten (Drank, Eten). ',
  conceptsStation: ' = wie het klaarmaakt (Bar, Keuken). ',
  conceptsSection: ' = waar de knop op de kassa staat — dat stel je per menukaart in.',
  categoryTerm: 'Categorie',
  stationTerm: 'Station',
  sectionTerm: 'Groep',
  categories: {
    title: 'Categorieën',
    description: 'Wat een product is (Drank, Eten, Inschrijvingen) — voor rapporten.',
    placeholder: 'Nieuwe categorie, bv. Drank',
    newLabel: 'Nieuwe categorie',
    renameTitle: 'Categorie hernoemen',
    loadFailed: (error: string) => `Kon categorieën niet laden: ${error}`,
    empty: 'Nog geen categorieën.',
  },
  stations: {
    title: 'Stations',
    description: 'Wie het klaarmaakt (Bar, Keuken, CoffeeCorner). Geen station = niets klaar te maken, bv. bonnen.',
    placeholder: 'Nieuw station, bv. Keuken',
    newLabel: 'Nieuw station',
    renameTitle: 'Station hernoemen',
    loadFailed: (error: string) => `Kon stations niet laden: ${error}`,
    empty: 'Nog geen stations.',
  },
  showArchived: 'Toon gearchiveerd',
  newProduct: 'Nieuw product',
  productsLoadFailed: (error: string) => `Kon producten niet laden: ${error}`,
  categoryColumn: 'Categorie',
  stationColumn: 'Station',
  vatColumn: 'BTW',
  variantsColumn: 'Varianten',
  noProducts: 'Nog geen producten.',
  archivedBadge: 'gearchiveerd',
  // A variant without a name (a single-version product).
  defaultVariant: 'standaard',
  vatProvisional: 'BTW-tarieven zijn voorlopig — nog te bevestigen met de boekhouder.',
  vatNone: 'Geen',

  // Product dialog
  editProduct: 'Product bewerken',
  productDialogDescription: 'Prijzen stel je per menukaart in, niet hier. Categorie = voor rapporten, Station = wie het klaarmaakt.',
  productNamePlaceholder: 'bv. Fietstocht',
  none: 'Geen',
  variants: 'Varianten',
  variantsHelp: 'Bv. niet-lid / lid, of volwassene / kind. Laat de naam leeg voor een product met één versie. De code is optioneel (voor “typ een code”).',
  variantName: 'Variantnaam',
  variantCode: 'Variantcode',
  newVariantName: 'Nieuwe variantnaam',
  newVariantCode: 'Nieuwe variantcode',
  newVariantPlaceholder: 'nieuwe variant',
  codePlaceholder: 'code',
  removeDraft: 'Weg',
  addVariant: '+ Variant',
  busy: 'Bezig...',
}

export type AdminCatalogMessages = typeof nl
export default nl
