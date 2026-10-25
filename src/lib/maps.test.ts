import { mapsApps, routeUrl } from './maps';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';

describe('applis d’itinéraire', () => {
  it('Apple Plans sur appareil Apple, « Autre application » sur Android, Waze sur mobile seulement', () => {
    const names = (ua: string, touchPoints = 0) => mapsApps(ua, touchPoints).map((a) => a.name);
    expect(names(IPHONE, 5)).toEqual(['Waze', 'Google Maps', 'Apple Plans']);
    expect(names(ANDROID, 5)).toEqual(['Waze', 'Google Maps', 'Autre application']);
    // iPad : se présente comme un Mac, mais tactile.
    expect(names(MAC, 5)).toEqual(['Waze', 'Google Maps', 'Apple Plans']);
    expect(names(MAC)).toEqual(['Google Maps', 'Apple Plans']);
    expect(names(WINDOWS)).toEqual(['Google Maps']);
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
