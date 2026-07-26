import prisma from "../db/prisma.js"
import { env } from "./env.js"
import { integrationConfig } from "./integration-config.js"
import { putPrivateObject, storageConfigured } from "./storage.js"

type UploadTarget = string | {
  url?: string
  upload_url?: string
  headers?: Record<string, string>
}

const sarvamHeaders = (apiKey: string) => ({
  "api-subscription-key": apiKey,
  "Content-Type": "application/json",
})

const uploadUrl = (target: UploadTarget | undefined) =>
  typeof target === "string" ? target : target?.url || target?.upload_url || ""

export async function transcribeCall(callId: string) {
  const call = await prisma.callRecord.findUnique({ where: { id: callId } })
  if (!call) throw new Error("Call is unavailable")
  const stored = await integrationConfig<{ apiKey?: string }>(call.organizationId, "sarvam")
  const apiKey = stored?.apiKey || env.SARVAM_API_KEY
  if (!apiKey) throw new Error("SARVAM_API_KEY is not configured")
  const recording = await prisma.callRecording.findUnique({ where: { callId } })
  if (!recording?.providerUrl) throw new Error("Call recording is unavailable")

  const transcript = await prisma.transcript.upsert({
    where: { callId },
    update: { status: "processing", errorMessage: null },
    create: {
      organizationId: call.organizationId,
      callId,
      status: "processing",
    },
  })

  try {
    const audioResponse = await fetch(recording.providerUrl)
    if (!audioResponse.ok) throw new Error("Call recording could not be downloaded")
    const audio = new Uint8Array(await audioResponse.arrayBuffer())
    const contentType = audioResponse.headers.get("content-type") || "audio/mpeg"
    const fileName = `${callId}.${contentType.includes("wav") ? "wav" : "mp3"}`

    if (await storageConfigured(call.organizationId)) {
      const storageKey = await putPrivateObject(
        call.organizationId,
        `${call.organizationId}/calls/${fileName}`,
        audio,
        contentType,
      )
      await prisma.callRecording.update({ where: { callId }, data: { storageKey, mimeType: contentType } })
    }

    const initiate = await fetch("https://api.sarvam.ai/speech-to-text/job/v1", {
      method: "POST",
      headers: sarvamHeaders(apiKey),
      body: JSON.stringify({
        job_parameters: {
          model: "saaras:v3",
          mode: "codemix",
          language_code: "unknown",
          with_diarization: true,
          num_speakers: 2,
        },
      }),
    })
    const initiated = await initiate.json() as { job_id?: string; message?: string }
    if (!initiate.ok || !initiated.job_id) throw new Error(initiated.message || "Sarvam job could not be created")
    await prisma.transcript.update({
      where: { id: transcript.id },
      data: { providerJobId: initiated.job_id },
    })

    const uploadRequest = await fetch("https://api.sarvam.ai/speech-to-text/job/v1/upload-files", {
      method: "POST",
      headers: sarvamHeaders(apiKey),
      body: JSON.stringify({ job_id: initiated.job_id, files: [fileName] }),
    })
    const uploadPayload = await uploadRequest.json() as {
      upload_urls?: Record<string, UploadTarget>
      message?: string
    }
    const target = uploadPayload.upload_urls?.[fileName]
      || Object.values(uploadPayload.upload_urls || {})[0]
    const targetUrl = uploadUrl(target)
    if (!uploadRequest.ok || !targetUrl) throw new Error(uploadPayload.message || "Sarvam upload URL is unavailable")
    const upload = await fetch(targetUrl, {
      method: "PUT",
      headers: typeof target === "object" ? target.headers : undefined,
      body: audio,
    })
    if (!upload.ok) throw new Error("Call recording upload to Sarvam failed")

    const start = await fetch(`https://api.sarvam.ai/speech-to-text/job/v1/${initiated.job_id}/start`, {
      method: "POST",
      headers: sarvamHeaders(apiKey),
      body: "{}",
    })
    if (!start.ok) throw new Error("Sarvam transcription job could not be started")

    let resultName = ""
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5_000))
      const statusResponse = await fetch(
        `https://api.sarvam.ai/speech-to-text/job/v1/${initiated.job_id}/status`,
        { headers: sarvamHeaders(apiKey) },
      )
      const status = await statusResponse.json() as {
        job_state?: string
        error_message?: string
        job_details?: Array<{ outputs?: Array<{ file_name?: string }> }>
      }
      if (status.job_state === "Failed") throw new Error(status.error_message || "Sarvam transcription failed")
      if (["Completed", "PartiallyCompleted"].includes(status.job_state || "")) {
        resultName = status.job_details?.flatMap((item) => item.outputs || [])[0]?.file_name || ""
        break
      }
    }
    if (!resultName) throw new Error("Sarvam transcription timed out")

    const downloadResponse = await fetch("https://api.sarvam.ai/speech-to-text/job/v1/download-files", {
      method: "POST",
      headers: sarvamHeaders(apiKey),
      body: JSON.stringify({ job_id: initiated.job_id, files: [resultName] }),
    })
    const downloads = await downloadResponse.json() as {
      download_urls?: Record<string, UploadTarget>
      message?: string
    }
    const resultTarget = downloads.download_urls?.[resultName]
      || Object.values(downloads.download_urls || {})[0]
    const resultUrl = uploadUrl(resultTarget)
    if (!downloadResponse.ok || !resultUrl) throw new Error(downloads.message || "Sarvam result URL is unavailable")
    const resultResponse = await fetch(resultUrl)
    if (!resultResponse.ok) throw new Error("Sarvam transcript could not be downloaded")
    const result = await resultResponse.json() as {
      transcript?: string
      language_code?: string
      diarized_transcript?: unknown
      timestamps?: unknown
    }
    const completed = await prisma.transcript.update({
      where: { id: transcript.id },
      data: {
        status: "completed",
        text: result.transcript || "",
        languageCode: result.language_code,
        diarized: result.diarized_transcript
          ? JSON.parse(JSON.stringify(result.diarized_transcript))
          : undefined,
        timestamps: result.timestamps ? JSON.parse(JSON.stringify(result.timestamps)) : undefined,
        completedAt: new Date(),
      },
    })
    await prisma.usageLedger.create({
      data: {
        organizationId: call.organizationId,
        usageType: "transcription_minutes",
        quantity: Math.max(1, Math.ceil((call.durationSeconds || 60) / 60)),
        referenceType: "call",
        referenceId: call.id,
      },
    })
    return completed
  } catch (error) {
    await prisma.transcript.update({
      where: { id: transcript.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Transcription failed",
      },
    })
    throw error
  }
}
