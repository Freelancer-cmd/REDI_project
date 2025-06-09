import { z } from "zod";
import { findStudentById, findSchoolById } from "../utils/data";

/**
 * Tool to predict the next two exam scores for a student based on their past performance
 * and provide advice, considering that eighth grade is the final year to demonstrate mastery.
 */
export const PredictNextExamScoresTool = {
  name: "predict-next-exam-scores" as const,
  description:
    "Predict the next two exam scores for a student and provide advice for eighth grade, their final exams",
  inputSchema: {
    student_id: z.string().describe("ID of the student to analyze")
  },
  run: async ({ student_id }: { student_id: string }) => {
    const student = findStudentById(student_id);
    if (!student) {
      return { content: [{ type: "text", text: `Student ${student_id} not found.` }] };
    }
    const exams = student.exams.map((e) => ({ id: Number(e.exam_id), score: e.exam_score }));
    if (exams.length < 2) {
      return {
        content: [
          {
            type: "text",
            text: `Not enough exam data to predict future scores for student ${student_id}.`
          }
        ]
      };
    }
    exams.sort((a, b) => a.id - b.id);
    const n = exams.length;
    const sumX = exams.reduce((sum, e) => sum + e.id, 0);
    const sumY = exams.reduce((sum, e) => sum + e.score, 0);
    const sumXY = exams.reduce((sum, e) => sum + e.id * e.score, 0);
    const sumXX = exams.reduce((sum, e) => sum + e.id * e.id, 0);
    const denom = n * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;
    const lastId = exams[n - 1].id;
    const nextIds = [lastId + 1, lastId + 2];
    const predictions = nextIds.map((id) => ({ id, predicted: Number((intercept + slope * id).toFixed(1)) }));

    // Predict school-wide average scores for upcoming exams and compute school slope
    const school = findSchoolById(student.school_id);
    let schoolPredictions: { id: number; avg: number }[] = [];
    let schSlope = 0;
    let schIntercept = 0;
    if (school) {
      const allExams: Record<number, { sum: number; count: number }> = {};
      for (const s of school.students) {
        for (const e of s.exams) {
          const id = Number(e.exam_id);
          const entry = allExams[id] || { sum: 0, count: 0 };
          entry.sum += e.exam_score;
          entry.count += 1;
          allExams[id] = entry;
        }
      }
      const groupData = Object.entries(allExams)
        .map(([k, v]) => ({ id: Number(k), avg: v.sum / v.count }))
        .sort((a, b) => a.id - b.id);
      if (groupData.length >= 2) {
        const m = groupData.length;
        const sx = groupData.reduce((sum, e) => sum + e.id, 0);
        const sy = groupData.reduce((sum, e) => sum + e.avg, 0);
        const sxy = groupData.reduce((sum, e) => sum + e.id * e.avg, 0);
        const sxx = groupData.reduce((sum, e) => sum + e.id * e.id, 0);
        const d = m * sxx - sx * sx;
        schSlope = d !== 0 ? (m * sxy - sx * sy) / d : 0;
        schIntercept = (sy - schSlope * sx) / m;
        schoolPredictions = nextIds.map((id) => ({ id, avg: Number((schIntercept + schSlope * id).toFixed(1)) }));
      }
    }

    const lines: string[] = [];
    lines.push(`Predicted exam scores for student ${student_id}:`);
    for (const p of predictions) {
      const grade =
        p.id === 9
          ? "8th grade (exam 1)"
          : p.id === 10
          ? "8th grade (exam 2)"
          : p.id <= 2
          ? "4th grade"
          : p.id <= 4
          ? "5th grade"
          : p.id <= 6
          ? "6th grade"
          : p.id <= 8
          ? "7th grade"
          : "future exam";
      const schoolAvgEntry = schoolPredictions.find((s) => s.id === p.id);
      if (schoolAvgEntry) {
        const diff = Number((p.predicted - schoolAvgEntry.avg).toFixed(1));
        lines.push(
          `- Exam ${p.id} (${grade}): Student ${p.predicted}, School expected ${schoolAvgEntry.avg} ` +
            `(difference ${diff >= 0 ? '+' : ''}${diff})`
        );
      } else {
        lines.push(`- Exam ${p.id} (${grade}): ${p.predicted}`);
      }
    }
    lines.push("");
    lines.push("Advice:");
    const compLines: string[] = [];
    for (const p of predictions) {
      const schoolAvgEntry = schoolPredictions.find((s) => s.id === p.id);
      if (schoolAvgEntry) {
        const delta = p.predicted - schoolAvgEntry.avg;
        if (delta < 0) {
          compLines.push(
            `For exam ${p.id}, you are predicted to score ${Math.abs(delta).toFixed(1)} points below the school average.`
          );
        } else if (delta > 0) {
          compLines.push(
            `For exam ${p.id}, you are predicted to score ${delta.toFixed(1)} points above the school average.`
          );
        } else {
          compLines.push(
            `For exam ${p.id}, you are predicted to match the school average.`
          );
        }
      }
    }
    if (compLines.length) {
      lines.push(...compLines);
    }
    if (schoolPredictions.length > 0) {
      if (slope >= schSlope) {
        lines.push(
          `Your rate of improvement (${slope.toFixed(2)} per exam) is at or above the school average (${schSlope.toFixed(2)} per exam). Keep up the strong progress!`
        );
      } else {
        lines.push(
          `Your rate of improvement (${slope.toFixed(2)} per exam) is below the school average (${schSlope.toFixed(2)} per exam). Consider extra support to keep pace with peers.`
        );
      }
    }
    lines.push(
      "Remember, 8th grade is the last year and you have only two exams left to demonstrate mastery—plan your study schedule accordingly."
    );
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
};