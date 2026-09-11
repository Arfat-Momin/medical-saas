import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { laboratoryRepository as repo } from '@/repositories/laboratory.repository';

const TESTS = ['lab', 'tests'];
const ORDERS = ['lab', 'orders'];

export function useLabTests(params: { search?: string; page?: number; pageSize?: number }) {
  return useQuery({ queryKey: [...TESTS, params], queryFn: () => repo.listTests(params) });
}
export function useCreateLabTest() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: repo.createTest, onSuccess: () => qc.invalidateQueries({ queryKey: TESTS }) });
}
export function useUpdateLabTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => repo.updateTest(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: TESTS }),
  });
}

export function useLabOrders(params: { status?: string; patientId?: string; date?: string; page?: number; pageSize?: number }) {
  return useQuery({ queryKey: [...ORDERS, params], queryFn: () => repo.listOrders(params) });
}
export function useLabOrder(id: string | undefined) {
  return useQuery({ queryKey: [...ORDERS, id], queryFn: () => repo.getOrder(id!), enabled: Boolean(id) });
}
export function useCreateLabOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.createOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDERS }),
  });
}
export function useCollectSample(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sampleType: string; barcode?: string | null; notes?: string | null }) => repo.collect(orderId, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ORDERS }); qc.invalidateQueries({ queryKey: [...ORDERS, orderId] }); },
  });
}
export function useEnterResults(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: any[]) => repo.enterResults(orderId, items),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ORDERS }); qc.invalidateQueries({ queryKey: [...ORDERS, orderId] }); },
  });
}
export function useVerifyResults(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => repo.verify(orderId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ORDERS }); qc.invalidateQueries({ queryKey: [...ORDERS, orderId] }); },
  });
}