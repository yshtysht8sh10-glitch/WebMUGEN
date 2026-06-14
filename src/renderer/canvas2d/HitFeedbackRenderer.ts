import type { HitFeedbackState, HitSpark } from '../../core/engine/HitFeedback';

export class HitFeedbackRenderer {
  render(ctx: CanvasRenderingContext2D, feedback: HitFeedbackState): void {
    feedback.sparks.forEach((spark) => this.drawSpark(ctx, spark));
  }

  private drawSpark(ctx: CanvasRenderingContext2D, spark: HitSpark): void {
    const radius = 8 + (18 - spark.life) * 0.9;

    ctx.save();
    ctx.translate(spark.x, spark.y);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 210, 80, 0.95)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const inner = radius * 0.5;
      const outer = radius * 1.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`-${spark.damage}`, 12, -12);

    ctx.restore();
  }
}
