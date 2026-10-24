# Arcanum - design review brief (kassa, customer display, console)

> **This is a recurring exchange.** Every pack is a dated folder with the
> screens as they are today. `CHANGES.md` says what changed since the
> previous pack, and what we did with your last review (adopted, adapted,
> or not, and why). Please read it first, and review the current screens,
> not the earlier ones.

Arcanum is a point-of-sale system for volunteer-run events in Belgium:
a scout group's spaghetti evening, a football club's tournament, a youth
club's party. It runs in the browser on tablets and laptops.

The screens grew feature by feature from an original design. We'd like a
review of **usability and accessibility**, and concrete proposals to make
them calmer and clearer.

The screenshots use realistic sample data: Scouts Kabouterland's spaghetti
evening, with 4 open tabs and a menu of drinks, spaghetti and desserts.
Each PNG has an `.html` file next to it: the same screen as HTML with its
CSS inlined (no scripts), so you can read the exact structure and texts.
Some images inside them (fonts, the logo) won't load from the file.

## Who uses it, and how

- **Kassa (till)** - volunteers, often teenagers or parents who use it once
  a year, at a busy bar. They need speed and no mistakes.
  - **Setting:** a 10-13" tablet in landscape (1280×800 and 1024×640
    shots), often one-handed and standing, with noise and glare. Dark mode
    is used in the evening.
  - **Core loop, dozens of times an hour:**
    1. Pick a tab, or **Toog** (pay straight away).
    2. Tap products.
    3. Pick a payment method.
    4. Afrekenen, then confirm cash or wait for the Bancontact QR.
    5. "Volgende klant".
  - **Rounds:** a round tapped onto an open tab is sent to the kitchen/bar
    by itself when the cashier leaves the tab or pays, or after 30 s.
    There's no button. New lines show marked "Nieuw - wordt zo
    doorgestuurd".
  - **Rules that must stay:**
    - Once a line is sent, it can only be cancelled with a reason
      ("Annuleren" → reason). Nothing is ever deleted silently.
    - Split payment, equal parts or per item.
    - A tip is optional and is added at payment.
  - **Less frequent:** opening the drawer with its float, the kasopmaak
    (counting the drawer at the end), choosing who is working (staff
    picker), the Rekeningen overview, and settings.
- **Customer display (CFD)** - faces the **customer**, on a second
  tablet or screen beside the kassa, 1-2 m away (landscape, plus one
  portrait shot).
  - **What it shows:** what's being ordered, the total, how to pay
    (Bancontact QR to scan), and "Bedankt!".
  - **The customer never touches it.** The organisation can brand it with
    its logo, a main colour and an accent colour (Weergave →
    Klantscherm). See the `-branded` shots in scouts green with a yellow
    scarf.
- **Console** - the organiser, on a laptop (1440×900), in the weeks
  before the event and afterwards. They set up the menu, products, prices
  and stations (kitchen, bar), events (self-ordering by QR, ordering modes
  such as Ter plaatse / Take-away), devices, staff, registers and payment
  providers. Afterwards they read reports.

## Constraints

- **Three languages:** Dutch, French and English, chosen per device. French
  texts are the longest (see the `-fr` shots). Labels must never overflow
  their buttons.
- **Light and dark mode.** Contrast must hold in both (see the `-dark`
  shots).
- **Accessibility target: WCAG 2.2 AA:**
  - contrast;
  - touch targets of at least 44 px on the kassa;
  - nothing that relies on colour alone (paid / new / cancelled);
  - fully keyboard-usable in the console.
- **Built with React and shadcn/ui (Tailwind).** Proposals that stay within
  that component set are easiest to build.
- **Free to change:** the kassa and CFD layouts. **Must stay:** the steps
  and rules above.

## What we'd like back

Please give your answer as one or more files (Markdown, HTML mockups,
images) that we can keep next to the pack, in its `feedback/` folder.

Per area (kassa, CFD, console), please give:

1. **The 5-10 changes with the biggest impact on speed and mistakes,**
   ranked, each with the screen(s) it applies to and why.
2. **Accessibility issues found:** what, where, and the fix.
3. **For the kassa main screen** (`kassa/04-tab-new-round.png`) and **the
   CFD** (`cfd/02-order-being-entered*.png`): a redesigned layout, as a
   mockup.

## Screens

### Kassa (`kassa/`)

| File | State |
|---|---|
| 01-toog-empty | Start: Toog (quick sale), nothing tapped |
| 02-toog-order | Toog with products tapped |
| 03-tab-open | An open tab ("#1 Tafel 4") with its lines |
| 04-tab-new-round (+ `-dark`, `-1024x640`, `-fr`) | The same tab, a new round being tapped (marked new): **the main screen** |
| 05-dialog-new-tab | Opening a new named tab |
| 06-dialog-void-line | Cancelling a sent line (with a reason) |
| 07-dialog-split-equal (+ `-fr`) | Splitting into equal parts |
| 08-dialog-split-per-item | Splitting per item |
| 09-split-per-item-picking | Picking what one person pays |
| 10-paying-cash | Waiting for the cash to be confirmed |
| 11-paid-next-customer | Paid: "Volgende klant" |
| 12-paying-bancontact | Bancontact QR on the kassa (the CFD shows it too) |
| 13-rekeningen-overview | Today's tabs (open and paid) |
| 14-staff-picker | Choosing who is working |
| 15-register-open-drawer | Opening the drawer with its float |
| 16-cash-up | Kasopmaak: counting the drawer |
| 17-kassa-settings | The kassa's settings |
| 18-arrange-groups | Arranging the menu's groups on this till (Indeling aanpassen): rows and columns, dragged by their grip |

### Customer display (`cfd/`), each plain and `-branded`

| File | State |
|---|---|
| 01-idle | Waiting for the next customer (€ 0,00) |
| 02-order-being-entered (+ `-dark`, `-portrait`) | The order as the cashier taps it |
| 03-paying-bancontact | The QR to scan |
| 04-paying-cash | Pay cash at the bar |
| 05-paid | Paid: the bill stays, a check and "Bedankt!" take the place of the QR |

### Console (`console/`)

01 start · 02 dashboard · 03 reports · 04 events · 05 an event's settings
(self-ordering, ordering modes) · 06 products · 07 menus (+ `-row-menu`: a
line's actions in its "…" menu, the same on every list) · 08 menu editor
(+ `-dark`) · 09 devices · 10 users · 11 staff · 12 registers · 13 tables ·
14-18 settings (organisation, appearance with the CFD branding,
preferences, payment providers, data).

## What we already see

- **Kassa:** the header carries many buttons of equal weight. It's unclear
  what matters during service and what's set-up.
- **Kassa:** the payment section (method, tip) is always visible, even
  while tapping a round. It pushes "Afrekenen" down, and on 1024×640 below
  the fold.
- **Kassa:** the tab strip will get long on a busy evening (10-20 tabs).
- **Kassa:** the "#" button (find an order by its number) isn't
  self-explanatory.
- **CFD:** debug text ("CFD-ID: … status laden…") and the theme, language
  and full-screen controls are visible to customers.
- **Console:** the event settings dialog is dense with long explanations.
- *(The guest link in 05 shows `localhost` only because of the test
  setup.)*
