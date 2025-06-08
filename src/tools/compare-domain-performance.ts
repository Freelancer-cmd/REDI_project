import { z } from "zod";
import { findSchoolById } from "../utils/data";

/**
 * Tool metadata and implementation to compare average performance across
 * domains A, B, and C for a specific school.
 */
export const CompareDomainPerformanceTool = {
  name: "compare-domain-performance" as const,
  description: "Compare performance across domains (a, b, c) for a specific school",
  inputSchema: {
    school_id: z.string().describe("Required school ID to analyze")
  },
  run: async ({ school_id }: { school_id: string }) => {
    const school = findSchoolById(school_id);
    if (!school) {
      return { content: [{ type: "text", text: `School ${school_id} not found.` }] };
    }
    if (!school.students.length) {
      return { content: [{ type: "text", text: `No students found in school ${school_id}.` }] };
    }
    let sumA = 0,
      sumB = 0,
      sumC = 0,
      examCount = 0;
    for (const student of school.students) {
      for (const exam of student.exams) {
        sumA += exam.items_correct.A;
        sumB += exam.items_correct.B;
        sumC += exam.items_correct.C;
        examCount++;
      }
    }
    const avgA = sumA / examCount;
    const avgB = sumB / examCount;
    const avgC = sumC / examCount;
    const pctA = (avgA / 10) * 100;
    const pctB = (avgB / 10) * 100;
    const pctC = (avgC / 10) * 100;
    const analysis: string[] = [];
    analysis.push(`Domain Performance Analysis for School ${school_id}:`);
    analysis.push(`Total exams analyzed: ${examCount}`);
    analysis.push("");
    analysis.push("Average performance per domain (out of 10 questions):");
    analysis.push(`- Domain A: ${avgA.toFixed(2)} correct (${pctA.toFixed(1)}%)`);
    analysis.push(`- Domain B: ${avgB.toFixed(2)} correct (${pctB.toFixed(1)}%)`);
    analysis.push(`- Domain C: ${avgC.toFixed(2)} correct (${pctC.toFixed(1)}%)`);
    analysis.push("");
    const weakest = avgA < avgB && avgA < avgC ? "A" : avgB < avgC ? "B" : "C";
    const strongest = avgA > avgB && avgA > avgC ? "A" : avgB > avgC ? "B" : "C";
    analysis.push(`- Strongest domain: ${strongest}`);
    analysis.push(`- Weakest domain: ${weakest}`);
    if (pctA < 60) analysis.push(`- Domain A needs attention (${pctA.toFixed(1)}%)`);
    if (pctB < 60) analysis.push(`- Domain B needs attention (${pctB.toFixed(1)}%)`);
    if (pctC < 60) analysis.push(`- Domain C needs attention (${pctC.toFixed(1)}%)`);
    return { content: [{ type: "text", text: analysis.join("\n") }] };
  }
};