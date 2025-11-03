"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Info } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { BoundingBoxViewer } from "@/components/bounding-box-viewer"

interface ResultsPanelProps {
  result: any
  isAnalyzing: boolean
}

export function ResultsPanel({ result, isAnalyzing }: ResultsPanelProps) {
  if (isAnalyzing) {
    return (
      <Card className="p-6 shadow-lg">
        <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4">
          <Spinner className="h-12 w-12" />
          <p className="text-sm text-muted-foreground">Analyzing image...</p>
        </div>
      </Card>
    )
  }

  if (!result) {
    return (
      <Card className="p-6 shadow-lg">
        <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4">
          <Info className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="text-base font-medium text-foreground">No analysis yet</p>
            <p className="text-sm text-muted-foreground">Capture or upload an image to begin detection</p>
          </div>
        </div>
      </Card>
    )
  }

  const detections = result.detections || []
  const imageUrl = result.imageUrl
  const recommendations = result.recommendations || {}
  const disease = result.diseaseProbabilities?.[0]?.disease || "Unknown"
  const confidence = result.diseaseProbabilities?.[0]?.probability || 0

  return (
    <Card className="p-6 shadow-lg">
      <h2 className="mb-4 text-lg font-semibold text-card-foreground">Detection Results</h2>

      <div className="space-y-6">
        {imageUrl && detections.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Detected Image</h3>
            <BoundingBoxViewer imageUrl={imageUrl} detections={detections} />
          </div>
        )}

        {/* Detection Status */}
        {detections.length > 0 ? (
          <Alert variant="default" className="border-primary/50 bg-primary/5">
            <AlertCircle className="h-5 w-5 text-primary" />
            <AlertTitle className="text-base">Oral Lesion Detected</AlertTitle>
            <AlertDescription>
              {disease} detected with {confidence.toFixed(1)}% confidence
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="default">
            <Info className="h-5 w-5" />
            <AlertTitle className="text-base">No Lesions Detected</AlertTitle>
            <AlertDescription>No oral lesions were detected in the image</AlertDescription>
          </Alert>
        )}

        {detections.length > 0 && (
          <>
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">Detected Lesion</h3>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{disease}</p>
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {confidence.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </div>

            {/* Medical Recommendations */}
            {recommendations && Object.keys(recommendations).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-foreground">Medical Recommendations</h3>

                <div className="rounded-lg border border-primary/50 bg-primary/5 p-4">
                  <div className="space-y-3 text-sm">
                    {recommendations.urgent_actions && (
                      <div className="flex gap-3">
                        <div className="mt-1 flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-destructive" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Urgent Actions:</p>
                          <ul className="text-muted-foreground leading-relaxed list-disc list-inside">
                            {recommendations.urgent_actions.map((action: string, idx: number) => (
                              <li key={idx}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {recommendations.monitoring && (
                      <div className="flex gap-3">
                        <div className="mt-1 flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Monitoring:</p>
                          <ul className="text-muted-foreground leading-relaxed list-disc list-inside">
                            {recommendations.monitoring.map((item: string, idx: number) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {recommendations.lifestyle && (
                      <div className="flex gap-3">
                        <div className="mt-1 flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-accent" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Lifestyle Considerations:</p>
                          <ul className="text-muted-foreground leading-relaxed list-disc list-inside">
                            {recommendations.lifestyle.map((item: string, idx: number) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <Alert className="border-accent/50 bg-accent/5">
              <Info className="h-4 w-4 text-accent" />
              <AlertDescription className="text-sm leading-relaxed">
                This is an AI-assisted diagnostic tool. Results should be verified by a qualified healthcare
                professional. Always consult with a dentist or healthcare provider for proper diagnosis and treatment.
              </AlertDescription>
            </Alert>
          </>
        )}
      </div>
    </Card>
  )
}
