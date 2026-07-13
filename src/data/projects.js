/**
 * Conversion Lens project examples.
 * Add niches here — beforeImg / afterImg should be 1600×892 (1024:571) in /public.
 *
 * @typedef {Object} MirrorProject
 * @property {string} id
 * @property {string} niche
 * @property {string} beforeImg
 * @property {string} afterImg
 * @property {string} [beforeAlt]
 * @property {string} [afterAlt]
 */

/** @type {MirrorProject[]} */
export const projects = [
  {
    id: "patriot-plumbing",
    niche: "Plumbing",
    beforeImg: "/mirror-before.jpg",
    afterImg: "/mirror-after.jpg",
    beforeAlt: "Generic template-style Patriot Plumbing website before the ToolCrate redesign",
    afterAlt: "High-authority Patriot Plumbing website after the ToolCrate redesign",
  },
  {
    id: "apex-hvac",
    niche: "HVAC",
    beforeImg: "/mirror-hvac-before.jpg",
    afterImg: "/mirror-hvac-after.jpg",
    beforeAlt: "Generic HVAC company template site before the ToolCrate redesign",
    afterAlt: "High-authority HVAC landing page after the ToolCrate redesign",
  },
  {
    id: "summit-roofing",
    niche: "Roofing",
    beforeImg: "/mirror-roofing-before.jpg",
    afterImg: "/mirror-roofing-after.jpg",
    beforeAlt: "Generic roofing company template site before the ToolCrate redesign",
    afterAlt: "High-authority roofing landing page after the ToolCrate redesign",
  },
  {
    id: "elite-homes-contractors",
    niche: "Contractors",
    beforeImg: "/mirror-contractors-before.jpg",
    afterImg: "/mirror-contractors-after.jpg",
    beforeAlt: "Generic general contractor template site before the ToolCrate redesign",
    afterAlt: "High-authority Elite Homes contractor website after the ToolCrate redesign",
  },
  {
    id: "harper-croft-law",
    niche: "Law Firm",
    beforeImg: "/mirror-law-before.jpg",
    afterImg: "/mirror-law-after.jpg",
    beforeAlt: "Generic law firm template site before the ToolCrate redesign",
    afterAlt: "High-authority Harper & Croft boutique law firm website after the ToolCrate redesign",
  },
];
