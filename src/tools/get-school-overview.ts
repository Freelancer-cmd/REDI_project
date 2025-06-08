import { z } from "zod";
import { findSchoolById, examStats } from "../utils/data";

/**
 * Tool metadata and implementation to generate an overview summary for a school,
 * including total students, per-exam average scores compared with global averages, and overall domain performance.
 */
export const GetSchoolOverviewTool = {
  name: "get-school-overview" as const,
  description: "Get overview of a specific school, with per-exam average scores compared to global averages and overall domain performance",
  inputSchema: {
    school_id: z.string().describe("Required school ID to analyze")
  },
  run: async ({ school_id }: { school_id: string }) => {
    const school = findSchoolById(school_id);
    if (!school) {
      return { content: [{ type: "text", text: `School ${school_id} not found.` }] };
    }
    const { students } = school;
    const studentCount = students.length;
    const examScoresById: Record<string, number[]> = {};
    let sumA = 0, sumB = 0, sumC = 0, totalExams = 0;
    for (const student of students) {
      for (const exam of student.exams) {
        const eid = exam.exam_id;
        (examScoresById[eid] ||= []).push(exam.exam_score);
        sumA += exam.items_correct.A;
        sumB += exam.items_correct.B;
        sumC += exam.items_correct.C;
        totalExams++;
      }
    }

    const lines: string[] = [`School ${school_id} Overview:`, `Students: ${studentCount}`];
    if (totalExams > 0) {
      lines.push(`Total Exams: ${totalExams}`);
      lines.push("");
      lines.push("Per-Exam Average Scores vs. Global Averages:");
      const examIds = Object.keys(examScoresById).sort((a, b) => Number(a) - Number(b));
      for (const eid of examIds) {
        const scores = examScoresById[eid];
        const schoolAvg = scores.reduce((sum, v) => sum + v, 0) / scores.length;
        const stats = examStats[eid];
        if (stats) {
          lines.push(
            `- Exam ${eid}: school avg ${schoolAvg.toFixed(1)}, global avg ${stats.mean.toFixed(1)}, std ${stats.stdDev.toFixed(1)}`
          );
        } else {
          lines.push(`- Exam ${eid}: school avg ${schoolAvg.toFixed(1)} (no global data)`);
        }
      }
      lines.push("");
      lines.push("Overall Domain Performance:");
      const avgA = (sumA / totalExams).toFixed(1);
      const avgB = (sumB / totalExams).toFixed(1);
      const avgC = (sumC / totalExams).toFixed(1);
      lines.push(`- Domain A: ${avgA}/10 (${((sumA / totalExams) / 10 * 100).toFixed(1)}%)`);
      lines.push(`- Domain B: ${avgB}/10 (${((sumB / totalExams) / 10 * 100).toFixed(1)}%)`);
      lines.push(`- Domain C: ${avgC}/10 (${((sumC / totalExams) / 10 * 100).toFixed(1)}%)`);
    } else {
      lines.push(`No exam data available for school ${school_id}`);
    }
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
};