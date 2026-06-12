import type { SpritePackManifest } from '../core/sprite/SpriteTypes';

// Phase17: 本物SFFの前段階。
// SFFから抽出したPNGが public/sprites/debug/ にある想定。
// 画像が存在しない場合、Rendererは従来の棒人間描画へフォールバックする。
export const sampleSpritePackManifest: SpritePackManifest = {
  sprites: [
    { groupNo: 0, imageNo: 0, src: '/sprites/debug/0_0.png', xAxis: 16, yAxis: 78 },
    { groupNo: 20, imageNo: 0, src: '/sprites/debug/20_0.png', xAxis: 16, yAxis: 78 },
    { groupNo: 20, imageNo: 1, src: '/sprites/debug/20_1.png', xAxis: 16, yAxis: 78 },
    { groupNo: 20, imageNo: 2, src: '/sprites/debug/20_2.png', xAxis: 16, yAxis: 78 },
    { groupNo: 40, imageNo: 0, src: '/sprites/debug/40_0.png', xAxis: 16, yAxis: 78 },
    { groupNo: 40, imageNo: 1, src: '/sprites/debug/40_1.png', xAxis: 16, yAxis: 78 },
    { groupNo: 200, imageNo: 0, src: '/sprites/debug/200_0.png', xAxis: 16, yAxis: 78 },
    { groupNo: 200, imageNo: 1, src: '/sprites/debug/200_1.png', xAxis: 16, yAxis: 78 },
    { groupNo: 200, imageNo: 2, src: '/sprites/debug/200_2.png', xAxis: 16, yAxis: 78 },
    { groupNo: 1000, imageNo: 0, src: '/sprites/debug/1000_0.png', xAxis: 16, yAxis: 78 },
    { groupNo: 1000, imageNo: 1, src: '/sprites/debug/1000_1.png', xAxis: 16, yAxis: 78 },
    { groupNo: 1000, imageNo: 2, src: '/sprites/debug/1000_2.png', xAxis: 16, yAxis: 78 },
    { groupNo: 1100, imageNo: 0, src: '/sprites/debug/1100_0.png', xAxis: 12, yAxis: 12 },
    { groupNo: 1100, imageNo: 1, src: '/sprites/debug/1100_1.png', xAxis: 12, yAxis: 12 },
    { groupNo: 5000, imageNo: 0, src: '/sprites/debug/5000_0.png', xAxis: 16, yAxis: 78 },
    { groupNo: 5000, imageNo: 1, src: '/sprites/debug/5000_1.png', xAxis: 16, yAxis: 78 },
    { groupNo: 5030, imageNo: 0, src: '/sprites/debug/5030_0.png', xAxis: 16, yAxis: 78 },
    { groupNo: 5030, imageNo: 1, src: '/sprites/debug/5030_1.png', xAxis: 16, yAxis: 78 },
  ],
};
