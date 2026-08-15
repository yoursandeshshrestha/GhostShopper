import type { SupabaseClient } from "jsr:@supabase/supabase-js@2"

export const CALL_RECORDINGS_BUCKET = "call-recordings"

export function recordingObjectPath(orgId: string, callId: string) {
  return `${orgId}/${callId}.mp3`
}

export async function uploadCallRecording(
  admin: SupabaseClient,
  orgId: string,
  callId: string,
  audio: Uint8Array
) {
  const path = recordingObjectPath(orgId, callId)

  const { error: uploadError } = await admin.storage
    .from(CALL_RECORDINGS_BUCKET)
    .upload(path, audio, {
      contentType: "audio/mpeg",
      upsert: true,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { error: updateError } = await admin
    .from("calls")
    .update({ recording_url: path })
    .eq("id", callId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return path
}

export function decodeBase64Audio(value: string) {
  const normalized = value.replace(/\s/g, "")
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
