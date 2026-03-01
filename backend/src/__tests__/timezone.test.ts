import { resolveTimezone, toUTC, fromUTC, formatForDisplay } from '../services/timezoneService';

describe('timezoneService', () => {
  describe('resolveTimezone', () => {
    it('resolves known city by name', () => {
      expect(resolveTimezone('Paris')).toBe('Europe/Paris');
      expect(resolveTimezone('Tokyo')).toBe('Asia/Tokyo');
      expect(resolveTimezone('Dubai')).toBe('Asia/Dubai');
    });

    it('resolves city with country code disambiguation', () => {
      expect(resolveTimezone('Sydney', 'AU')).toBe('Australia/Sydney');
      expect(resolveTimezone('Los Angeles', 'US')).toBe('America/Los_Angeles');
    });

    it('is case-insensitive', () => {
      expect(resolveTimezone('paris')).toBe('Europe/Paris');
      expect(resolveTimezone('PARIS')).toBe('Europe/Paris');
    });

    it('returns UTC for unknown city and warns', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(resolveTimezone('Atlantis', 'XX')).toBe('UTC');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown city timezone'));
      consoleSpy.mockRestore();
    });

    it('resolves Indian tournament cities', () => {
      expect(resolveTimezone('New Delhi', 'IN')).toBe('Asia/Kolkata');
      expect(resolveTimezone('Mumbai', 'IN')).toBe('Asia/Kolkata');
    });
  });

  describe('toUTC', () => {
    it('converts Paris local time to UTC correctly (summer +2)', () => {
      const result = toUTC('2025-06-15T18:00:00', 'Paris', 'FR');
      expect(result.utc).toBe('2025-06-15T16:00:00.000Z');
      expect(result.timezone).toBe('Europe/Paris');
    });

    it('converts Tokyo local time to UTC correctly (always +9)', () => {
      const result = toUTC('2025-07-10T10:00:00', 'Tokyo', 'JP');
      expect(result.utc).toBe('2025-07-10T01:00:00.000Z');
    });

    it('stores original local time in localEvent field', () => {
      const result = toUTC('2025-06-15T18:00:00', 'Paris', 'FR');
      expect(result.localEvent).toContain('2025-06-15T18:00:00');
    });

    it('handles unknown city gracefully (defaults to UTC)', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = toUTC('2025-06-15T18:00:00', 'Atlantis');
      expect(result.utc).toBe('2025-06-15T18:00:00.000Z');
      consoleSpy.mockRestore();
    });

    it('converts Dubai local time to UTC correctly (+4)', () => {
      const result = toUTC('2025-03-20T09:00:00', 'Dubai', 'AE');
      expect(result.utc).toBe('2025-03-20T05:00:00.000Z');
    });
  });

  describe('fromUTC', () => {
    it('defaults to America/Los_Angeles (PST/PDT)', () => {
      // 2025-06-15T16:00:00Z is 09:00 PDT (UTC-7 in summer)
      const result = fromUTC('2025-06-15T16:00:00.000Z');
      expect(result).toContain('9:00');
    });

    it('converts to the specified user timezone', () => {
      // 2025-06-15T16:00:00Z is 18:00 CEST (Paris, UTC+2 in summer)
      const result = fromUTC('2025-06-15T16:00:00.000Z', 'Europe/Paris');
      expect(result).toContain('6:00');
    });

    it('converts Tokyo time correctly', () => {
      // 2025-07-10T01:00:00Z is 10:00 JST (UTC+9)
      const result = fromUTC('2025-07-10T01:00:00.000Z', 'Asia/Tokyo');
      expect(result).toContain('10:00');
    });

    it('is the deprecated alias formatForDisplay', () => {
      expect(formatForDisplay).toBe(fromUTC);
    });
  });
});
