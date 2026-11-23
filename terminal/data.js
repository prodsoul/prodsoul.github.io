/* Shared content for every page. Edit text here. */
window.JB = {
  name: "Joann Bisseling",
  email: "j29bisseling@gmail.com",
  links: {
    email: "mailto:j29bisseling@gmail.com",
    linkedin: "https://www.linkedin.com/in/joannbisseling/",
    resume: "resume.html",
    resumePdf: "assets/resume.pdf"
  },
  about: [
    "I’m Joann, a UX and Game Design student in Singapore. I design interfaces and playable prototypes, then watch people try them to understand where they get stuck and what helps them move forward.",
    "My background in Big Data Analytics shapes how I approach information-heavy experiences, from event dashboards to interactive field guides. I use Figma and Unity to test design ideas, and I’m looking for an internship where I can keep prototyping, testing and refining the details people interact with."
  ],
  skills: [
    ["design", "UX design · interface design · prototyping"],
    ["testing", "playtesting · usability testing · iteration"],
    ["tools", "Figma · Unity"],
    ["background", "Big Data Analytics"]
  ],
  /* alias, title, type, slug, thumbnail (or ""), featured */
  works: [
    ["convex", "CONVEX", "Event organiser dashboard", "convex", "convex", 1],
    ["moustache", "Moustach’ve Been the Wind", "2D speedrunning platformer", "moustachve-been-the-wind", "moustachvebeenthewind", 1],
    ["specimen", "3D Specimen Adaptation Tool", "Photo-to-model developer tool", "specimen-tool", "3dadaptationtool", 1],
    ["eduvision", "EduVision", "Android insect field guide", "eduvision", "", 0],
    ["kopi", "Order Kopi Lah!", "Mobile puzzle playtesting", "order-kopi-lah", "orderkopilah", 0],
    ["netflix", "Netflix Mobile Discovery", "Streaming discovery concept", "netflix", "netflix", 0],
    ["amazon", "Amazon Search & Prime", "Search filters and Prime concept", "amazon", "amazon", 0],
    ["gio", "GIO Guest Booking Experience", "Brand and reservation experience", "gio", "gio", 0],
    ["purrdom", "Key to Purrdom", "2D puzzle platformer", "key-to-purrdom", "keytopurrdom", 0],
    ["orderup", "Order Up!", "Real-time tabletop card game", "order-up", "orderup", 0],
    ["stray", "Stray Game Design Analysis", "Interactive game design analysis", "stray", "stray", 0],
    ["gamefeel", "Game Feel in Unity", "Combat feedback and movement prototypes", "game-feel", "", 0],
    ["molten", "Molten Motion", "Difficulty progression study", "molten-motion", "", 0]
  ].map(function (w) { return { alias: w[0], title: w[1], type: w[2], slug: w[3], thumb: w[4], featured: !!w[5] }; })
};
