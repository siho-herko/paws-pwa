# Handover: landscape resilience and woodland restoration apps and microsites

Date: 3 November 2026. Revised the same day after Si's ruling to reduce the prominence of ShieldBelt: the addresses take the `resilience-` prefix, the titles take "Landscape Resilience", and PAWS becomes woodland restoration. For Si's Cursor projects on the two apps, and for the new microsites repository.
Based on: a content review of the five live pages on 2–3 November. I read the pages as text, not their source code, so some findings need checking in the code. They are marked **(check)**.
This replaces the single-repository plan in `client-apps-migration-plan-2026-11-02.md` §4.

---

## 1. Where everything lives

| Thing | Repository | Deployed as | Address |
|---|---|---|---|
| Fife Landscape Resilience Calculator (app) | `siho-herko/fife-shieldbelt-toolkit` (existing) | Its own Worker. It already runs at `fife-shieldbelt-toolkit.siho.workers.dev` | `resilience-calculator.trigrammatic.com` |
| Woodland Restoration Calculator (app) | `siho-herko/paws-pwa` (existing) | Its own Worker | `woodland-restoration.trigrammatic.com` |
| Fife Landscape Resilience Summary (microsite) | `siho-herko/trigrammatic-microsites` (new, private) | Folder `resilience-fife/`, its own Worker | `resilience-fife.trigrammatic.com` |
| East Neuk Landscape Resilience Summary (microsite) | same | Folder `resilience-east-neuk/`, its own Worker | `resilience-east-neuk.trigrammatic.com` |
| Dreel Burn Landscape Resilience Guide (microsite) | same | Folder `resilience-dreel-burn/`, its own Worker | `resilience-dreel-burn.trigrammatic.com` |

**Why one repository for the three microsites.** They are single HTML files with no build step. Separate repositories would be overhead, and putting them in the site repository would break the rule that client work is never built into trigrammatic.com. In one repository with one folder and one Worker each, they still deploy and roll back independently. The name `trigrammatic-microsites` leaves room for future client microsites.

**Addresses (Si, 3 November).** The four landscape pages share the `resilience-` prefix. The PAWS app moves to `woodland-restoration`. Freeze these before the client reports print.

---

## 2. Standard for all five (do these in every repository)

### 2.1 Names and spelling

- **ShieldBelt is the name of the intervention type only** (Si, 3 November), meaning the family of linear field-margin interventions.
  - Keep it in body text where it names those interventions, and spell it ShieldBelt (plural ShieldBelts).
  - Take it out of titles, addresses, headers, navigation, footers and metadata.
  - Cut repetition: name the type once per section, then use plain words ("the hedge", "the strip", "these interventions").
- Titles follow the site:

  | App | Title |
  |---|---|
  | Fife microsite | Fife Landscape Resilience Summary |
  | East Neuk microsite | East Neuk Landscape Resilience Summary |
  | Guide | Dreel Burn Landscape Resilience Guide |
  | Calculator | Fife Landscape Resilience Calculator |
  | PAWS app | Woodland Restoration Calculator |

  Each title is used in the `<title>`, the H1 or header, the Open Graph title, the web app manifest name (apps) and the footer. Drop the alternative names: "Fife Farm Resilience Calculator", "ShieldBelt Calc", "ShieldBelt Outcomes", "PAWS Business Case Modeller", "Complete Solution Guide", and any "ShieldBelt" title such as "Fife ShieldBelt: Six Topic Areas" or "East Neuk ShieldBelt".
- Use British English throughout: fertiliser, litres, centre, neighbours, -ise endings (stabilise, maximise, optimise, analyse, utilise).

### 2.2 Remove NFCA branding (replace with nothing)

Remove all of the following:

- "NFCA" and "Nature Finance Certification Alliance" in titles, headers, subtitles, footers, meta author, meta description and Open Graph tags.
- The NFCA logo:
  - hot-linked from `storage.ghost.io/.../Color-logo---no-background.svg` on the microsites;
  - `icons/nfca-logo.svg` in PAWS.
- "natcert.earth" footer text and links.
- Phrases such as "NFCA Research", "NFCA Fife Research", "NFCA East Neuk Research" and "NFCA Farm Guide".

