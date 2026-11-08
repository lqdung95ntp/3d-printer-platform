import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { listenForCameraPopIn, registerCameraTab } from '../utils/camera';
import { EmbeddedCameraViewer } from '../components/EmbeddedCameraViewer';

const STORAGE_KEY = 'openEmbeddedCameras';

export interface OpenCamera {
  id: number;
  name: string;
}

interface EmbeddedCameraContextType {
  openCameras: OpenCamera[];
  openEmbeddedCamera: (id: number, name: string) => void;
  closeEmbeddedCamera: (id: number) => void;
}

const EmbeddedCameraContext = createContext<EmbeddedCameraContextType | undefined>(undefined);

function readStored(): OpenCamera[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const cameras = JSON.parse(saved) as OpenCamera[];
      if (Array.isArray(cameras)) {
        return cameras
          .filter(c => c && Number.isInteger(c.id) && c.id > 0)
          .map(c => ({ id: c.id, name: String(c.name ?? '') }));
      }
    }
  } catch {
    // Unreadable storage
  }
  return [];
}

function updateStored(change: (cameras: OpenCamera[]) => OpenCamera[]) {
  try {
    const next = change(readStored());
    if (next.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Session fallback
  }
}

export function EmbeddedCameraProvider({ children }: { children: ReactNode }) {
  const { hasPermission } = useAuth();
  const canView = hasPermission('camera:view') && hasPermission('printers:read');
  const [cameras, setCameras] = useState<Map<number, OpenCamera>>(
    () => new Map(readStored().map(c => [c.id, c])),
  );

  const openEmbeddedCamera = useCallback((id: number, name: string) => {
    setCameras(prev => (prev.has(id) ? prev : new Map(prev).set(id, { id, name })));
    updateStored(list => (list.some(c => c.id === id) ? list : [...list, { id, name }]));
  }, []);

  const closeEmbeddedCamera = useCallback((id: number) => {
    setCameras(prev => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    updateStored(list => list.filter(c => c.id !== id));
  }, []);

  const queryClient = useQueryClient();
  const [mountedAt] = useState(() => Date.now());
  const { data: printers, dataUpdatedAt, isSuccess, isError } = useQuery({
    queryKey: ['printers'],
    queryFn: api.getPrinters,
    enabled: canView && cameras.size > 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const listFresh = isSuccess && dataUpdatedAt >= mountedAt;
  const listChecked = listFresh || isError;

  useEffect(() => {
    if (!listFresh || !printers) return;
    const visible = new Set(printers.map(p => p.id));
    const dropped = Array.from(cameras.keys()).filter(id => !visible.has(id));
    dropped.forEach(closeEmbeddedCamera);
  }, [listFresh, printers, cameras, closeEmbeddedCamera]);

  useEffect(() => {
    if (!canView) return;
    const canShow = async (printerId: number) => {
      const list = await queryClient.fetchQuery({ queryKey: ['printers'], queryFn: api.getPrinters, staleTime: 0 });
      return list.some(p => p.id === printerId);
    };
    return listenForCameraPopIn(registerCameraTab(), openEmbeddedCamera, canShow);
  }, [canView, openEmbeddedCamera, queryClient]);

  const openCameras = useMemo(() => Array.from(cameras.values()), [cameras]);
  const value = useMemo(
    () => ({ openCameras, openEmbeddedCamera, closeEmbeddedCamera }),
    [openCameras, openEmbeddedCamera, closeEmbeddedCamera],
  );

  return (
    <EmbeddedCameraContext.Provider value={value}>
      {children}
      {canView && listChecked && openCameras.length > 0 && (
        <>
          {openCameras.map((camera, index) => (
            <EmbeddedCameraViewer
              key={camera.id}
              printerId={camera.id}
              printerName={camera.name}
              viewerIndex={index}
              onClose={() => closeEmbeddedCamera(camera.id)}
            />
          ))}
        </>
      )}
    </EmbeddedCameraContext.Provider>
  );
}

export function useEmbeddedCameras(): EmbeddedCameraContextType {
  const context = useContext(EmbeddedCameraContext);
  if (!context) {
    throw new Error('useEmbeddedCameras must be used inside EmbeddedCameraProvider');
  }
  return context;
}

