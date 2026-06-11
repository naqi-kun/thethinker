import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, ImagePlus, RotateCcw, Scan } from 'lucide-react';
import { classifyItem } from '../api';

type PageState = 'camera' | 'camera-preview' | 'busy';

const HEADER_TITLES: Record<PageState, string> = {
  camera: 'Scan Item',
  'camera-preview': 'Scan Item',
  busy: 'Add Item',
};

export default function AddItemPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  // Open the camera immediately on entry; clean up the stream on unmount.
  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, []);

  // Attach the live stream once the camera is ready and the <video> has mounted.
  useEffect(() => {
    if (cameraReady && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraReady]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  function clearImage() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraReady(true);
      setPageState('camera');
    } catch {
      setCameraReady(false);
      setError('Camera access denied or not available on this device.');
    }
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
      setPageState('camera-preview');
    }, 'image/jpeg');
  }

  // Both camera capture and gallery upload converge here: classify, then hand
  // the result + image to the review screen.
  async function classifyAndReview(image: Blob) {
    setPageState('busy');
    setError(null);
    try {
      const result = await classifyItem(image);
      navigate('/wardrobe/add/review', {
        state: { classifyResult: result, imageBlob: image },
      });
    } catch {
      setError('Scan failed. Please try again.');
      setPageState(capturedUrl ? 'camera-preview' : 'camera');
    }
  }

  function handleGalleryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(file);
    setCapturedUrl(URL.createObjectURL(file));
    void classifyAndReview(file);
  }

  // Discard any captured image and return to the live camera view.
  function restartCamera() {
    clearImage();
    setError(null);
    stopCamera();
    setPageState('camera');
    void startCamera();
  }

  return (
    <div className="min-h-screen-safe bg-background pb-24">
      <div className="container-app py-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() =>
              pageState === 'camera' ? navigate('/wardrobe') : restartCamera()
            }
            className="btn-ghost btn-icon"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h4 className="font-serif">{HEADER_TITLES[pageState]}</h4>
          <div className="h-11 w-11" />
        </div>

        {/* ── CAMERA LIVE ─────────────────────────────── */}
        {pageState === 'camera' && (
          <>
            {cameraReady ? (
              <div className="mb-6 aspect-square overflow-hidden rounded-2xl bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="mb-6 flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
                <Camera className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {error ?? 'Starting camera…'}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {cameraReady && (
                <button
                  onClick={capturePhoto}
                  className="btn-primary btn-lg w-full gap-2"
                >
                  <Camera className="h-5 w-5" />
                  Capture
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-outline btn-lg w-full gap-2"
              >
                <ImagePlus className="h-5 w-5" />
                Upload from Gallery
              </button>
            </div>
          </>
        )}

        {/* ── CAMERA PREVIEW ──────────────────────────── */}
        {pageState === 'camera-preview' && capturedUrl && (
          <>
            <div className="mb-6 aspect-square overflow-hidden rounded-2xl">
              <img
                src={capturedUrl}
                alt="Captured item"
                className="h-full w-full object-cover"
              />
            </div>
            {error && (
              <p className="mb-4 text-center text-sm text-destructive">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={restartCamera}
                className="btn-outline btn-lg flex-1 gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Retake
              </button>
              <button
                onClick={() => capturedBlob && classifyAndReview(capturedBlob)}
                className="btn-primary btn-lg flex-1 gap-2"
              >
                <Scan className="h-4 w-4" />
                Scan Item
              </button>
            </div>
          </>
        )}

        {/* ── BUSY ────────────────────────────────────── */}
        {pageState === 'busy' && (
          <div className="flex flex-col items-center gap-4 py-20">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Classifying your item…</p>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGalleryFile}
        />
      </div>
    </div>
  );
}
