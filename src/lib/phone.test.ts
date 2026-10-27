import { formatPhone, parsePhone, smsUrl } from './phone';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';

describe('numéros de téléphone', () => {
  it('saisie libre → format international, comme en base', () => {
    expect(parsePhone('06 12 34 56 78')).toBe('+33612345678');
    expect(parsePhone('06.12.34.56.78')).toBe('+33612345678');
    expect(parsePhone('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(parsePhone('0033612345678')).toBe('+33612345678');
    expect(parsePhone('+41 79 123 45 67')).toBe('+41791234567');
    expect(parsePhone('  ')).toBeNull();
    expect(parsePhone('12345')).toBeUndefined();
    expect(parsePhone('06 12 34')).toBeUndefined();
  });

  it('affichage : format français par paires, international sinon', () => {
    expect(formatPhone('+33612345678')).toBe('06 12 34 56 78');
    expect(formatPhone('+41791234567')).toBe('+41791234567');
  });

  it('SMS groupé : forme propre à l’iPhone', () => {
    expect(smsUrl(['+33611111111'], IPHONE)).toBe('sms:+33611111111');
    expect(smsUrl(['+33611111111', '+33622222222'], IPHONE)).toBe('sms:/open?addresses=+33611111111,+33622222222');
    expect(smsUrl(['+33611111111', '+33622222222'], ANDROID)).toBe('sms:+33611111111,+33622222222');
  });
});
