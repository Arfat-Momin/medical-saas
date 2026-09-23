import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  useEncounterAttachments,
  useUploadEncounterAttachment,
  useDeleteEncounterAttachment,
  type EncounterAttachment,
} from '@/hooks/useEncounterAttachments';
import { useAuthStore } from '@/stores/auth.store';
import { compressImage } from '@/lib/image-compression';

interface Props {
  encounterId: string | null | undefined;
  editable?: boolean;
  title?: string;
}

export function ConsultationImages({
  encounterId,
  editable = false,
  title = 'Attachments',
}: Props) {
  const query  = useEncounterAttachments(encounterId ?? undefined);
  const upload = useUploadEncounterAttachment(encounterId ?? '');
  const remove = useDeleteEncounterAttachment(encounterId ?? '');

  const tenantId = useAuthStore((s) => s.tenantId);
  const userId   = useAuthStore((s) => s.user?.id ?? null);

  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);
  const [lightbox, setLightbox] = useState<EncounterAttachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!encounterId) {
    if (!editable) return null;
    return (
      <Alert tone="info">
        Save the consultation once, then you can attach photos.
      </Alert>
    );
  }

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!tenantId || !userId) {
      setError('Missing tenant or user context.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 20 * 1024 * 1024) {
          setError('"' + file.name + '" is larger than 20 MB.');
          continue;
        }
        const { blob, width, height } = await compressImage(file);
        await upload.mutateAsync({ tenantId, userId, blob, width, height });
      }
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onDelete(att: EncounterAttachment) {
    if (!confirm('Delete this attachment?')) return;
    setError(null);
    try {
      await remove.mutateAsync(att);
    } catch (e: any) {
      setError(e?.message ?? 'Delete failed');
    }
  }

  const rows = query.data ?? [];

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}

      {editable && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              loading={busy || upload.isPending}
              leftIcon={<Camera size={14} />}
            >
              Take / attach photo
            </Button>
          </div>
        </>
      )}

      {query.isLoading && (
        <div className="flex justify-center py-6">
          <Spinner size={20} />
        </div>
      )}

      {!query.isLoading && rows.length === 0 && (
        <p className="text-xs italic text-slate-500">
          {editable
            ? 'No photos yet. Take or attach one above.'
            : 'No photos attached to this consultation.'}
        </p>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {rows.map((att) => (
            <div
              key={att.id}
              className="group relative overflow-hidden rounded-md border border-slate-200 bg-white"
            >
              <button
                type="button"
                onClick={() => setLightbox(att)}
                className="block aspect-square w-full overflow-hidden bg-slate-100"
              >
                {att.url ? (
                  <img
                    src={att.url}
                    alt="Attachment"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300">
                    <ImageIcon size={24} />
                  </div>
                )}
              </button>
              {editable && (
                <button
                  type="button"
                  onClick={() => onDelete(att)}
                  className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1 text-slate-500 shadow-sm transition hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        title={title}
        size="xl"
      >
        {lightbox?.url ? (
          <img
            src={lightbox.url}
            alt="Attachment"
            className="mx-auto max-h-[70vh] w-auto"
          />
        ) : (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        )}
      </Modal>
    </div>
  );
}