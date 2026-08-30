/**
 * GPS Protocol Registry
 * Manages all registered protocol decoders and provides routing/dispatch logic.
 */
import { GpsProtocolDecoder, GpsPacketContext, ProtocolDecodeResult } from '../shared/types/protocols.js';
import { ProtocolType } from '../shared/types/enums.js';

export class ProtocolRegistry {
  private decoders: Map<ProtocolType, GpsProtocolDecoder> = new Map();

  public register(decoder: GpsProtocolDecoder): void {
    this.decoders.set(decoder.protocol, decoder);
  }

  public get(protocol: ProtocolType): GpsProtocolDecoder | undefined {
    return this.decoders.get(protocol);
  }

  public getAll(): GpsProtocolDecoder[] {
    return Array.from(this.decoders.values());
  }

  /**
   * Identifies the matching decoder for an incoming raw buffer
   */
  public findDecoder(buffer: Buffer | string, context: GpsPacketContext): GpsProtocolDecoder | undefined {
    // 1. If context already has an associated device with a known protocol, test that first
    // 2. Otherwise iterate over all registered decoders
    for (const decoder of this.decoders.values()) {
      try {
        if (decoder.canHandle(buffer, context)) {
          return decoder;
        }
      } catch (err) {
        console.warn(`[ProtocolRegistry] Error in canHandle for ${decoder.protocol}:`, err);
      }
    }
    return undefined;
  }

  /**
   * Attempts to decode a raw packet with the best matching decoder
   */
  public async decodePacket(buffer: Buffer | string, context: GpsPacketContext): Promise<{
    decoder?: GpsProtocolDecoder;
    result: ProtocolDecodeResult;
  }> {
    const decoder = this.findDecoder(buffer, context);
    if (!decoder) {
      return {
        result: {
          success: false,
          positions: [],
          errorMessage: `No matching protocol decoder found for packet (${typeof buffer === 'string' ? buffer.length : buffer.length} bytes)`,
        },
      };
    }

    try {
      const result = await decoder.decode(buffer, context);
      return { decoder, result };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        decoder,
        result: {
          success: false,
          positions: [],
          errorMessage: `Decoder exception for ${decoder.protocol}: ${msg}`,
        },
      };
    }
  }
}

import { Gt06Decoder } from './gt06/decoder.js';
import { Tk103Decoder } from './tk103/decoder.js';
import { Gps103Decoder } from './gps103/decoder.js';
import { EelinkDecoder } from './eelink/decoder.js';
import { CustomJsonDecoder } from './custom/decoder.js';

export const globalProtocolRegistry = new ProtocolRegistry();

// Auto-register built-in protocol decoders
globalProtocolRegistry.register(new Gt06Decoder());
globalProtocolRegistry.register(new Tk103Decoder());
globalProtocolRegistry.register(new Gps103Decoder());
globalProtocolRegistry.register(new EelinkDecoder());
globalProtocolRegistry.register(new CustomJsonDecoder());

