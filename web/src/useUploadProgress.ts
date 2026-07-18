import { useCallback, useState } from 'react'

// 사진 여러 장 업로드가 끝날 때까지 화면이 무반응이던 문제 — 업로드 중 상태와 진행률(0~1)을
// 표준화해서, 호출부는 run()으로 감싸기만 하면 UploadProgressBar를 그대로 붙일 수 있다.
export function useUploadProgress() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const run = useCallback(async <T,>(fn: (onProgress: (fraction: number) => void) => Promise<T>): Promise<T> => {
    setUploading(true)
    setProgress(0)
    try {
      return await fn((fraction) => setProgress(fraction))
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [])

  return { uploading, progress, run }
}
