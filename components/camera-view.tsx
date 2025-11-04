"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Camera, CameraOff, Scan } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { detectLesion } from "@/lib/api-client"

interface CameraViewProps {
  onDetection: (result: any) => void
  isAnalyzing: boolean
  setIsAnalyzing: (value: boolean) => void
}

export function CameraView({ onDetection, isAnalyzing, setIsAnalyzing }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRealTimeDetection, setIsRealTimeDetection] = useState(false)
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsCameraActive(true)
        setError(null)
      }
    } catch (err) {
      setError("Unable to access camera. Please check permissions.")
      console.error("Camera error:", err)
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setIsCameraActive(false)
    }
    stopRealTimeDetection()
  }

  const captureFrame = (): File | null => {
    if (!videoRef.current || !canvasRef.current) return null

    const canvas = canvasRef.current
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0)
      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], "frame.jpg", { type: "image/jpeg" }))
            } else {
              resolve(null)
            }
          },
          "image/jpeg",
          0.9,
        )
      }) as any
    }
    return null
  }

  const startRealTimeDetection = async () => {
    setIsRealTimeDetection(true)
    setIsAnalyzing(true)

    detectionIntervalRef.current = setInterval(async () => {
      const frame = await captureFrame()
      if (frame) {
        try {
          const result = await detectLesion(frame)
          onDetection({
            imageUrl: URL.createObjectURL(frame),
            ...result,
          })
        } catch (err) {
          console.error("[v0] Real-time detection error:", err)
        }
      }
    }, 2000)
  }

  const stopRealTimeDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
      detectionIntervalRef.current = null
    }
    setIsRealTimeDetection(false)
    setIsAnalyzing(false)
  }

  const captureAndAnalyze = async () => {
    if (!videoRef.current) return

    setIsAnalyzing(true)
    const frame = await captureFrame()
    if (frame) {
      try {
        const result = await detectLesion(frame)
        const imageUrl = URL.createObjectURL(frame)
        onDetection({
          imageUrl,
          ...result,
        })
      } catch (err) {
        console.error("[v0] Detection error:", err)
        setError(err instanceof Error ? err.message : "Detection failed. Please try again.")
      } finally {
        setIsAnalyzing(false)
      }
    }
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
        {isCameraActive ? (
          <>
            <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {isRealTimeDetection && (
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                <div className="h-2 w-2 bg-white rounded-full animate-pulse" />
                Live Detection
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Camera className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Camera inactive</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        {!isCameraActive ? (
          <Button onClick={startCamera} className="flex-1 h-12 text-base">
            <Camera className="mr-2 h-5 w-5" />
            Start Camera
          </Button>
        ) : (
          <>
            <Button onClick={stopCamera} variant="outline" className="flex-1 h-12 text-base bg-transparent">
              <CameraOff className="mr-2 h-5 w-5" />
              Stop Camera
            </Button>
            <Button
              onClick={captureAndAnalyze}
              disabled={isAnalyzing || isRealTimeDetection}
              className="flex-1 h-12 text-base"
            >
              <Scan className="mr-2 h-5 w-5" />
              {isAnalyzing ? "Analyzing..." : "Capture"}
            </Button>
            <Button
              onClick={isRealTimeDetection ? stopRealTimeDetection : startRealTimeDetection}
              variant={isRealTimeDetection ? "destructive" : "secondary"}
              className="flex-1 h-12 text-base"
            >
              {isRealTimeDetection ? "Stop Live" : "Start Live"}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
