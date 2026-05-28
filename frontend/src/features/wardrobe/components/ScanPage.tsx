import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, RotateCcw, Check, ArrowLeft } from 'lucide-react';
import { apiRequest } from '../../../shared/api/httpClient';
import type { ClothingItem } from '../../../shared/api/types';

type ScanState = 'preview' | 'captured' | 'uploading' | 'error';

export default function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [scanState, setScanState] = useState<ScanState>('preview');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError('Camera access denied or not available on this device.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      stopCamera();
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
      setScanState('captured');
    }, 'image/jpeg');
  }

  function retake() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
    setScanState('preview');
    startCamera();
  }

  async function confirmScan() {
    if (!capturedBlob) return;
    setScanState('uploading');

    try {
      const form = new FormData();
      form.append('image', capturedBlob, 'scan.jpg');
      await apiRequest<ClothingItem>('/wardrobe/scan', { method: 'POST', body: form });
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      navigate('/wardrobe');
    } catch {
      setErrorMessage('Failed to upload the scan. Please try again.');
      setScanState('error');
    }
  }

  if (cameraError) {
    return (
      <div className="min-h-screen-safe bg-background">
        <div className="container-app py-8">
          <button onClick={() => navigate('/wardrobe')} className="btn-ghost mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <h5 className="mb-2">Camera Unavailable</h5>
            <p className="helper-text">{cameraError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen-safe bg-background">
      <div className="container-app py-8">
        <button onClick={() => navigate('/wardrobe')} className="btn-ghost mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <h2 className="mb-2">Scan Garment</h2>
        <p className="helper-text mb-6">Point your camera at a clothing item and capture it.</p>

        <div className="relative overflow-hidden rounded-2xl bg-black aspect-[3/4]">
          {scanState === 'preview' && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          )}

          {(scanState === 'captured' || scanState === 'uploading' || scanState === 'error') &&
            capturedUrl && (
              <img
                src={capturedUrl}
                alt="Captured garment"
                className="h-full w-full object-cover"
              />
            )}

          {scanState === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <p className="font-sans text-white">Uploading…</p>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {scanState === 'error' && (
          <p className="mt-3 text-center text-sm text-destructive">{errorMessage}</p>
        )}

        <div className="mt-6 flex gap-3">
          {scanState === 'preview' && (
            <button onClick={capturePhoto} className="btn-primary btn-lg w-full gap-2">
              <Camera className="h-5 w-5" />
              Capture
            </button>
          )}

          {(scanState === 'captured' || scanState === 'error') && (
            <>
              <button onClick={retake} className="btn-outline btn-lg flex-1 gap-2">
                <RotateCcw className="h-4 w-4" />
                Retake
              </button>
              <button onClick={confirmScan} className="btn-primary btn-lg flex-1 gap-2">
                <Check className="h-4 w-4" />
                Confirm
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
