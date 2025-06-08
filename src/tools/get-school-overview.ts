import { z } from "zod";
import { findSchoolById } from "../utils/data";

/**
 * Tool metadata and implementation to generate an overview summary for a school,
 * including total students, exams, average scores, and domain performance.
 */
export const GetSchoolOverviewTool = {
  name: "get-school-overview" as const,
  description: "Get overview of a specific school and its performance",
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
    let totalScore = 0,
      totalExams = 0,
      sumA = 0,
      sumB = 0,
      sumC = 0;
    for (const student of students) {
      for (const exam of student.exams) {
        totalScore += exam.exam_score;
        sumA += exam.items_correct.A;
        sumB += exam.items_correct.B;
        sumC += exam.items_correct.C;
        totalExams++;
      }
    }
    const lines: string[] = [`School ${school_id} Overview:`, `Students: ${studentCount}`];
    if (totalExams > 0) {
      const avgScore = (totalScore / totalExams).toFixed(1);
      const avgA = (sumA / totalExams).toFixed(1);
      const avgB = (sumB / totalExams).toFixed(1);
      const avgC = (sumC / totalExams).toFixed(1);
      lines.push(`Total Exams: ${totalExams}`);
      lines.push(`Average Exam Score: ${avgScore}`);
      lines.push("");
      lines.push("Average Domain Performance:");
      lines.push(`- Domain A: ${avgA}/10 (${((sumA / totalExams) / 10 * 100).toFixed(1)}%)`);
      lines.push(`- Domain B: ${avgB}/10 (${((sumB / totalExams) / 10 * 100).toFixed(1)}%)`);
      lines.push(`- Domain C: ${avgC}/10 (${((sumC / totalExams) / 10 * 100).toFixed(1)}%)`);
    } else {
      lines.push(`No exam data available for school ${school_id}`);
    }
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
};