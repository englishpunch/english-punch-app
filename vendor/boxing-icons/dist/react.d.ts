import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import type { IconData } from './index';
export interface BoxingIconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  /** 지정하면 role="img" + aria-label, 없으면 aria-hidden */
  title?: string;
}
export type BoxingIcon = ForwardRefExoticComponent<BoxingIconProps & RefAttributes<SVGSVGElement>>;
export declare const PunchingBag: BoxingIcon;
export declare const BoxingGlove: BoxingIcon;
export declare const PunchingBagIcon: BoxingIcon;
export declare const BoxingGloveIcon: BoxingIcon;
export declare function createIcon(icon: IconData, displayName: string): BoxingIcon;
