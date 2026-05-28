import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, CloudUpload, Image, RotateCcw, Check } from 'lucide-react';
import { apiRequest } from '../../../shared/api/httpClient';
import type { ClothingItem } from '../../../shared/api/types';

type ScanState = 'idle' | 'camera' | 'captured' | 'uploading' | 'error';

export default function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (scanState === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [scanState]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setScanState('camera');
    } catch {
      setErrorMessage('Camera access denied or not available on this device.');
      setScanState('error');
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(file);
    setCapturedUrl(URL.createObjectURL(file));
    setScanState('captured');
  }

  function retake() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
    setErrorMessage('');
    setScanState('idle');
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

  return (
    <div className="min-h-screen-safe bg-background">
      <div className="container-app py-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => navigate('/wardrobe')}
            className="btn-ghost btn-icon"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h4 className="font-serif">Scan Clothing</h4>
          <div className="h-11 w-11" />
        </div>

        {/* Preview area */}
        <div className="mb-6 flex aspect-square items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-sand bg-linen/40">
          {scanState === 'idle' && (
            <div className="flex flex-col items-center gap-3 px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linen">
                <CloudUpload className="h-8 w-8 text-terracotta" />
              </div>
              <h5>Add to your Wardrobe</h5>
              <p className="helper-text">
                Upload a high-quality photo of your item. For best results, use a plain
                background and natural light.
              </p>
            </div>
          )}

          {scanState === 'camera' && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          )}

          {(scanState === 'captured' ||
            scanState === 'uploading' ||
            scanState === 'error') &&
            capturedUrl && (
              <div className="relative h-full w-full">
                <img
                  src={capturedUrl}
                  alt="Captured garment"
                  className="h-full w-full object-cover"
                />
                {scanState === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <p className="font-sans font-medium text-white">Uploading…</p>
                  </div>
                )}
              </div>
            )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {scanState === 'error' && errorMessage && (
          <p className="mb-4 text-center text-sm text-destructive">{errorMessage}</p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {scanState === 'idle' && (
            <>
              <button onClick={startCamera} className="btn-primary btn-lg w-full gap-2">
                <Camera className="h-5 w-5" />
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-outline btn-lg w-full gap-2"
              >
                <Image className="h-5 w-5" />
                Upload from Gallery
              </button>
            </>
          )}

          {scanState === 'camera' && (
            <button onClick={capturePhoto} className="btn-primary btn-lg w-full gap-2">
              <Camera className="h-5 w-5" />
              Capture
            </button>
          )}

          {(scanState === 'captured' || scanState === 'error') && (
            <div className="flex gap-3">
              <button onClick={retake} className="btn-outline btn-lg flex-1 gap-2">
                <RotateCcw className="h-4 w-4" />
                Retake
              </button>
              <button onClick={confirmScan} className="btn-primary btn-lg flex-1 gap-2">
                <Check className="h-4 w-4" />
                Confirm
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
