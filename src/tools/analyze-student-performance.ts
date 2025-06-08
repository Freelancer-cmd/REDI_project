import { z } from "zod";
import { findStudentById, TOTAL_QUESTIONS_PER_EXAM } from "../utils/data";

/**
 * Tool metadata and implementation to analyze individual student performance
 * across all exams and domains.
 */
export const AnalyzeStudentPerformanceTool = {
  name: "analyze-student-performance" as const,
  description: "Analyze individual student performance across domains",
  inputSchema: {
    student_id: z.string().describe("ID of the student to analyze")
  },
  /**
   * Executes the analysis and returns a multi-line text report.
   */
  run: async ({ student_id }: { student_id: string }) => {
    const student = findStudentById(student_id);
    if (!student) {
      return { content: [{ type: "text", text: `Student ${student_id} not found` }] };
    }
    const { id, exams, school_id } = student;
    if (!exams || exams.length === 0) {
      return { content: [{ type: "text", text: `Student ${id} has no exam data available.` }] };
    }
    // Aggregate domain and score data
    let totalA = 0,
      totalB = 0,
      totalC = 0,
      avgScore = 0;
    for (const exam of exams) {
      totalA += Number(exam.items_correct.A);
      totalB += Number(exam.items_correct.B);
      totalC += Number(exam.items_correct.C);
      avgScore += exam.exam_score;
    }
    const examCount = exams.length;
    avgScore /= examCount;
    const avgA = totalA / examCount;
    const avgB = totalB / examCount;
    const avgC = totalC / examCount;
    const totalCorrect = avgA + avgB + avgC;
    const overallPct = (totalCorrect / TOTAL_QUESTIONS_PER_EXAM) * 100;
    const pctA = (avgA / 10) * 100;
    const pctB = (avgB / 10) * 100;
    const pctC = (avgC / 10) * 100;

    const insights: string[] = [];
    insights.push(`Student ${id} (School: ${school_id}) Performance Analysis:`);
    insights.push(`Average Exam Score: ${avgScore.toFixed(1)}`);
    insights.push(
      `Overall Questions Correct: ${totalCorrect.toFixed(1)}/${TOTAL_QUESTIONS_PER_EXAM} (${overallPct.toFixed(1)}%)`
    );
    insights.push("");
    insights.push("Domain Performance (avg items correct & percentage):");
    insights.push(`- Domain A: ${avgA.toFixed(1)}/10 (${pctA.toFixed(1)}%)`);
    insights.push(`- Domain B: ${avgB.toFixed(1)}/10 (${pctB.toFixed(1)}%)`);
    insights.push(`- Domain C: ${avgC.toFixed(1)}/10 (${pctC.toFixed(1)}%)`);
    insights.push("");
    const weakest = avgA < avgB && avgA < avgC ? "A" : avgB < avgC ? "B" : "C";
    const strongest = avgA > avgB && avgA > avgC ? "A" : avgB > avgC ? "B" : "C";
    insights.push("Insights:");
    insights.push(`- Strongest domain: ${strongest}`);
    insights.push(`- Weakest domain: ${weakest}`);
    if (pctA < 50) insights.push(`- Struggling in Domain A (${pctA.toFixed(1)}%)`);
    if (pctB < 50) insights.push(`- Struggling in Domain B (${pctB.toFixed(1)}%)`);
    if (pctC < 50) insights.push(`- Struggling in Domain C (${pctC.toFixed(1)}%)`);
    if (overallPct < 60) {
      insights.push(`- Needs significant support overall (${overallPct.toFixed(1)}%)`);
    } else if (overallPct < 75) {
      insights.push(`- Could benefit from additional practice (${overallPct.toFixed(1)}%)`);
    } else {
      insights.push(`- Performing well overall (${overallPct.toFixed(1)}%)`);
    }
    return { content: [{ type: "text", text: insights.join("\n") }] };
  }
};