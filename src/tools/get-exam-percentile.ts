import { z } from "zod";
import { findStudentById, examStats } from "../utils/data";
import { normalCdf } from "../utils/statistics";

/**
 * Tool metadata and implementation to calculate a student's exam score percentile
 * relative to the global exam distribution (assumed normal).
 */
export const GetExamPercentileTool = {
  name: "get-exam-percentile" as const,
  description: "Calculate the percentile rank of a student's exam score relative to the global baseline distribution",
  inputSchema: {
    student_id: z.string().describe("ID of the student to analyze"),
    exam_id: z.union([z.string(), z.number()]).describe("ID of the exam to calculate percentile for")
  },
  run: async ({ student_id, exam_id }: { student_id: string; exam_id: string | number }) => {
    const student = findStudentById(student_id);
    if (!student) {
      return { content: [{ type: "text", text: `Student ${student_id} not found` }] };
    }
    const examEntry = student.exams.find((e) => String(e.exam_id) === String(exam_id));
    if (!examEntry) {
      return { content: [{ type: "text", text: `Exam ${exam_id} not found for student ${student_id}` }] };
    }
    const stats = examStats[String(exam_id)];
    if (!stats) {
      return { content: [{ type: "text", text: `No baseline available for exam ${exam_id}` }] };
    }
    const { mean, stdDev } = stats;
    if (stdDev === 0) {
      return { content: [{ type: "text", text: `All students have identical scores for exam ${exam_id}. Percentile is undefined.` }] };
    }
    const percentile = normalCdf(examEntry.exam_score, mean, stdDev);
    const pctStr = (percentile * 100).toFixed(1);
    const text = `Student ${student_id} scored ${examEntry.exam_score} on exam ${exam_id}. Global average: ${mean.toFixed(
      1
    )}, standard deviation: ${stdDev.toFixed(1)}. This corresponds to approximately the ${pctStr}th percentile.`;
    return { content: [{ type: "text", text }] };
  }
};