Check the source code for any further references in comments, manifests and icons.

### 2.3 Funder acknowledgement (required in all five)

Place it in the footer of every app and microsite. The text is verbatim:

> This project has been supported by [The Facility for Investment Ready Nature in Scotland](https://www.nature.scot/funding-and-projects/firns-facility-investment-ready-nature-scotland), delivered by [NatureScot](https://www.nature.scot/) in collaboration with [The Scottish Government](https://www.gov.scot/) and in partnership with the [National Lottery Heritage Fund](https://www.heritagefund.org.uk/).
>
> Thanks to National Lottery players.

Use these logos, unaltered: `heritage-fund-stamp-gd-en.png` and `scotgov-naturescot-lockup.png`. They are the same files as on trigrammatic.com, in `public/images/funders/` of the site repository.

The Heritage Fund stamp rules:
- at least 238 px in diameter on screen (bilingual stamp); use 240 px;
- clear space of at least 32 px on every side;
- never recolour, crop or stretch it.

The two logos sit side by side from 768 px and stack below that. In dark mode, place the block on a light panel (#F4EFE3 or white) so the black logos stay visible. Never invert the logos.

### 2.4 Credit

Add a small footer line: **"Built by Trigrammatic"**, linking to `https://trigrammatic.com/en/work/nature-finance`.

The apps keep their own look; the credit is the only Trigrammatic element.

### 2.5 Disclaimer

Two of the four have no disclaimer at all, although they present financial and carbon figures (the Fife microsite and the calculator). The East Neuk microsite and the guide have none either. Standard wording for every app and microsite (confirmed by Si, 3 November):

> Indicative estimates for discussion, based on the sources listed below. Not financial, legal or agronomic advice. Check figures with a qualified adviser before making decisions.

PAWS keeps its forestry-specific line ("Consult a registered forestry consultant…") as well.

### 2.6 Sources, dates and terms

- **Sources.** Nearly every headline figure is uncited. Examples: £/km pollination, CREW values, carbon tonnages, net income forgone, network km, the 2 m statutory headland, and the £2 and £60 carbon prices. Add a **Sources and method** section to each app and microsite, naming the source for each figure family. Si validates the datasets and supplies the sources in each Cursor project; Cursor must not invent any. Shared figures come from `FIGURES.md` in `trigrammatic-microsites`, the single register of each shared value, its unit, source and year (see the migration plan, phase 2).
- **Last updated.** Add a "Last updated" date, and the year of any rates used, to every page.
- **Acronyms.** Expand each one on first use, or add a short glossary: ESF, NS, CS (cross-slope), CREW, WCS, NVZ, FIOs, SEPA, AWI (Ancient Woodland Inventory), SFGS, SPH and FCCT (Fife Coast and Countryside Trust).

### 2.7 Links between the apps

Every cross-link must point to the new addresses:
- netlify.app, pages.dev and workers.dev links become `*.trigrammatic.com`;
- canonical and `og:url` tags point to the new addresses too.

The current state:
- the calculator links to `fife-shieldbelt.netlify.app` twice;
- PAWS links to `fife-shieldbelt.netlify.app` and to `fife-shieldbelt-toolkit.siho.workers.dev`;
- the two microsites have "Open the … Calculator →" links with no target.

Rename the link labels as well, so they use the new titles. For example, "← ShieldBelt Summary" becomes "← Fife Landscape Resilience Summary", and "Open ShieldBelt Calculator →" becomes "Open the Landscape Resilience Calculator →".

### 2.8 Quality standard (same as trigrammatic.com)

- Lighthouse 95 or above on mobile, WCAG 2.2 AA, responsive from 320 px, no layout shift.
- Charts on canvas need a text alternative: a data table or an `aria-describedby` summary. The calculator currently shows "(canvas not supported)" as its fallback.
- No external requests that are not needed. Removing the hot-linked NFCA logo removes one.
- `<html lang="en-GB">`, a meta description and Open Graph tags with the new title and address.

### 2.9 Migration and hosting

- Each app or microsite gets a `wrangler.jsonc` with its own name, `assets.directory`, and a `custom_domain` route on its trigrammatic.com address. There is no Worker script.
- **Saved data and offline caching (check):**
  - Find out whether "Save scenario" in the calculator, or anything in PAWS, uses localStorage or IndexedDB, and whether either app registers a service worker.
  - Saved data stays with the old address, so tell users plainly: "Scenarios are saved in this browser only."
  - Before redirecting an old address, ship a final update there that unregisters any service worker.
- **Old addresses:** once each new address is verified, the old Netlify or Pages site is replaced by a single `_redirects` file:

  ```
  /*  https://<new-address>/:splat  301!
  ```

  Keep the old sites; do not delete them.

---

## 3. Issues by app

### 3.1 Fife Landscape Resilience Summary (`fife-shieldbelt.netlify.app`)

1. **The network total doesn't add up.** The six micro-biome figures sum to 1,930 km, but the page says 2,000 km.
2. **Net income forgone appears as "£16/km" and as "£16.9/km".** The East Neuk microsite says £16.70/km. Use one figure, and one precision, across all pages.
3. **The carbon price is £2/tCO₂e here, but the calculator's default is £60/tCO₂e.** Its own note says Woodland Carbon Code credits typically fetch £25–£120. Reconcile, or explain why they differ.
4. **"+79%" has no stated base.**
5. **Carbon is given as 510 / 128 / 127 tCO₂e with no unit basis.** East Neuk gives 510 tCO₂e **per ha**. Add the unit, and explain the difference between variants.
6. **The navigation labels don't match the section headings.** For example "Soil Erosion" vs "Stopping Gravity", and "Urban Friction" vs "Urban & Community".
7. **The header reads "NFCAFife ShieldBelt"** (logo alt text running into the title). This goes away with the NFCA removal.
8. **The "Strip width: 3m 6m 12m 20m" control has no explanation.** **(check)**
9. **"Open the Fife Calculator →" has no link.** It should point to `resilience-calculator.trigrammatic.com`.
10. **"Fertilizer" appears twice;** it should be "fertiliser".
11. **"The 2-Metre Statutory Rule" needs its source** (the cross-compliance or GAEC rule it refers to).

### 3.2 East Neuk Landscape Resilience Summary (`east-neuk-shieldbelt.netlify.app`)

1. **"100% water purification efficiency" will be challenged.** Qualify it, or remove it.
2. **Net income forgone is £16.70/km here,** against £16 and £16.9 on the Fife page (see 3.1.2).
3. **"Open the East Neuk Calculator →" has no link.** Point it to the calculator, ideally preset to East Neuk.
4. **"Highlighted gold values" is mentioned,** but the highlighting may not be visible or accessible. Don't rely on colour alone. **(check)**
5. **Metadata may be leaking into the visible body** ("meta-viewport…", "title: …"), and stray "★" and "1–5" markers appear. **(check in a browser)**
6. **"Fertilizer"** should be "fertiliser".
7. **FIOs, ESF, CS, CREW and SEPA need expanding.**

### 3.3 Dreel Burn Landscape Resilience Guide (`dreel-burn-shieldbelt-guide.netlify.app`)

1. **Rename** it in the `<title>`, the H1 and the hero, from "Dreel Burn Catchment — Complete Solution Guide" and "The Complete Dreel Burn Farm Intervention Guide".
2. **There is no footer.** Add one, with the funder acknowledgement, credit, disclaimer, sources and last-updated date.
3. **Many American spellings:** liters, center, neighbors, neighboring, fertilize, fertilizer, stabilizes, utilizing, maximize, optimize, analyze. The page also mixes "Stabilisation" with "stabilizes".
4. **"1 problems"** in the Carbon and Livestock headers needs singular and plural handling.
5. **Copy-pasted "AI application" text.** All 39 ShieldBelt cards share the same DroneDeploy text, and the Agronomic, Precision Ag and Infrastructure cards each repeat one paragraph. Write card-specific text, or remove the field.
6. **Several ShieldBelt cards have no problem tags,** including "20m Coastal Erosion Wood", "12m Coastal Salt-Spray Screen" and "6m Distillery Foraging Strip".
7. **"None directly applicable."** repeats in Community and Infrastructure cells. Hide empty cells instead.
8. **A possible truncation, "⚖️NVZ_L",** at the end of the Precision Ag section. **(check)**
9. **"By 2028, all Scottish farms must complete a carbon audit to receive basic payment"** is a regulatory claim. Verify it against current Scottish Government rules and cite it, or remove it.
10. **"102 calibrated solutions" vs "102 scoped solutions":** choose one. "Calibrated" implies a validation that should be backed up.
11. **There are about 60 external links,** including commercial products (Nofence, Halter, Carbogenics, Soil Essentials, Agri-EPI Centre, Soil Foodweb).
    - Check for dead links.
    - Add a line saying that listing a product is not an endorsement. This matters on a publicly funded resource.
    - The "up to 90%" chemical-reduction claim links only to a vendor's homepage.
12. **Expand "FCCT"** to Fife Coast and Countryside Trust. Keep the "DBIRP / FCCT" partnership line, but expand DBIRP once.
13. **The "2026" in the header** should become a proper "Last updated" date.

### 3.4 Fife Landscape Resilience Calculator (`fife-shieldbelt-toolkit`, being overhauled)

Check these against the overhaul:

1. **Naming:**
   - Retitle it "Fife Landscape Resilience Calculator" everywhere, replacing "Fife Farm Resilience Calculator" and "ShieldBelt Calc".
   - Use one label for the third output; "Wider Ecosystem Service Value", "…Services" and "…Value" all appear now.
   - Use one case: "Adjust inputs" vs "Adjust Inputs".
2. **NFCA** appears in the meta author, meta description, Open Graph title, header and footer. Remove it (§2.2).
3. **Canonical and `og:url`** point to pages.dev. Change both to `resilience-calculator.trigrammatic.com`.
4. **"← Summary Site" and "View the ShieldBelt Guide ↗" both point to `fife-shieldbelt.netlify.app`.**
   - The summary link should go to `resilience-fife.trigrammatic.com`.
   - The guide link should go to the Dreel Burn guide. At the moment it points to the summary.
5. **There is no disclaimer,** although the calculator outputs "25-Year Carbon Revenue" (§2.5).
6. **Carbon price:**
   - The £60 default needs a source and date.
   - The £25–£120 Woodland Carbon Code note needs a source.
   - "£20£200" needs a separator: "£20 to £200".
7. **Counts don't match:** "20 variants × 6 locations" makes 120, but the footer says "132 interventions".
8. **"Save scenario"** never says where scenarios are kept. Say "Saved in this browser only" (§2.9).
9. **Empty states and gaps:**
   - "## —" renders as a heading.
   - "— —" and "— ha" show before input.
   - "Agronomic & Registry Notes" is empty.
   - Design proper empty states.
10. **"(canvas not supported)" fallbacks:** five charts need accessible text alternatives (§2.8).
11. **"Results scale linearly"** is stated without support. Explain it under Sources and method.
12. **The default location is "East Neuk Coast"** while the tool is Fife-wide. Confirm that this is intended.

### 3.5 Woodland Restoration Calculator (`paws-pwa`)

1. **Retitle it "Woodland Restoration Calculator",** replacing "PAWS Business Case Modeller" in the title, header and footer.
   - Use Si's scope line as the subtitle: "Estimate the balance sheet for your woodland restoration project, to help your funders or sponsors understand what they are contributing to."
2. **Remove the "North Fife Community Arborist" credit,** which is an error, from the header and footer. Remove the NFCA logo (`icons/nfca-logo.svg`) and its alt text.
3. **Links:**
   - "← ShieldBelt Summary" goes to netlify.app.
   - "Open ShieldBelt Calculator →" and the footer link go to `fife-shieldbelt-toolkit.siho.workers.dev`.
   - Point them to `resilience-fife.trigrammatic.com` and `resilience-calculator.trigrammatic.com`.
4. **Define PAWS on the page,** not only in the meta description: "Plantations on Ancient Woodland Sites". Link it to the Forest Research page used on trigrammatic.com.
5. **Expand "NatureScot AWI"** to Ancient Woodland Inventory.
6. **The grant rate year is inconsistent:** "SFGS 2024" in one place, "2024–25 indicative rates" in another.
   - Use one rate year.
   - Cite the specific Scottish Forestry grant rate table.
   - Show "rates as at …".
7. **The disclaimer mentions "carbon prices",** but the app has no carbon calculation. Remove the mention, or add carbon.
8. **The projection says "your restored broadleaf woodland" while the default species is Sitka Spruce.** If Sitka is the crop being removed, label the field "Current conifer crop" so the wording is consistent. **(check)**
9. **Formula text shown to users:** "Suggested: ≈ — m (√(ha × 10,000) × 4 × 1.2)" shows the formula and a blank. Show only the result, with the formula as help text.
10. **Advanced settings appeared without visible values** in the review. Check that each field shows its default. **(check)**
11. **Show the "Loading PAWS data…" state only briefly,** and handle load failure.
12. **It's named "pwa", but no manifest or service worker was visible.** Decide whether it is meant to be installable:
    - If yes: add a manifest with the new name and address, plus the service-worker rules in §2.9.
    - If no: remove the Apple web-app meta tags. **(check)**

---

## 4. Prompt for the microsites repository (replaces prompt 05)

Before you start:
1. Create the empty private repository `siho-herko/trigrammatic-microsites`.
2. Below the prompt, say where your local source for each microsite is, or write "download from the live site".

Run it in a local Agent chat.

```
Task: create the private repository siho-herko/trigrammatic-microsites holding three static microsites, one folder each, each deployable as its own Cloudflare Worker (static assets only) on its own trigrammatic.com subdomain. Move the content unchanged in this first commit. Do not deploy.

Folders (folder = Worker name = subdomain), with current live source:
- resilience-fife        ← https://fife-shieldbelt.netlify.app
- resilience-east-neuk   ← https://east-neuk-shieldbelt.netlify.app
- resilience-dreel-burn  ← https://dreel-burn-shieldbelt-guide.netlify.app

1. Clone to ~/GitHub/trigrammatic-microsites. Add README.md, .gitignore (node_modules, .wrangler, .DS_Store) and .node-version (copied from ~/GitHub/trigrammatic-site).
2. For each folder: put the site in <folder>/public/ with index.html at the root. Use Si's local source if given; otherwise mirror the deployed files, meaning the HTML plus every file it references on the same host. Diff the local source against the live site and report the differences. Change no content in this commit.
3. For each folder, write <folder>/wrangler.jsonc:
   { "name": "<folder>", "compatibility_date": "2026-10-01",
     "assets": { "directory": "./public" },
     "routes": [{ "pattern": "<folder>.trigrammatic.com", "custom_domain": true }],
     "workers_dev": false, "preview_urls": true }
   Add a minimal <folder>/package.json (private) pinning wrangler to the same version trigrammatic-site uses, with its lockfile. No Worker script.
4. In each folder, verify that npx wrangler deploy --dry-run passes and that npx wrangler dev serves the page with no new console errors.
5. Commit ("Consolidate three microsites, content unchanged") and push to main.
6. Report: the source used, the diffs against live, the dry-run results, and every external host each page loads from.

Content changes follow in a separate task, using HANDOVER.md (Si will add it) sections 2 and 3.
```

Then copy this handover into each repository as `HANDOVER.md`, so the Cursor projects can work through §2 and their part of §3.

---

## 5. Follow-ups on trigrammatic.com (short prompt, after the addresses are confirmed)

- **`client-apps.ts`:** the five entries take the new folders, addresses and titles in §1 and §2.1, with `live: false` until each address resolves.
- **Names on `/en/work/nature-finance`:** use the new titles. "ShieldBelt" stays in site copy only where it names the intervention type.
- **The Nature Finance Fife paragraph on `/en/work` and `/en/work/nature-finance`.** The current wording is "…see the Shieldbelt summaries, guide and calculator, and the PAWS Restoration Calculator." Confirmed by Si, 3 November:
  > …see the landscape resilience summaries for Fife and the East Neuk, the Dreel Burn Landscape Resilience Guide, the Fife Landscape Resilience Calculator and the Woodland Restoration Calculator.
- **The PAWS line** keeps its scope sentence and Forest Research link, under the new title.
- **Project instructions §13:** the Nature Finance Fife apps become `resilience-fife`, `resilience-east-neuk`, `resilience-dreel-burn`, `resilience-calculator` and `woodland-restoration`. Their repositories are `fife-shieldbelt-toolkit`, `paws-pwa` and `trigrammatic-microsites`.
