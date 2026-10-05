export type IconNode = [tag: string, attrs: Record<string, string | number>, children?: IconNode[]];
export interface IconData {
  name: string;
  /** 가공용 원본 패스 데이터 */
  paths: Record<string, string>;
  build(id: string, strokeWidth: number): IconNode[];
}
export interface IconOptions {
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  class?: string;
  className?: string;
  /** mask id 직접 지정 (기본: 자동 고유값) */
  id?: string;
  [attr: string]: unknown;
}
export declare const PunchingBag: IconData;
export declare const BoxingGlove: IconData;
export declare const icons: { PunchingBag: IconData; BoxingGlove: IconData };
export declare const iconsByName: Record<'punching-bag' | 'boxing-glove', IconData>;
export declare const defaultAttributes: Record<string, string | number>;
export declare function toSvg(icon: IconData, opts?: IconOptions): string;
export declare function createElement(icon: IconData, opts?: IconOptions, doc?: Document): SVGSVGElement;
export declare function createIcons(opts?: {
  icons?: Record<string, IconData>;
  nameAttr?: string;
  attrs?: IconOptions;
  root?: ParentNode;
}): void;
declare const _default: { PunchingBag: IconData; BoxingGlove: IconData };
export default _default;
