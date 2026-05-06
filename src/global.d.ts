import { ThreeElements } from '@react-three/fiber'

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }

  interface Window {
    electronAPI?: {
      platform: string;
      isElectron: boolean;
      openFolder: () => Promise<string | null>;
      onGoToView: (cb: (view: string) => void) => void;
      onOpenFolder: (cb: (folderPath: string) => void) => void;
      onSaveAs: (cb: (filePath: string) => void) => void;
      onAutoSave: (cb: (enabled: boolean) => void) => void;
      onCloseFolder: (cb: () => void) => void;
      onClearRecent: (cb: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
    /** Nexus global hook — registered by App.tsx for menu integration */
    __nexus?: {
      save?: () => void;
      saveAll?: () => void;
      newFile?: () => void;
      revertFile?: () => void;
      closeEditor?: () => void;
      find?: () => void;
      expandSelection?: () => void;
    };
  }
}
