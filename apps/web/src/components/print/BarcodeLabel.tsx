import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface Props {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
}

export function BarcodeLabel({
  value,
  width = 1.6,
  height = 50,
  fontSize = 12,
  displayValue = true,
  className,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        width,
        height,
        fontSize,
        displayValue,
        margin: 4,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch (err) {
      // Invalid value - JsBarcode throws; safe to ignore for display
      console.warn('[BarcodeLabel] failed to render', value, err);
    }
  }, [value, width, height, fontSize, displayValue]);

  if (!value) {
    return <span className="text-xs italic text-slate-400">No barcode</span>;
  }

  return <svg ref={ref} className={className} />;
}