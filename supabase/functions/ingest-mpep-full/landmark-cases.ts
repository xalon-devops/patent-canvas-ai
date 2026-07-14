// Curated landmark Federal Circuit / Supreme Court case headnotes.
// Each entry is ingested as its own chunk under a synthetic MPEP-style section id.
// Purpose: give the RAG layer authoritative precedent alongside MPEP text so
// drafting agents can cite Alice, KSR, Nautilus, Phillips, etc. inline.

export interface LandmarkCase {
  case_id: string;      // e.g. "case-alice-corp-v-cls-bank"
  case_name: string;    // e.g. "Alice Corp. v. CLS Bank Int'l"
  citation: string;     // e.g. "573 U.S. 208 (2014)"
  statutory_hook: string; // e.g. "§101"
  holding: string;
  reasoning: string;
  source_url: string;
}

export const LANDMARK_CASES: LandmarkCase[] = [
  // ===== §101 Patent Eligibility =====
  {
    case_id: "case-alice-corp-v-cls-bank",
    case_name: "Alice Corp. v. CLS Bank Int'l",
    citation: "573 U.S. 208 (2014)",
    statutory_hook: "§101",
    holding: "Claims drawn to an abstract idea implemented on a generic computer are not patent-eligible under 35 U.S.C. §101.",
    reasoning: "Applied the two-step Mayo framework: (1) determine whether claims are directed to a patent-ineligible concept (abstract idea, law of nature, natural phenomenon); (2) if so, determine whether additional elements transform the claim into a patent-eligible application. Mere recitation of a generic computer cannot supply the 'inventive concept' — the abstract idea of intermediated settlement was not transformed by having a computer perform generic functions of obtaining data, adjusting balances, and issuing instructions.",
    source_url: "https://supreme.justia.com/cases/federal/us/573/208/",
  },
  {
    case_id: "case-mayo-v-prometheus",
    case_name: "Mayo Collaborative Servs. v. Prometheus Labs.",
    citation: "566 U.S. 66 (2012)",
    statutory_hook: "§101",
    holding: "Claims that recite a law of nature plus 'well-understood, routine, conventional activity' fail §101.",
    reasoning: "Established the two-step eligibility test. Claims correlating metabolite levels with drug dosage merely instructed doctors to apply a natural law. Adding 'administer' and 'determine' steps that were well-known in the field did not add enough to transform the natural law into a patent-eligible application.",
    source_url: "https://supreme.justia.com/cases/federal/us/566/66/",
  },
  {
    case_id: "case-bilski-v-kappos",
    case_name: "Bilski v. Kappos",
    citation: "561 U.S. 593 (2010)",
    statutory_hook: "§101",
    holding: "The machine-or-transformation test is a useful clue but not the sole test for §101 eligibility of process claims; abstract ideas remain unpatentable.",
    reasoning: "Rejected the Federal Circuit's exclusive machine-or-transformation test. Bilski's claims on hedging risk in commodities trading were unpatentable as an abstract idea regardless of the test applied.",
    source_url: "https://supreme.justia.com/cases/federal/us/561/593/",
  },
  {
    case_id: "case-diamond-v-diehr",
    case_name: "Diamond v. Diehr",
    citation: "450 U.S. 175 (1981)",
    statutory_hook: "§101",
    holding: "A claim reciting a mathematical formula is patent-eligible when the claim as a whole applies the formula in a structure or process that transforms an article into a different state.",
    reasoning: "The Arrhenius equation was applied in the context of a rubber curing process that continuously measured mold temperature and used the calculation to control cure time — a physical transformation of raw rubber into cured product.",
    source_url: "https://supreme.justia.com/cases/federal/us/450/175/",
  },
  {
    case_id: "case-enfish-v-microsoft",
    case_name: "Enfish, LLC v. Microsoft Corp.",
    citation: "822 F.3d 1327 (Fed. Cir. 2016)",
    statutory_hook: "§101",
    holding: "Software claims can be patent-eligible at Alice step one when they are directed to an improvement in computer functionality rather than an abstract idea implemented on a computer.",
    reasoning: "Enfish's self-referential logical table was a specific improvement to how computers store and retrieve data, not a generic use of a computer. The claims were directed to an improvement in computer capabilities, not an abstract idea.",
    source_url: "https://law.justia.com/cases/federal/appellate-courts/cafc/15-1244/15-1244-2016-05-12.html",
  },
  {
    case_id: "case-mcro-v-bandai",
    case_name: "McRO, Inc. v. Bandai Namco Games Am. Inc.",
    citation: "837 F.3d 1299 (Fed. Cir. 2016)",
    statutory_hook: "§101",
    holding: "Claims reciting specific rules that improve an existing technological process are patent-eligible even if performed on a generic computer.",
    reasoning: "The claimed automated lip-sync rules were a specific means of solving a technical problem in 3D animation. The rules were not a generalized abstract idea but a specific improvement over prior manual and rules-based systems.",
    source_url: "https://law.justia.com/cases/federal/appellate-courts/cafc/15-1080/15-1080-2016-09-13.html",
  },

  // ===== §103 Obviousness =====
  {
    case_id: "case-ksr-v-teleflex",
    case_name: "KSR Int'l Co. v. Teleflex Inc.",
    citation: "550 U.S. 398 (2007)",
    statutory_hook: "§103",
    holding: "The rigid teaching-suggestion-motivation (TSM) test is not the sole basis for finding obviousness; a flexible common-sense approach is required.",
    reasoning: "Expanded the obviousness analysis beyond the TSM test. When there is a design need or market pressure to solve a problem and there are a finite number of identified predictable solutions, a person of ordinary skill has good reason to pursue the known options. If this leads to the anticipated success, it is likely obvious under §103.",
    source_url: "https://supreme.justia.com/cases/federal/us/550/398/",
  },
  {
    case_id: "case-graham-v-deere",
    case_name: "Graham v. John Deere Co.",
    citation: "383 U.S. 1 (1966)",
    statutory_hook: "§103",
    holding: "Obviousness under §103 is determined by four factual inquiries: (1) scope and content of the prior art, (2) differences between prior art and claims, (3) level of ordinary skill in the art, (4) objective indicia of nonobviousness (secondary considerations).",
    reasoning: "Established the framework that still governs §103 analysis. Secondary considerations include commercial success, long-felt but unsolved need, failure of others, copying, and unexpected results.",
    source_url: "https://supreme.justia.com/cases/federal/us/383/1/",
  },
  {
    case_id: "case-in-re-kubin",
    case_name: "In re Kubin",
    citation: "561 F.3d 1351 (Fed. Cir. 2009)",
    statutory_hook: "§103",
    holding: "'Obvious to try' can support an obviousness rejection under KSR when the prior art provides both the motivation and a reasonable expectation of success within a finite number of known options.",
    reasoning: "Applied KSR to biotech cloning claims. When a gene's function and existence were known and standard cloning techniques would predictably isolate it, the claims were obvious.",
    source_url: "https://law.justia.com/cases/federal/appellate-courts/cafc/08-1184/08-1184-2011-08-11.html",
  },

  // ===== §112 Written Description / Definiteness / Enablement =====
  {
    case_id: "case-nautilus-v-biosig",
    case_name: "Nautilus, Inc. v. Biosig Instruments, Inc.",
    citation: "572 U.S. 898 (2014)",
    statutory_hook: "§112(b)",
    holding: "A claim is indefinite under §112(b) if, read in light of the specification and prosecution history, it fails to inform those skilled in the art about the scope of the invention with reasonable certainty.",
    reasoning: "Rejected the Federal Circuit's more lenient 'insolubly ambiguous' standard. The 'reasonable certainty' standard applies at the time of filing and requires the claim to give clear notice of what is claimed.",
    source_url: "https://supreme.justia.com/cases/federal/us/572/898/",
  },
  {
    case_id: "case-ariad-v-eli-lilly",
    case_name: "Ariad Pharms., Inc. v. Eli Lilly & Co.",
    citation: "598 F.3d 1336 (Fed. Cir. 2010) (en banc)",
    statutory_hook: "§112(a)",
    holding: "§112(a) contains a written description requirement separate from enablement. The specification must reasonably convey to those skilled in the art that the inventor had possession of the claimed subject matter as of the filing date.",
    reasoning: "For genus claims, possession may be shown by disclosing a representative number of species or common structural features. Merely describing a desired result or a research plan is insufficient.",
    source_url: "https://law.justia.com/cases/federal/appellate-courts/cafc/08-1248/08-1248-2011-08-11.html",
  },
  {
    case_id: "case-in-re-wands",
    case_name: "In re Wands",
    citation: "858 F.2d 731 (Fed. Cir. 1988)",
    statutory_hook: "§112(a)",
    holding: "Enablement is assessed by whether one skilled in the art could make and use the invention without undue experimentation, considering eight factors (the Wands factors).",
    reasoning: "The Wands factors: (1) quantity of experimentation needed, (2) amount of direction/guidance presented, (3) presence or absence of working examples, (4) nature of the invention, (5) state of the prior art, (6) relative skill of those in the art, (7) predictability or unpredictability of the art, (8) breadth of the claims.",
    source_url: "https://law.justia.com/cases/federal/appellate-courts/F2/858/731/199088/",
  },

  // ===== Claim Construction =====
  {
    case_id: "case-phillips-v-awh",
    case_name: "Phillips v. AWH Corp.",
    citation: "415 F.3d 1303 (Fed. Cir. 2005) (en banc)",
    statutory_hook: "Claim construction",
    holding: "Claim terms are given their ordinary and customary meaning as understood by a person of ordinary skill in the art at the time of the invention, read in light of the specification and prosecution history.",
    reasoning: "The specification is 'the single best guide to the meaning of a disputed term.' Extrinsic evidence (dictionaries, expert testimony) is less reliable than intrinsic evidence. Courts should not import limitations from embodiments into the claims but must interpret claims in view of the specification.",
    source_url: "https://law.justia.com/cases/federal/appellate-courts/F3/415/1303/546022/",
  },
  {
    case_id: "case-markman-v-westview",
    case_name: "Markman v. Westview Instruments, Inc.",
    citation: "517 U.S. 370 (1996)",
    statutory_hook: "Claim construction",
    holding: "Claim construction is a matter of law reserved for the court, not a factual question for the jury.",
    reasoning: "Interpretation of patent claims requires special training and construction consistency across cases, both of which favor judicial rather than jury determination.",
    source_url: "https://supreme.justia.com/cases/federal/us/517/370/",
  },

  // ===== §102 Anticipation =====
  {
    case_id: "case-schering-v-geneva",
    case_name: "Schering Corp. v. Geneva Pharms., Inc.",
    citation: "339 F.3d 1373 (Fed. Cir. 2003)",
    statutory_hook: "§102",
    holding: "A prior art reference anticipates a claim under §102 if it discloses every claim element, either expressly or inherently.",
    reasoning: "Inherent anticipation requires that the missing element is necessarily present, not merely probably or possibly present. If ingestion of the prior art drug would inevitably produce the claimed metabolite, the metabolite is inherently disclosed.",
    source_url: "https://law.justia.com/cases/federal/appellate-courts/F3/339/1373/569148/",
  },

  // ===== Recent CAFC (2020-2025) representative decisions =====
  {
    case_id: "case-am-axle-v-neapco",
    case_name: "American Axle & Mfg. v. Neapco Holdings LLC",
    citation: "967 F.3d 1285 (Fed. Cir. 2020)",
    statutory_hook: "§101",
    holding: "Method claims that merely apply Hooke's Law to tune drive shaft liners are directed to a natural law and lack an inventive concept.",
    reasoning: "The claims required nothing beyond the natural law itself plus routine tuning steps. Post-Alice §101 analysis extends to mechanical inventions when the claim boils down to applying a law of nature without meaningful implementation detail.",
    source_url: "https://law.justia.com/cases/federal/appellate-courts/cafc/18-1763/18-1763-2020-07-31.html",
  },
  {
    case_id: "case-cardionet-v-infobionic",
    case_name: "CardioNet, LLC v. InfoBionic, Inc.",
    citation: "955 F.3d 1358 (Fed. Cir. 2020)",
    statutory_hook: "§101",
    holding: "Claims directed to a specific improvement in cardiac monitoring technology — distinguishing atrial fibrillation from ventricular arrhythmias — are patent-eligible under Alice step one.",
    reasoning: "The claims recited a specific technological improvement, not an abstract idea. The specification demonstrated the invention improved the accuracy of arrhythmia detection over prior art.",
    source_url: "https://law.justia.com/cases/federal/appellate-courts/cafc/19-1149/19-1149-2020-04-17.html",
  },
];
