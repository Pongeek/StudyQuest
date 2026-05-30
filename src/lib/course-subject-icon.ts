/**
 * Subject-icon sigil for course tiles.
 *
 * Each course tile in the dashboard "Your Realm" grid renders one large
 * thematic icon as a faded ornament in the bottom-right corner. The icon
 * is purposeful — it identifies the course's *subject*, not random
 * decoration. Same Lucide vocabulary the rest of the app uses.
 *
 * Keyword matching is intentionally fuzzy and case-insensitive: course
 * titles vary wildly ("Theory of Computation", "Intro to CS Theory",
 * "Computability and Complexity" all map to the same automata family).
 * First-match-wins in the order below — keep specific terms above generic
 * ones (e.g. "quantum mechanics" should match physics, not mechanics-as-eng).
 */

export type CourseSubjectIcon =
  | "Workflow"       // Automata / theory of computation / computability
  | "Code2"          // Programming / algorithms / software
  | "Compass"        // Math / algebra / calculus / geometry / number theory
  | "Atom"           // Physics / quantum / optics
  | "FlaskConical"   // Chemistry
  | "Leaf"           // Biology / life sciences
  | "Languages"      // Language / linguistics / grammar
  | "Scroll"         // History / philosophy / literature
  | "TrendingUp"     // Economics / finance / statistics
  | "Brain"          // Psychology / cognitive science / neuroscience
  | "Sword";         // Default — RPG-coded fallback

const KEYWORD_RULES: Array<{ icon: CourseSubjectIcon; patterns: string[] }> = [
  // Order matters. Specific terms above generic ones.
  { icon: "Workflow", patterns: ["automat", "computab", "turing", "regular language", "context-free", "complexity theory", "theory of comput"] },
  { icon: "Code2", patterns: ["algorithm", "programming", "software", "compiler", "data structur", "operating system", "computer science", " cs ", "(cs)"] },
  { icon: "Atom", patterns: ["physic", "quantum", "optic", "relativity", "thermodynam", "electromagnet"] },
  { icon: "FlaskConical", patterns: ["chemistry", "chemical", "organic chem", "inorganic chem", "biochem"] },
  { icon: "Leaf", patterns: ["biology", "biological", "ecology", "genetic", "molecular biol", "cell biol"] },
  { icon: "Brain", patterns: ["psychology", "cognitive", "neuroscience", "neurolog"] },
  { icon: "TrendingUp", patterns: ["economics", "econom", "finance", "financial", "accounting", "statistic", "probability"] },
  { icon: "Languages", patterns: ["language", "linguistic", "grammar", "hebrew", "arabic", "english composition", "literature"] },
  { icon: "Scroll", patterns: ["history", "philosophy", "ethics", "religion"] },
  { icon: "Compass", patterns: ["calculus", "algebra", "geometry", "number theory", "discrete math", "linear algebra", "analysis", "topology", "trigonometry", "math"] },
];

/**
 * Resolve a course's subject icon from its title and theme_name.
 * Returns "Sword" when nothing matches — the RPG default.
 */
export function getCourseSubjectIcon(input: {
  title?: string | null;
  themeName?: string | null;
}): CourseSubjectIcon {
  const haystack = `${input.title ?? ""} ${input.themeName ?? ""}`.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    for (const pattern of rule.patterns) {
      if (haystack.includes(pattern)) return rule.icon;
    }
  }
  return "Sword";
}
