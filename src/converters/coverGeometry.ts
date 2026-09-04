/**
 * 표지 좌표 변환 헬퍼.
 * 미리보기는 모든 요소를 A4(210×297mm) 기준 % 좌표로 저장한다.
 * DOCX는 EMU(914400/inch)와 twip(1440/inch), HWPX는 HWPUNIT(7200/inch),
 * 그리고 미리보기→DOCX 이미지 사이즈는 px(96dpi)을 사용한다.
 */

export const A4_W_MM = 210;
export const A4_H_MM = 297;

const EMU_PER_MM = 36000; // 914400 / 25.4
const TWIP_PER_MM = 1440 / 25.4;
const HWPU_PER_MM = 7200 / 25.4;
const PX_PER_MM = 96 / 25.4;

const r = Math.round;

export const pctXToEmu  = (p: number) => r((p / 100) * A4_W_MM * EMU_PER_MM);
export const pctYToEmu  = (p: number) => r((p / 100) * A4_H_MM * EMU_PER_MM);
export const pctWToEmu  = (p: number) => r((p / 100) * A4_W_MM * EMU_PER_MM);
export const pctHToEmu  = (p: number) => r((p / 100) * A4_H_MM * EMU_PER_MM);

export const pctXToTwip = (p: number) => r((p / 100) * A4_W_MM * TWIP_PER_MM);
export const pctYToTwip = (p: number) => r((p / 100) * A4_H_MM * TWIP_PER_MM);
export const pctWToTwip = (p: number) => r((p / 100) * A4_W_MM * TWIP_PER_MM);
export const pctHToTwip = (p: number) => r((p / 100) * A4_H_MM * TWIP_PER_MM);

export const pctXToHwp  = (p: number) => r((p / 100) * A4_W_MM * HWPU_PER_MM);
export const pctYToHwp  = (p: number) => r((p / 100) * A4_H_MM * HWPU_PER_MM);
export const pctWToHwp  = (p: number) => r((p / 100) * A4_W_MM * HWPU_PER_MM);
export const pctHToHwp  = (p: number) => r((p / 100) * A4_H_MM * HWPU_PER_MM);

export const pctWToPx   = (p: number) => r((p / 100) * A4_W_MM * PX_PER_MM);
export const pctHToPx   = (p: number) => r((p / 100) * A4_H_MM * PX_PER_MM);
