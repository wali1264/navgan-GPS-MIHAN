/**
 * Packet Deduplicator
 * Filters duplicate GPS positions within a time-window threshold to prevent database bloat.
 */
import { NormalizedGpsPosition } from '../shared/types/protocols.js';

export class PacketDeduplicator {
  private lastPositions: Map<string, { timestamp: number; lat: number; lng: number; speed: number }> = new Map();
  private readonly minIntervalMs: number;

  constructor(minIntervalMs: number = 2000) {
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Returns true if the position is new and valid, false if it is an exact duplicate
   */
  public isUnique(position: NormalizedGpsPosition): boolean {
    const key = position.imei || position.deviceId;
    const currentTs = new Date(position.timestamp).getTime();
    const last = this.lastPositions.get(key);

    if (!last) {
      this.lastPositions.set(key, {
        timestamp: currentTs,
        lat: position.latitude,
        lng: position.longitude,
        speed: position.speed,
      });
      return true;
    }

    // If identical timestamp, it's a duplicate
    if (last.timestamp === currentTs) {
      return false;
    }

    // If within 1 second and exact same lat, lng, speed, treat as duplicate
    if (
      Math.abs(currentTs - last.timestamp) < this.minIntervalMs &&
      last.lat === position.latitude &&
      last.lng === position.longitude &&
      last.speed === position.speed
    ) {
      return false;
    }

    this.lastPositions.set(key, {
      timestamp: currentTs,
      lat: position.latitude,
      lng: position.longitude,
      speed: position.speed,
    });
    return true;
  }

  public clear(): void {
    this.lastPositions.clear();
  }
}
