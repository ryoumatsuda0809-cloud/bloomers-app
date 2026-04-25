let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let stream: MediaStream | null = null;

export function isMediaRecorderSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export async function startAudioRecording(): Promise<void> {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/mp4";

  mediaRecorder = new MediaRecorder(stream, { mimeType });
  audioChunks = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.start(1000); // collect chunks every 1s
}

export function stopAudioRecording(): Promise<{ blob: Blob; mimeType: string }> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      reject(new Error("録音が開始されていません"));
      return;
    }

    mediaRecorder.onstop = () => {
      const mimeType = mediaRecorder?.mimeType ?? "audio/webm";
      const blob = new Blob(audioChunks, { type: mimeType });
      // cleanup stream
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      mediaRecorder = null;
      audioChunks = [];
      resolve({ blob, mimeType: mimeType.split(";")[0] }); // strip codecs param
    };

    mediaRecorder.stop();
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip "data:audio/webm;base64," prefix
      const base64 = result.split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Base64変換に失敗しました"));
    };
    reader.onerror = () => reject(new Error("ファイル読み込みに失敗しました"));
    reader.readAsDataURL(blob);
  });
}
