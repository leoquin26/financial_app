declare module 'react-colorful' {
  import { ComponentProps } from 'react';

  export interface ColorPickerBaseProps {
    color: string;
    onChange: (color: string) => void;
    style?: React.CSSProperties;
    className?: string;
  }

  export const HexColorPicker: React.FC<ColorPickerBaseProps>;
  export const RgbColorPicker: React.FC<ColorPickerBaseProps>;
  export const HslColorPicker: React.FC<ColorPickerBaseProps>;
  export const HsvColorPicker: React.FC<ColorPickerBaseProps>;
}
