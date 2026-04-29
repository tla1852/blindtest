'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function QrCode({ value, size = 260 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: '#0A0015', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setDataUrl);
  }, [value, size]);

  if (!dataUrl) return <div className="bg-white/10 rounded" style={{ width: size, height: size }} />;
  return (
    <div className="p-3 bg-white rounded-xl shadow-neon-cyan inline-block">
      <img src={dataUrl} alt="QR code" width={size} height={size} />
    </div>
  );
}
