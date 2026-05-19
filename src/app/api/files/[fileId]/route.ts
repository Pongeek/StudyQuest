import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Proxy route for serving course PDF files.
 * Downloads the file server-side using the service role key and streams it
 * to the client. This bypasses Supabase Storage's InvalidKey issue with
 * non-ASCII (Hebrew/Arabic/etc.) filenames in public URLs.
 *
 * GET /api/files/[fileId]
 *   - fileId: course_files.id (UUID)
 *   - Returns the PDF binary with appropriate content headers
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Look up the user
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch the file record and verify the user owns the course
  const { data: fileRecord } = await supabase
    .from("course_files")
    .select("file_url, file_name, course_id, courses!inner(user_id)")
    .eq("id", fileId)
    .single();

  if (!fileRecord) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Verify ownership
  const courseOwner = (fileRecord.courses as any)?.user_id;
  if (courseOwner !== dbUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Extract the storage path from the file_url
  // file_url could be:
  //   1. A full public URL like https://xxx.supabase.co/storage/v1/object/public/course-files/courses/...
  //   2. A raw storage path like courses/xxx/timestamp-filename.pdf
  let storagePath = fileRecord.file_url;

  // If it's a full URL, extract just the path portion after the bucket name
  const bucketPrefix = "/storage/v1/object/public/course-files/";
  if (storagePath.includes(bucketPrefix)) {
    storagePath = decodeURIComponent(storagePath.split(bucketPrefix)[1]);
  }

  // Download the file server-side using the service role key
  let fileBlob: Blob | null = null;
  let downloadError: any = null;

  try {
    const result = await supabase.storage
      .from("course-files")
      .download(storagePath);
    fileBlob = result.data;
    downloadError = result.error;
  } catch (err) {
    downloadError = err;
  }

  if (downloadError || !fileBlob) {
    console.error("Download error:", downloadError, "path:", storagePath);

    // If the error is InvalidKey (non-ASCII filename), return a specific message
    const errMsg = downloadError?.message || "";
    if (errMsg.includes("InvalidKey") || errMsg.includes("Invalid key")) {
      return NextResponse.json(
        {
          error: "This file was uploaded with a non-ASCII filename. Please re-upload the course to fix this.",
          code: "INVALID_KEY",
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: "Could not download file" },
      { status: 500 }
    );
  }

  // Stream the PDF back to the client
  const arrayBuffer = await fileBlob.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(arrayBuffer.byteLength),
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileRecord.file_name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
