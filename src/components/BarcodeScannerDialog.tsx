import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type BarcodeScannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (value: string) => void;
  title?: string;
};

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onDetected,
  title = "Scan barcode",
}: BarcodeScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const stopScanner = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    readerRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!open) {
      stopScanner();
      detectedRef.current = false;
      setError(null);
      return;
    }

    let cancelled = false;
    detectedRef.current = false;
    setError(null);

    const start = async () => {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setError("Camera access is not supported in this browser.");
        return;
      }

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (err) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (fallbackErr) {
          const name = (fallbackErr as Error & { name?: string })?.name;
          if (name === "NotAllowedError" || name === "SecurityError") {
            setError("Camera permission was denied.");
          } else if (name === "NotFoundError" || name === "OverconstrainedError") {
            setError("No available camera was found.");
          } else {
            setError("Unable to access the camera.");
          }
          return;
        }
      }

      if (cancelled || !open || !stream) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      const preview = videoRef.current;
      if (!preview) {
        setError("Unable to initialize the camera preview.");
        stopScanner();
        return;
      }

      try {
        const controls = await reader.decodeFromStream(stream, preview, (result) => {
          if (!result || detectedRef.current) return;
          detectedRef.current = true;
          const value = result.getText().trim();
          if (value) {
            onDetected(value);
          }
          onOpenChange(false);
        });

        if (!cancelled) {
          controlsRef.current = controls;
        } else {
          controls.stop();
        }
      } catch {
        setError("Unable to start barcode scanning.");
        stopScanner();
      }
    };

    start();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [open, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <video
              ref={videoRef}
              className="aspect-video w-full rounded-md bg-black"
              muted
              playsInline
            />
          )}
          <p className="text-xs text-muted-foreground">Align the barcode within the frame.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
