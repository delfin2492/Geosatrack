import { Injectable, Logger } from '@nestjs/common';

export interface TelemetryPayload {
  temperature?: number;
  humidity?: number;
  accel_x?: number;
  accel_y?: number;
  accel_z?: number;
  pitch?: number;
  roll?: number;
  hall_sensor?: number;
  signals?: any;
}

export interface StatusPayload {
  battery_voltage?: number;
  rssi?: number;
  motion?: boolean;
  hop_count?: number;
  update_interval?: number;
  signals?: any;
}

@Injectable()
export class DecoderService {
  private readonly logger = new Logger(DecoderService.name);

  /**
   * Decodes Endpoint 11 (Physical Sensor Telemetry)
   */
  decodeTelemetry(payload: any): TelemetryPayload {
    try {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;

      return {
        temperature: parsed.temperature ?? parsed.temp,
        humidity: parsed.humidity ?? parsed.hum,
        accel_x: parsed.accel_x ?? parsed.acc_x ?? 0,
        accel_y: parsed.accel_y ?? parsed.acc_y ?? 0,
        accel_z: parsed.accel_z ?? parsed.acc_z ?? 1.0,
        pitch: parsed.pitch ?? 0,
        roll: parsed.roll ?? 0,
        hall_sensor: parsed.hall_sensor ?? parsed.hall ?? 0,
        signals: parsed.signals ?? parsed.attributes ?? parsed.rssi_anchors ?? parsed.rssiAnchors ?? null,
      };
    } catch (error) {
      this.logger.error('Failed to decode Endpoint 11 payload:', error);
      return {};
    }
  }

  /**
   * Decodes Endpoint 238 (Node Health Status)
   */
  decodeStatus(payload: any): StatusPayload {
    try {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;

      return {
        battery_voltage: parsed.battery_voltage ?? parsed.battery ?? 3.6,
        rssi: parsed.rssi ?? -70,
        motion: parsed.motion ?? false,
        hop_count: parsed.hop_count ?? parsed.hops ?? 1,
        update_interval: parsed.update_interval ?? 30,
        signals: parsed.signals ?? parsed.attributes ?? parsed.rssi_anchors ?? parsed.rssiAnchors ?? null,
      };
    } catch (error) {
      this.logger.error('Failed to decode Endpoint 238 payload:', error);
      return {};
    }
  }

  /**
   * Evaluates the asset status based on sensor values
   */
  evaluateAssetStatus(
    telemetry: TelemetryPayload,
    statusInfo: StatusPayload,
  ): 'static' | 'moving' | 'tilt_warning' | 'fall_detected' | 'high_vibration' {
    const { accel_x = 0, accel_y = 0, accel_z = 1, pitch = 0, roll = 0 } = telemetry;

    // 1. Check for Fall (Impact detection: total acceleration magnitude > 2.5 G)
    const accelMagnitude = Math.sqrt(accel_x ** 2 + accel_y ** 2 + accel_z ** 2);
    if (accelMagnitude > 2.5) {
      return 'fall_detected';
    }

    // 2. Check for Tilt Warning (Sumbu pitch atau roll miring melebihi 15 derajat)
    if (Math.abs(pitch) > 15 || Math.abs(roll) > 15) {
      return 'tilt_warning';
    }

    // 3. Check for high vibration (Vibration on X & Y axes with low Z-variance)
    const horizontalVibration = Math.sqrt(accel_x ** 2 + accel_y ** 2);
    if (horizontalVibration > 0.4 && statusInfo.motion) {
      return 'high_vibration';
    }

    // 4. Check for active motion
    if (statusInfo.motion || Math.abs(accelMagnitude - 1.0) > 0.15) {
      return 'moving';
    }

    // 5. Default state
    return 'static';
  }
}
