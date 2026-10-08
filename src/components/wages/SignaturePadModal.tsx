import { useEffect, useRef, useState } from "react";
import { Eraser, Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Existing signature data URL to seed the pad (edit flow). */
  initialDataUrl?: string | null;
  pending?: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  onClearSaved?: () => void;
  canClearSaved?: boolean;
  clearPending?: boolean;
};

/**
 * Electronic signature pad — draw with mouse/touch, save as PNG data URL.
 */
export function SignaturePadModal({
  open,
  title,
  subtitle,
  initialDataUrl,
  pending,
  onClose,
  onSave,
  onClearSaved,
  canClearSaved,
  clearPending,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.25;
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setIsEmpty(false);
      };
      img.src = initialDataUrl;
    } else {
      setIsEmpty(true);
    }
  }, [open, initialDataUrl]);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pointFromEvent(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const clearPad = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setIsEmpty(true);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    onSave(canvas.toDataURL("image/png"));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle ?? "Draw your signature below, then save."}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clearPad} disabled={pending}>
              <Eraser className="h-3.5 w-3.5" />
              Clear pad
            </Button>
            {canClearSaved && onClearSaved ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive"
                disabled={pending || clearPending}
                onClick={onClearSaved}
              >
                {clearPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Remove saved
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isEmpty || pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save signature
            </Button>
          </div>
        </div>
      }
    >
      <div className="overflow-hidden rounded-md border border-input bg-white">
        <canvas
          ref={canvasRef}
          className="h-48 w-full touch-none cursor-crosshair sm:h-56"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Use your mouse or finger to sign. Clear the pad to start over.
      </p>
    </Modal>
  );
}
