import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pharmacyRepository as repo } from '@/repositories/pharmacy.repository';

const MED = ['pharmacy', 'medicines'];
const SUP = ['pharmacy', 'suppliers'];
const BAT = ['pharmacy', 'batches'];
const PUR = ['pharmacy', 'purchases'];
const DISP = ['pharmacy', 'dispenses'];
const LOW = ['pharmacy', 'low-stock'];
const EXP = ['pharmacy', 'expiring'];

export function useMedicines(params: { search?: string; page?: number; pageSize?: number }) {
  return useQuery({ queryKey: [...MED, params], queryFn: () => repo.listMedicines(params) });
}
export function useCreateMedicine() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: repo.createMedicine, onSuccess: () => qc.invalidateQueries({ queryKey: MED }) });
}
export function useUpdateMedicine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => repo.updateMedicine(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: MED }),
  });
}

export function useSuppliers() {
  return useQuery({ queryKey: SUP, queryFn: repo.listSuppliers });
}
export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: repo.createSupplier, onSuccess: () => qc.invalidateQueries({ queryKey: SUP }) });
}

export function useBatches(params: { medicineId?: string; onlyInStock?: boolean } = {}) {
  return useQuery({ queryKey: [...BAT, params], queryFn: () => repo.listBatches(params) });
}

export function usePurchases(page = 1, pageSize = 20) {
  return useQuery({ queryKey: [...PUR, page, pageSize], queryFn: () => repo.listPurchases(page, pageSize) });
}
export function useReceivePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.receivePurchase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PUR });
      qc.invalidateQueries({ queryKey: BAT });
      qc.invalidateQueries({ queryKey: MED });
      qc.invalidateQueries({ queryKey: LOW });
    },
  });
}

export function useDispenses(page = 1, pageSize = 20) {
  return useQuery({ queryKey: [...DISP, page, pageSize], queryFn: () => repo.listDispenses(page, pageSize) });
}
export function useDispense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.dispense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DISP });
      qc.invalidateQueries({ queryKey: BAT });
      qc.invalidateQueries({ queryKey: LOW });
    },
  });
}

export function useLowStock() {
  return useQuery({ queryKey: LOW, queryFn: repo.lowStock });
}
export function useExpiring() {
  return useQuery({ queryKey: EXP, queryFn: repo.expiring });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.adjustStock,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BAT });
      qc.invalidateQueries({ queryKey: LOW });
    },
  });
}