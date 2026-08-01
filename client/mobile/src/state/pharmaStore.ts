import { create } from 'zustand';

export interface Prescription {
  id: string;
  uri: string;
  fileName: string;
  uploadDate: string;
}

interface PharmaState {
  prescriptions: Prescription[];
  uploadPrescription: (uri: string, fileName: string) => void;
  removePrescription: (id: string) => void;
}

export const usePharmaStore = create<PharmaState>()((set) => ({
  prescriptions: [],
  uploadPrescription: (uri, fileName) => set((state) => ({
    prescriptions: [
      ...state.prescriptions,
      {
        id: Math.random().toString(36).substring(2, 9),
        uri,
        fileName,
        uploadDate: new Date().toISOString(),
      },
    ],
  })),
  removePrescription: (id) => set((state) => ({
    prescriptions: state.prescriptions.filter((p) => p.id !== id),
  })),
}));
