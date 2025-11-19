export interface Currency {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  decimals: number;
}

export const CURRENCIES: Record<string, Currency> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US',
    decimals: 2,
  },
  PEN: {
    code: 'PEN',
    symbol: 'S/',
    name: 'Peruvian Sol',
    locale: 'es-PE',
    decimals: 2,
  },
};

export const DEFAULT_CURRENCY = 'USD';

export const formatCurrency = (amount: number, currencyCode: string = DEFAULT_CURRENCY): string => {
  const currency = CURRENCIES[currencyCode] || CURRENCIES[DEFAULT_CURRENCY];
  
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(amount);
};

export const getCurrencySymbol = (currencyCode: string = DEFAULT_CURRENCY): string => {
  const currency = CURRENCIES[currencyCode] || CURRENCIES[DEFAULT_CURRENCY];
  return currency.symbol;
};
