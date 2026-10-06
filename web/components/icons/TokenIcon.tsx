import clsx from 'clsx';

type TokenInfo = { bg: string; fg: string; symbol: string; logo?: string };

/// The coins this deployment shows: USDC and the four xStock stand-ins, each
/// with the mark of the real token it tracks.
const TOKENS: Record<string, TokenInfo> = {
  USDC: { bg: '#2775CA', fg: '#FFFFFF', symbol: '$', logo: '/logos/usdc.svg' },
  TSLAx: { bg: '#E82127', fg: '#fff', symbol: 'T', logo: '/stocks/tslax.svg' },
  NVDAx: { bg: '#76B900', fg: '#fff', symbol: 'N', logo: '/stocks/nvdax.png' },
  SPYx: { bg: '#1B1BFF', fg: '#fff', symbol: 'S', logo: '/stocks/spyx.png' },
  AAPLx: { bg: '#000000', fg: '#fff', symbol: 'A', logo: '/stocks/aaplx.svg' },
};

const FALLBACK = { bg: '#3B4256', fg: '#FFFFFF', symbol: '?' };

export function TokenIcon({
  symbol,
  size = 24,
  className,
}: {
  symbol: string;
  size?: number;
  className?: string;
}) {
  const info = TOKENS[symbol] ?? { ...FALLBACK, symbol: symbol.slice(0, 1).toUpperCase() };
  if (info.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        // From this deployment's own origin: app.agama.finance proxies this app
        // and serves its own public/ on that path, so a logo only we have would
        // 404 there.
        src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX ?? ''}${info.logo}`}
        alt={symbol}
        width={size}
        height={size}
        className={clsx('rounded-full select-none block', className)}
        style={{ width: size, height: size, flexShrink: 0 }}
      />
    );
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full ring-1 ring-[#254839]/15 select-none',
        className
      )}
      style={{
        width: size,
        height: size,
        background: info.bg,
        color: info.fg,
        fontSize: size * 0.5,
        fontWeight: 700,
        lineHeight: 1,
      }}
      aria-label={symbol}
    >
      {info.symbol}
    </span>
  );
}
