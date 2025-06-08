import { z } from "zod";
import { findSchoolById } from "../utils/data";

/**
 * Tool metadata and implementation to identify students scoring below
 * a given threshold in one or all domains for a specific school.
 */
export const IdentifyStrugglingStudentsTool = {
  name: "identify-struggling-students" as const,
  description: "Identify students who are struggling in specific domain(s) within a school and provide class average and standard deviation",
  inputSchema: {
    school_id: z.string().describe("Required school ID to analyze"),
    domains: z
      .preprocess((val) => {
        if (typeof val === "string") {
          return val.split(/[,\s]+/).map((v) => v.toLowerCase());
        }
        if (Array.isArray(val)) {
          return val.map((v) => (typeof v === "string" ? v.toLowerCase() : v));
        }
        return val;
      }, z.array(z.enum(["a", "b", "c"])))
      .optional()
      .describe(
        "Specific domains to analyze (a, b, or c). For multiple domains, separate by commas or provide an array."
      ),
    threshold: z
      .number()
      .default(5)
      .describe("Minimum correct items threshold (out of 10)")
  },
  run: async (
    { school_id, domains, threshold = 5 }: { school_id: string; domains?: ("a" | "b" | "c")[]; threshold?: number }
  ) => {
    const school = findSchoolById(school_id);
    if (!school) {
      return { content: [{ type: "text", text: `School ${school_id} not found.` }] };
    }
    const results: string[] = [];
    const domainsToCheck: ("A" | "B" | "C")[] = domains && domains.length > 0
      ? domains.map((d) => d.toUpperCase() as "A" | "B" | "C")
      : ["A", "B", "C"];
    for (const student of school.students) {
      for (const exam of student.exams) {
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
      const suffix = domains && domains.length > 0
        ? ` in domain${domains.length > 1 ? "s" : ""} ${domains
            .map((d) => d.toUpperCase())
            .join(", ")}`
        : "";
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

    const scoreBuckets: Record<"A" | "B" | "C", number[]> = { A: [], B: [], C: [] };
    for (const student of school.students) {
      for (const exam of student.exams) {
        for (const d of domainsToCheck) {
          scoreBuckets[d].push(exam.items_correct[d]);
        }
      }
    }
    const statsLines = ["Class Performance Statistics:"];
    for (const d of domainsToCheck) {
      const scores = scoreBuckets[d];
      const count = scores.length;
      const mean = count > 0 ? scores.reduce((sum, v) => sum + v, 0) / count : 0;
      const variance = count > 0 ? scores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / count : 0;
      const stdDev = Math.sqrt(variance);
      statsLines.push(
        `- Domain ${d}: average ${mean.toFixed(1)}/10 (${((mean / 10) * 100).toFixed(1)}%), std ${stdDev.toFixed(1)}`
      );
    }

    const suffix = domains && domains.length > 0
      ? ` in domain${domains.length > 1 ? "s" : ""} ${domains.map((d) => d.toUpperCase()).join(", ")}`
      : "";
    const header = `Students Struggling in School ${school_id}${suffix} (below ${threshold}/10 questions):`;
    return {
      content: [
        { type: "text", text: [header, ...statsLines, "", ...results].join("\n") }
      ]
    };
  }
};