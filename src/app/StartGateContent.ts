import type { UiLanguage } from './UiLanguage';

export type StartGateContent = {
  startLabel: string;
  noticeParagraphs: readonly string[];
  compatibilityNote: string;
  recommendation: string;
};

// Keep purpose-dependent start-screen copy here so it can be revised without
// changing the Audio Start Gate interaction or audio-unlock lifecycle.
export const START_GATE_CONTENT: Record<UiLanguage, StartGateContent> = {
  en: {
    startLabel: 'Click or press a key to start',
    noticeParagraphs: [
      'This web app aims to recreate WinMUGEN.',
      'It is currently about 60% complete, and many behaviors still differ from the original MUGEN.',
    ],
    compatibilityNote: 'Characters made for MUGEN 1.0 or 1.1 in particular are expected to behave quite differently.',
    recommendation: 'Please download the content and try it in the compatible version of MUGEN as well.',
  },
  ja: {
    startLabel: 'クリックまたはキー入力で開始',
    noticeParagraphs: [
      '本WebアプリはWinMUGENの再現を目指したアプリとなります。',
      'まだ完成度は6割ほどであり、実際の挙動は本物のMUGENと異なる部分が多々あります。',
    ],
    compatibilityNote: '特にMUGEN1.0や1.1対応のキャラは挙動が大きく異なる想定です。',
    recommendation: '是非、ダウンロードをし、対応VerのMUGENに導入して遊んでください。',
  },
};
