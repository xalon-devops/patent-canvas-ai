// Curated MPEP seed corpus — key passages for §§ 101, 102, 103, 112.
// Sourced from the public-domain USPTO Manual of Patent Examining Procedure
// (9th Ed., Rev. 07.2022). Text is condensed for retrieval; source URLs point
// to the authoritative USPTO version.
//
// This is not the full MPEP — it is a focused seed of the passages that
// examiners most often cite in first-office-action rejections under
// §§ 101/102/103/112. Additional sections can be ingested via the
// `custom_chunks` payload of the ingest-mpep function.

export interface MpepSeedChunk {
  section_number: string;
  section_title: string;
  chunks: string[];
  source_url: string;
}

export const MPEP_SEED: MpepSeedChunk[] = [
  // ─── § 101 — Patent Eligibility ─────────────────────────────
  {
    section_number: "2106",
    section_title: "Patent Subject Matter Eligibility",
    source_url: "https://www.uspto.gov/web/offices/pac/mpep/s2106.html",
    chunks: [
      "The two-step Alice/Mayo framework governs § 101 analysis. Step 1 (Step 2A Prong One under the 2019 Revised Guidance) asks whether the claim is directed to a judicial exception: a law of nature, natural phenomenon, or abstract idea. Abstract ideas are grouped into: (a) mathematical concepts (formulas, calculations); (b) certain methods of organizing human activity (fundamental economic practices, commercial or legal interactions, managing personal behavior); and (c) mental processes (concepts performable in the human mind, including observation, evaluation, judgment, opinion).",
      "Step 2A Prong Two asks whether the claim recites additional elements that integrate the judicial exception into a practical application. Integration is shown by, e.g., an improvement in the functioning of a computer or other technology, a particular treatment or prophylaxis for a disease, implementation with a particular machine that is integral to the claim, effecting a transformation of a particular article, or applying the exception in a meaningful way beyond generally linking use to a technological environment.",
      "Step 2B asks whether the claim provides an inventive concept — an element or combination that amounts to significantly more than the judicial exception itself. Adding well-understood, routine, and conventional activity previously known to the industry (specified at a high level of generality) is insufficient. Berkheimer requires factual support for any § 101 rejection that relies on the WURC (well-understood, routine, conventional) determination.",
    ],
  },
  {
    section_number: "2106.04",
    section_title: "Eligibility Step 2A: Whether a Claim is Directed to a Judicial Exception",
    source_url: "https://www.uspto.gov/web/offices/pac/mpep/s2106_04.html",
    chunks: [
      "A claim that recites a mathematical concept, mental process, or method of organizing human activity is 'directed to' an abstract idea unless additional claim elements integrate the exception into a practical application. Merely reciting 'apply it' with generic computer components, adding insignificant extra-solution activity (e.g., data gathering), or generally linking the exception to a particular technological environment does not integrate.",
      "An improvement to the functioning of a computer or to another technology is a strong indicator of integration. The improvement must be reflected in the claim — a claim that recites only the abstract idea plus generic computer functionality (processor, memory) does not qualify. See Enfish (self-referential table improved database performance) vs. Alice (generic computer implementation of intermediated settlement).",
    ],
  },

  // ─── § 102 — Novelty ────────────────────────────────────────
  {
    section_number: "2131",
    section_title: "Anticipation — Application of 35 U.S.C. 102",
    source_url: "https://www.uspto.gov/web/offices/pac/mpep/s2131.html",
    chunks: [
      "To anticipate a claim under 35 U.S.C. 102, a single prior art reference must disclose each and every element of the claim, arranged as in the claim, either expressly or inherently. If any element is missing from the reference, the claim is not anticipated. Verdegaal Bros. v. Union Oil Co., 814 F.2d 628, 631 (Fed. Cir. 1987).",
      "Inherency requires that the missing descriptive matter is necessarily present in the reference; probabilities or possibilities are insufficient. The mere fact that a certain thing may result from a given set of circumstances is not sufficient to establish inherency. Continental Can Co. v. Monsanto Co., 948 F.2d 1264 (Fed. Cir. 1991).",
      "A genus does not necessarily anticipate a species within the genus. However, a species anticipates a claim to a genus that reads on it. Prior art disclosure of a species that falls within a claimed genus anticipates the genus claim.",
    ],
  },
  {
    section_number: "2132",
    section_title: "Pre-AIA 35 U.S.C. 102(a)",
    source_url: "https://www.uspto.gov/web/offices/pac/mpep/s2132.html",
    chunks: [
      "Under AIA 35 U.S.C. 102(a)(1), a person is not entitled to a patent if the claimed invention was patented, described in a printed publication, or in public use, on sale, or otherwise available to the public before the effective filing date. 'Otherwise available to the public' is a catch-all that includes any manner of public disclosure.",
      "AIA 102(a)(2) treats issued U.S. patents, published U.S. applications, and PCT applications designating the U.S. as prior art as of their effective filing date, subject to the exceptions in 102(b)(2) (inventor's own prior disclosure, or common ownership).",
    ],
  },

  // ─── § 103 — Obviousness ────────────────────────────────────
  {
    section_number: "2141",
    section_title: "Examination Guidelines for Determining Obviousness Under 35 U.S.C. 103",
    source_url: "https://www.uspto.gov/web/offices/pac/mpep/s2141.html",
    chunks: [
      "The Graham v. John Deere framework governs obviousness: (1) determine the scope and content of the prior art; (2) ascertain the differences between the prior art and the claims at issue; (3) resolve the level of ordinary skill in the pertinent art; and (4) evaluate any objective evidence of nonobviousness (secondary considerations).",
      "KSR v. Teleflex rejected a rigid TSM (teaching-suggestion-motivation) test. Any need or problem known in the field and addressed by the patent can provide a reason for combining elements. A combination of familiar elements according to known methods is likely obvious when it yields predictable results. Common sense, market forces, and design incentives can supply the motivation.",
      "The seven KSR rationales for obviousness: (A) combining prior art elements according to known methods to yield predictable results; (B) simple substitution of one known element for another; (C) use of a known technique to improve similar devices in the same way; (D) applying a known technique to a known device ready for improvement; (E) obvious to try — choosing from a finite number of identified, predictable solutions; (F) known work in one field prompting variations in the same or a different field based on design incentives; (G) some TSM in the prior art. MPEP § 2143.",
    ],
  },
  {
    section_number: "2144",
    section_title: "Supporting a Rejection Under 35 U.S.C. 103",
    source_url: "https://www.uspto.gov/web/offices/pac/mpep/s2144.html",
    chunks: [
      "Obviousness rejections must be supported by articulated reasoning with rational underpinnings. Conclusory statements are inadequate. In re Kahn, 441 F.3d 977 (Fed. Cir. 2006). The examiner bears the initial burden of establishing a prima facie case of obviousness.",
      "Secondary considerations (objective indicia) must be considered when present: commercial success, long-felt but unsolved needs, failure of others, unexpected results, copying, praise, and skepticism. A nexus between the evidence and the claimed invention is required.",
    ],
  },

  // ─── § 112 — Written Description, Enablement, Definiteness ─
  {
    section_number: "2161",
    section_title: "Three Separate Requirements for the Specification Under 35 U.S.C. 112(a)",
    source_url: "https://www.uspto.gov/web/offices/pac/mpep/s2161.html",
    chunks: [
      "§ 112(a) contains three separate and distinct requirements: (1) written description; (2) enablement; and (3) best mode. Written description is separate from enablement — a specification may enable without providing adequate written description support for a claim, especially in the biological and chemical arts and for genus claims.",
    ],
  },
  {
    section_number: "2163",
    section_title: "Guidelines for the Examination of Patent Applications Under the § 112(a) 'Written Description' Requirement",
    source_url: "https://www.uspto.gov/web/offices/pac/mpep/s2163.html",
    chunks: [
      "The written description requirement is met if the specification reasonably conveys to a POSITA that the inventor had possession of the claimed invention at the time of filing. Ariad v. Eli Lilly, 598 F.3d 1336 (Fed. Cir. 2010) (en banc). Possession may be shown by disclosure of drawings, structural chemical formulas, or a sufficient number of representative species.",
      "For genus claims, especially in unpredictable arts, written description requires either representative species falling within the genus or disclosure of structural features common to the members of the genus so that a POSITA can visualize or recognize the members. A mere statement of function is insufficient — functional claim language must be supported by disclosure of structures that perform the function.",
      "Adding new matter to the specification (or new limitations to claims not supported by the original disclosure) violates § 132 and § 112(a). Every claim limitation must find explicit or inherent support in the originally filed disclosure.",
    ],
  },
  {
    section_number: "2164",
    section_title: "The Enablement Requirement",
    source_url: "https://www.uspto.gov/web/offices/pac/mpep/s2164.html",
    chunks: [
      "The specification must enable a POSITA to make and use the full scope of the claimed invention without undue experimentation. The Wands factors govern undue experimentation: (1) breadth of the claims; (2) nature of the invention; (3) state of the prior art; (4) level of ordinary skill; (5) predictability of the art; (6) amount of direction in the specification; (7) presence or absence of working examples; and (8) quantity of experimentation needed. In re Wands, 858 F.2d 731 (Fed. Cir. 1988).",
      "The scope of enablement must be commensurate with the scope of the claims. Amgen v. Sanofi, 143 S. Ct. 1243 (2023), reaffirmed that broad functional genus claims (e.g., antibodies defined by function) require enablement of the full genus — disclosure of a few working examples does not enable a broad functional class in an unpredictable art.",
    ],
  },
  {
    section_number: "2173",
    section_title: "Claims Must Particularly Point Out and Distinctly Claim the Invention — § 112(b) Definiteness",
    source_url: "https://www.uspto.gov/web/offices/pac/mpep/s2173.html",
    chunks: [
      "Under Nautilus v. Biosig, 572 U.S. 898 (2014), a claim is indefinite if, read in light of the specification and prosecution history, it fails to inform those skilled in the art about the scope of the invention with reasonable certainty. The prior 'insolubly ambiguous' standard is no longer applicable.",
      "Common indefiniteness pitfalls: (a) terms of degree without objective boundaries ('substantially', 'about', 'high') that lack definition in the spec; (b) subjective terms ('aesthetically pleasing', 'user-friendly'); (c) mixed statutory categories (a claim that recites both an apparatus and method steps); (d) unclear antecedent basis ('the widget' with no prior 'a widget'); (e) functional claiming without corresponding structure in the spec (§ 112(f) invoked but no algorithm disclosed for a computer-implemented means-plus-function limitation).",
    ],
  },
  {
    section_number: "2181",
    section_title: "Identifying and Interpreting a § 112(f) or Pre-AIA § 112, Sixth Paragraph Limitation",
    source_url: "https://www.uspto.gov/web/offices/pac/mpep/s2181.html",
    chunks: [
      "A claim limitation invokes § 112(f) when it uses 'means for' (or 'step for') plus functional language and does not recite sufficient structure for performing the function. The presumption from 'means for' is strong; the presumption against 112(f) for terms without 'means' can be overcome (Williamson v. Citrix, 792 F.3d 1339 (Fed. Cir. 2015) — 'module for' invoked § 112(f)).",
      "For computer-implemented means-plus-function limitations, the corresponding structure must be an algorithm disclosed in the specification (flowchart, prose, mathematical formula, or any other means sufficient to structure the function). Disclosure of a general-purpose computer alone is insufficient. Failure to disclose the algorithm renders the claim indefinite. Aristocrat Techs. v. Int'l Game Tech., 521 F.3d 1328 (Fed. Cir. 2008).",
    ],
  },

  // ─── Claim drafting fundamentals ───────────────────────────
  {
    section_number: "608.01(m)",
    section_title: "Form of Claims",
    source_url: "https://www.uspto.gov/web/offices/pac/mpep/s608_01_m.html",
    chunks: [
      "Each claim is a single sentence beginning with a capital letter and ending with a period. The claim is structured as: (1) preamble (identifying the category — apparatus, method, system, composition); (2) transitional phrase ('comprising' — open; 'consisting of' — closed; 'consisting essentially of' — partially open); (3) body reciting the elements and their relationships. Elements are typically introduced by 'a' or 'an' on first mention and referenced by 'the' or 'said' thereafter to preserve antecedent basis.",
      "Dependent claims must further limit a prior claim and must incorporate by reference all limitations of the parent. Format: 'The [system/method] of claim N, wherein …' or 'The [system] of claim N, further comprising …'. Multiple dependent claims (depending on more than one prior claim in the alternative) are permitted but incur additional fees and cannot serve as basis for other multiple dependent claims.",
    ],
  },
];
