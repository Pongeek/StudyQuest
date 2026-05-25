import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gradeOpenAnswer } from "@/lib/ai/grade-answer";
import { uploadAnswerImage } from "@/lib/answer-image";
import { classifyAiError } from "@/lib/ai-error";

export const maxDuration = 60;

/**
 * POST /api/quiz/answers
 *
 * Accepts EITHER JSON or multipart/form-data:
 *   - JSON: { sessionId, questionId, userAnswer, topicTitle }   ← legacy
 *   - multipart: fields above + optional `image` file (diagram, math, etc.)
 *
 * When an image is attached, it's uploaded to Supabase Storage and passed
 * to Claude's vision API alongside the typed text for grading.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Auto-detect JSON vs multipart based on Content-Type. Multipart payloads
    // wrap form fields, including an optional binary `image` file.
    const contentType = request.headers.get("content-type") || "";
    let sessionId: string;
    let questionId: string;
    let userAnswer: string;
    let topicTitle: string;
    let imageFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const fd = await request.formData();
      sessionId = (fd.get("sessionId") as string) ?? "";
      questionId = (fd.get("questionId") as string) ?? "";
      userAnswer = (fd.get("userAnswer") as string) ?? "";
      topicTitle = (fd.get("topicTitle") as string) ?? "";
      const f = fd.get("image");
      imageFile = f instanceof File ? f : null;
    } else {
      const body = await request.json();
      sessionId = body.sessionId;
      questionId = body.questionId;
      userAnswer = body.userAnswer;
      topicTitle = body.topicTitle;
    }

    const supabase = createServiceClient();

    const { data: question } = await supabase
      .from("questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

    // Question was soft-replaced between page load and submit (typically:
    // user has the quiz open in tab A, regenerated this question from
    // another tab/path). Grading against the old correct_answer would
    // silently insert a quiz_answers row pointing at a retired question
    // (which TopicMasteryPanel then excludes from stumble math), so the
    // student's score would be inconsistent with their telemetry. Refuse
    // the submission with a classified error the engine knows how to
    // surface — the toast tells the user to refresh.
    if (question.replaced_at) {
      return NextResponse.json(
        {
          error: {
            code: "QUESTION_RETIRED",
            userMessage:
              "This question was just regenerated. Refresh the page to load the new version — your typed answer is saved.",
            retryable: false,
          },
        },
        { status: 409 },
      );
    }

    // Upload the diagram image first (if attached) — both stored for later
    // viewing AND passed inline to Claude for grading via vision.
    const uploadedImage =
      question.type === "open" && imageFile
        ? await uploadAnswerImage({
            file: imageFile,
            userId,
            sessionId,
            questionId,
          })
        : null;

    let score = 0;
    let feedback = "";

    if (question.type === "mcq") {
      score = userAnswer === question.correct_answer ? 1 : 0;
      feedback = score === 1
        ? `Correct! ${question.explanation}`
        : `The correct answer was: "${question.correct_answer}". ${question.explanation}`;
    } else {
      const result = await gradeOpenAnswer({
        question: question.content,
        modelAnswer: question.correct_answer,
        explanation: question.explanation,
        studentAnswer: userAnswer,
        topicTitle: topicTitle || "",
        studentImage: uploadedImage
          ? {
              mediaType: uploadedImage.mediaType,
              base64: uploadedImage.buffer.toString("base64"),
            }
          : null,
      });
      score = result.score;
      feedback = result.feedback;
    }

    await supabase.from("quiz_answers").insert({
      session_id: sessionId,
      question_id: questionId,
      user_answer: userAnswer,
      ai_score: score,
      ai_feedback: feedback,
      image_url: uploadedImage?.storagePath ?? null,
    });

    return NextResponse.json({ score, feedback });
  } catch (err) {
    console.error("[api/quiz/answers] grading failed:", err);
    // Classify the upstream failure so the client can keep the student's
    // typed answer + surface an actionable sentence (instead of "Failed
    // to grade your answer."). 502 = upstream AI failed.
    const classified = classifyAiError(err);
    return NextResponse.json({ error: classified }, { status: 502 });
  }
}
