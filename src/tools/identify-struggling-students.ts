import { z } from "zod";
import { findSchoolById } from "../utils/data";

/**
 * Tool metadata and implementation to identify students scoring below
 * a given threshold in one or all domains for a specific school.
 */
export const IdentifyStrugglingStudentsTool = {
  name: "identify-struggling-students" as const,
  description: "Identify students who are struggling in specific domains within a school",
  inputSchema: {
    school_id: z.string().describe("Required school ID to analyze"),
    domain: z
      .preprocess((val) => (typeof val === "string" ? val.toLowerCase() : val), z.enum(["a", "b", "c"]))
      .optional()
      .describe("Specific domain to analyze (a, b, or c, case-insensitive)"),
    threshold: z
      .number()
      .default(5)
      .describe("Minimum correct items threshold (out of 10)")
  },
  run: async ({ school_id, domain, threshold = 5 }: { school_id: string; domain?: "a" | "b" | "c"; threshold?: number }) => {
    const school = findSchoolById(school_id);
    if (!school) {
      return { content: [{ type: "text", text: `School ${school_id} not found.` }] };
    }
    const results: string[] = [];
    for (const student of school.students) {
      for (const exam of student.exams) {
        const domainsToCheck: ("A" | "B" | "C")[] = domain
          ? [domain.toUpperCase() as "A" | "B" | "C"]
          : ["A", "B", "C"];
        for (const d of domainsToCheck) {
          const score = exam.items_correct[d];
          if (score < threshold) {
            const pct = (score / 10) * 100;
            results.push(
              `- Student ${student.id}: Domain ${d} ${score}/10 (${pct.toFixed(1)}%) in exam ${exam.exam_id}`
            );
          }
        }
      }
    }
    if (results.length === 0) {
      const suffix = domain ? ` in domain ${domain.toUpperCase()}` : "";
      return {
        content: [
          {
            type: "text",
            text: `No students found struggling in School ${school_id}${suffix} with threshold ${threshold}/10 (${(
              (threshold / 10) *
              100
            ).toFixed(1)}%).`
          }
        ]
      };
    }
    const header = `Students Struggling in School ${school_id}${domain ? ` in Domain ${domain.toUpperCase()}` : ""} (below ${threshold}/10 questions):`;
    return {
      content: [{ type: "text", text: [header, ...results].join("\n") }]
    };
  }
};