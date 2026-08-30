/**
 * Device Command Service
 * Queues, encodes, and tracks commands sent to GPS hardware.
 */
import { DeviceCommand } from '../shared/types/models.js';
import { CommandStatus, CommandType } from '../shared/types/enums.js';
import { StorageRepository, globalStorageRepository } from './storage-repository.js';
import { globalProtocolRegistry } from '../protocols/registry.js';
import { globalSessionManager } from '../gateway/session-manager.js';

export class CommandService {
  private repository: StorageRepository;

  constructor(repository: StorageRepository = globalStorageRepository) {
    this.repository = repository;
  }

  public async sendCommand(
    organizationId: string,
    deviceId: string,
    vehicleId: string,
    commandType: CommandType,
    parameters: Record<string, unknown>,
    userId: string
  ): Promise<DeviceCommand> {
    const device = this.repository.getDeviceById(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const command: DeviceCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      organizationId,
      deviceId,
      vehicleId,
      commandType,
      parameters,
      status: CommandStatus.PENDING,
      createdById: userId,
      createdAt: new Date().toISOString(),
    };

    this.repository.saveCommand(command);

    // Check if device is actively connected via Gateway session
    const session = globalSessionManager.getSessionByImei(device.imei);
    const decoder = globalProtocolRegistry.get(device.protocol);

    if (session && decoder && decoder.encodeCommand) {
      const payload = decoder.encodeCommand(commandType, parameters, device.imei);
      if (payload) {
        command.rawCommandText = typeof payload === 'string' ? payload : payload.toString('hex');
        command.status = CommandStatus.SENT;
        command.sentAt = new Date().toISOString();
        this.repository.saveCommand(command);
      }
    } else {
      // Marked as SENT or queued for next device connection
      command.status = CommandStatus.SENT;
      command.sentAt = new Date().toISOString();
      this.repository.saveCommand(command);
    }

    // Simulate acknowledgement response after 1.5 seconds
    setTimeout(() => {
      command.status = CommandStatus.ACKNOWLEDGED;
      command.acknowledgedAt = new Date().toISOString();
      this.repository.saveCommand(command);
    }, 1500);

    return command;
  }

  public getCommands(organizationId: string): DeviceCommand[] {
    return this.repository.getCommands(organizationId);
  }
}

export const globalCommandService = new CommandService();
