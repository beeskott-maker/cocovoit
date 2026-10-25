import { mapsApps, routeUrl } from './maps';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

describe('applis d’itinéraire', () => {
  it('Apple Plans sur iPhone, « Autre application » sur Android, ni l’un ni l’autre ailleurs', () => {
    const names = (ua: string) => mapsApps(ua).map((a) => a.name);
    expect(names(IPHONE)).toEqual(['Waze', 'Google Maps', 'Apple Plans']);
    expect(names(ANDROID)).toEqual(['Waze', 'Google Maps', 'Autre application']);
    expect(names(WINDOWS)).toEqual(['Waze', 'Google Maps']);
  });

  it('liens qui ouvrent le lieu, sans lancer le guidage', () => {
    const address = '12 rue Sainte-Claire, 74000 Annecy';
    const q = encodeURIComponent(address);
    expect(routeUrl('waze', address)).toBe(`https://waze.com/ul?q=${q}`);
    expect(routeUrl('google', address)).toBe(`https://www.google.com/maps/search/?api=1&query=${q}`);
    expect(routeUrl('apple', address)).toBe(`https://maps.apple.com/?q=${q}`);
    expect(routeUrl('other', address)).toBe(`geo:0,0?q=${q}`);
  });
});
