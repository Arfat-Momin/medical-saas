import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase';

export interface EncounterAttachment {
  id: string;
  tenant_id: string;
  encounter_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  uploaded_by: string;
  created_at: string;
  url?: string;
}

const BUCKET = 'consultation-attachments';
const KEY = (encounterId: string) => ['encounter-attachments', encounterId];

export function useEncounterAttachments(encounterId: string | undefined) {
  return useQuery({
    queryKey: KEY(encounterId ?? ''),
    enabled: Boolean(encounterId),
    staleTime: 30_000,
    queryFn: async (): Promise<EncounterAttachment[]> => {
      if (!encounterId) return [];
      const sb = getSupabase();

      const { data, error } = await sb
        .from('encounter_attachments')
        .select('*')
        .eq('encounter_id', encounterId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as EncounterAttachment[];

      const signed = await Promise.all(
        rows.map(async (r) => {
          const { data: sig } = await sb.storage
            .from(BUCKET)
            .createSignedUrl(r.storage_path, 60 * 60);
          return { ...r, url: sig?.signedUrl };
        }),
      );

      return signed;
    },
  });
}

export function useUploadEncounterAttachment(encounterId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      tenantId: string;
      userId: string;
      blob: Blob;
      width: number;
      height: number;
    }) => {
      const sb = getSupabase();

      const ext =
        input.blob.type === 'image/png'  ? 'png'  :
        input.blob.type === 'image/webp' ? 'webp' :
        'jpg';
      const path = input.tenantId + '/' + encounterId + '/' + crypto.randomUUID() + '.' + ext;

      const { error: upErr } = await sb.storage
        .from(BUCKET)
        .upload(path, input.blob, { contentType: input.blob.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await sb.from('encounter_attachments').insert({
        tenant_id:    input.tenantId,
        encounter_id: encounterId,
        storage_path: path,
        mime_type:    input.blob.type,
        size_bytes:   input.blob.size,
        width:        input.width,
        height:       input.height,
        uploaded_by:  input.userId,
      });

      if (insErr) {
        await sb.storage.from(BUCKET).remove([path]).catch(() => {});
        throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(encounterId) });
    },
  });
}

export function useDeleteEncounterAttachment(encounterId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (att: EncounterAttachment) => {
      const sb = getSupabase();
      await sb.storage.from(BUCKET).remove([att.storage_path]).catch(() => {});
      const { error } = await sb.from('encounter_attachments').delete().eq('id', att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(encounterId) });
    },
  });
}